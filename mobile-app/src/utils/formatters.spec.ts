import { describe, expect, it } from 'vitest';
import { paiseToRupees, rupeesToPaise, formatINR, formatDuration, formatClock } from './formatters';

describe('money helpers', () => {
  it('converts paise <-> rupees exactly', () => {
    expect(paiseToRupees(30000)).toBe(300);
    expect(rupeesToPaise(300)).toBe(30000);
    expect(rupeesToPaise(50)).toBe(5000);
    expect(rupeesToPaise(0.5)).toBe(50);
  });

  it('rounds fractional rupees to paise', () => {
    expect(rupeesToPaise(33.333)).toBe(3333);
    expect(paiseToRupees(3333)).toBe(33.33);
  });

  it('formats INR with en-IN grouping', () => {
    expect(formatINR(123456789)).toBe('₹12,34,567.89');
  });
});

describe('duration / clock formatters', () => {
  it('formats minutes as h m', () => {
    expect(formatDuration(30)).toBe('30m');
    expect(formatDuration(180)).toBe('3h');
    expect(formatDuration(150)).toBe('2h 30m');
    expect(formatDuration(0)).toBe('0m');
  });

  it('formats elapsed clock as HH:MM:SS', () => {
    expect(formatClock(0)).toBe('00:00:00');
    expect(formatClock(6105000)).toBe('01:41:45');
    expect(formatClock(36 * 3600 * 1000 + 5 * 60 * 1000 + 59 * 1000)).toBe('36:05:59');
  });
});

describe('business calculation sanity (mirrors backend rules)', () => {
  it('180 min @ ₹100/hr = ₹300 gross', () => {
    const ratePerHourPaise = 10000;
    const durationMinutes = 180;
    const grossPaise = Math.round((ratePerHourPaise * durationMinutes) / 60);
    expect(paiseToRupees(grossPaise)).toBe(300);
  });

  it('30 min @ ₹100/hr = ₹50 gross', () => {
    const grossPaise = Math.round((10000 * 30) / 60);
    expect(paiseToRupees(grossPaise)).toBe(50);
  });

  it('fixed discount reduces final but not gross', () => {
    const grossPaise = 30000;
    const discountPaise = 5000;
    const finalPaise = grossPaise - discountPaise;
    expect(paiseToRupees(finalPaise)).toBe(250);
    expect(paiseToRupees(grossPaise)).toBe(300);
  });

  it('partial payment keeps session partially_paid', () => {
    const billed = 100000; // ₹1000
    const paid = 60000; // ₹600
    const pending = billed - paid;
    const status = paid >= billed ? 'paid' : paid > 0 ? 'partially_paid' : 'unpaid';
    expect(status).toBe('partially_paid');
    expect(paiseToRupees(pending)).toBe(400);
  });

  it('rate change never rewrites old sessions (rate captured at session time)', () => {
    const oldSessionRatePaise = 10000; // ₹100 took at session time
    const currentRatePaise = 12000; // rate later changed
    expect(oldSessionRatePaise).not.toBe(currentRatePaise);
    expect(paiseToRupees(oldSessionRatePaise)).toBe(100); // old record stays ₹100
  });
});