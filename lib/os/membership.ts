/**
 * JOINING, UPGRADING AND RENEWING THE CLUB - the rules, with no database in
 * sight.
 *
 * Source: docs/AUTOMODZ-OS.md §15, docs/AUTOMODZ-LIVING-STATES.md §2
 *
 * ── WHAT THIS REPLACES ───────────────────────────────────────────────────
 * There were no rules. `ClubFlow` assembled a subscription document in the
 * browser - plan, start date, end date, wash count, payment method - and wrote
 * it straight to Firestore, which accepted it because it said `pending`. The
 * studio's activation screen then honoured whatever it found. So the terms of
 * a standing entitlement were the customer's to write, and the only thing
 * standing between that and free washes was somebody in the studio noticing.
 *
 * Everything a subscription needs is derivable from two facts the server
 * already has: WHICH PLAN, and WHEN. This is that derivation, and the decision
 * about whether the request may be made at all.
 *
 * Pure - no Firebase, no React, no routes, no clock of its own.
 */
import type { MembershipPlan, MembershipPlanConfig, Subscription } from '@/lib/types';
import { MEMBERSHIP_PLANS } from '@/lib/types';
import { cycleEnd, isLapsed, washesGrantedBy } from './club';
import { termState } from './term';
import { studioDay } from './lifecycle';

/** The plan, or nothing. A name that is not in the catalogue is not a plan. */
export const planOf = (id: unknown): MembershipPlanConfig | undefined =>
  MEMBERSHIP_PLANS.find(p => p.id === id);

/** Studio-local today. The studio keeps studio time (see `lib/os/lifecycle`). */
export const studioToday = (now: Date = new Date()): string =>
  studioDay(now);

/* ── IS THIS MEMBERSHIP STILL STANDING? ──────────────────────────────────── */

/**
 * A membership HOLDS while it is active and its cycle has not run out -
 * including the grace week, because grace is when a renewal is most likely and
 * refusing one then is the product working against itself.
 *
 * `isLapsed` answers the narrower question the nightly job asks; this is the
 * one every decision here needs, and it is written once.
 */
export const membershipHolds = (
  sub: Pick<Subscription, 'status' | 'endDate'> | null | undefined,
  now: Date = new Date(),
): boolean => {
  if (!sub || sub.status !== 'active') return false;
  return termState(sub.endDate, { grace: true, now }) !== 'lapsed';
};

/** The one the customer is actually in, out of everything they have held. */
export const standingMembership = (
  subs: readonly Subscription[], now: Date = new Date(),
): Subscription | undefined => subs.find(s => membershipHolds(s, now));

/** The one they have asked for and the studio has not answered. */
export const openRequest = (
  subs: readonly Subscription[],
): Subscription | undefined => subs.find(s => s.status === 'pending');

/* ── MAY THIS REQUEST BE MADE? ───────────────────────────────────────────── */

export type JoinRefusal =
  | 'plan-unknown'
  | 'payment-method-invalid'
  /** one is already with the studio, unanswered */
  | 'already-pending'
  /** they are already in the Club on this plan or a better one */
  | 'already-a-member'
  /** the reference they offered is not one */
  | 'reference-invalid';

export type JoinIntent =
  /** nothing standing, nothing pending - the ordinary first join */
  | { act: 'join' }
  /** a cycle that has ended, or is in its grace week and being renewed */
  | { act: 'renew' }
  /** standing, and the chosen plan costs strictly more */
  | { act: 'upgrade'; supersedes: Subscription };

export type JoinVerdict =
  | { ok: true; intent: JoinIntent }
  | { ok: false; reason: JoinRefusal };

/**
 * WHAT A CUSTOMER MAY ASK FOR, GIVEN WHAT THEY ALREADY HAVE.
 *
 * Three answers and no fourth:
 *
 *   JOIN     nothing stands. The ordinary case.
 *   RENEW    a cycle has ended, or is ending. A NEW subscription - the old one
 *            keeps its own dates and its own revenue.
 *   UPGRADE  one stands and the customer wants MORE of it. Allowed, because a
 *            member reaching for a bigger plan is the one request the studio
 *            never wants to refuse; it supersedes what it replaces when the
 *            studio activates it.
 *
 * A DOWNGRADE or a re-join on the same plan while one is running is refused,
 * and deliberately: both are ways to restart a cycle early, which is a way to
 * be granted a second month of washes for one month's money. Leaving and
 * rejoining is the honest path and the product offers it.
 *
 * A SECOND PENDING REQUEST is refused outright. The studio answers one
 * question about one customer at a time; two open requests is how a counter
 * activates the wrong one.
 */
