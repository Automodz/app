// Pure pricing functions - no Firebase imports, unit-testable.
import type { Promo, MembershipPlan, BookingDiscount } from '../types';

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
