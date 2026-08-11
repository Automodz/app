import 'server-only';
/**
 * PAYING — design screen 13.
 *
 * ── THE AMOUNT IS NEVER THE CUSTOMER'S ───────────────────────────────────
 * Nothing on the request names a figure. The payable amount is resolved here
 * from the studio's own records through `settlementOf`, and the UPI intent is
 * built from that. A body carrying `amount` would not be rejected — it has no
 * name to be read by.
 *
 * ── AND OPENING A LINK IS NOT A RECEIPT ──────────────────────────────────
 * There is no gateway. The application cannot know whether money moved, so it
 * does not claim to: `submitted` records the customer's word and releases
 * nothing, and only the studio may write `paid`, against money it has seen.
 * Collapsing those two would let a customer release their own car.
 *
 * ── SETTLEMENT IS IDEMPOTENT BY THE PAYMENT'S OWN STATE ──────────────────
 * A second settle finds it already `paid`, writes nothing, and returns the
 * same answer. The ledger entry on the job is keyed by the payment id, so a
 * retried request cannot add the money twice.
 */
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin';
import { settlementOf } from '@/lib/os/settlement';
import { paymentTransition, PAYMENT_INTENT_VALID_MINUTES } from '@/lib/os/lifecycle';
import { buildUpiIntent, isUpiReference, isVpa, normaliseVpa } from '@/lib/os/upi';
import { COMPANY } from '@/lib/company';
import type { Booking, Invoice, Job, Payment, PaymentRecord, Visit } from '@/lib/types';

export class PaymentError extends Error {
  constructor(readonly code: string, readonly status = 409) {
    super(code);
  }
}

/**
 * THE STUDIO'S COLLECTING ADDRESS.
 *
 * Configuration, not a constant in a component: it changes when the studio
 * changes bank, and it must change in exactly one place.
 *
 * `NEXT_PUBLIC_UPI_ID` is the name the deployment already uses, and it is
 * kept — a payee address is meant to be public, it is printed on the counter,
 * and inventing a second name for a value that is already set would mean a
 * deploy where the studio silently stops being payable. `STUDIO_UPI_VPA`
 * overrides it for the day the two need to differ.
 *
 * VALIDATED, not merely read. A malformed address here is every customer
 * tapping Pay and their bank refusing to open, so an unusable value is treated
 * as no value at all and the screen says the studio is not taking UPI in the
 * app — which is true, and is better than a link to nowhere.
 */
export const studioVpa = (): string | null => {
  const raw = process.env.STUDIO_UPI_VPA || process.env.NEXT_PUBLIC_UPI_ID || '';
  return isVpa(raw) ? normaliseVpa(raw) : null;
};

export interface VisitMoney {
  /** The visit the money belongs to, in whichever form it exists. */
  jobId?: string;
  bookingId?: string;
  visitId?: string;
  invoiceId?: string;
  customerId: string;
  vehicleName: string;
}

/**
 * WHAT IS OWED, resolved from the studio's own records.
 *
 * Ownership is checked here and not assumed: the Admin SDK is not subject to
 * rules, so the caller's uid must match the record's customer or nothing is
 * returned. A record that is not theirs is "not found" — the same answer as
 * one that does not exist.
 */
export async function payableFor(
  callerUid: string, bookingId: string,
): Promise<{ money: VisitMoney; payable: number; total: number; received: number }> {
  if (!adminDb) throw new PaymentError('not-configured', 503);
  const db = adminDb;

  const bookingSnap = await db.collection('bookings').doc(bookingId).get();
  if (!bookingSnap.exists) throw new PaymentError('not-found', 404);
  const booking = { id: bookingSnap.id, ...(bookingSnap.data() as object) } as Booking;
  if (booking.userId !== callerUid) throw new PaymentError('not-found', 404);

  const [jobSnap, invoiceSnap, visitSnap] = await Promise.all([
    booking.jobId ? db.collection('jobs').doc(booking.jobId).get() : Promise.resolve(null),
    db.collection('invoices').where('bookingId', '==', bookingId).limit(1).get(),
    db.collection('visits').where('bookingId', '==', bookingId).limit(1).get(),
  ]);

  const job = jobSnap?.exists ? ({ id: jobSnap.id, ...(jobSnap.data() as object) } as Job) : null;
  const invoice = invoiceSnap.docs[0]
    ? ({ id: invoiceSnap.docs[0].id, ...(invoiceSnap.docs[0].data() as object) } as Invoice) : null;
  const visit = visitSnap.docs[0]
    ? ({ id: visitSnap.docs[0].id, ...(visitSnap.docs[0].data() as object) } as Visit) : null;

  const s = settlementOf({
    invoiceTotal: invoice?.total,
    jobTotal: job?.totalAmount,
    bookingTotal: booking.totalAmount,
    received: job?.amountPaid ?? 0,
  });

  return {
    money: {
      ...(job ? { jobId: job.id } : {}),
      bookingId,
      ...(visit ? { visitId: visit.id } : {}),
      ...(invoice ? { invoiceId: invoice.id } : {}),
      customerId: booking.userId,
      vehicleName: booking.vehicleName || booking.vehicleRegNo || 'your car',
    },
    payable: s.payable,
    total: s.total,
    received: s.received,
  };
}

