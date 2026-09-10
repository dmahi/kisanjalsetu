import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, CurrentUser, AuthUser } from '../common/decorators';
import { ROLES } from '../common/constants';
import { SessionsService, SessionFilters } from './sessions.service';
import {
  ManualSessionDto,
  SessionFiltersQueryDto,
  StartSessionDto,
  StopSessionDto,
  UpdateSessionDto,
  CustomerStartSessionDto,
} from './dto/session.dto';
import { TubewellsService } from '../tubewells/tubewells.service';
import { UsersService } from '../users/users.service';
import { FieldsService } from '../fields/fields.service';
import { MoneyService } from '../common/money.service';

@ApiTags('tubewell-sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.TUBEWELL_OWNER, ROLES.OPERATOR)
@Controller('api/tubewell/water-sessions')
export class OwnerSessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly tubewellsService: TubewellsService,
    private readonly usersService: UsersService,
    private readonly money: MoneyService,
  ) {}

  private async presenter(session: any) {
    const customer = await this.usersService.findById(String(session.customerId));
    const tubewell = await this.tubewellsService.findById(String(session.tubewellId));
    return this.serialize(session, tubewell?.name || null, customer?.name || null, customer?.phone || null);
  }

  serialize(session: any, tubewellName?: string | null, customerName?: string | null, customerPhone?: string | null) {
    return {
      id: String(session._id),
      tubewellId: String(session.tubewellId),
      tubewellName: tubewellName || null,
      customerId: String(session.customerId),
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      fieldId: session.fieldId ? String(session.fieldId) : null,
      cropId: session.cropId ? String(session.cropId) : null,
      cropName: session.cropName || null,
      startDatetime: session.startDatetime,
      endDatetime: session.endDatetime || null,
      durationMinutes: session.durationMinutes ?? null,
      billableMinutes: session.billableMinutes ?? null,
      ratePerHourPaise: session.ratePerHourPaise,
      grossAmountPaise: session.grossAmountPaise,
      discountAmountPaise: session.discountAmountPaise,
      discountType: session.discountType || null,
      discountValue: session.discountValue ?? null,
      discountReason: session.discountReason || null,
      finalAmountPaise: session.finalAmountPaise,
      status: session.status,
      paymentStatus: session.paymentStatus,
      paidAmountPaise: session.paidAmountPaise || 0,
      completedAt: session.completedAt || null,
      createdAt: session.createdAt,
    };
  }

  @Post('start')
  async start(@CurrentUser() user: AuthUser, @Body() dto: StartSessionDto) {
    const session = await this.sessionsService.start(user.id, {
      ...dto,
      startDatetime: dto.startDatetime ? new Date(dto.startDatetime) : undefined,
    });
    return this.presenter(session);
  }

  @Post(':id/stop')
  async stop(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: StopSessionDto) {
    const session = await this.sessionsService.stop(user.id, id, dto.endDatetime ? new Date(dto.endDatetime) : undefined);
    return this.presenter(session);
  }

  @Post('manual')
  async manual(@CurrentUser() user: AuthUser, @Body() dto: ManualSessionDto) {
    const session = await this.sessionsService.createManual(user.id, {
      ...dto,
      startDatetime: new Date(dto.startDatetime),
      endDatetime: new Date(dto.endDatetime),
    });
    return this.presenter(session);
  }

  @Put(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateSessionDto) {
    const session = await this.sessionsService.update(user.id, id, {
      ...dto,
      startDatetime: dto.startDatetime ? new Date(dto.startDatetime) : undefined,
      endDatetime: dto.endDatetime ? new Date(dto.endDatetime) : undefined,
    });
    return this.presenter(session);
  }

  @Post(':id/cancel')
  async cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const session = await this.sessionsService.cancel(user.id, id);
    return this.presenter(session);
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('tubewellId') tubewellId: string,
    @Query() filters: SessionFiltersQueryDto,
  ) {
    if (!tubewellId) throw new BadRequestException('tubewellId query parameter is required');
    await this.tubewellsService.ownerMustOwn(tubewellId, user.id);
    const sessions = await this.sessionsService.listForOwner(tubewellId, this.toFilters(filters));
    const out: any[] = [];
    for (const s of sessions) out.push(await this.presenter(s));
    return out;
  }

  private toFilters(filters: SessionFiltersQueryDto): SessionFilters {
    return {
      customerId: filters.customerId,
      fieldId: filters.fieldId,
      cropId: filters.cropId,
      paymentStatus: filters.paymentStatus,
      from: filters.from ? new Date(filters.from) : undefined,
      to: filters.to ? new Date(filters.to) : undefined,
    };
  }
}

