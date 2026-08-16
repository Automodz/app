import 'server-only';
/**
 * MID-VISIT APPROVAL - design screen 12.
 *
 * The studio opens a panel, finds something underneath, and the work changes.
 * That is the one moment in this product where a customer agrees to spend more
 * money after the car is already on a bay, and it is the moment with the most
 * ways to go wrong:
 *
 *   · the studio answering on the customer's behalf
 *   · a second tap charging twice
 *   · a figure that moves between being shown and being applied
 *   · an approval that outlives the visit it belonged to
 *
 * Each is closed below, and each is closed in the same place: the transition
 * table in `lib/os/lifecycle` decides who may do what, and the commit that
 * records the answer is the commit that applies it.
 *
 * ── THE FIGURE IS FROZEN AT THE MOMENT OF ASKING ─────────────────────────
 * `before` and `after` are both computed when the studio requests, by
 * `priceVisit`, and stored. The customer taps a total; that exact total is
 * what the job carries afterwards. Recomputing on approval would mean a
 * catalogue edit or a lapsing membership between asking and
 * answering silently changed what was agreed - which is precisely the class of
 * defect the estimate exists to prevent one screen earlier.
 */
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin';
import { priceVisit, pickupFees, taxPolicy, storedBreakdown } from '@/lib/services/pricing';
import {
  approvalTransition, approvalHasExpired, APPROVAL_VALID_HOURS,
} from '@/lib/os/lifecycle';
import type {
  Approval, ApprovalEvidence, Booking, Job, StoredBreakdown, Subscription,
} from '@/lib/types';

export class ApprovalError extends Error {
  constructor(readonly code: string, readonly status = 409) {
    super(code);
  }
}

const today = () => new Date().toISOString().slice(0, 10);

export interface ApprovalRequest {
  jobId: string;
  /** The studio's own sentence. Bounded, never rendered as markup. */
  reason: string;
  detail?: string;
  photos?: ApprovalEvidence[];
  /** The work proposed, priced by the counter. */
  label: string;
  price: number;
  minutes: number;
  /** Recorded, never rendered customer-side. */
  byEmployeeId?: string;
}

/**
 * THE STUDIO ASKS.
 *
 * Staff-only, enforced at the route. What this adds beyond the write is the
 * arithmetic: it loads the job, prices the visit as it stands and as it would
 * be, and stores both - so the customer is shown a delta the studio cannot
 * later dispute and a total the studio cannot later exceed.
 */
