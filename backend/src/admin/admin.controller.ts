import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators';
import { ROLES } from '../common/constants';
import { UsersService } from '../users/users.service';
import { TubewellsService } from '../tubewells/tubewells.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Tubewell, TubewellDocument } from '../tubewells/schemas/tubewell.schema';
import { WaterSession, WaterSessionDocument } from '../sessions/schemas/water-session.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { PaymentRequest, PaymentRequestDocument } from '../payments/schemas/payment.schema';
import { MoneyService } from '../common/money.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.ADMIN)
@Controller('api/admin')
export class AdminController {
  constructor(
    private readonly usersService: UsersService,
    private readonly tubewellsService: TubewellsService,
    private readonly money: MoneyService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Tubewell.name) private readonly tubewellModel: Model<TubewellDocument>,
    @InjectModel(WaterSession.name) private readonly sessionModel: Model<WaterSessionDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(PaymentRequest.name)
    private readonly requestModel: Model<PaymentRequestDocument>,
  ) {}

  @Get('stats')
  async stats() {
    const [farmers, owners, tubewells, sessions, sessionAgg, paymentAgg] = await Promise.all([
      this.userModel.countDocuments({ role: ROLES.FARMER }).exec(),
      this.userModel.countDocuments({ role: ROLES.TUBEWELL_OWNER }).exec(),
      this.tubewellModel.countDocuments().exec(),
      this.sessionModel.countDocuments().exec(),
      this.sessionModel.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        {
          $group: {
            _id: null,
            minutes: { $sum: { $ifNull: ['$durationMinutes', 0] } },
            billed: { $sum: { $ifNull: ['$finalAmountPaise', 0] } },
          },
        },
      ]),
      this.paymentModel.aggregate([
        { $match: { status: 'approved' } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            collected: { $sum: { $ifNull: ['$amountPaise', 0] } },
          },
        },
      ]),
    ]);

    const s = sessionAgg[0] || {};
    const p = paymentAgg[0] || {};
    const billed = s.billed || 0;
    const collected = p.collected || 0;

    return {
      farmers,
      owners,
      tubewells,
      totalSessions: sessions,
      totalHours: +((s.minutes || 0) / 60).toFixed(2),
      totalBilledPaise: billed,
      totalCollectedPaise: collected,
      totalPendingPaise: Math.max(0, billed - collected),
      paymentCount: p.count || 0,
    };
  }

  @Get('users')
  async users(
    @Query('role') role?: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const query: Record<string, unknown> = {};
    if (role) query.role = role;
    if (search) {
      const re = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ name: re }, { phone: re }];
    }
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const [items, total] = await Promise.all([
      this.userModel.find(query as any).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).exec(),
      this.userModel.countDocuments(query as any).exec(),
    ]);
    return {
      items: items.map((u) => ({
        id: String(u._id),
        name: u.name,
        phone: u.phone,
        email: u.email || null,
        role: u.role,
        status: u.status,
        phoneVerifiedAt: u.phoneVerifiedAt,
        createdAt: (u as any).createdAt,
      })),
      total,
      page: p,
      limit: l,
    };
  }

  @Post('users/:id/suspend')
  async suspendUser(@Param('id') id: string) {
    const doc = await this.usersService.setStatus(id, 'suspended');
    return { id: String(doc._id), status: doc.status };
  }

  @Post('users/:id/activate')
  async activateUser(@Param('id') id: string) {
    const doc = await this.usersService.setStatus(id, 'active');
    return { id: String(doc._id), status: doc.status };
  }

  @Get('tubewells')
  async tubewells(@Query('search') search?: string, @Query('limit') limit = '50') {
    const query: Record<string, unknown> = {};
    if (search) {
      const re = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ name: re }, { code: re }, { village: re }];
    }
    const docs = await this.tubewellModel
      .find(query as any)
      .sort({ createdAt: -1 })
      .limit(Math.min(200, parseInt(limit, 10)))
      .exec();
    return docs.map((d) => ({
      id: String(d._id),
      name: d.name,
      code: d.code,
      address: d.address,
      village: d.village || null,
      status: d.status,
      ownerId: String(d.ownerId),
      ratePerHour: this.money.paiseToRupees(d.settings?.ratePerHourPaise ?? 0),
      createdAt: (d as any).createdAt,
    }));
  }

  @Post('tubewells/:id/suspend')
  async suspendTubewell(@Param('id') id: string) {
    const doc = await this.tubewellsService.setStatus(id, 'suspended');
    return { id: String(doc._id), status: doc.status };
  }

  @Post('tubewells/:id/activate')
  async activateTubewell(@Param('id') id: string) {
    const doc = await this.tubewellsService.setStatus(id, 'active');
    return { id: String(doc._id), status: doc.status };
  }

  @Get('sessions')
  async sessions(@Query('limit') limit = '100') {
    const docs = await this.sessionModel
      .find({})
      .sort({ createdAt: -1 })
      .limit(Math.min(200, parseInt(limit, 10)))
      .exec();
    return docs.map((s) => ({
      id: String(s._id),
      tubewellId: String(s.tubewellId),
      customerId: String(s.customerId),
      startDatetime: s.startDatetime,
      endDatetime: s.endDatetime || null,
      durationMinutes: s.durationMinutes ?? null,
      finalAmountPaise: s.finalAmountPaise,
      status: s.status,
      paymentStatus: s.paymentStatus,
    }));
  }

  @Get('payments')
  async payments(@Query('limit') limit = '100') {
    const docs = await this.paymentModel
      .find({})
      .sort({ createdAt: -1 })
      .limit(Math.min(200, parseInt(limit, 10)))
      .exec();
    return docs.map((p) => ({
      id: String(p._id),
      tubewellId: String(p.tubewellId),
      customerId: String(p.customerId),
      amountPaise: p.amountPaise,
      paymentMethod: p.paymentMethod,
      status: p.status,
      source: p.source,
      createdAt: (p as any).createdAt,
    }));
  }

  @Get('payment-requests')
  async paymentRequests(@Query('limit') limit = '100') {
    const docs = await this.requestModel
      .find({})
      .sort({ createdAt: -1 })
      .limit(Math.min(200, parseInt(limit, 10)))
      .exec();
    return docs.map((r) => ({
      id: String(r._id),
      tubewellId: String(r.tubewellId),
      customerId: String(r.customerId),
      amountPaise: r.amountPaise,
      status: r.status,
      requestedAt: r.requestedAt,
      approvedAt: r.approvedAt || null,
      rejectedAt: r.rejectedAt || null,
    }));
  }
}