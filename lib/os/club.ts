/**
 * The Club's model (P2D1 §C7 · P2D3 C-10).
 *
 * Membership as a relationship, not a plan: which state it is in, what is
 * left of it this cycle, and when it renews. The lifecycle itself belongs to
 * the term engine (membership is the one term that gets grace) and the
 * counts belong to the subscription document — nothing is recomputed here.
 */
import type { Booking, Subscription } from '@/lib/types';
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
  /** a car that washes often, with no membership — the invitation may show */
  invited: boolean;
}

const fmtLong = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

/** The invitation is earned, not pushed: it appears after the second visit. */
export const INVITE_AFTER_VISITS = 2;

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

  const washesTotal = m.washesTotal ?? 0;
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
    : state === 'lapsed' ? 'Rejoin any time — your history holds.'
    : state === 'grace'
    ? `The cycle ended ${fmtLong(m.endDate)} — renew to keep it going.`
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

/** Days until the cycle ends — the term engine's count, not a second one. */
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
