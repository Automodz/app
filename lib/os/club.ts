/**
 * The Club's model (P2D1 §C7 · P2D3 C-10).
 *
 * Membership as a relationship, not a plan: which state it is in, what is
 * left of it this cycle, and when it renews. The lifecycle itself belongs to
 * the term engine (membership is the one term that gets grace) and the
 * counts belong to the subscription document - nothing is recomputed here.
 */
import type { Booking, Subscription } from '@/lib/types';
import { MEMBERSHIP_PLANS } from '@/lib/types';
import { termState, daysLeft } from './term';

export type ClubState = 'none' | 'pending' | 'active' | 'grace' | 'lapsed';

export interface ClubModel {
  state: ClubState;
  plan: string | null;
  since: string | null;
  /** the cycle's own arithmetic, straight off the membership */
  washesLeft: number;
  washesUsed: number;
  washesTotal: number;
  renewsOn: string | null;
  /** one true sentence under the card, or nothing */
  context: string | null;
  /** the studio hasn't taken payment yet */
  awaitingPayment: boolean;
  /** a car that washes often, with no membership - the invitation may show */
  invited: boolean;
}

const fmtLong = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

/** The invitation is earned, not pushed: it appears after the second visit. */
export const INVITE_AFTER_VISITS = 2;

/**
 * Washes left on a raw subscription.
 *
 * `clubModel` gives the same number as part of the whole picture, but three
 * callers only have a `Subscription` in hand and were each subtracting it
 * themselves. One subtraction, one place - §22.2.
 */
export const washesLeftOf = (
  sub: { plan?: string; washesTotal?: number; washesIncluded?: number; washesUsed?: number } | null,
): number => Math.max(0, washesGrantedBy(sub) - (sub?.washesUsed ?? 0));

/**
 * WHAT THE PLAN GRANTS - and why this is not simply `sub.washesTotal`.
 *
 * A production Gold subscription carried BOTH `washesIncluded: 8` and
 * `washesTotal: 16`, while `MEMBERSHIP_PLANS.Gold.washesPerMonth` is 8 and the
 * plan's own perk line reads "8 Premium Washes / month". Reading `washesTotal`
 * made every customer surface say "10 of 16 washes left" over a benefits list
 * that said 8 - the product overstating what the customer was owed, by eight
 * washes, in its own words, on one screen.
 *
 * THE PLAN THE CUSTOMER BOUGHT IS THE AUTHORITY. A count copied onto the
 * subscription document is a cache, and this one had drifted; the catalogue is
 * the thing the customer actually agreed to and the thing the benefits list is
 * rendered from, so the two can no longer disagree.
 *
 * The document is still read, in order, for the cases the catalogue cannot
 * answer: a legacy plan name no longer in the catalogue, or a bespoke
 * arrangement the studio wrote by hand. `washesIncluded` is preferred over
 * `washesTotal` because where both exist, `washesIncluded` is the one that has
 * always agreed with the plan.
 */
export function washesGrantedBy(
  sub: { plan?: string; washesTotal?: number; washesIncluded?: number } | null,
): number {
  if (!sub) return 0;
  const configured = MEMBERSHIP_PLANS.find(p => p.id === sub.plan)?.washesPerMonth;
  return configured ?? sub.washesIncluded ?? sub.washesTotal ?? 0;
}

/**
 * Has this membership run out?
 *
 * The rule, not the query. The client service and the nightly job read
 * subscriptions through different SDKs but must agree on what "lapsed" means,
 * and before this they each wrote `endDate < today` themselves.
 */
export const isLapsed = (
  sub: { status?: string; endDate?: string } | null,
  now = new Date(),
): boolean =>
  !!sub
  && sub.status === 'active'
  && !!sub.endDate
  && sub.endDate < now.toISOString().split('T')[0];

/** A cycle is thirty days. The one place that arithmetic is written. */
export const CYCLE_DAYS = 30;

/**
 * When a cycle beginning on `fromISO` ends.
 *
 * Lived inside the old `JoinClub` component, which meant the length of a
 * membership cycle was a fact known only to a piece of UI. It belongs to the
 * engine that owns the lifecycle, so joining, renewing and upgrading all get
 * the same answer (§22.2).
 */
export const cycleEnd = (fromISO: string): string => {
  const d = new Date(`${fromISO}T12:00:00`);
  d.setDate(d.getDate() + CYCLE_DAYS);
  return d.toISOString().split('T')[0];
};

export function clubModel(args: {
  membership: Subscription | null;
  /** this customer's completed visits */
  completed: Booking[];
  now?: Date;
}): ClubModel {
  const { membership: m, completed, now = new Date() } = args;

  const none: ClubModel = {
    state: 'none', plan: null, since: null,
    washesLeft: 0, washesUsed: 0, washesTotal: 0,
    renewsOn: null, context: null, awaitingPayment: false,
    invited: completed.length >= INVITE_AFTER_VISITS,
  };

  if (!m || m.status === 'cancelled') return none;

  /* The catalogue, not the document - see `washesGrantedBy`. */
  const washesTotal = washesGrantedBy(m);
  const washesUsed = m.washesUsed ?? 0;
  const washesLeft = Math.max(0, washesTotal - washesUsed);

  // one lifecycle, from the one term engine (membership gets grace)
  const term = termState(m.endDate, { grace: true, now });
  const state: ClubState =
    m.status === 'pending' ? 'pending'
    : m.status === 'expired' || term === 'lapsed' ? 'lapsed'
    : term === 'grace' ? 'grace'
    : 'active';

  const context =
    state === 'pending' ? null // the card carries its own confirming line
    : state === 'lapsed' ? 'Rejoin any time - your history holds.'
    : state === 'grace'
    ? `The cycle ended ${fmtLong(m.endDate)} - renew to keep it going.`
    : `${washesLeft} wash${washesLeft === 1 ? '' : 'es'} left this cycle · renews ${fmtLong(m.endDate)}`;

  return {
    state,
    plan: m.plan,
    since: m.startDate,
    washesLeft, washesUsed, washesTotal,
    renewsOn: m.endDate,
    context,
    awaitingPayment: state === 'pending',
    invited: false,
  };
}

/** Days until the cycle ends - the term engine's count, not a second one. */
export const cycleDaysLeft = (m: ClubModel, now = new Date()): number | null =>
  m.renewsOn ? daysLeft(m.renewsOn, now) : null;

/**
 * The honest arithmetic for a plan: what the customer's own cadence has been
 * against what the plan covers. Silent when there isn't enough history to say
 * anything true.
 */
export function cadenceLine(args: {
  washesPerMonth: number;
  /** completed wash visits, newest first */
  washes: Booking[];
  now?: Date;
}): string | null {
  const { washesPerMonth, washes, now = new Date() } = args;
  if (washes.length < 2) return null;
  const oldest = washes[washes.length - 1];
  const days = Math.round(
    (now.getTime() - new Date(`${oldest.scheduledDate}T12:00:00`).getTime()) / 86400000,
  );
  // a month of history is the least that can be said honestly
  if (days < 30) return null;
  const perMonth = washes.length / (days / 30);
  const rounded = Math.round(perMonth * 10) / 10;
  return `You wash about ${rounded} time${rounded === 1 ? '' : 's'} a month · this covers ${washesPerMonth}.`;
}
