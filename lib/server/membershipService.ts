import 'server-only';
/**
 * THE MEMBERSHIP SERVICE — the only thing that may put a customer in the Club.
 *
 * ── THE CONTRACT, and it is the Booking Service's contract ───────────────
 *   The client expresses INTENT: which plan, and how they mean to pay.
 *   The server decides EVERYTHING ELSE: the price, the dates, the wash count,
 *   and whether the request may be made at all.
 *   The studio decides ACTIVATION, against money it has actually seen.
 *
 * There is no field a caller can set that changes what they get. `amountDue`,
 * `startDate`, `endDate`, `washesTotal` and `status` are never read off a
 * request — they are derived in `lib/os/membership.ts` from the plan name and
 * the clock, and the plan name is checked against the catalogue before it is
 * used for anything.
 *
 * ── WHAT THIS REPLACES ───────────────────────────────────────────────────
 * `ClubFlow` wrote the subscription itself, from the browser, and
 * `firestore.rules` allowed it because the document said `pending`. A customer
 * could therefore have written `plan: 'Platinum'`, `washesTotal: 999` and
 * `endDate: '2099-12-31'`, paid for Silver at the counter, and been activated
 * by a studio screen that had no reason to doubt the record in front of it.
 *
 * ── AND HISTORY IS NOT REVIVED ───────────────────────────────────────────
 * Rejoining writes a NEW subscription. The cycle that ended keeps its own
 * dates, its own `paidAt` and its own `amountPaid`, because membership revenue
 * is reported on those and a report that can be rewritten is not a report.
 */
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin';
import {
  mayJoin, deriveSubscription, planOf, subscriptionIdFor, standingMembership,
  isReference, normaliseReference, PAYMENT_METHODS, studioToday,
} from '@/lib/os/membership';
import { membershipTransition, type MembershipState } from '@/lib/os/lifecycle';
/* One cycle, one implementation. Nothing here owns a second copy of "thirty
   days" — the engine that owns the lifecycle owns the arithmetic. */
import { cycleEnd as cycleEndOf } from '@/lib/os/club';
import type { Subscription, User } from '@/lib/types';

export class MembershipError extends Error {
  constructor(readonly code: string, readonly status = 409) {
    super(code);
  }
}

const SUBSCRIPTIONS = 'subscriptions';

const db = () => {
  if (!adminDb) throw new MembershipError('not-configured', 503);
  return adminDb;
};

const rows = (snap: { docs: { id: string; data: () => unknown }[] }): Subscription[] =>
  snap.docs.map(d => ({ ...(d.data() as object), id: d.id }) as Subscription);

