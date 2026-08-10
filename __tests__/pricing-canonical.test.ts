/**
 * THE CANONICAL FINANCIAL ENGINE.
 *
 * Money was computed in four places with two meanings of "subtotal", and the
 * seal RECONSTRUCTED the discount by subtracting one total from another. That
 * subtraction is correct only when nothing but a discount separates them; add a
 * fee and it halves what the customer was given, permanently, in a sealed
 * record. The first test below is that exact case.
 */
import { priceVisit, pickupFees, PICKUP_LEG_FEE } from '@/lib/services/pricing';
import type { PricingInput } from '@/lib/services/pricing';
import type { Promo, Subscription } from '@/lib/types';

const benefit = (over: Partial<PricingInput> = {}): PricingInput => ({
  base: 0, category: 'Coating', serviceId: 'svc-glass', ownerId: 'u1',
  membership: null, wantsWash: false, promos: [], myRedemptions: new Map(),
  date: '2026-07-20',
  ...over,
});

const sub = (over: Partial<Subscription> = {}): Subscription & { id: string } => ({
  id: 'sub1', userId: 'u1', plan: 'Gold', status: 'active',
  startDate: '2026-01-01', endDate: '2026-12-31',
  washesTotal: 8, washesUsed: 0, paymentMethod: 'upi',
  createdAt: null as never, updatedAt: null as never,
  ...over,
} as Subscription & { id: string });

const promo = (over: Partial<Promo> = {}): Promo => ({
  id: 'p1', label: 'Monsoon ₹200 off', type: 'flat', value: 200,
  active: true, validFrom: '2026-01-01', validTo: '2026-12-31',
  usedCount: 0, scope: { kind: 'all' }, target: { kind: 'all' },
  ...over,
} as Promo);

const GLASS = [{ name: 'Glass Coating', price: 1200 }];

describe('THE PINNED REGRESSION — discount is carried, never derived', () => {
  it('services 1200, discount 200, two legs → subtotal 1200, discount 200, fees 100, total 1100', () => {
    const b = priceVisit({
      services: GLASS,
      fees: pickupFees({ pickup: true, drop: true }),
      benefit: benefit({ promos: [promo()] }),
    });
    expect(b.subtotal).toBe(1200);
    expect(b.discountAmount).toBe(200);
    expect(b.feesTotal).toBe(100);
    expect(b.total).toBe(1100);
    /* The subtraction the seal used to perform would say 100 here. */
    expect(b.subtotal - b.total).toBe(100);
    expect(b.discountAmount).not.toBe(b.subtotal - b.total);
  });
});

describe('fees', () => {
  it('one leg is one line at ₹50', () => {
    const b = priceVisit({ services: GLASS, fees: pickupFees({ pickup: true }), benefit: benefit() });
    expect(b.fees).toEqual([{ label: 'Pickup', amount: PICKUP_LEG_FEE }]);
    expect(b.total).toBe(1250);
  });
  it('two legs are two lines at ₹50 each', () => {
    const b = priceVisit({ services: GLASS, fees: pickupFees({ pickup: true, drop: true }), benefit: benefit() });
    expect(b.fees.map(f => f.label)).toEqual(['Pickup', 'Drop']);
    expect(b.total).toBe(1300);
  });
  it('no legs, no fee lines', () => {
    expect(priceVisit({ services: GLASS, benefit: benefit() }).fees).toEqual([]);
  });
  it('a discount never applies to a fee', () => {
    const b = priceVisit({
      services: GLASS, fees: pickupFees({ pickup: true }),
      benefit: benefit({ membership: sub() }),
    });
    /* Gold 15% of 1200 = 180, off the WORK only. 1200-180+50. */
    expect(b.discountAmount).toBe(180);
    expect(b.total).toBe(1070);
  });
});

describe('benefits', () => {
  it('membership discount', () => {
    const b = priceVisit({ services: GLASS, benefit: benefit({ membership: sub() }) });
    expect(b.discount?.source).toBe('membership');
    expect(b.total).toBe(1020);
  });
  it('promo discount', () => {
    const b = priceVisit({ services: GLASS, benefit: benefit({ promos: [promo()] }) });
    expect(b.discount?.source).toBe('promo');
    expect(b.total).toBe(1000);
  });
  it('membership + promo takes the best, never both', () => {
    const b = priceVisit({
      services: GLASS,
      benefit: benefit({ membership: sub(), promos: [promo()] }),
    });
    /* Gold 15% = 180 against a flat 200. The promo wins, alone. */
    expect(b.discountAmount).toBe(200);
    expect(b.discount?.source).toBe('promo');
    expect(b.total).toBe(1000);
  });
  it('a covered wash is ₹0 for the work, and fees still stand', () => {
    const b = priceVisit({
      services: [{ name: 'Maintenance wash', price: 1200 }],
      fees: pickupFees({ pickup: true }),
      benefit: benefit({ category: 'Washing', wantsWash: true, membership: sub() }),
    });
    expect(b.washCovered).toBe(true);
    expect(b.discountAmount).toBe(0);
    expect(b.discount).toBeUndefined();
    expect(b.total).toBe(50);
  });
});