export function mayJoin(args: {
  plan: unknown;
  /** every subscription this customer has ever held, newest first */
  held: readonly Subscription[];
  now?: Date;
}): JoinVerdict {
  const plan = planOf(args.plan);
  if (!plan) return { ok: false, reason: 'plan-unknown' };

  const now = args.now ?? new Date();

  if (openRequest(args.held)) return { ok: false, reason: 'already-pending' };

  const standing = standingMembership(args.held, now);
  if (!standing) {
    /* Held one before? Then this is a renewal rather than a first join. The
       distinction is only ever a word to the customer - the record written is
       identical - but the product should know which it is. */
    return { ok: true, intent: { act: args.held.length > 0 ? 'renew' : 'join' } };
  }

  const current = planOf(standing.plan);
  /* A plan the catalogue has since dropped cannot be compared, so a member on
     one may always move to a current plan. Refusing would strand them. */
  if (current && plan.price <= current.price) {
    return { ok: false, reason: 'already-a-member' };
  }
  return { ok: true, intent: { act: 'upgrade', supersedes: standing } };
}

/* ── THE DOCUMENT THE SERVER WRITES ──────────────────────────────────────── */

/**
 * Every field of a subscription, derived.
 *
 * NOTHING HERE COMES FROM A REQUEST except the plan name and the payment
 * method, and both are checked against a closed set before they arrive. The
 * price is the catalogue's, the dates are the clock's, the wash count is
 * `washesGrantedBy` - the same function every customer surface reads, so the
 * card and the entitlement cannot disagree.
 */
export interface DerivedSubscription {
  plan: MembershipPlan;
  status: 'pending';
  startDate: string;
  endDate: string;
  washesTotal: number;
  washesIncluded: number;
  washesUsed: 0;
  amountDue: number;
  paymentMethod: 'upi' | 'cash';
}

export const PAYMENT_METHODS: readonly string[] = ['upi', 'cash'];

export function deriveSubscription(args: {
  plan: MembershipPlanConfig;
  paymentMethod: 'upi' | 'cash';
  now?: Date;
}): DerivedSubscription {
  const start = studioToday(args.now ?? new Date());
  const granted = washesGrantedBy({ plan: args.plan.id });
  return {
    plan: args.plan.id,
    status: 'pending',
    startDate: start,
    endDate: cycleEnd(start),
    washesTotal: granted,
    washesIncluded: granted,
    washesUsed: 0,
    amountDue: args.plan.price,
    paymentMethod: args.paymentMethod,
  };
}

/**
 * ONE REQUEST PER CUSTOMER PER PLAN PER DAY, by construction.
 *
 * The id is derived from those three facts, so a double tap lands on the SAME
 * document and Firestore's own write conflict resolves it - rather than two
 * subscriptions, two notifications to the studio, and a counter choosing.
 */
export const subscriptionIdFor = (
  uid: string, plan: MembershipPlan, startDate: string,
): string => `${uid}_${plan}_${startDate}`;

/* ── THE CUSTOMER'S CLAIM ABOUT PAYING ───────────────────────────────────── */

/**
 * A UPI reference, or a bank's own transaction id. Deliberately permissive on
 * the characters and strict on the shape: banks differ, and a regex that tried
 * to enumerate them would refuse a real reference the week a bank changed one.
 *
 * IT ACTIVATES NOTHING. `submitPaymentReference` records exactly this kind of
 * claim against a visit and the car stays where it is; a membership reference
 * is the same claim and the Club stays pending until the studio has seen the
 * money.
 */
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9 /-]{3,39}$/;

export const normaliseReference = (raw: string): string =>
  (raw ?? '').toUpperCase().replace(/\s+/g, ' ').trim();

export const isReference = (raw: unknown): boolean =>
  typeof raw === 'string' && REFERENCE.test(normaliseReference(raw));

/* ── WORDS ───────────────────────────────────────────────────────────────── */

/** §21.8 - the customer's word for each state, never the enum. */
export const MEMBERSHIP_WORD: Record<Subscription['status'], string> = {
  pending: 'With the studio',
  active: 'Running',
  expired: 'Ended',
  cancelled: 'Left',
  rejected: 'Not taken up',
};

/** Has the nightly job got work to do on this one? */
export const needsExpiring = (sub: Subscription, now = new Date()): boolean =>
  isLapsed(sub, now);