@ApiTags('customer-sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.FARMER)
@Controller('api/customer/water-sessions')
export class CustomerSessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly tubewellsService: TubewellsService,
    private readonly fieldsService: FieldsService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('tubewellId') tubewellId?: string,
    @Query() filters: SessionFiltersQueryDto = {},
  ) {
    if (tubewellId) {
      await this.tubewellsService.verifyApprovedMembership(tubewellId, user.id);
    }
    const sessions = await this.sessionsService.listForCustomer(user.id, {
      ...this.toFilters(filters),
      tubewellId,
    });
    const out: any[] = [];
    for (const s of sessions) {
      const tubewell = await this.tubewellsService.findById(String(s.tubewellId));
      out.push(await this.customerPresenter(s, user.id, tubewell?.name || null));
    }
    return out;
  }

  @Post('start')
  async start(@CurrentUser() user: AuthUser, @Body() dto: CustomerStartSessionDto) {
    const session = await this.sessionsService.startForCustomer(user.id, dto);
    const tubewell = await this.tubewellsService.findById(dto.tubewellId);
    return this.customerPresenter(session, user.id, tubewell?.name || null);
  }

  @Post(':id/stop')
  async stop(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: StopSessionDto) {
    const session = await this.sessionsService.stopForCustomer(
      user.id,
      id,
      dto.endDatetime ? new Date(dto.endDatetime) : undefined,
    );
    const tubewell = await this.tubewellsService.findById(String(session.tubewellId));
    return this.customerPresenter(session, user.id, tubewell?.name || null);
  }

  private async customerPresenter(session: any, customerId: string, tubewellName?: string | null) {
    let fieldName: string | null = null;
    if (session.fieldId) {
      const field = await this.fieldsService.findByIdForCustomer(customerId, String(session.fieldId));
      fieldName = field?.name ?? null;
    }
    return {
      id: String(session._id),
      tubewellId: String(session.tubewellId),
      tubewellName: tubewellName || null,
      fieldId: session.fieldId ? String(session.fieldId) : null,
      fieldName,
      cropId: session.cropId ? String(session.cropId) : null,
      cropName: session.cropName || null,
      startDatetime: session.startDatetime,
      endDatetime: session.endDatetime || null,
      durationMinutes: session.durationMinutes ?? null,
      billableMinutes: session.billableMinutes ?? null,
      ratePerHourPaise: session.ratePerHourPaise,
      grossAmountPaise: session.grossAmountPaise,
      discountAmountPaise: session.discountAmountPaise,
      discountType: session.discountType || null,
      discountValue: session.discountValue ?? null,
      finalAmountPaise: session.finalAmountPaise,
      status: session.status,
      paymentStatus: session.paymentStatus,
      paidAmountPaise: session.paidAmountPaise || 0,
      createdAt: (session as any).createdAt,
    };
  }

  private toFilters(filters: SessionFiltersQueryDto): SessionFilters {
    return {
      fieldId: filters.fieldId,
      cropId: filters.cropId,
      paymentStatus: filters.paymentStatus,
      from: filters.from ? new Date(filters.from) : undefined,
      to: filters.to ? new Date(filters.to) : undefined,
    };
  }
}