/**
 * THE CLUB, READ FROM A BROWSER - and only read.
 *
 * ── WHAT WAS HERE ────────────────────────────────────────────────────────
 * `createSubscription`, `updateSubscriptionStatus` and
 * `expireLapsedSubscriptions`. All three wrote to Firestore from a browser,
 * and the first was the serious one: it accepted a whole subscription document
 * from its caller - plan, start date, end date, wash count, status - and the
 * rules allowed it so long as the document said `pending`. Rules can check
 * that word and nothing else about it, so `washesTotal: 999` and an `endDate`
 * in 2099 were one devtools session away, and the studio's activation screen
 * had no reason to doubt the record in front of it.
 *
 * All three are now `/api/membership` (POST · PATCH · PUT) over
 * `lib/server/membershipService.ts`, where the plan is checked against the
 * catalogue, the dates come from the studio's own clock, and `active` is a
 * write no browser can reach. Expiry moved to the nightly job, which is where
 * it always belonged - it used to run only when somebody in the studio
 * happened to open a screen.
 */
import {
  collection, getDocs, query, where, orderBy, limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Subscription } from '../types';
import { isLapsed } from '../os/club';

/**
 * Expiry is COMPUTED on read, never written here: a lapsed member must still
 * see their card, and the day their cycle ended must not depend on when a
 * writer last ran.
 */
const withComputedExpiry = (sub: Subscription): Subscription =>
  isLapsed(sub) ? { ...sub, status: 'expired' } : sub;

export const getUserSubscription = async (uid: string): Promise<Subscription | null> => {
  const q = query(
    collection(db, 'subscriptions'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const sub = { id: snap.docs[0].id, ...snap.docs[0].data() } as Subscription;
  return withComputedExpiry(sub);
};

/* `deductMembershipWash` lived here, calling /api/membership/deduct-wash after
   the job had already been written - so a wash could be spent on a visit that
   failed, or a visit could be given away free without spending one. Both routes
   are deleted: the deduction now rides the same commit as the record that
   consumes it (lib/server/bookingService.ts). */

/** The studio's own list. Staff-read by the rules; still never staff-written. */
export const getAllSubscriptions = async (): Promise<Subscription[]> => {
  const snap = await getDocs(query(collection(db, 'subscriptions'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => withComputedExpiry({ id: d.id, ...d.data() } as Subscription));
};
