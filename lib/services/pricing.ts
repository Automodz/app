// THE PRICING ENGINE. Pure functions, no Firebase imports, unit-testable.
//
// Everything that decides what a visit costs is in this file, and only the
// Booking Service (lib/server/bookingService.ts) is allowed to act on it. The
// UI may call the same functions to QUOTE a price - it just never writes one.
import type {
  MembershipPlan, BookingDiscount, Subscription, StoredBreakdown,
} from '../types';
import { washesLeftOf } from '../os/club';
import { GST_ENABLED, GST_RATE, GSTIN } from '../config/storeConfig';

/** Membership "% off other services" perk (Silver 10 / Gold 15 / Platinum 20) */
export const membershipDiscountPct = (plan: MembershipPlan): number =>
  ({ Silver: 10, Gold: 15, Platinum: 20 }[plan] ?? 0);

/**
 * THE DISCOUNT, AND THERE IS EXACTLY ONE KIND OF IT.
 *
 * This was "best-of: membership % vs the best eligible promo, never stacked",
 * and half of it is gone: the owner removed promo codes and the referral
 * programme that issued them. What is left is the membership rate, which is a
 * property of a relationship the studio already keeps - so a discount now has
 * one source, one reason, and nothing to be best-of against.
 *
 * Returns undefined when nothing applies.
 */
export const computeBestDiscount = (args: {
  price: number;
  membershipPlan?: MembershipPlan | null;
}): BookingDiscount | undefined => {
  const { price, membershipPlan } = args;
  if (price <= 0 || !membershipPlan) return undefined;

  const pct = membershipDiscountPct(membershipPlan);
  if (pct <= 0) return undefined;

  const amount = Math.round(price * pct / 100);
  return amount > 0
    ? { source: 'membership', label: `${membershipPlan} member ${pct}% off`, amount }
    : undefined;
};

export const applyDiscount = (price: number, discount?: BookingDiscount): number =>
  Math.max(0, price - (discount?.amount ?? 0));

/* ── The decision ───────────────────────────────────────────────────────── */

export interface PricingInput {
  /** what the studio charges before any benefit */
  base: number;
  category: string;
  serviceId: string;
  /** the account the visit belongs to, or null for an unidentified walk-in */
  ownerId: string | null;
  membership: (Subscription & { id: string }) | null;
  /** the customer ASKED to spend a wash; this function decides if they can */
  wantsWash: boolean;
  /** YYYY-MM-DD, injected so the decision is testable and never clock-dependent */
  date: string;
}

export interface PricingDecision {
  base: number;
  discount?: BookingDiscount;
  discountAmount: number;
  washCovered: boolean;
  membershipId?: string;
  /** what the service line costs after the benefit */
  netService: number;
}

/**
 * What this visit costs, decided once.
 *
 * A membership wash comes first and stands alone: it zero-prices the line, so
 * stacking a percentage on top of a free wash would be discounting nothing.
 * Otherwise it is the membership rate, which is the only discount this studio
 * gives: promo codes and the referral programme that issued them are removed,
 * so there is no second source to be best-of against.
 *
 * An expired membership is not a membership - checked here rather than trusted
 * from a caller.
 */
export const decidePrice = (i: PricingInput): PricingDecision => {
  const activeMember =
    i.membership && i.membership.status === 'active' && i.membership.endDate >= i.date
      ? i.membership : null;

  /* One subtraction, one place (§22.2) - the same helper the club engine,
     the projection, the retention job and the kiosk all use. */
  const washesLeft = activeMember ? washesLeftOf(activeMember) : 0;
  const washCovered = !!activeMember && i.wantsWash
    && i.category === 'Washing' && washesLeft > 0;

  if (washCovered) {
    return {
      base: i.base, discountAmount: 0, washCovered: true,
      membershipId: activeMember!.id, netService: 0,
    };
  }

  const discount = computeBestDiscount({
    price: i.base,
    membershipPlan: (activeMember?.plan as MembershipPlan | undefined) ?? null,
  });

  return {
    base: i.base,
    discount,
    discountAmount: discount?.amount ?? 0,
    washCovered: false,
    netService: applyDiscount(i.base, discount),
  };
};

/* ── THE CANONICAL ENGINE ───────────────────────────────────────────────── */

/**
 * WHAT A VISIT COSTS - services, discount, fees, tax, total. One calculation.
 *
 * `decidePrice` decided the SERVICE line and stopped there, so every caller
 * assembled the rest itself: the booking service added pickup fees, the invoice
 * added GST and summed a different set of line items, and the seal INFERRED the
 * discount by subtracting one total from another. Four places, two meanings of
 * "subtotal", and a discount that was reconstructed rather than recorded.
 *
 * ── THE ORDER IS FIXED, AND IT MATTERS ──────────────────────────────────
 *   services → discount → fees → tax → total
 *
 * Discount applies to the WORK, never to the fees: a member's 15% is a
 * benefit on craft, not on a van's diesel. Tax then applies to everything
 * chargeable, because a service fee is taxable in its own right.
 *
 * ── `subtotal` HAS ONE MEANING ──────────────────────────────────────────
 * The services, before fees and before discount. The invoice previously called
 * the fee-inclusive figure "subtotal" while the sealed visit called the
 * services-only figure the same word; for AMZ-2026-0001 that is 1250 against
 * 1200. Both are now named, separately, and neither is called the other.
 *
 * ── THE DISCOUNT IS CARRIED, NEVER DERIVED ──────────────────────────────
 * `sealVisit` computed `discount = max(0, subtotal - total)`. With a discount
 * AND a fee that is provably wrong: services 1200, discount 200, fees 100 gives
 * total 1100, and the subtraction reports 100. The customer's permanent record
 * would understate what they were given by half. The breakdown carries the real
 * figure so nothing has to guess.
 */
