import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, CurrentUser, AuthUser } from '../common/decorators';
import { ROLES } from '../common/constants';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { ReportsService, ReportPeriod } from './reports.service';
import { TubewellsService } from '../tubewells/tubewells.service';
import { SessionsService } from '../sessions/sessions.service';
import { MoneyService } from '../common/money.service';

class ReportQueryDto {
  @IsString()
  tubewellId: string;

  @IsOptional()
  @IsIn(['today', 'week', 'month', 'year', 'custom'])
  period?: ReportPeriod;

  @IsOptional()
  from?: string;

  @IsOptional()
  to?: string;
}

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.TUBEWELL_OWNER, ROLES.OPERATOR)
@Controller('api/tubewell')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly tubewellsService: TubewellsService,
    private readonly sessionsService: SessionsService,
    private readonly money: MoneyService,
  ) {}

  @Get('reports')
  async report(@CurrentUser() user: AuthUser, @Query() query: ReportQueryDto) {
    await this.tubewellsService.ownerMustOwn(query.tubewellId, user.id);
    const result = await this.reportsService.report(
      query.tubewellId,
      query.period || 'today',
      query.from ? new Date(query.from) : undefined,
      query.to ? new Date(query.to) : undefined,
    );
    return {
      ...result,
      totalHours: +this.toHours(result.totalMinutes).toFixed(2),
      amounts: {
        totalBilled: this.money.paiseToRupees(result.totalBilledPaise),
        totalCollected: this.money.paiseToRupees(result.totalCollectedPaise),
        totalPending: this.money.paiseToRupees(result.totalPendingPaise),
      },
    };
  }

  @Get('reports/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('tubewellId') tubewellId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    await this.tubewellsService.ownerMustOwn(tubewellId, user.id);
    const { rows, filename } = await this.reportsService.exportCsv(
      tubewellId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('dashboard')
  async dashboard(@CurrentUser() user: AuthUser, @Query('tubewellId') tubewellId: string) {
    if (!tubewellId) throw new BadRequestException('tubewellId is required');
    const tubewell = await this.tubewellsService.ownerMustOwn(tubewellId, user.id);
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const today = await this.sessionsService.totalsForTubewell(tubewellId, {
      from: todayStart,
      to: todayEnd,
    });
    const running = await this.sessionsService.runningForTubewell(tubewellId);
    const forgotten = await this.sessionsService.flagForgotten(tubewell);
    const customerCount = await this.countApprovedCustomers(tubewellId);

    let customerName: string | null = null;
    if (running) {
      const users = await this.sessionsService.getUsersMap([String(running.customerId)]);
      customerName = users.get(String(running.customerId)) || null;
    }

    return {
      today: {
        totalMinutes: today.totalMinutes,
        totalHours: +this.toHours(today.totalMinutes).toFixed(2),
        totalBilledPaise: today.totalBilledPaise,
        totalCollectedPaise: today.totalCollectedPaise,
        totalPendingPaise: today.totalPendingPaise,
        customers: customerCount,
      },
      running: running
        ? {
            id: String(running._id),
            customerId: String(running.customerId),
            customerName,
            startDatetime: running.startDatetime,
            elapsedMinutes: Math.max(0, Math.round((now.getTime() - running.startDatetime.getTime()) / 60000)),
            ratePerHour: this.money.paiseToRupees(running.ratePerHourPaise),
            warning: forgotten?.warning || null,
          }
        : null,
    };
  }

  @Post('sessions/warn')
  async warn(@CurrentUser() user: AuthUser, @Body('tubewellId') tubewellId: string) {
    await this.tubewellsService.ownerMustOwn(tubewellId, user.id);
    const tubewell = await this.tubewellsService.findByIdOrThrow(tubewellId);
    const forgotten = await this.sessionsService.flagForgotten(tubewell);
    if (!forgotten) return { warned: false };
    return { warned: true, warning: forgotten.warning, sessionId: String(forgotten.session._id) };
  }

  @Get('reports/summary')
  async summary(@CurrentUser() user: AuthUser, @Query('tubewellId') tubewellId: string) {
    await this.tubewellsService.ownerMustOwn(tubewellId, user.id);
    const [daily, monthly, yearly] = await Promise.all([
      this.reportsService.report(tubewellId, 'today'),
      this.reportsService.report(tubewellId, 'month'),
      this.reportsService.report(tubewellId, 'year'),
    ]);
    return {
      daily: this.mapAmounts(daily),
      monthly: this.mapAmounts(monthly),
      yearly: this.mapAmounts(yearly),
    };
  }

  private mapAmounts(r: any) {
    return {
      totalCustomers: r.totalCustomers,
      totalMinutes: r.totalMinutes,
      totalHours: +this.toHours(r.totalMinutes).toFixed(2),
      totalBilledPaise: r.totalBilledPaise,
      totalCollectedPaise: r.totalCollectedPaise,
      totalPendingPaise: r.totalPendingPaise,
      sessionCount: r.sessionCount,
    };
  }

  private toHours(minutes: number): number {
    return minutes / 60;
  }

  private async countApprovedCustomers(tubewellId: string): Promise<number> {
    return this.sessionsService.countApprovedCustomers(tubewellId);
  }
}