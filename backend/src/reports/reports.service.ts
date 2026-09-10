import { Injectable } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { WaterSession, WaterSessionDocument } from '../sessions/schemas/water-session.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { PAYMENT_STATUSES, SESSION_STATUS } from '../common/constants';
import { startOfDay } from '../common/helpers/date.util';

export type ReportPeriod = 'today' | 'week' | 'month' | 'year' | 'custom';

@Injectable()
export class ReportsService {
  private readonly tzOffsetMinutes = 330;

  constructor(
    @InjectModel(WaterSession.name)
    private readonly sessionModel: Model<WaterSessionDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  computeRange(period: ReportPeriod, from?: Date, to?: Date): { from: Date; to: Date } {
    const now = new Date();
    let start: Date;
    const end = new Date(now.getTime() + 365 * 86400 * 1000);
    if (period === 'custom') {
      start = from ? new Date(from) : new Date(0);
      return { from: start, to: to ? new Date(to) : end };
    }
    const offset = this.tzOffsetMinutes * 60 * 1000;
    const local = new Date(now.getTime() + offset);
    if (period === 'today') {
      start = startOfDay(now, this.tzOffsetMinutes);
      return { from: start, to: new Date(start.getTime() + 86400 * 1000 - 1) };
    }
    if (period === 'week') {
      const day = (local.getUTCDay() + 6) % 7; // Monday = 0
      const monday = new Date(local.getTime() - day * 86400 * 1000);
      monday.setUTCHours(0, 0, 0, 0);
      start = new Date(monday.getTime() - offset);
    } else if (period === 'month') {
      const first = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1));
      start = new Date(first.getTime() - offset);
    } else {
      const first = new Date(Date.UTC(local.getUTCFullYear(), 0, 1));
      start = new Date(first.getTime() - offset);
    }
    return { from: start, to: end };
  }

  async report(
    tubewellId: string,
    period: ReportPeriod,
    from?: Date,
    to?: Date,
  ): Promise<{
    period: ReportPeriod;
    range: { from: Date; to: Date };
    totalCustomers: number;
    totalMinutes: number;
    totalBilledPaise: number;
    totalCollectedPaise: number;
    totalPendingPaise: number;
    sessionCount: number;
    paymentCount: number;
  }> {
    const range = this.computeRange(period, from, to);
    const tid = new Types.ObjectId(tubewellId);

    const [sessionAgg, paymentAgg, customerCount] = await Promise.all([
      this.sessionModel.aggregate([
        {
          $match: {
            tubewellId: tid,
            status: { $ne: SESSION_STATUS.CANCELLED },
            startDatetime: { $gte: range.from, $lte: range.to },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            minutes: { $sum: { $ifNull: ['$durationMinutes', 0] } },
            billed: { $sum: { $ifNull: ['$finalAmountPaise', 0] } },
          },
        },
      ]),
      this.paymentModel.aggregate([
        {
          $match: {
            tubewellId: tid,
            status: PAYMENT_STATUSES.APPROVED,
            paymentDate: { $gte: range.from, $lte: range.to },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            collected: { $sum: { $ifNull: ['$amountPaise', 0] } },
          },
        },
      ]),
      (this.connection as any).db.collection('tubewellcustomers').countDocuments({
        tubewellId: tid,
        status: 'approved',
      }),
    ]);

    const s = sessionAgg[0] || {};
    const p = paymentAgg[0] || {};
    const billed = s.billed || 0;
    const collected = p.collected || 0;
    return {
      period,
      range,
      totalCustomers: customerCount,
      totalMinutes: s.minutes || 0,
      totalBilledPaise: billed,
      totalCollectedPaise: collected,
      totalPendingPaise: Math.max(0, billed - collected),
      sessionCount: s.count || 0,
      paymentCount: p.count || 0,
    };
  }

  async exportCsv(tubewellId: string, from?: Date, to?: Date): Promise<{ rows: string[][]; filename: string }> {
    const range = this.computeRange('custom', from, to);
    const sessions = await this.sessionModel
      .find({
        tubewellId: new Types.ObjectId(tubewellId),
        status: { $ne: SESSION_STATUS.CANCELLED },
        startDatetime: { $gte: range.from, $lte: range.to },
      })
      .sort({ startDatetime: 1 })
      .exec();

    const header = [
      'Session ID',
      'Start',
      'End',
      'Duration (min)',
      'Rate (INR/hr)',
      'Gross (INR)',
      'Discount (INR)',
      'Final (INR)',
      'Payment Status',
      'Status',
    ];
    const rows = sessions.map((s) => [
      String(s._id),
      s.startDatetime.toISOString(),
      s.endDatetime ? s.endDatetime.toISOString() : '',
      String(s.durationMinutes ?? ''),
      (s.ratePerHourPaise / 100).toFixed(2),
      (s.grossAmountPaise / 100).toFixed(2),
      (s.discountAmountPaise / 100).toFixed(2),
      (s.finalAmountPaise / 100).toFixed(2),
      s.paymentStatus,
      s.status,
    ]);
    rows.unshift(header);
    return { rows, filename: `sessions-${tubewellId}-${Date.now()}.csv` };
  }
}