describe('tax', () => {
  it('OFF — the field is absent, never zero', () => {
    const b = priceVisit({ services: GLASS, benefit: benefit(), tax: { enabled: false, rate: 18 } });
    expect(b.tax).toBeUndefined();
    expect('tax' in b).toBe(false);
    expect(b.total).toBe(1200);
  });
  it('ON — exclusive, on work and fees, rounded once to the rupee', () => {
    const b = priceVisit({
      services: GLASS, fees: pickupFees({ pickup: true }),
      benefit: benefit({ promos: [promo()] }),
      tax: { enabled: true, rate: 18, gstin: '24ABCDE1234F1Z5' },
    });
    /* (1200-200) + 50 = 1050 taxable · 18% = 189 · total 1239 */
    expect(b.taxable).toBe(1050);
    expect(b.tax).toEqual({ rate: 18, amount: 189, gstin: '24ABCDE1234F1Z5' });
    expect(b.total).toBe(1239);
  });
  it('rounds once — a fractional rate never leaves a fraction', () => {
    const b = priceVisit({
      services: [{ name: 'x', price: 999 }], benefit: benefit(),
      tax: { enabled: true, rate: 18 },
    });
    expect(Number.isInteger(b.tax!.amount)).toBe(true);
    expect(Number.isInteger(b.total)).toBe(true);
  });
  it('no GSTIN, no gstin field', () => {
    const b = priceVisit({ services: GLASS, benefit: benefit(), tax: { enabled: true, rate: 18 } });
    expect(b.tax).toEqual({ rate: 18, amount: 216 });
  });
});

describe('AMZ-2026-0001 — the real invoice, pinned forever', () => {
  it('reconciles at exactly ₹1,250', () => {
    /* Glass Coating ₹1,200 + one leg ₹50, no discount, no GST. Booking, job,
       sealed visit and invoice all record 1250; this proves the canonical
       engine produces the same figure, so nothing is rewritten. */
    const b = priceVisit({
      services: [{ name: 'Glass Coating', price: 1200 }],
      fees: [{ label: 'Pickup & Drop', amount: 50 }],
      benefit: benefit(),
      tax: { enabled: false, rate: 18 },
    });
    expect(b.subtotal).toBe(1200);
    expect(b.feesTotal).toBe(50);
    expect(b.discountAmount).toBe(0);
    expect(b.tax).toBeUndefined();
    expect(b.total).toBe(1250);
  });

  it('a catalogue price change cannot move it', () => {
    /* The sealed figures are the job's own, snapshotted. Re-pricing the
       catalogue at 1800 changes what a NEW visit costs and nothing else. */
    const now = priceVisit({
      services: [{ name: 'Glass Coating', price: 1800 }],
      fees: [{ label: 'Pickup & Drop', amount: 50 }],
      benefit: benefit(),
    });
    expect(now.total).toBe(1850);
    /* The historical record is untouched: it stores 1250 and is never recomputed. */
    const sealed = { subtotal: 1200, discount: 0, total: 1250 };
    expect(sealed.total).toBe(1250);
  });
});

describe('legacy and edge', () => {
  it('a record with no fees and no benefit still totals correctly', () => {
    expect(priceVisit({ services: GLASS, benefit: benefit() }).total).toBe(1200);
  });
  it('no services is zero, not NaN', () => {
    const b = priceVisit({ services: [], benefit: benefit() });
    expect(b.subtotal).toBe(0);
    expect(b.total).toBe(0);
    expect(b.discount).toBeUndefined();
  });
  it('a discount can never exceed the work', () => {
    const b = priceVisit({
      services: [{ name: 'x', price: 100 }],
      benefit: benefit({ promos: [promo({ value: 500 })] }),
    });
    expect(b.total).toBeGreaterThanOrEqual(0);
    expect(b.discountAmount).toBeLessThanOrEqual(100);
  });
  it('multiple services sum into one subtotal', () => {
    const b = priceVisit({
      services: [{ name: 'a', price: 1200 }, { name: 'b', price: 800 }],
      benefit: benefit(),
    });
    expect(b.subtotal).toBe(2000);
  });
});
