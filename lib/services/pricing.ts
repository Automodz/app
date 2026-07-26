// THE PRICING ENGINE. Pure functions, no Firebase imports, unit-testable.
//
// Everything that decides what a visit costs is in this file, and only the
// Booking Service (lib/server/bookingService.ts) is allowed to act on it. The
// UI may call the same functions to QUOTE a price - it just never writes one.
import type { Promo, MembershipPlan, BookingDiscount, Subscription } from '../types';

/** Membership "% off other services" perk (Silver 10 / Gold 15 / Platinum 20) */
export const membershipDiscountPct = (plan: MembershipPlan): number =>
  ({ Silver: 10, Gold: 15, Platinum: 20 }[plan] ?? 0);

export const promoDiscountAmount = (promo: Promo, price: number): number => {
  const raw = promo.type === 'percent' ? Math.round(price * promo.value / 100) : promo.value;
  return Math.min(Math.max(0, raw), price);
};

export interface PromoEligibilityContext {
  serviceId: string;
  category: string;
  userId?: string;
  date: string;               // YYYY-MM-DD
  userRedemptionCount?: number; // times this user already used this promo
}

export const isPromoEligible = (promo: Promo, ctx: PromoEligibilityContext): boolean => {
  if (!promo.active) return false;
  if (ctx.date < promo.validFrom || ctx.date > promo.validTo) return false;
  if (promo.usageLimitTotal != null && promo.usedCount >= promo.usageLimitTotal) return false;
  if (promo.usageLimitPerCustomer != null && (ctx.userRedemptionCount ?? 0) >= promo.usageLimitPerCustomer) return false;
  if (promo.scope.kind === 'category' && !promo.scope.categories.includes(ctx.category)) return false;
  if (promo.scope.kind === 'services' && !promo.scope.serviceIds.includes(ctx.serviceId)) return false;
  if (promo.target.kind === 'customers') {
    if (!ctx.userId || !promo.target.userIds.includes(ctx.userId)) return false;
  }
  return true;
};

/**
 * Best-of discount: membership % vs best eligible promo - never stacked.
 * Returns undefined when nothing applies.
 */
export const computeBestDiscount = (args: {
  price: number;
  membershipPlan?: MembershipPlan | null;
  eligiblePromos: Promo[];      // pre-filtered via isPromoEligible
}): BookingDiscount | undefined => {
  const { price, membershipPlan, eligiblePromos } = args;
  if (price <= 0) return undefined;

  let best: BookingDiscount | undefined;

  if (membershipPlan) {
    const pct = membershipDiscountPct(membershipPlan);
    if (pct > 0) {
      best = {
        source: 'membership',
        label: `${membershipPlan} member ${pct}% off`,
        amount: Math.round(price * pct / 100),
      };
    }
  }

  for (const promo of eligiblePromos) {
    const amount = promoDiscountAmount(promo, price);
    if (amount > (best?.amount ?? 0)) {
      best = { source: 'promo', promoId: promo.id, label: promo.label, amount };
    }
  }

  return best && best.amount > 0 ? best : undefined;
};

export const applyDiscount = (price: number, discount?: BookingDiscount): number =>
  Math.max(0, price - (discount?.amount ?? 0));

/* ── The decision ───────────────────────────────────────────────────────── */

export interface PricingInput {
  /** what the studio charges before any benefit */
  base: number;
  category: string;
  serviceId: string;
  /** null for an unidentified walk-in - a targeted promo then cannot match */
  ownerId: string | null;
  membership: (Subscription & { id: string }) | null;
  /** the customer ASKED to spend a wash; this function decides if they can */
  wantsWash: boolean;
  promos: Promo[];
  /** this customer's redemption counts, keyed by promoId */
  myRedemptions: Map<string, number>;
  /** YYYY-MM-DD, injected so the decision is testable and never clock-dependent */
  date: string;
}

export interface PricingDecision {
  base: number;
  discount?: BookingDiscount;
  discountAmount: number;
  washCovered: boolean;
  membershipId?: string;
  /** the promo whose count must move, if any */
  promo?: Promo;
  /** what the service line costs after the benefit */
  netService: number;
}

/**
 * What this visit costs, decided once.
 *
 * A membership wash comes first and stands alone: it zero-prices the line, so
 * stacking a percentage on top of a free wash would be discounting nothing.
 * Otherwise it is best-of membership % vs the best eligible promo - never both,
 * which is the rule the counter has always used.
 *
 * An expired membership is not a membership. A promo the customer has already
 * spent to its per-customer limit is not eligible. Both are checked here rather
 * than trusted from a caller.
 */
export const decidePrice = (i: PricingInput): PricingDecision => {
  const activeMember =
    i.membership && i.membership.status === 'active' && i.membership.endDate >= i.date
      ? i.membership : null;

  const washesLeft = activeMember
    ? Math.max(0, (activeMember.washesTotal ?? 0) - (activeMember.washesUsed ?? 0)) : 0;
  const washCovered = !!activeMember && i.wantsWash
    && i.category === 'Washing' && washesLeft > 0;

  if (washCovered) {
    return {
      base: i.base, discountAmount: 0, washCovered: true,
      membershipId: activeMember!.id, netService: 0,
    };
  }

  const eligible = i.promos.filter(p => isPromoEligible(p, {
    serviceId: i.serviceId,
    category: i.category,
    userId: i.ownerId ?? undefined,
    date: i.date,
    userRedemptionCount: i.myRedemptions.get(p.id) ?? 0,
  }));

  const discount = computeBestDiscount({
    price: i.base,
    membershipPlan: (activeMember?.plan as MembershipPlan | undefined) ?? null,
    eligiblePromos: eligible,
  });

  return {
    base: i.base,
    discount,
    discountAmount: discount?.amount ?? 0,
    washCovered: false,
    netService: applyDiscount(i.base, discount),
    promo: discount?.source === 'promo'
      ? eligible.find(p => p.id === discount.promoId) : undefined,
  };
};
