import { Injectable } from '@nestjs/common';
import { MoneyService } from '../common/money.service';
import { DISCOUNT_TYPE } from '../common/constants';

export interface BillingSettings {
  ratePerHourPaise: number;
}

export interface BillingRequest {
  start: Date;
  end: Date;
  settings: BillingSettings;
  discountType?: 'fixed' | 'percentage' | null;
  discountValue?: number | null;
}

export interface BillingResult {
  durationMinutes: number;
  billableMinutes: number;
  ratePerHourPaise: number;
  grossPaise: number;
  discountPaise: number;
  discountValue: number | null;
  discountType: 'fixed' | 'percentage' | null;
  finalPaise: number;
}

@Injectable()
export class BillingService {
  constructor(private readonly money: MoneyService) {}

  compute(request: BillingRequest): BillingResult {
    const durationMinutes = Math.round((request.end.getTime() - request.start.getTime()) / 60000);
    if (durationMinutes < 0) {
      throw new Error('End time must be after start time');
    }
    const billableMinutes = durationMinutes;

    const ratePerHourPaise = request.settings.ratePerHourPaise;
    const grossPaise = this.money.computeGross(billableMinutes, ratePerHourPaise);
    const discountPaise = this.money.computeDiscount(
      grossPaise,
      request.discountType as 'fixed' | 'percentage' | null,
      request.discountValue ?? null,
    );
    const finalPaise = this.money.finalAmount(grossPaise, discountPaise);

    return {
      durationMinutes,
      billableMinutes,
      ratePerHourPaise,
      grossPaise,
      discountPaise,
      discountValue: request.discountValue ?? null,
      discountType: request.discountType || null,
      finalPaise,
    };
  }
}