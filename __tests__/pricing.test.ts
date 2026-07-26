import {
  membershipDiscountPct, promoDiscountAmount, isPromoEligible,
  computeBestDiscount, applyDiscount, decidePrice, type PricingInput,
} from '../lib/services/pricing';
import type { Promo, Subscription } from '../lib/types';

const basePromo: Promo = {
  id: 'p1', code: 'WASH15', label: '15% off washing',
  type: 'percent', value: 15,
  scope: { kind: 'category', categories: ['Washing'] },
  target: { kind: 'all' },
  validFrom: '2026-01-01', validTo: '2026-12-31',
  usedCount: 0, autoApply: true, active: true,
  // Timestamps unused by pure functions
  createdAt: null as never, updatedAt: null as never,
};

const ctx = { serviceId: 's1', category: 'Washing', userId: 'u1', date: '2026-07-10' };

describe('membershipDiscountPct', () => {
  it('maps plans to 10/15/20', () => {
    expect(membershipDiscountPct('Silver')).toBe(10);
    expect(membershipDiscountPct('Gold')).toBe(15);
    expect(membershipDiscountPct('Platinum')).toBe(20);
  });
});

describe('promoDiscountAmount', () => {
  it('computes percent discounts', () => {
    expect(promoDiscountAmount(basePromo, 1000)).toBe(150);
  });
  it('caps flat discounts at the price', () => {
    const flat = { ...basePromo, type: 'flat' as const, value: 2000 };
    expect(promoDiscountAmount(flat, 500)).toBe(500);
  });
});

describe('isPromoEligible', () => {
  it('accepts matching category in validity window', () => {
    expect(isPromoEligible(basePromo, ctx)).toBe(true);
  });
  it('rejects outside validity window', () => {
    expect(isPromoEligible(basePromo, { ...ctx, date: '2027-01-01' })).toBe(false);
    expect(isPromoEligible(basePromo, { ...ctx, date: '2025-12-31' })).toBe(false);
  });
  it('rejects wrong category', () => {
    expect(isPromoEligible(basePromo, { ...ctx, category: 'PPF' })).toBe(false);
  });
  it('rejects inactive promos', () => {
    expect(isPromoEligible({ ...basePromo, active: false }, ctx)).toBe(false);
  });
  it('enforces total usage limit', () => {
    expect(isPromoEligible({ ...basePromo, usageLimitTotal: 5, usedCount: 5 }, ctx)).toBe(false);
    expect(isPromoEligible({ ...basePromo, usageLimitTotal: 5, usedCount: 4 }, ctx)).toBe(true);
  });
  it('enforces per-customer usage limit', () => {
    const p = { ...basePromo, usageLimitPerCustomer: 1 };
    expect(isPromoEligible(p, { ...ctx, userRedemptionCount: 1 })).toBe(false);
    expect(isPromoEligible(p, { ...ctx, userRedemptionCount: 0 })).toBe(true);
  });
  it('enforces customer targeting', () => {
    const p: Promo = { ...basePromo, target: { kind: 'customers', userIds: ['u2'] } };
    expect(isPromoEligible(p, ctx)).toBe(false);
    expect(isPromoEligible(p, { ...ctx, userId: 'u2' })).toBe(true);
    expect(isPromoEligible(p, { ...ctx, userId: undefined })).toBe(false);
  });
  it('enforces service scoping', () => {
    const p: Promo = { ...basePromo, scope: { kind: 'services', serviceIds: ['s9'] } };
    expect(isPromoEligible(p, ctx)).toBe(false);
    expect(isPromoEligible(p, { ...ctx, serviceId: 's9' })).toBe(true);
  });
});

describe('computeBestDiscount', () => {
  it('applies membership % when no promos', () => {
    const d = computeBestDiscount({ price: 1000, membershipPlan: 'Gold', eligiblePromos: [] });
    expect(d).toEqual({ source: 'membership', label: 'Gold member 15% off', amount: 150 });
  });
  it('picks the better of membership vs promo - never stacks', () => {
    // Gold 15% (150) vs 20% promo (200) → promo wins alone
    const promo20 = { ...basePromo, value: 20 };
    const d = computeBestDiscount({ price: 1000, membershipPlan: 'Gold', eligiblePromos: [promo20] });
    expect(d?.source).toBe('promo');
    expect(d?.amount).toBe(200);
  });
  it('keeps membership when it beats the promo', () => {
    const promo5 = { ...basePromo, value: 5 };
    const d = computeBestDiscount({ price: 1000, membershipPlan: 'Platinum', eligiblePromos: [promo5] });
    expect(d?.source).toBe('membership');
    expect(d?.amount).toBe(200);
  });
  it('returns undefined for zero price or no discounts', () => {
    expect(computeBestDiscount({ price: 0, membershipPlan: 'Gold', eligiblePromos: [] })).toBeUndefined();
    expect(computeBestDiscount({ price: 1000, eligiblePromos: [] })).toBeUndefined();
  });
});

describe('applyDiscount', () => {
  it('never goes below zero', () => {
    expect(applyDiscount(100, { source: 'promo', label: 'x', amount: 500 })).toBe(0);
    expect(applyDiscount(1000, { source: 'membership', label: 'x', amount: 150 })).toBe(850);
    expect(applyDiscount(1000, undefined)).toBe(1000);
  });
});

/* ── decidePrice — the whole booking decision, the thing the server acts on ──
   These matter more than the pieces above: this is the function that decides
   what a customer is charged. Every case here was previously decided in a
   browser. */