export async function requestApproval(
  request: ApprovalRequest,
): Promise<Approval> {
  if (!adminDb) throw new ApprovalError('not-configured', 503);
  const db = adminDb;

  const price = Math.round(Number(request.price));
  const minutes = Math.round(Number(request.minutes));
  if (!Number.isFinite(price) || price <= 0) throw new ApprovalError('price-required', 400);
  if (!Number.isFinite(minutes) || minutes < 0) throw new ApprovalError('minutes-invalid', 400);
  if (!request.reason?.trim()) throw new ApprovalError('reason-required', 400);
  if (!request.label?.trim()) throw new ApprovalError('label-required', 400);

  const jobSnap = await db.collection('jobs').doc(request.jobId).get();
  if (!jobSnap.exists) throw new ApprovalError('job-not-found', 404);
  const job = { id: jobSnap.id, ...(jobSnap.data() as object) } as Job;

  /* A CAR NOBODY OWNS CANNOT BE ASKED. A walk-in whose customer never had an
     account has no one to approve - the counter asks them in person, and this
     object would be a request addressed to nobody. */
  if (!job.customerId) throw new ApprovalError('job-has-no-customer', 409);
  if (job.status === 'completed' || job.status === 'cancelled') {
    throw new ApprovalError('visit-already-closed', 409);
  }

  const booking = job.bookingId
    ? ({ id: job.bookingId, ...((await db.collection('bookings').doc(job.bookingId).get()).data() ?? {}) } as Booking)
    : null;

  /* ── the two figures ──
     The work as it stands, and the work with the proposed line added. Both
     through `priceVisit`, so the delta is the engine's answer and not a
     subtraction somebody did by hand. */
  const currentLines = (job.serviceItems ?? []).map(i => ({ name: i.serviceName, price: i.price }));
  const fees = pickupFees({ pickup: booking?.pickupRequired, drop: booking?.dropRequired });

  const [subSnap] = await Promise.all([
    db.collection('subscriptions').where('userId', '==', job.customerId)
      .orderBy('createdAt', 'desc').limit(1).get(),
  ]);
  const membership = subSnap.docs[0]
    ? ({ id: subSnap.docs[0].id, ...(subSnap.docs[0].data() as object) } as Subscription & { id: string })
    : null;

  const benefit = {
    base: 0,
    category: job.serviceItems?.[0]?.category ?? '',
    serviceId: job.serviceItems?.[0]?.serviceId ?? '',
    ownerId: job.customerId,
    membership,
    /* A membership wash already spent stays spent; this is extra work, and
       extra work is not another free wash. */
    wantsWash: false,
    date: today(),
  };

  const before = storedBreakdown(priceVisit({
    services: currentLines, fees, tax: taxPolicy(), benefit,
  }));
  const after = storedBreakdown(priceVisit({
    services: [...currentLines, { name: request.label.trim(), price }],
    fees, tax: taxPolicy(), benefit,
  }));

  const ref = db.collection('approvals').doc();
  const record = {
    jobId: job.id,
    ...(job.bookingId ? { bookingId: job.bookingId } : {}),
    customerId: job.customerId,
    vehicleId: job.vehicleId ?? '',
    vehicleName: job.vehicleName ?? '',
    reason: request.reason.trim().slice(0, 400),
    ...(request.detail?.trim() ? { detail: request.detail.trim().slice(0, 800) } : {}),
    photos: (request.photos ?? []).slice(0, 6).map(p => ({
      url: String(p.url).slice(0, 1000),
      caption: String(p.caption ?? '').slice(0, 60),
    })),
    proposed: { label: request.label.trim().slice(0, 80), price, minutes },
    /* Never negative. An approval is for MORE work; a reduction is the studio
       correcting an invoice, which is a different act with a different record. */
    priceDelta: Math.max(0, after.total - before.total),
    timeDeltaMinutes: minutes,
    before,
    after,
    status: 'requested' as const,
    ...(request.byEmployeeId ? { requestedByEmployeeId: request.byEmployeeId } : {}),
    expiresAt: Timestamp.fromMillis(Date.now() + APPROVAL_VALID_HOURS * 3600_000),
  };

  await ref.set({ ...record, requestedAt: FieldValue.serverTimestamp() });
  await db.collection('jobs').doc(job.id).update({
    approvalIds: FieldValue.arrayUnion(ref.id),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { id: ref.id, ...record, requestedAt: Timestamp.now() } as unknown as Approval;
}

export interface RespondResult {
  id: string;
  status: 'approved' | 'declined';
  /** true when the answer had already been given - a replay, not a second act. */
  replayed: boolean;
  /** What the job now totals. Unchanged on a decline. */
  total: number;
}

/**
 * THE CUSTOMER ANSWERS.
 *
 * ── IDEMPOTENT, AND NOT BY A MARKER ──────────────────────────────────────
 * The approval's own status is the guard, inside the transaction that applies
 * the change. A second approve finds it already `approved`, applies nothing,
 * and returns the same answer - so a double tap, a retried request and a
 * customer pressing back and forward all cost exactly one charge.
 *
 * ── DECLINING WRITES NOTHING BUT THE ANSWER ──────────────────────────────
 * The original work, its price and its record are untouched. A decline is not
 * a change to the visit; it is the absence of one.
 */
export async function respondToApproval(
  callerUid: string,
  approvalId: string,
  answer: 'approved' | 'declined',
  opts: { now?: Date } = {},
): Promise<RespondResult> {
  if (!adminDb) throw new ApprovalError('not-configured', 503);
  const db = adminDb;
  const now = opts.now ?? new Date();

  return db.runTransaction(async t => {
    const ref = db.collection('approvals').doc(approvalId);
    const snap = await t.get(ref);
    if (!snap.exists) throw new ApprovalError('not-found', 404);
    const approval = { id: snap.id, ...(snap.data() as object) } as Approval;

    /* NOT "forbidden" - the same answer as an id that does not exist, so this
       cannot be used to discover which approvals are real. */
    if (approval.customerId !== callerUid) throw new ApprovalError('not-found', 404);

    /* Already answered: return the answer that was given rather than an error.
       A retry is not a mistake, and the second tap must not charge again. */
    if (approval.status === 'approved' || approval.status === 'declined') {
      const jobSnap = await t.get(db.collection('jobs').doc(approval.jobId));
      return {
        id: approvalId,
        status: approval.status,
        replayed: true,
        total: (jobSnap.data() as { totalAmount?: number } | undefined)?.totalAmount ?? 0,
      };
    }

    /* THE CLOCK RETIRES IT, and the retirement is recorded rather than
       silently refused - otherwise a customer answering a minute late is told
       nothing at all. */
    const requestedAtMs = approval.requestedAt?.toMillis?.() ?? 0;
    if (approvalHasExpired({ status: approval.status, requestedAtMs }, now)) {
      t.update(ref, { status: 'expired', respondedAt: FieldValue.serverTimestamp() });
      throw new ApprovalError('approval-expired', 409);
    }

    const move = approvalTransition(approval.status, answer, 'customer');
    if (!move.ok) throw new ApprovalError(move.reason ?? 'illegal-transition', 409);

    const jobRef = db.collection('jobs').doc(approval.jobId);
    const jobSnap = await t.get(jobRef);
    if (!jobSnap.exists) throw new ApprovalError('job-not-found', 404);
    const job = jobSnap.data() as Job;
    if (job.status === 'completed' || job.status === 'cancelled') {
      throw new ApprovalError('visit-already-closed', 409);
    }

    if (answer === 'declined') {
      /* NOTHING BUT THE ANSWER. The work, the price and the record stand. */
      t.update(ref, { status: 'declined', respondedAt: FieldValue.serverTimestamp() });
      return {
        id: approvalId, status: 'declined' as const, replayed: false,
        total: job.totalAmount ?? 0,
      };
    }

    /* ── APPLIED IN THE SAME COMMIT AS THE ANSWER ──
       The frozen `after` is what the customer tapped, so it is what the job
       carries. Recomputing here would let a catalogue edit between asking and
       answering change what was agreed. */
    const after: StoredBreakdown = approval.after;
    t.update(jobRef, {
      serviceItems: [
        ...(job.serviceItems ?? []),
        {
          serviceId: `approval_${approvalId}`,
          serviceName: approval.proposed.label,
          category: job.serviceItems?.[0]?.category ?? '',
          price: approval.proposed.price,
        },
      ],
      subtotal: after.subtotal,
      totalAmount: after.total,
      /* THE BREAKDOWN MOVES WITH THE TOTAL. A total that changed while its
         working stayed behind is a receipt that cannot be checked. */
      breakdown: after,
      updatedAt: FieldValue.serverTimestamp(),
    });

    /* The commercial twin follows the operational one; a booking claiming the
       old figure is the customer's own screens disagreeing about what they owe. */
    if (approval.bookingId) {
      t.update(db.collection('bookings').doc(approval.bookingId), {
        totalAmount: after.total,
        breakdown: after,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    t.update(ref, { status: 'approved', respondedAt: FieldValue.serverTimestamp() });

    return {
      id: approvalId, status: 'approved' as const, replayed: false, total: after.total,
    };
  }, { maxAttempts: 8 });
}

/* `approvalsForCustomer` STOOD HERE. `loadCustomerPicture` reads the same
   approvals with the same owner scope and hands them to every room, so this
   was a second query for a list the request already had. */


/** One approval, for its owner. Absent and not-yours are the same answer. */
export async function readApproval(uid: string, id: string): Promise<Approval | null> {
  if (!adminDb) return null;
  const snap = await adminDb.collection('approvals').doc(id).get();
  if (!snap.exists) return null;
  const approval = { id: snap.id, ...(snap.data() as object) } as Approval;
  return approval.customerId === uid ? approval : null;
}
