import { MoneyService } from './money.service';

describe('MoneyService', () => {
  let money: MoneyService;

  beforeEach(() => {
    money = new MoneyService();
  });

  it('converts rupees to paise without float drift', () => {
    expect(money.rupeesToPaise(100)).toBe(10000);
    expect(money.rupeesToPaise('50.25')).toBe(5025);
    expect(money.rupeesToPaise(0.1)).toBe(10);
  });

  it('formats paise back to rupees with two decimals', () => {
    expect(money.paiseToRupees(10000)).toBe('100.00');
    expect(money.paiseToRupees(5025)).toBe('50.25');
    expect(money.paiseToRupees(1)).toBe('0.01');
  });

  it('computes gross amount: 180 minutes @ 100 INR/hr = 30000 paise', () => {
    expect(money.computeGross(180, 10000)).toBe(30000);
  });

  it('computes gross amount: 30 minutes @ 100 INR/hr = 5000 paise', () => {
    expect(money.computeGross(30, 10000)).toBe(5000);
  });

  it('computes gross with odd minute producing fractional paisa (rounded)', () => {
    // 1 minute @ 100 INR/hr = 1.6666 INR => 167 paise
    expect(money.computeGross(1, 10000)).toBe(167);
  });

  it('applies fixed discount', () => {
    expect(money.computeDiscount(50000, 'fixed', 5000)).toBe(5000);
  });

  it('applies percentage discount', () => {
    expect(money.computeDiscount(50000, 'percentage', 10)).toBe(5000);
  });

  it('percentage discount never exceeds gross', () => {
    expect(money.computeDiscount(50000, 'percentage', 99)).toBe(49500);
    expect(() => money.computeDiscount(50000, 'percentage', 150)).toThrow();
  });

  it('final amount never negative', () => {
    expect(money.finalAmount(50000, 60000)).toBe(0);
    expect(money.finalAmount(50000, 0)).toBe(50000);
  });

  it('rounds duration up', () => {
    expect(money.roundDuration(31, 30, 'up')).toBe(60);
    expect(money.roundDuration(30, 30, 'up')).toBe(30);
  });

  it('rounds duration down', () => {
    expect(money.roundDuration(31, 30, 'down')).toBe(30);
    expect(money.roundDuration(29, 30, 'down')).toBe(0);
  });

  it('rounds duration to nearest interval', () => {
    expect(money.roundDuration(14, 15, 'nearest')).toBe(15);
    expect(money.roundDuration(8, 15, 'nearest')).toBe(15);
    expect(money.roundDuration(7, 15, 'nearest')).toBe(0);
  });

  it('supports exact billing (interval 1)', () => {
    expect(money.roundDuration(137, 1, 'nearest')).toBe(137);
  });

  it('rejects negative duration', () => {
    expect(() => money.computeGross(-1, 10000)).toThrow();
  });
});