import { computeMonth, netPayable } from '../lib/services/payrollMath';

const att = (present: number, half: number, leave: number) => [
  ...Array(present).fill({ status: 'present' }),
  ...Array(half).fill({ status: 'half_day' }),
  ...Array(leave).fill({ status: 'leave' }),
];

describe('computeMonth', () => {
  it('per_day: rate × (present + half×0.5)', () => {
    const r = computeMonth({ type: 'per_day', perDayRate: 700 }, att(26, 2, 2), '2026-07');
    expect(r.daysPresent).toBe(26);
    expect(r.halfDays).toBe(2);
    expect(r.leaves).toBe(2);
    expect(r.baseAmount).toBe(700 * 27); // 26 + 1
  });

  it('monthly: pro-rata on effective days over days-in-month', () => {
    // July has 31 days; 26 present + 2 half = 27 effective
    const r = computeMonth({ type: 'monthly', monthlyBase: 18000 }, att(26, 2, 2), '2026-07');
    expect(r.baseAmount).toBe(Math.round(18000 * 27 / 31));
  });

  it('monthly: full attendance caps at full base', () => {
    const r = computeMonth({ type: 'monthly', monthlyBase: 18000 }, att(31, 0, 0), '2026-07');
    expect(r.baseAmount).toBe(18000);
  });

  it('handles February month lengths', () => {
    const r = computeMonth({ type: 'monthly', monthlyBase: 28000 }, att(28, 0, 0), '2026-02');
    expect(r.baseAmount).toBe(28000); // Feb 2026 has 28 days
  });

  it('zero attendance pays zero', () => {
    expect(computeMonth({ type: 'monthly', monthlyBase: 18000 }, [], '2026-07').baseAmount).toBe(0);
    expect(computeMonth({ type: 'per_day', perDayRate: 700 }, [], '2026-07').baseAmount).toBe(0);
  });
});

describe('netPayable', () => {
  it('subtracts advances and deductions, floors at zero', () => {
    expect(netPayable(18000, [{ amount: 2000, date: '2026-07-05' }], [{ amount: 500, date: '2026-07-20', note: 'damage' }])).toBe(15500);
    expect(netPayable(1000, [{ amount: 2000, date: '2026-07-05' }], [])).toBe(0);
  });
});
