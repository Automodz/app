/**
 * PROMO CODES ARE REMOVED, AND WITH THEM HALF OF THIS FILE.
 *
 * `promoDiscountAmount`, `isPromoEligible` and every case that asked which of
 * a membership and a promo won stood here. The owner removed promo codes and
 * the referral programme that issued them, so a discount now has exactly one
 * source: the membership rate. There is nothing to be best-of against, which
 * is why `computeBestDiscount` no longer takes a list to compare.
 */
import {
  membershipDiscountPct,
  computeBestDiscount, applyDiscount, decidePrice, type PricingInput,
} from '../lib/services/pricing';
import type { Subscription } from '../lib/types';

describe('membershipDiscountPct', () => {
  it('maps plans to 10/15/20', () => {
    expect(membershipDiscountPct('Silver')).toBe(10);
    expect(membershipDiscountPct('Gold')).toBe(15);
    expect(membershipDiscountPct('Platinum')).toBe(20);
  });
});

describe('computeBestDiscount', () => {
  it('applies the membership rate, and it is the only discount there is', () => {
    const d = computeBestDiscount({ price: 1000, membershipPlan: 'Gold' });
    expect(d).toEqual({ source: 'membership', label: 'Gold member 15% off', amount: 150 });
    expect(computeBestDiscount({ price: 1000, membershipPlan: 'Platinum' })?.amount).toBe(200);
  });
  it('returns undefined for zero price or no membership', () => {
    expect(computeBestDiscount({ price: 0, membershipPlan: 'Gold' })).toBeUndefined();
    expect(computeBestDiscount({ price: 1000 })).toBeUndefined();
  });
});

describe('applyDiscount', () => {
  it('never goes below zero', () => {
    expect(applyDiscount(100, { source: 'membership', label: 'x', amount: 500 })).toBe(0);
    expect(applyDiscount(1000, { source: 'membership', label: 'x', amount: 150 })).toBe(850);
    expect(applyDiscount(1000, undefined)).toBe(1000);
  });
});

/* ── decidePrice - the whole booking decision, the thing the server acts on ──
   These matter more than the pieces above: this is the function that decides
   what a customer is charged. Every case here was previously decided in a
   browser. */

/* `washesTotal` MATCHES THE PLAN. It read 4 against a Gold plan the catalogue
   grants 8 - the same drift a production subscription turned out to carry, and
   the reason `os/club.washesGrantedBy` now reads the catalogue rather than the
   document. A fixture that disagrees with the plan it names is a fixture
   asserting the bug. */
const sub = (over: Partial<Subscription> = {}): Subscription & { id: string } => ({
  id: 'sub1', userId: 'u1', plan: 'Gold', status: 'active',
  startDate: '2026-01-01', endDate: '2026-12-31',
  washesTotal: 8, washesUsed: 0, paymentMethod: 'upi',
  createdAt: null as never, updatedAt: null as never,
  ...over,
} as Subscription & { id: string });

const input = (over: Partial<PricingInput> = {}): PricingInput => ({
  base: 1000, category: 'Washing', serviceId: 's1',
  ownerId: 'u1', membership: null, wantsWash: false, date: '2026-07-10',
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
    /* A covered wash zero-prices the line, so a percentage on top would be
       discounting nothing. */
    const d = decidePrice(input({ membership: sub(), wantsWash: true }));
    expect(d.discount).toBeUndefined();
    expect(d.netService).toBe(0);
  });

  it('refuses to cover a non-Washing service', () => {
    const d = decidePrice(input({ category: 'Ceramic', membership: sub(), wantsWash: true }));
    expect(d.washCovered).toBe(false);
    expect(d.netService).toBe(850);   // Gold 15% instead
  });

  it('refuses when the allowance is spent', () => {
    /* Spent means "used everything the PLAN grants" - Gold's eight - not
       "used everything a field on the document happens to say". */
    const d = decidePrice(input({
      membership: sub({ washesUsed: 8 }), wantsWash: true,
    }));
    expect(d.washCovered).toBe(false);
  });

  it('the plan outranks a drifted count on the document', () => {
    /* The production defect, pinned: a Gold subscription claiming sixteen
       washes grants eight, so six used leaves two - never ten. */
    const d = decidePrice(input({
      membership: sub({ washesTotal: 16, washesUsed: 6 }), wantsWash: true,
    }));
    expect(d.washCovered).toBe(true);
    const spent = decidePrice(input({
      membership: sub({ washesTotal: 16, washesUsed: 8 }), wantsWash: true,
    }));
    expect(spent.washCovered).toBe(false);
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

describe('decidePrice · the membership rate', () => {
  it('applies the plan\'s percentage to the work', () => {
    /* `describe('best-of, never stacked')` STOOD HERE - which of a membership
       and a promo won, and which promo had to be counted. Promo codes are
       removed; there is one benefit and nothing to choose between. */
    const d = decidePrice(input({ membership: sub() }));
    expect(d.discount?.source).toBe('membership');
    expect(d.netService).toBe(850);
  });

  it('gives nothing to a customer with no membership', () => {
    expect(decidePrice(input()).discount).toBeUndefined();
    expect(decidePrice(input()).netService).toBe(1000);
  });
});

describe('decidePrice · the membership is re-checked, never trusted', () => {
  /* This describe used to re-check PROMO eligibility - scope, targeting, an
     unidentified walk-in, an exhausted code. Promo codes are removed; the one
     benefit left still has to be verified here rather than taken from a
     caller, and an expired membership is not a membership. */
  it('ignores a membership that has expired', () => {
    const expired = sub({ endDate: '2026-06-30' });
    expect(decidePrice(input({ membership: expired })).discount).toBeUndefined();
  });

  it('ignores a membership that is not active', () => {
    expect(decidePrice(input({ membership: sub({ status: 'cancelled' }) })).discount)
      .toBeUndefined();
  });

  it('never discounts below zero', () => {
    const d = decidePrice(input({ base: 1, membership: sub() }));
    expect(d.netService).toBeGreaterThanOrEqual(0);
  });
});
