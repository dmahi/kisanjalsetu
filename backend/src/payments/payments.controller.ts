import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, CurrentUser, AuthUser } from '../common/decorators';
import { ROLES } from '../common/constants';
import { IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaymentsService } from './payments.service';
import { LedgerService } from './ledger.service';
import { TubewellsService } from '../tubewells/tubewells.service';
import { UsersService } from '../users/users.service';
import { SessionsService } from '../sessions/sessions.service';
import { MoneyService } from '../common/money.service';
import { Type } from 'class-transformer';

class CreatePaymentRequestDto {
  @IsMongoId()
  tubewellId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amountPaise: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

class RecordPaymentDto {
  @IsMongoId()
  tubewellId: string;

  @IsMongoId()
  customerId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amountPaise: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

@ApiTags('customer-payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.FARMER)
@Controller('api/customer')
export class CustomerPaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly ledgerService: LedgerService,
    private readonly sessionsService: SessionsService,
    private readonly tubewellsService: TubewellsService,
    private readonly money: MoneyService,
  ) {}

  @Get('ledger')
  async ledger(@CurrentUser() user: AuthUser, @Query('tubewellId') tubewellId?: string) {
    if (tubewellId) await this.tubewellsService.verifyApprovedMembership(tubewellId, user.id);
    const result = await this.ledgerService.ledger(user.id, tubewellId);
    return {
      entries: result.entries.map((e) => ({
        date: e.date,
        type: e.type,
        description: e.description,
        amountPaise: e.amountPaise,
        balancePaise: e.balancePaise,
        refId: e.refId || null,
      })),
      totals: {
        totalBilledPaise: result.totalBilledPaise,
        totalPaidPaise: result.totalPaidPaise,
        balancePaise: result.balancePaise,
      },
    };
  }

  @Get('payments')
  async payments(@CurrentUser() user: AuthUser, @Query('tubewellId') tubewellId?: string) {
    if (tubewellId) await this.tubewellsService.verifyApprovedMembership(tubewellId, user.id);
    const items = await this.paymentsService.listForCustomer(user.id, tubewellId);
    return items.map((p) => ({
      id: String(p._id),
      tubewellId: String(p.tubewellId),
      amountPaise: p.amountPaise,
      paymentMethod: p.paymentMethod,
      paymentDate: p.paymentDate,
      referenceNumber: p.referenceNumber || null,
      notes: p.notes || null,
      status: p.status,
      source: p.source,
      allocations: (p.allocations || []).map((a) => ({
        waterSessionId: String(a.waterSessionId),
        amountPaise: a.amountPaise,
      })),
      createdAt: (p as any).createdAt,
    }));
  }

  @Get('payment-requests')
  async myRequests(@CurrentUser() user: AuthUser, @Query('tubewellId') tubewellId?: string) {
    if (tubewellId) await this.tubewellsService.verifyApprovedMembership(tubewellId, user.id);
    const items = await this.paymentsService.listPaymentRequestsForCustomer(user.id, tubewellId);
    return this.serializeRequests(items);
  }

  @Post('payment-requests')
  async createRequest(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentRequestDto) {
    const doc = await this.paymentsService.createPaymentRequest(user.id, dto);
    return this.serializeRequests([doc])[0];
  }

  @Get('dashboard')
  async dashboard(@CurrentUser() user: AuthUser, @Query('tubewellId') tubewellId?: string) {
    if (!tubewellId) throw new BadRequestException('tubewellId is required');
    await this.tubewellsService.verifyApprovedMembership(tubewellId, user.id);
    const totals = await this.sessionsService.totalsForCustomerForTubewell(user.id, tubewellId);
    const paid = await this.paymentsService.totalsForCustomerTubewell(user.id, tubewellId);
    const tubewell = await this.tubewellsService.findById(tubewellId);
    return {
      totals: {
        totalMinutes: totals.totalMinutes,
        totalBilledPaise: totals.totalBilledPaise,
        totalPaidPaise: paid.totalPaidPaise,
        totalPendingPaise: Math.max(0, totals.totalBilledPaise - paid.totalPaidPaise),
      },
      tubewell: {
        id: String(tubewell?._id),
        name: tubewell?.name,
        ratePerHour: this.money.paiseToRupees(tubewell?.settings?.ratePerHourPaise ?? 0),
      },
    };
  }

  private serializeRequests(items: any[]) {
    return items.map((r) => ({
      id: String(r._id),
      tubewellId: String(r.tubewellId),
      amountPaise: r.amountPaise,
      notes: r.notes || null,
      status: r.status,
      requestedAt: r.requestedAt,
      approvedAt: r.approvedAt || null,
      rejectedAt: r.rejectedAt || null,
    }));
  }
}

@ApiTags('tubewell-payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.TUBEWELL_OWNER, ROLES.OPERATOR)
@Controller('api/tubewell')
export class OwnerPaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly tubewellsService: TubewellsService,
    private readonly usersService: UsersService,
    private readonly money: MoneyService,
  ) {}

  @Get('payments')
  async payments(@CurrentUser() user: AuthUser, @Query('tubewellId') tubewellId: string) {
    if (!tubewellId) throw new BadRequestException('tubewellId is required');
    await this.tubewellsService.ownerMustOwn(tubewellId, user.id);
    const items = await this.paymentsService.listForOwner(tubewellId);
    const out: any[] = [];
    for (const p of items) {
      const c = await this.usersService.findById(String(p.customerId));
      out.push({
        id: String(p._id),
        customerId: String(p.customerId),
        customerName: c?.name || null,
        amountPaise: p.amountPaise,
        paymentMethod: p.paymentMethod,
        paymentDate: p.paymentDate,
        referenceNumber: p.referenceNumber || null,
        notes: p.notes || null,
        status: p.status,
        source: p.source,
        allocations: (p.allocations || []).map((a) => ({
          waterSessionId: String(a.waterSessionId),
          amountPaise: a.amountPaise,
        })),
      });
    }
    return out;
  }

  @Post('payments/record')
  async record(@CurrentUser() user: AuthUser, @Body() dto: RecordPaymentDto) {
    const doc = await this.paymentsService.recordPayment(user.id, {
      ...dto,
      paymentDate: new Date(),
      source: 'manual',
    });
    return { id: String(doc._id), amountPaise: doc.amountPaise, status: doc.status };
  }

  @Get('payment-requests')
  async requests(@CurrentUser() user: AuthUser, @Query('tubewellId') tubewellId: string, @Query('status') status?: string) {
    if (!tubewellId) throw new BadRequestException('tubewellId is required');
    await this.tubewellsService.ownerMustOwn(tubewellId, user.id);
    const items = await this.paymentsService.listPaymentRequestsForOwner(tubewellId, status);
    const out: any[] = [];
    for (const r of items) {
      const c = await this.usersService.findById(String(r.customerId));
      out.push({
        id: String(r._id),
        customerId: String(r.customerId),
        customerName: c?.name || null,
        customerPhone: c?.phone || null,
        tubewellId: String(r.tubewellId),
        amountPaise: r.amountPaise,
        notes: r.notes || null,
        status: r.status,
        requestedAt: r.requestedAt,
        approvedAt: r.approvedAt || null,
        rejectedAt: r.rejectedAt || null,
      });
    }
    return out;
  }

  @Post('payment-requests/:id/approve')
  async approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const req = await this.paymentsService.approvePaymentRequest(user.id, id);
    return { id: String(req._id), status: req.status };
  }

  @Post('payment-requests/:id/reject')
  async reject(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const req = await this.paymentsService.rejectPaymentRequest(user.id, id);
    return { id: String(req._id), status: req.status };
  }
}