/** Newest first, deterministic when two share a moment. */
const byNewest = (a: Subscription, b: Subscription) =>
  ((b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
  || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

/** Is this caller the studio? Read from their own profile, never the body. */
export async function isStudio(uid: string): Promise<boolean> {
  const profile = await db().collection('users').doc(uid).get();
  return ['admin', 'employee'].includes((profile.data()?.role as string) ?? '');
}

/* ── JOIN, RENEW, UPGRADE ────────────────────────────────────────────────── */

export interface JoinResult {
  subscriptionId: string;
  status: MembershipState;
  /** `join` · `renew` · `upgrade` — what the server decided this actually is. */
  act: 'join' | 'renew' | 'upgrade';
  /** What the studio will ask for, in rupees. Derived, never sent. */
  amountDue: number;
  /** True when the same request was already in and nothing new was written. */
  replay: boolean;
}

export async function joinMembership(
  uid: string,
  input: { plan?: unknown; paymentMethod?: unknown } | null,
  now: Date = new Date(),
): Promise<JoinResult> {
  const plan = planOf(input?.plan);
  if (!plan) throw new MembershipError('plan-unknown', 400);

  const method = input?.paymentMethod;
  if (typeof method !== 'string' || !PAYMENT_METHODS.includes(method)) {
    throw new MembershipError('payment-method-invalid', 400);
  }

  /**
   * THE CUSTOMER'S OWN DETAILS COME FROM THEIR OWN PROFILE.
   *
   * `ClubFlow` sent `userName`, `userEmail` and `userPhone` in the payload, so
   * the name the studio saw beside a membership was a string the browser chose.
   * It is a display field, not an authorisation one — but a counter reading
   * "Aarav Shah" off a record somebody else wrote is a counter being lied to.
   */
  const profile = (await db().doc(`users/${uid}`).get()).data() as Partial<User> | undefined;

  const derived = deriveSubscription({ plan, paymentMethod: method as 'upi' | 'cash', now });
  const id = subscriptionIdFor(uid, plan.id, derived.startDate);

  return db().runTransaction(async tx => {
    /* The exact document first — this is what makes a double tap a database
       conflict rather than a race. Then everything the customer holds, so the
       decision is made against the record and not against a stale read. */
    const mineRef = db().collection(SUBSCRIPTIONS).doc(id);
    const mine = await tx.get(mineRef);
    const held = rows(await tx.get(
      db().collection(SUBSCRIPTIONS).where('userId', '==', uid),
    )).sort(byNewest);

    if (mine.exists) {
      const prior = { ...(mine.data() as object), id } as Subscription;
      /* The same plan, asked for again on the same day. Answer with what is
         there: pending is still pending, and active is already granted. */
      if (prior.status === 'pending' || prior.status === 'active') {
        return {
          subscriptionId: id,
          status: prior.status,
          act: 'join' as const,
          amountDue: prior.amountDue ?? plan.price,
          replay: true,
        };
      }
      /* Refused or cancelled earlier today, and now asked for again. That is a
         new act and deserves a new record rather than a dead end. */
      throw new MembershipError(`already-${prior.status}`, 409);
    }

    const verdict = mayJoin({ plan: plan.id, held, now });
    if (!verdict.ok) throw new MembershipError(verdict.reason, 409);

    tx.create(mineRef, {
      userId: uid,
      userName: profile?.name ?? '',
      userEmail: profile?.email ?? '',
      userPhone: profile?.phone ?? '',
      ...derived,
      ...(verdict.intent.act === 'upgrade'
        ? { supersedesId: verdict.intent.supersedes.id }
        : {}),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      subscriptionId: id,
      status: 'pending' as const,
      act: verdict.intent.act,
      amountDue: derived.amountDue,
      replay: false,
    };
  });
}

/**
 * THE STUDIO STARTS ONE AT THE COUNTER.
 *
 * A customer signs up in person and pays there and then, so there is no
 * request to answer — the studio creates it and it is active immediately.
 *
 * It runs through the SAME derivation as a customer's own request, which is
 * the point: the admin console used to assemble the document itself (plan,
 * dates, wash count) and write `status: 'active'` straight to Firestore. Two
 * writers meant two chances for the terms to drift from the catalogue, and the
 * console's copy had no `amountPaid` at all — so a membership sold at the
 * counter carried no revenue figure.
 */
export async function startMembershipForCustomer(
  actorUid: string,
  input: { userId?: unknown; plan?: unknown; paymentMethod?: unknown } | null,
  now: Date = new Date(),
): Promise<JoinResult> {
  if (!await isStudio(actorUid)) throw new MembershipError('not-yours-to-make', 403);

  const forUid = typeof input?.userId === 'string' ? input.userId.trim() : '';
  if (!forUid) throw new MembershipError('customer-required', 400);

  const plan = planOf(input?.plan);
  if (!plan) throw new MembershipError('plan-unknown', 400);
  const method = input?.paymentMethod;
  if (typeof method !== 'string' || !PAYMENT_METHODS.includes(method)) {
    throw new MembershipError('payment-method-invalid', 400);
  }

  const profileSnap = await db().doc(`users/${forUid}`).get();
  if (!profileSnap.exists) throw new MembershipError('customer-not-found', 404);
  const profile = profileSnap.data() as Partial<User> | undefined;

  const derived = deriveSubscription({ plan, paymentMethod: method as 'upi' | 'cash', now });
  const id = subscriptionIdFor(forUid, plan.id, derived.startDate);

  return db().runTransaction(async tx => {
    const mineRef = db().collection(SUBSCRIPTIONS).doc(id);
    const mine = await tx.get(mineRef);
    const held = rows(await tx.get(
      db().collection(SUBSCRIPTIONS).where('userId', '==', forUid),
    ));

    if (mine.exists) {
      const prior = { ...(mine.data() as object), id } as Subscription;
      if (prior.status === 'active') {
        return {
          subscriptionId: id, status: 'active' as const, act: 'join' as const,
          amountDue: prior.amountDue ?? plan.price, replay: true,
        };
      }
      throw new MembershipError(`already-${prior.status}`, 409);
    }

    /* One standing membership, here too. Anything else running is closed in
       the SAME commit rather than left to a second write nobody makes. */
    for (const other of held) {
      if (other.status !== 'active') continue;
      if (!membershipTransition('active', 'cancelled', 'studio').ok) continue;
      tx.update(db().collection(SUBSCRIPTIONS).doc(other.id), {
        status: 'cancelled',
        adminNotes: `Superseded by ${id}`,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    tx.create(mineRef, {
      userId: forUid,
      userName: profile?.name ?? '',
      userEmail: profile?.email ?? '',
      userPhone: profile?.phone ?? '',
      ...derived,
      status: 'active',
      paidAt: Timestamp.fromDate(now),
      amountPaid: derived.amountDue,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      subscriptionId: id, status: 'active' as const, act: 'join' as const,
      amountDue: derived.amountDue, replay: false,
    };
  });
}

/* ── THE CUSTOMER'S CLAIM ABOUT PAYING ───────────────────────────────────── */

/**
 * "I have paid, here is the reference."
 *
 * A CLAIM. It writes `transactionId` and a timestamp and moves no status —
 * exactly what `submitPaymentReference` does for a visit, and for the same
 * reason: a customer returning from their bank application has said something,
 * not proved it.
 */
export async function claimMembershipPayment(
  uid: string,
  input: { subscriptionId?: unknown; reference?: unknown } | null,
  now: Date = new Date(),
): Promise<{ subscriptionId: string; status: MembershipState }> {
  const id = typeof input?.subscriptionId === 'string' ? input.subscriptionId.trim() : '';
  if (!id) throw new MembershipError('subscription-required', 400);
  if (!isReference(input?.reference)) throw new MembershipError('reference-invalid', 400);
  const reference = normaliseReference(input?.reference as string);

  return db().runTransaction(async tx => {
    const ref = db().collection(SUBSCRIPTIONS).doc(id);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new MembershipError('not-found', 404);
    const held = { ...(snap.data() as object), id } as Subscription;

    /* OWNERSHIP FROM THE DOCUMENT, COMPARED WITH THE SESSION. Another
       customer's subscription id is simply not theirs to speak about. */
    if (held.userId !== uid) throw new MembershipError('not-yours', 403);
    if (held.status !== 'pending') throw new MembershipError(`already-${held.status}`, 409);

    tx.update(ref, {
      transactionId: reference,
      paymentClaimedAt: Timestamp.fromDate(now),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { subscriptionId: id, status: 'pending' as const };
  });
}

/* ── LEAVING ─────────────────────────────────────────────────────────────── */

export async function cancelMembership(
  uid: string,
  input: { subscriptionId?: unknown } | null,
): Promise<{ subscriptionId: string; status: MembershipState }> {
  const id = typeof input?.subscriptionId === 'string' ? input.subscriptionId.trim() : '';
  if (!id) throw new MembershipError('subscription-required', 400);

  return db().runTransaction(async tx => {
    const ref = db().collection(SUBSCRIPTIONS).doc(id);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new MembershipError('not-found', 404);
    const held = { ...(snap.data() as object), id } as Subscription;
    if (held.userId !== uid) throw new MembershipError('not-yours', 403);

    const move = membershipTransition(held.status, 'cancelled', 'customer');
    if (!move.ok) throw new MembershipError(move.reason ?? 'illegal-transition', 409);

    tx.update(ref, { status: 'cancelled', updatedAt: FieldValue.serverTimestamp() });
    return { subscriptionId: id, status: 'cancelled' as const };
  });
}

/* ── THE STUDIO'S DECISION ───────────────────────────────────────────────── */

export interface DecideResult {
  subscriptionId: string;
  status: MembershipState;
  /** The membership an upgrade replaced, when it replaced one. */
  supersededId?: string;
}

/**
 * ACTIVATE OR REFUSE — the only door to a standing entitlement.
 *
 * `paidAt` and `amountPaid` are stamped exactly once and never moved: they are
 * what membership revenue is reported on, and a report that drifts when a
 * record is touched again is not a report. `amountPaid` comes from what the
 * customer was told they owed (`amountDue`, itself derived from the catalogue
 * at the moment of the request) rather than from today's price list, so a
 * price change cannot rewrite last year.
 */
export async function decideMembership(
  actorUid: string,
  input: { subscriptionId?: unknown; decision?: unknown; reason?: unknown } | null,
  now: Date = new Date(),
): Promise<DecideResult> {
  const id = typeof input?.subscriptionId === 'string' ? input.subscriptionId.trim() : '';
  if (!id) throw new MembershipError('subscription-required', 400);

  const decision = input?.decision;
  if (decision !== 'activate' && decision !== 'reject') {
    throw new MembershipError('decision-invalid', 400);
  }
  const reason = typeof input?.reason === 'string' ? input.reason.trim().slice(0, 300) : '';

  if (!await isStudio(actorUid)) throw new MembershipError('not-yours-to-make', 403);

  return db().runTransaction(async tx => {
    const ref = db().collection(SUBSCRIPTIONS).doc(id);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new MembershipError('not-found', 404);
    const held = { ...(snap.data() as object), id } as Subscription;

    const to: MembershipState = decision === 'activate' ? 'active' : 'rejected';
    const move = membershipTransition(held.status, to, 'studio');
    if (!move.ok) throw new MembershipError(move.reason ?? 'illegal-transition', 409);

    if (to === 'rejected') {
      tx.update(ref, {
        status: 'rejected',
        ...(reason ? { adminNotes: reason } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { subscriptionId: id, status: 'rejected' as const };
    }

    /* Everything else this customer holds, read inside the transaction so a
       second activation racing this one conflicts rather than leaving two
       standing memberships. */
    const siblings = rows(await tx.get(
      db().collection(SUBSCRIPTIONS).where('userId', '==', held.userId),
    ));

    /**
     * ONE STANDING MEMBERSHIP, ENFORCED AT THE WRITE.
     *
     * An upgrade names what it supersedes, but the rule may not depend on that
     * field being right: anything else of this customer's that still holds is
     * closed here, whatever put it there. A customer with two active
     * subscriptions is a customer with two wash allowances.
     */
    let supersededId: string | undefined;
    for (const other of siblings) {
      if (other.id === id) continue;
      /**
       * ACTIVE — because a customer with two running memberships has two wash
       * allowances.
       *
       * AND PENDING — because the studio has just answered this customer's
       * question, and any other open request is now a question nobody will
       * ask again. `mayJoin` refuses a second open request going forward, but
       * PRODUCTION ALREADY HOLDS TWO for one customer (a Silver and a
       * Platinum, both asked for on 11 August, from before that rule existed).
       * Closing them here makes the invariant self-healing rather than needing
       * a migration — and a request left `pending` for ever is one the nightly
       * job nags the studio about every single day.
       */
      if (other.status !== 'active' && other.status !== 'pending') continue;
      const step = membershipTransition(other.status, 'cancelled', 'studio');
      if (!step.ok) continue;
      tx.update(db().collection(SUBSCRIPTIONS).doc(other.id), {
        status: 'cancelled',
        adminNotes: `Superseded by ${id}`,
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (other.status === 'active') supersededId = other.id;
    }

    /**
     * THE CYCLE STARTS WHEN THE MONEY IS SEEN, not when the request was typed.
     *
     * A request made on Monday and paid for on Thursday would otherwise hand
     * the customer twenty-seven days of a thirty-day cycle. The dates are
     * re-derived here from the studio's clock, and they are still never the
     * browser's.
     */
    const start = studioToday(now);
    const price = held.amountDue ?? planOf(held.plan)?.price;

    tx.update(ref, {
      status: 'active',
      startDate: start,
      endDate: cycleEndOf(start),
      ...(held.paidAt ? {} : { paidAt: Timestamp.fromDate(now) }),
      ...(held.amountPaid == null && price != null ? { amountPaid: price } : {}),
      ...(reason ? { adminNotes: reason } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { subscriptionId: id, status: 'active' as const, supersededId };
  });
}

/* ── THE NIGHTLY JOB ─────────────────────────────────────────────────────── */

/**
 * Persist expiry for memberships whose cycle has run out.
 *
 * Was `expireLapsedSubscriptions` in lib/services/subscriptions.ts, called from
 * the ADMIN PAGE ON LOAD — so whether a customer's membership had expired
 * depended on somebody in the studio having opened a screen. Every customer
 * surface computed it on the fly instead, which is right for a read and wrong
 * as the only writer. Attributed to `system`, through the same table every
 * other transition goes through.
 */
export async function expireLapsedMemberships(now: Date = new Date()): Promise<number> {
  const snap = await db().collection(SUBSCRIPTIONS).where('status', '==', 'active').get();
  const today = studioToday(now);
  const done: string[] = [];
  for (const d of snap.docs) {
    const sub = { ...(d.data() as object), id: d.id } as Subscription;
    if (!sub.endDate || sub.endDate >= today) continue;
    if (!membershipTransition('active', 'expired', 'system').ok) continue;
    await d.ref.update({ status: 'expired', updatedAt: FieldValue.serverTimestamp() });
    done.push(d.id);
  }
  return done.length;
}

/** Every membership one customer has ever held, newest first. */
export async function membershipsOf(uid: string): Promise<Subscription[]> {
  const snap = await db().collection(SUBSCRIPTIONS).where('userId', '==', uid).get();
  return rows(snap).sort(byNewest);
}

/** The one in force right now, or nothing. Reads the engine's own rule. */
export const standingOf = standingMembership;
