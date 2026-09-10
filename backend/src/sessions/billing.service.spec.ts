import { BillingService } from './billing.service';
import { MoneyService } from '../common/money.service';

describe('BillingService', () => {
  let billing: BillingService;

  beforeEach(() => {
    billing = new BillingService(new MoneyService());
  });

  const settings = { ratePerHourPaise: 10000 }; // 100 INR / hr

  it('bills the worked example: 3 hours @ 100 = 300', () => {
    const res = billing.compute({
      start: new Date('2026-09-09T04:30:00Z'),
      end: new Date('2026-09-09T07:30:00Z'),
      settings,
    });
    expect(res.durationMinutes).toBe(180);
    expect(res.billableMinutes).toBe(180);
    expect(res.grossPaise).toBe(30000);
    expect(res.finalPaise).toBe(30000);
  });

  it('bills 30 minutes @ 100 = 50', () => {
    const res = billing.compute({
      start: new Date('2026-09-09T07:30:00Z'),
      end: new Date('2026-09-09T08:00:00Z'),
      settings,
    });
    expect(res.grossPaise).toBe(5000);
  });

  it('applies fixed discount and preserves gross', () => {
    const res = billing.compute({
      start: new Date('2026-09-09T04:30:00Z'),
      end: new Date('2026-09-09T07:30:00Z'),
      settings,
      discountType: 'fixed',
      discountValue: 5000,
    });
    expect(res.grossPaise).toBe(30000);
    expect(res.discountPaise).toBe(5000);
    expect(res.finalPaise).toBe(25000);
  });

  it('applies percentage discount', () => {
    const res = billing.compute({
      start: new Date('2026-09-09T04:30:00Z'),
      end: new Date('2026-09-09T07:30:00Z'),
      settings,
      discountType: 'percentage',
      discountValue: 10,
    });
    expect(res.grossPaise).toBe(30000);
    expect(res.discountPaise).toBe(3000);
    expect(res.finalPaise).toBe(27000);
  });

  it('bills exact minutes with no minimum duration', () => {
    const res = billing.compute({
      start: new Date('2026-09-09T04:30:00Z'),
      end: new Date('2026-09-09T05:00:00Z'),
      settings: { ...settings, ratePerHourPaise: 10000 },
    });
    expect(res.durationMinutes).toBe(30);
    expect(res.billableMinutes).toBe(30);
    expect(res.grossPaise).toBe(5000);
  });

  it('bills partial minutes exactly (no blocks)', () => {
    const res = billing.compute({
      start: new Date('2026-09-09T04:31:00Z'),
      end: new Date('2026-09-09T04:52:00Z'),
      settings: { ...settings, ratePerHourPaise: 10000 },
    });
    expect(res.durationMinutes).toBe(21);
    expect(res.billableMinutes).toBe(21);
    expect(res.grossPaise).toBe(3500);
  });

  it('rejects end before start', () => {
    expect(() =>
      billing.compute({
        start: new Date('2026-09-09T08:00:00Z'),
        end: new Date('2026-09-09T07:00:00Z'),
        settings,
      }),
    ).toThrow();
  });
});