export interface IntentResult {
  payment: Payment;
  /** The `upi://pay` link, built from the SERVER's figure. */
  link: string;
}

/**
 * Build a payment intent for what is actually owed.
 *
 * The customer's own VPA is recorded on the payment — it is which application
 * opens on their phone, and the studio's is the one being paid. Neither
 * decides the amount.
 */
export async function createPaymentIntent(
  callerUid: string, bookingId: string,
): Promise<IntentResult> {
  if (!adminDb) throw new PaymentError('not-configured', 503);
  const db = adminDb;

  const payee = studioVpa();
  if (!payee) throw new PaymentError('upi-not-configured', 503);

  const { money, payable } = await payableFor(callerUid, bookingId);
  if (payable <= 0) throw new PaymentError('nothing-to-pay', 409);

  const profile = await db.collection('users').doc(callerUid).get();
  const customerVpa = (profile.data()?.upiVpa as string | undefined) ?? '';

  /* ONE OPEN INTENT PER VISIT. A customer who taps twice gets the same
     payment, not a second one — otherwise the studio reconciles two records
     for one credit, and a settlement against the wrong one leaves a car
     unreleased. */
  const open = await db.collection('payments')
    .where('bookingId', '==', bookingId)
    .where('status', 'in', ['initiated', 'submitted'])
    .limit(1).get();

  const ref = open.docs[0]?.ref ?? db.collection('payments').doc();
  const existing = open.docs[0]?.data() as Payment | undefined;

  const record = {
    ...money,
    /* THE FIGURE IS RE-RESOLVED even on a replay. A mid-visit approval granted
       between the two taps changes what is owed, and handing back the stale
       link would collect the wrong amount. */
    amount: payable,
    method: 'upi' as const,
    status: (existing?.status === 'submitted' ? 'submitted' : 'initiated') as Payment['status'],
    ...(customerVpa ? { vpa: customerVpa } : {}),
    expiresAt: Timestamp.fromMillis(Date.now() + PAYMENT_INTENT_VALID_MINUTES * 60_000),
  };

  await ref.set({
    ...record,
    ...(existing ? {} : { createdAt: FieldValue.serverTimestamp() }),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return {
    payment: { id: ref.id, ...record, createdAt: Timestamp.now() } as unknown as Payment,
    link: buildUpiIntent({
      payeeVpa: payee,
      payeeName: COMPANY.name,
      amount: payable,
      note: `${money.vehicleName}`,
      reference: ref.id.slice(-12).toUpperCase(),
    }),
  };
}

/**
 * THE CUSTOMER SAYS THEY HAVE PAID.
 *
 * A claim, recorded as one. It does not settle anything, does not release the
 * car, and does not change what is owed — it gives the studio a reference to
 * reconcile against, which is the whole of what a customer can honestly
 * contribute without a gateway.
 */
export async function submitPaymentReference(
  callerUid: string, paymentId: string, reference: string,
): Promise<Payment> {
  if (!adminDb) throw new PaymentError('not-configured', 503);
  if (!isUpiReference(reference)) throw new PaymentError('reference-invalid', 400);
  const db = adminDb;

  return db.runTransaction(async t => {
    const ref = db.collection('payments').doc(paymentId);
    const snap = await t.get(ref);
    if (!snap.exists) throw new PaymentError('not-found', 404);
    const payment = { id: snap.id, ...(snap.data() as object) } as Payment;
    if (payment.customerId !== callerUid) throw new PaymentError('not-found', 404);

    const move = paymentTransition(payment.status, 'submitted', 'customer');
    if (!move.ok) throw new PaymentError(move.reason ?? 'illegal-transition', 409);

    const patch = {
      status: 'submitted' as const,
      reference: reference.trim().toUpperCase(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    t.update(ref, patch);
    return { ...payment, ...patch, updatedAt: Timestamp.now() } as unknown as Payment;
  }, { maxAttempts: 6 });
}

export interface SettleResult {
  id: string;
  status: 'paid';
  /** true when it had already been settled — nothing was added a second time. */
  replayed: boolean;
  amount: number;
}

/**
 * THE STUDIO SEES THE MONEY.
 *
 * Studio-only, and the one write in the product that releases a car. Three
 * things happen in one commit: the payment is marked, the job's ledger gains
 * an entry keyed by the payment id, and `amountPaid` moves with it.
 *
 * `expectedAmount` is what the counter believes it received. It is compared
 * against the payment's own figure and a mismatch is REFUSED rather than
 * reconciled — a settlement for the wrong amount leaves the studio's books and
 * the customer's record disagreeing, and only one of them is looked at again.
 */
export async function settlePayment(
  staff: { id: string; name: string },
  paymentId: string,
  opts: { expectedAmount?: number; reference?: string } = {},
): Promise<SettleResult> {
  if (!adminDb) throw new PaymentError('not-configured', 503);
  const db = adminDb;

  return db.runTransaction(async t => {
    const ref = db.collection('payments').doc(paymentId);
    const snap = await t.get(ref);
    if (!snap.exists) throw new PaymentError('not-found', 404);
    const payment = { id: snap.id, ...(snap.data() as object) } as Payment;

    /* ALREADY SETTLED: succeed, add nothing. The caller asked for a state the
       payment is already in, which is not an error — but crediting the money
       twice would be. */
    if (payment.status === 'paid') {
      return { id: paymentId, status: 'paid' as const, replayed: true, amount: payment.amount };
    }

    const move = paymentTransition(payment.status, 'paid', 'studio');
    if (!move.ok) throw new PaymentError(move.reason ?? 'illegal-transition', 409);

    if (typeof opts.expectedAmount === 'number'
        && Math.round(opts.expectedAmount) !== Math.round(payment.amount)) {
      throw new PaymentError('amount-mismatch', 409);
    }

    const now = Timestamp.now();
    t.update(ref, {
      status: 'paid',
      ...(opts.reference && isUpiReference(opts.reference)
        ? { reference: opts.reference.trim().toUpperCase() } : {}),
      settledAt: FieldValue.serverTimestamp(),
      settledById: staff.id,
      settledByName: staff.name,
      updatedAt: FieldValue.serverTimestamp(),
    });

    /* THE LEDGER ENTRY IS KEYED BY THE PAYMENT, so a retried settlement cannot
       add the money a second time even if it reached this line twice. */
    if (payment.jobId) {
      const jobRef = db.collection('jobs').doc(payment.jobId);
      const jobSnap = await t.get(jobRef);
      if (jobSnap.exists) {
        const job = jobSnap.data() as Job;
        const already = (job.payments ?? []).some(p => p.id === paymentId);
        if (!already) {
          /* Admin-SDK `Timestamp`, not the client class `lib/types.ts` is
             written against — identical on the wire, different classes at
             compile time. The same cast the walk-in path already makes. */
          const entry = {
            id: paymentId,
            amount: payment.amount,
            method: 'upi',
            ...(payment.reference ? { transactionId: payment.reference } : {}),
            receivedById: staff.id,
            receivedByName: staff.name,
            at: now,
            date: new Date().toISOString().slice(0, 10),
          } as unknown as PaymentRecord;
          const amountPaid = (job.amountPaid ?? 0) + payment.amount;
          t.update(jobRef, {
            payments: [...(job.payments ?? []), entry],
            amountPaid,
            paymentStatus: amountPaid >= (job.totalAmount ?? 0) ? 'collected' : 'pending',
            paymentMethod: 'upi',
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
    }

    if (payment.bookingId) {
      t.update(db.collection('bookings').doc(payment.bookingId), {
        paymentStatus: 'verified',
        paymentMethod: 'upi',
        ...(payment.reference ? { transactionId: payment.reference } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    if (payment.invoiceId) {
      t.update(db.collection('invoices').doc(payment.invoiceId), { paymentStatus: 'paid' });
    }

    return { id: paymentId, status: 'paid' as const, replayed: false, amount: payment.amount };
  }, { maxAttempts: 8 });
}

/** Every payment on this customer's visits. Owner-scoped by the query itself. */
export async function paymentsForCustomer(uid: string): Promise<Payment[]> {
  if (!adminDb) return [];
  const snap = await adminDb.collection('payments').where('customerId', '==', uid).get();
  return snap.docs
    .map(d => ({ id: d.id, ...(d.data() as object) }) as Payment)
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
}
