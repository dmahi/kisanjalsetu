import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Payment, PaymentDocument, PaymentRequest, PaymentRequestDocument } from './schemas/payment.schema';
import { SessionsService } from '../sessions/sessions.service';
import { TubewellsService } from '../tubewells/tubewells.service';
import { UsersService } from '../users/users.service';
import { MoneyService } from '../common/money.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PAYMENT_REQUEST_STATUS, PAYMENT_STATUSES } from '../common/constants';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(PaymentRequest.name)
    private readonly requestModel: Model<PaymentRequestDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly sessionsService: SessionsService,
    private readonly tubewellsService: TubewellsService,
    private readonly usersService: UsersService,
    private readonly money: MoneyService,
    private readonly logsService: ActivityLogsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Customer creates a "Mark as Paid" request. NOT approved automatically. */
  async createPaymentRequest(
    customerId: string,
    dto: { tubewellId: string; amountPaise: number; notes?: string; idempotencyKey?: string },
  ): Promise<PaymentRequestDocument> {
    if (!dto.amountPaise || dto.amountPaise <= 0) {
      throw new BadRequestException('Amount must be positive');
    }
    await this.tubewellsService.verifyApprovedMembership(dto.tubewellId, customerId);

    if (dto.idempotencyKey) {
      const existing = await this.requestModel.findOne({ idempotencyKey: dto.idempotencyKey }).exec();
      if (existing) return existing;
    }

    const doc = await this.requestModel.create({
      tubewellId: new Types.ObjectId(dto.tubewellId),
      customerId: new Types.ObjectId(customerId),
      amountPaise: Math.round(dto.amountPaise),
      notes: dto.notes || null,
      status: PAYMENT_REQUEST_STATUS.PENDING,
      idempotencyKey: dto.idempotencyKey || undefined,
    });

    const tubewell = await this.tubewellsService.findById(dto.tubewellId);
    const farmer = await this.usersService.findById(customerId);
    await this.notificationsService.create({
      userId: String(tubewell?.ownerId),
      title: 'Payment request received',
      body: `${farmer?.name || 'A farmer'} has requested payment confirmation of ₹${this.money.paiseToRupees(dto.amountPaise)}`,
      type: 'payment_request',
      data: { requestId: String(doc._id), tubewellId: dto.tubewellId },
    });
    return doc;
  }

  async listPaymentRequestsForCustomer(customerId: string, tubewellId?: string): Promise<PaymentRequestDocument[]> {
    const query: Record<string, unknown> = { customerId: new Types.ObjectId(customerId) };
    if (tubewellId) query.tubewellId = new Types.ObjectId(tubewellId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.requestModel.find(query as any).sort({ createdAt: -1 }).exec();
  }

  async listPaymentRequestsForOwner(tubewellId: string, status?: string): Promise<PaymentRequestDocument[]> {
    const query: Record<string, unknown> = { tubewellId: new Types.ObjectId(tubewellId) };
    if (status) query.status = status;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.requestModel.find(query as any).sort({ requestedAt: -1 }).exec();
  }

  async approvePaymentRequest(ownerId: string, requestId: string): Promise<PaymentRequestDocument> {
    const req = await this.requestModel.findById(requestId).exec();
    if (!req) throw new NotFoundException('Payment request not found');
    await this.tubewellsService.ownerMustOwn(String(req.tubewellId), ownerId);
    if (req.status !== PAYMENT_REQUEST_STATUS.PENDING) {
      throw new ConflictException('Request already processed');
    }

    const payment = await this.recordPayment(ownerId, {
      tubewellId: String(req.tubewellId),
      customerId: String(req.customerId),
      amountPaise: req.amountPaise,
      paymentMethod: 'cash',
      source: 'payment_request',
      paymentRequestId: requestId,
    });

    req.status = PAYMENT_REQUEST_STATUS.APPROVED;
    req.approvedAt = new Date();
    req.processedBy = new Types.ObjectId(ownerId);
    await req.save();

    await this.logsService.create({
      userId: ownerId,
      action: 'payment_approved',
      entityType: 'payment',
      entityId: String(payment._id),
      newValues: { amountPaise: payment.amountPaise },
      description: 'Approved payment request and recorded payment',
    });

    await this.notificationsService.create({
      userId: String(req.customerId),
      title: 'Payment approved',
      body: `Your payment of ₹${this.money.paiseToRupees(req.amountPaise)} has been confirmed`,
      type: 'payment_approved',
      data: { paymentId: String(payment._id), requestId: String(req._id) },
    });

    return req;
  }

  async rejectPaymentRequest(ownerId: string, requestId: string): Promise<PaymentRequestDocument> {
    const req = await this.requestModel.findById(requestId).exec();
    if (!req) throw new NotFoundException('Payment request not found');
    await this.tubewellsService.ownerMustOwn(String(req.tubewellId), ownerId);
    if (req.status !== PAYMENT_REQUEST_STATUS.PENDING) {
      throw new ConflictException('Request already processed');
    }
    req.status = PAYMENT_REQUEST_STATUS.REJECTED;
    req.rejectedAt = new Date();
    req.processedBy = new Types.ObjectId(ownerId);
    await req.save();

    await this.logsService.create({
      userId: ownerId,
      action: 'payment_rejected',
      entityType: 'payment_request',
      entityId: String(req._id),
      description: 'Rejected farmer payment request',
    });

    await this.notificationsService.create({
      userId: String(req.customerId),
      title: 'Payment not approved',
      body: `Your payment request of ₹${this.money.paiseToRupees(req.amountPaise)} was not approved. Please contact the tubewell.`,
      type: 'payment_rejected',
      data: { requestId: String(req._id) },
    });

    return req;
  }

  /** Owner records a real cash/UPI payment (manual). */
  async recordPayment(
    ownerId: string,
    dto: {
      tubewellId: string;
      customerId: string;
      amountPaise: number;
      paymentMethod?: string;
      paymentDate?: Date;
      referenceNumber?: string;
      notes?: string;
      source?: 'manual' | 'payment_request';
      paymentRequestId?: string;
      idempotencyKey?: string;
    },
  ): Promise<PaymentDocument> {
    await this.tubewellsService.ownerMustOwn(dto.tubewellId, ownerId);
    if (!dto.amountPaise || dto.amountPaise <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const session = await this.connection.startSession();
    try {
      let result: PaymentDocument | null = null;
      await session.withTransaction(async () => {
        if (dto.idempotencyKey) {
          const existing = await this.paymentModel.findOne({ idempotencyKey: dto.idempotencyKey }).session(session).exec();
          if (existing) {
            result = existing;
            return;
          }
        }
        const payment = await this.paymentModel.create(
          [
            {
              tubewellId: new Types.ObjectId(dto.tubewellId),
              customerId: new Types.ObjectId(dto.customerId),
              amountPaise: Math.round(dto.amountPaise),
              paymentMethod: dto.paymentMethod || 'manual',
              paymentDate: dto.paymentDate || new Date(),
              referenceNumber: dto.referenceNumber || null,
              notes: dto.notes || null,
              status: PAYMENT_STATUSES.APPROVED,
              approvedAt: new Date(),
              approvedBy: new Types.ObjectId(ownerId),
              createdBy: new Types.ObjectId(ownerId),
              source: dto.source || 'manual',
              paymentRequestId: dto.paymentRequestId ? new Types.ObjectId(dto.paymentRequestId) : undefined,
              idempotencyKey: dto.idempotencyKey || undefined,
            },
          ],
          { session },
        );
        await this.allocate(dto.tubewellId, dto.customerId, payment[0].amountPaise, payment[0], session);
        result = payment[0];
      });
      if (!result) throw new BadRequestException('Unable to record payment');
      return result;
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException('Duplicate payment detected');
      throw err;
    } finally {
      await session.endSession();
    }
  }

  private async allocate(
    tubewellId: string,
    customerId: string,
    amountPaise: number,
    payment: PaymentDocument,
    session: any,
  ): Promise<void> {
    let remaining = amountPaise;
    const unpaid = await this.sessionsService.listForCustomer(customerId, {
      tubewellId,
      status: 'completed',
      limit: 500,
    });
    const sorted = unpaid
      .filter((s) => s.paymentStatus !== 'paid' && s.finalAmountPaise > 0 && !s.runningLock)
      .sort((a, b) => a.startDatetime.getTime() - b.startDatetime.getTime());

    for (const sess of sorted) {
      if (remaining <= 0) break;
      const outstanding = sess.finalAmountPaise - (sess.paidAmountPaise || 0);
      if (outstanding <= 0) continue;
      const alloc = Math.min(outstanding, remaining);
      payment.allocations.push({ waterSessionId: sess._id, amountPaise: alloc });
      await this.sessionsService.applyPayment(String(sess._id), alloc, session);
      remaining -= alloc;
    }
    if (remaining > 0) {
      // partial over-payment just stays on the payment record / shown as credit
    }
    await payment.save({ session });
  }

  async listForOwner(tubewellId: string): Promise<PaymentDocument[]> {
    return this.paymentModel
      .find({ tubewellId: new Types.ObjectId(tubewellId) })
      .sort({ paymentDate: -1 })
      .limit(200)
      .exec();
  }

  async listForCustomer(customerId: string, tubewellId?: string): Promise<PaymentDocument[]> {
    const query: Record<string, unknown> = { customerId: new Types.ObjectId(customerId) };
    if (tubewellId) query.tubewellId = new Types.ObjectId(tubewellId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.paymentModel.find(query as any).sort({ paymentDate: -1 }).limit(200).exec();
  }

  async totalsForCustomerTubewell(customerId: string, tubewellId: string): Promise<{ totalPaidPaise: number }> {
    const res = await this.paymentModel.aggregate([
      {
        $match: {
          customerId: new Types.ObjectId(customerId),
          tubewellId: new Types.ObjectId(tubewellId),
          status: PAYMENT_STATUSES.APPROVED,
        },
      },
      { $group: { _id: null, total: { $sum: '$amountPaise' } } },
    ]);
    return { totalPaidPaise: res[0]?.total || 0 };
  }
}