export interface FeeLine {
  /** The customer's word for it, stored verbatim on the record. */
  label: string;
  amount: number;
}

export interface TaxPolicy {
  /** Off while the studio has no GSTIN - see lib/config/storeConfig.ts. */
  enabled: boolean;
  rate: number;
  gstin?: string;
}

export interface PriceBreakdown {
  /** The work, before fees and before any benefit. ONE meaning. */
  subtotal: number;
  /** What was actually given. Explicit, never inferred from two totals. */
  discount?: BookingDiscount;
  discountAmount: number;
  /** Each leg, each extra - never folded into the subtotal. */
  fees: FeeLine[];
  feesTotal: number;
  /** Everything chargeable, after the benefit. The base tax is taken on. */
  taxable: number;
  /**
   * ABSENT when tax was not charged, never zero. A zero implies the studio
   * charged nothing on a taxable sale; absent says no tax applied at all,
   * which is what an unregistered studio means.
   */
  tax?: { rate: number; amount: number; gstin?: string };
  total: number;
  /** A covered wash zero-prices the work and stands alone (no stacking). */
  washCovered: boolean;
  membershipId?: string;
}

/** Per leg. Two legs is two lines, so a customer can see what they paid for. */
export const PICKUP_LEG_FEE = 50;

export function priceVisit(args: {
  /** The work, at catalogue price before anything. */
  services: { name: string; price: number }[];
  /** Named lines. The booking service builds these from the legs requested. */
  fees?: FeeLine[];
  tax?: TaxPolicy;
  /** Everything `decidePrice` needs to choose the one benefit that applies. */
  benefit: PricingInput;
}): PriceBreakdown {
  const subtotal = args.services.reduce((n, s) => n + s.price, 0);
  const fees = args.fees ?? [];
  const feesTotal = fees.reduce((n, f) => n + f.amount, 0);

  /* The benefit is decided by the existing engine - the membership rate, or a
     covered wash standing alone. Priced against the WORK, which is why `base`
     is the services subtotal and not the total. */
  const decided = decidePrice({ ...args.benefit, base: subtotal });

  const afterDiscount = decided.washCovered ? 0 : applyDiscount(subtotal, decided.discount);
  const taxable = afterDiscount + feesTotal;

  /* Rounded ONCE, here, to the rupee. Nothing downstream rounds again. */
  const tax = args.tax?.enabled && args.tax.rate > 0
    ? {
        rate: args.tax.rate,
        amount: Math.round(taxable * args.tax.rate / 100),
        ...(args.tax.gstin ? { gstin: args.tax.gstin } : {}),
      }
    : undefined;

  return {
    subtotal,
    ...(decided.discount && !decided.washCovered ? { discount: decided.discount } : {}),
    discountAmount: decided.washCovered ? 0 : decided.discountAmount,
    fees,
    feesTotal,
    taxable,
    ...(tax ? { tax } : {}),
    total: taxable + (tax?.amount ?? 0),
    washCovered: decided.washCovered,
    ...(decided.membershipId ? { membershipId: decided.membershipId } : {}),
  };
}

/** The legs a booking asked for, as the fee lines a customer can read. */
export const pickupFees = (legs: { pickup?: boolean; drop?: boolean }): FeeLine[] => [
  ...(legs.pickup ? [{ label: 'Pickup', amount: PICKUP_LEG_FEE }] : []),
  ...(legs.drop ? [{ label: 'Drop', amount: PICKUP_LEG_FEE }] : []),
];

/**
 * THE TAX POLICY, READ FROM CONFIGURATION AND NEVER ASSUMED.
 *
 * The audit found GST on the invoice and absent from the estimate - one fact,
 * two calculations, guaranteed to contradict each other the day a GSTIN
 * exists. This is the one place it is decided, and `priceVisit` is the one
 * place it is applied, so the estimate, the booking, the invoice and the
 * payment all move together or not at all.
 *
 * It is off today because the studio has no GSTIN, and `priceVisit` then omits
 * the tax block ENTIRELY rather than writing a zero - a zero would claim the
 * studio charged nothing on a taxable sale, which is a different statement
 * from not being registered.
 */
export const taxPolicy = (): TaxPolicy => ({
  enabled: GST_ENABLED && !!GSTIN,
  rate: GST_RATE,
  ...(GSTIN ? { gstin: GSTIN } : {}),
});

/**
 * A breakdown as it is STORED.
 *
 * It used to carry the whole `Promo` document - a live record with its own
 * usage counts - and only the promo's IDENTITY was allowed into a snapshot,
 * because a frozen copy starts lying the first time anybody else redeems it.
 * Promo codes are removed, so a breakdown holds only figures and the id of the
 * membership that earned them, and there is nothing live left in it.
 */
export const storedBreakdown = (b: PriceBreakdown): StoredBreakdown => ({
  subtotal: b.subtotal,
  ...(b.discount ? { discount: b.discount } : {}),
  discountAmount: b.discountAmount,
  fees: b.fees,
  feesTotal: b.feesTotal,
  taxable: b.taxable,
  ...(b.tax ? { tax: b.tax } : {}),
  total: b.total,
  washCovered: b.washCovered,
  ...(b.membershipId ? { membershipId: b.membershipId } : {}),
});
