import type { Booking } from '@/lib/types';
/* `visitPhase` is gone from here with the derivation that used it. */
import { careAct, ACT_TITLE } from './visit';
import { daysLeft, termState } from './term';

/**
 * truthOf() - the one sentence under the car's name (design B1).
 * Priority is law: in studio > ready > agreed > term edge > care due > protected > quiet.
 * Pure derivation; never stored.
 */
export interface ProtectionFact {
  label: string;      // "Ceramic coat"
  expiresOn: string;  // ISO date
}

/**
 * IT IS HANDED THE TWO VISITS, IT DOES NOT FIND THEM.
 *
 * This took the whole booking list and worked out both for itself - the live
 * one by phase, the next one by filtering open bookings and sorting on
 * `scheduledDate`. That was the THIRD implementation of "the next visit" in the
 * product, and the last one standing after `agreedOf` and `liveBooking` were
 * collapsed into `nextVisitOf`. It was invisible until then only because Home
 * suppressed this sentence whenever a visit was booked; the moment lapsed
 * requests stopped counting as booked, the suppression lifted and this line
 * started announcing the very bookings that had just been retired - "Cared for"
 * in the largest type on the screen, and directly under it "Friday 11:00 -
 * we're ready for it." about a Friday that had gone.
 *
 * The priority law below is this engine's and stays here. WHICH booking is
 * live and WHICH is next is not this engine's question, and asking it a second
 * way is how two sentences about one car end up disagreeing.
 */
export interface TruthInput {
  /** The visit in flight - `liveOf`, decided once. */
  live: Booking | null;
  /** THE next visit - `nextVisitOf`, decided once. Never re-derived here. */
  next: Booking | null;
  protections: ProtectionFact[];  // this vehicle's live promises
  lastCaredOn?: string;           // ISO date of last completed visit
  now?: Date;
}

const fmtDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long' });

export function truthOf({ live, next, protections, lastCaredOn, now = new Date() }: TruthInput): string {
  if (live) {
    const act = careAct(live.status);
    if (act === 'ready') return 'Ready for collection.';
    return act ? `In the studio - ${ACT_TITLE[act].toLowerCase()}.` : 'In the studio.';
  }

  if (next) {
    const day = fmtDay(next.scheduledDate);
    /* A booking without an hour is a real record - the walk-in flow writes
       one. Naming an hour that does not exist would be inventing a fact. */
    return next.scheduledTime
      ? `${day} ${next.scheduledTime} - we're ready for it.`
      : `${day} - we're ready for it.`;
  }

  const edging = protections
    .map(p => ({ p, state: termState(p.expiresOn, { now }), left: daysLeft(p.expiresOn, now) }))
    .filter(x => x.state === 'waning' || x.state === 'expiring')
    .sort((a, b) => a.left - b.left)[0];
  if (edging) {
    return `${edging.p.label} - ${edging.left} day${edging.left === 1 ? '' : 's'} of protection left.`;
  }

  if (lastCaredOn) {
    const since = -daysLeft(lastCaredOn, now);
    if (since >= 30) return `Last cared for ${since} days ago.`;
  }

  const alive = protections.filter(p => termState(p.expiresOn, { now }) === 'active');
  if (alive.length > 0) return 'All quiet. Protected.';

  return 'All quiet.';
}
