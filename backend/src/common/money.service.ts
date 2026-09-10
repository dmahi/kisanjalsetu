import { Injectable } from '@nestjs/common';

/**
 * All monetary values in the system are stored as integer paise (1 INR = 100 paise).
 * This avoids floating point errors for financial calculations (MongoDB has no DECIMAL).
 */
@Injectable()
export class MoneyService {
  readonly PAISE_PER_RUPEE = 100;

  rupeesToPaise(value: number | string): number {
    if (value === null || value === undefined || value === '') {
      throw new Error('MoneyService: rupees value required');
    }
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (Number.isNaN(num)) {
      throw new Error('MoneyService: invalid rupees value');
    }
    return Math.round(num * this.PAISE_PER_RUPEE);
  }

  paiseToRupees(paise: number): string {
    if (!Number.isFinite(paise)) return '0.00';
    const value = Math.round(paise) / this.PAISE_PER_RUPEE;
    return value.toFixed(2);
  }

  /** Add paise amounts (integers) safely */
  add(...amounts: number[]): number {
    return amounts.reduce((sum, a) => sum + (a || 0), 0);
  }

  subtract(a: number, b: number): number {
    return (a || 0) - (b || 0);
  }

  /**
   * Compute gross amount for a duration (minutes) at a rate (paise per hour).
   * Uses integer arithmetic with a final rounding to the nearest paisa.
   */
  computeGross(durationMinutes: number, ratePerHourPaise: number): number {
    if (durationMinutes < 0) {
      throw new Error('duration cannot be negative');
    }
    if (ratePerHourPaise < 0) {
      throw new Error('rate cannot be negative');
    }
    return Math.round((durationMinutes * ratePerHourPaise) / 60);
  }

  /**
   * Apply discount. Returns the discount amount in paise.
   * - fixed: discountValue is paise directly
   * - percentage: discountValue is percent 0-100, applied against gross
   */
  computeDiscount(
    grossPaise: number,
    discountType: 'fixed' | 'percentage' | null,
    discountValue: number | null,
  ): number {
    if (!discountType || !discountValue || discountValue <= 0) return 0;
    if (discountType === 'fixed') {
      const amount = Math.min(Math.round(discountValue), grossPaise);
      return amount;
    }
    if (discountType === 'percentage') {
      if (discountValue > 100) {
        throw new Error('percentage discount cannot exceed 100');
      }
      const amount = Math.min(Math.round((grossPaise * discountValue) / 100), grossPaise);
      return amount;
    }
    return 0;
  }

  finalAmount(grossPaise: number, discountPaise: number): number {
    return Math.max(0, grossPaise - discountPaise);
  }

  /**
   * Round a raw duration (minutes) to a billable duration based on configured
   * billing interval and rounding type.
   */
  roundDuration(
    rawMinutes: number,
    billingIntervalMinutes: number = 1,
    roundingType: 'up' | 'down' | 'nearest' = 'nearest',
  ): number {
    if (rawMinutes < 0) {
      throw new Error('duration cannot be negative');
    }
    const interval = Math.max(1, Math.round(billingIntervalMinutes || 1));
    if (roundingType === 'up') {
      return Math.ceil(rawMinutes / interval) * interval;
    }
    if (roundingType === 'down') {
      return Math.max(0, Math.floor(rawMinutes / interval) * interval);
    }
    return Math.round(rawMinutes / interval) * interval;
  }

  formatPaiseForDisplay(paise: number): string {
    return `₹${this.paiseToRupees(paise)}`;
  }
}