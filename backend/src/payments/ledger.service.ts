import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SessionFilters, SessionsService } from '../sessions/sessions.service';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { PAYMENT_STATUSES, SESSION_STATUS } from '../common/constants';

export interface LedgerEntry {
  date: Date;
  type: 'water' | 'payment';
  description: string;
  amountPaise: number;
  balancePaise: number;
  refId?: string;
}

@Injectable()
export class LedgerService {
  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    private readonly sessionsService: SessionsService,
  ) {}

  async ledger(customerId: string, tubewellId?: string): Promise<{
    entries: LedgerEntry[];
    totalBilledPaise: number;
    totalPaidPaise: number;
    balancePaise: number;
  }> {
    const filters: SessionFilters = { limit: 1000 };
    if (tubewellId) filters.tubewellId = tubewellId;
    const sessions = await this.sessionsService.listForCustomer(customerId, filters);
    const water = sessions
      .filter((s) => s.status === SESSION_STATUS.COMPLETED && s.finalAmountPaise > 0)
      .map((s) => ({
        date: s.startDatetime,
        type: 'water' as const,
        description: `Water ${s.cropName || 'session'} (${s.durationMinutes ?? 0} min)`,
        amountPaise: s.finalAmountPaise,
        refId: String(s._id),
      }));

    const pq: Record<string, unknown> = {
      customerId: new Types.ObjectId(customerId),
      status: PAYMENT_STATUSES.APPROVED,
    };
    if (tubewellId) pq.tubewellId = new Types.ObjectId(tubewellId);
    const payments = await this.paymentModel.find(pq as any).sort({ paymentDate: 1 }).exec();
    const paymentRows = payments.map((p) => ({
      date: p.paymentDate,
      type: 'payment' as const,
      description: `Payment (${p.paymentMethod})`,
      amountPaise: -p.amountPaise,
      refId: String(p._id),
    }));

    const all = [...water, ...paymentRows].sort((a, b) => a.date.getTime() - b.date.getTime());
    let balance = 0;
    const entries = all.map((e) => {
      balance += e.amountPaise;
      return { ...e, balancePaise: balance };
    });

    const totalBilledPaise = water.reduce((sum, w) => sum + w.amountPaise, 0);
    const totalPaidPaise = payments.reduce((sum, p) => sum + p.amountPaise, 0);
    return { entries, totalBilledPaise, totalPaidPaise, balancePaise: totalBilledPaise - totalPaidPaise };
  }
}