const sub = (over: Partial<Subscription> = {}): Subscription & { id: string } => ({
  id: 'sub1', userId: 'u1', plan: 'Gold', status: 'active',
  startDate: '2026-01-01', endDate: '2026-12-31',
  washesTotal: 4, washesUsed: 0, paymentMethod: 'upi',
  createdAt: null as never, updatedAt: null as never,
  ...over,
} as Subscription & { id: string });

const input = (over: Partial<PricingInput> = {}): PricingInput => ({
  base: 1000, category: 'Washing', serviceId: 's1',
  ownerId: 'u1', membership: null, wantsWash: false,
  promos: [], myRedemptions: new Map(), date: '2026-07-10',
  ...over,
});

describe('decidePrice · membership wash', () => {
  it('covers a wash and charges nothing', () => {
    const d = decidePrice(input({ membership: sub(), wantsWash: true }));
    expect(d.washCovered).toBe(true);
    expect(d.netService).toBe(0);
    expect(d.membershipId).toBe('sub1');
  });

  it('never stacks a discount on a covered wash', () => {
    const d = decidePrice(input({
      membership: sub(), wantsWash: true,
      promos: [{ ...basePromo, value: 50 }],
    }));
    expect(d.discount).toBeUndefined();
    expect(d.netService).toBe(0);
  });

  it('refuses to cover a non-Washing service', () => {
    const d = decidePrice(input({ category: 'Ceramic', membership: sub(), wantsWash: true }));
    expect(d.washCovered).toBe(false);
    expect(d.netService).toBe(850);   // Gold 15% instead
  });

  it('refuses when the allowance is spent', () => {
    const d = decidePrice(input({
      membership: sub({ washesUsed: 4, washesTotal: 4 }), wantsWash: true,
    }));
    expect(d.washCovered).toBe(false);
  });

  it('refuses on an EXPIRED membership', () => {
    const d = decidePrice(input({
      membership: sub({ endDate: '2026-07-09' }), wantsWash: true,
    }));
    expect(d.washCovered).toBe(false);
    expect(d.discount).toBeUndefined();   // and no percentage either
  });

  it('refuses on a non-active membership', () => {
    const d = decidePrice(input({ membership: sub({ status: 'pending' }), wantsWash: true }));
    expect(d.washCovered).toBe(false);
  });

  it('does not spend a wash that was not asked for', () => {
    const d = decidePrice(input({ membership: sub(), wantsWash: false }));
    expect(d.washCovered).toBe(false);
    expect(d.netService).toBe(850);
  });
});

describe('decidePrice · best-of, never stacked', () => {
  it('takes the promo when it beats the membership', () => {
    const d = decidePrice(input({ membership: sub(), promos: [{ ...basePromo, value: 25 }] }));
    expect(d.discount?.source).toBe('promo');
    expect(d.netService).toBe(750);       // 25%, not 15+25
  });

  it('keeps the membership when it beats the promo', () => {
    const d = decidePrice(input({ membership: sub(), promos: [{ ...basePromo, value: 5 }] }));
    expect(d.discount?.source).toBe('membership');
    expect(d.netService).toBe(850);
  });

  it('names the promo that must be counted', () => {
    const p = { ...basePromo, id: 'p-win', value: 40 };
    const d = decidePrice(input({ promos: [p] }));
    expect(d.promo?.id).toBe('p-win');
  });

  it('names no promo when the membership wins', () => {
    const d = decidePrice(input({ membership: sub(), promos: [{ ...basePromo, value: 5 }] }));
    expect(d.promo).toBeUndefined();
  });
});

describe('decidePrice · eligibility is re-checked, never trusted', () => {
  it('ignores a promo out of its scope', () => {
    const d = decidePrice(input({ category: 'PPF', promos: [basePromo] }));
    expect(d.discount).toBeUndefined();
  });

  it('ignores a promo targeted at someone else', () => {
    const p: Promo = { ...basePromo, target: { kind: 'customers', userIds: ['someone-else'] } };
    expect(decidePrice(input({ promos: [p] })).discount).toBeUndefined();
  });

  it('ignores a targeted promo for an unidentified walk-in', () => {
    const p: Promo = { ...basePromo, target: { kind: 'customers', userIds: ['u1'] } };
    expect(decidePrice(input({ ownerId: null, promos: [p] })).discount).toBeUndefined();
  });

  it('ignores an exhausted promo', () => {
    const p: Promo = { ...basePromo, usageLimitTotal: 2, usedCount: 2 };
    expect(decidePrice(input({ promos: [p] })).discount).toBeUndefined();
  });

  it('ignores a promo this customer has already spent', () => {
    const p: Promo = { ...basePromo, usageLimitPerCustomer: 1 };
    const spent = new Map([[p.id, 1]]);
    expect(decidePrice(input({ promos: [p], myRedemptions: spent })).discount).toBeUndefined();
    expect(decidePrice(input({ promos: [p] })).discount).toBeDefined();
  });

  it('ignores an expired promo', () => {
    const p: Promo = { ...basePromo, validTo: '2026-07-09' };
    expect(decidePrice(input({ promos: [p] })).discount).toBeUndefined();
  });

  it('never discounts below zero', () => {
    const p: Promo = { ...basePromo, type: 'flat', value: 99999 };
    const d = decidePrice(input({ base: 500, promos: [p] }));
    expect(d.netService).toBe(0);
    expect(d.discountAmount).toBe(500);
  });
});
