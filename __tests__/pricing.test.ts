import {
  membershipDiscountPct, promoDiscountAmount, isPromoEligible,
  computeBestDiscount, applyDiscount,
} from '../lib/services/pricing';
import type { Promo } from '../lib/types';

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
