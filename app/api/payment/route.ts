import { NextResponse, type NextRequest } from 'next/server';
import { adminAuth, adminDb, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { callerOf as sessionCaller } from '@/lib/server/session';
import {
  createPaymentIntent, submitPaymentReference, settlePayment, PaymentError,
} from '@/lib/server/paymentService';
import { recordEvent } from '@/lib/server/events';
import { notifyAdmins } from '@/lib/server/notify';
import { reportError } from '@/lib/server/report';

export const dynamic = 'force-dynamic';

/**
 * PAYING — design screen 13.
 *
 * POST   the customer asks for an intent   (owner; the SERVER decides the amount)
 * PATCH  the customer gives a reference    (owner; a CLAIM, releases nothing)
 * PUT    the studio settles                (staff; the only write that releases a car)
 *
 * Three verbs, and the separation is the security model. Note what has no name
 * anywhere in this file: `amount`. There is no field a caller can set that
 * changes what they pay, so there is nothing to validate and nothing to forget
 * to validate.
 */
/**
 * THE CALLER — a bearer token, or the session cookie the rooms already use.
 *
 * The two sessions lapse independently, so a customer can reach a room that
 * renders perfectly and find its one control claiming they are signed out.
 * The cookie fallback is same-origin only; see `lib/server/session.ts`.
 */
const callerOf = (req: NextRequest) =>
  sessionCaller(req, t => adminAuth!.verifyIdToken(t));

const configured = () => {
  try {
    assertAdminConfigured();
    return true;
  } catch {
    return false;
  }
};

/** THE CUSTOMER ASKS. The figure comes from the studio's own records. */
export async function POST(req: NextRequest) {
  if (!configured()) return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  const uid = await callerOf(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { bookingId?: string } | null;
  const bookingId = typeof body?.bookingId === 'string' ? body.bookingId : '';
  if (!bookingId) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  try {
    return NextResponse.json(await createPaymentIntent(uid, bookingId));
  } catch (e) {
    if (e instanceof PaymentError) {
      return NextResponse.json({ error: e.code }, { status: e.status });
    }
    await reportError(e, { op: 'payment.intent', userId: uid, extra: { bookingId } });
    return NextResponse.json({ error: 'intent-failed' }, { status: 500 });
  }
}

/** THE CUSTOMER'S WORD. Recorded as a claim; it settles nothing. */
export async function PATCH(req: NextRequest) {
  if (!configured()) return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  const uid = await callerOf(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as
    { paymentId?: string; reference?: string } | null;
  const paymentId = typeof body?.paymentId === 'string' ? body.paymentId : '';
  const reference = typeof body?.reference === 'string' ? body.reference : '';
  if (!paymentId || !reference) {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  try {
    const payment = await submitPaymentReference(uid, paymentId, reference);
    /* The studio is told there is something to reconcile. Idempotent on the
       payment, so a retried submit does not put two rows on the board. */
    await notifyAdmins(
      'payment_submitted',
      'A payment to confirm',
      'A customer says they have paid. Check the credit and settle it.',
      { url: '/admin/invoices', dedupeKey: paymentId },
    );
    return NextResponse.json(payment);
  } catch (e) {
    if (e instanceof PaymentError) {
      return NextResponse.json({ error: e.code }, { status: e.status });
    }
    await reportError(e, { op: 'payment.submit', userId: uid, extra: { paymentId } });
    return NextResponse.json({ error: 'submit-failed' }, { status: 500 });
  }
}

/**
 * THE STUDIO SETTLES.
 *
 * Staff are recognised from their OWN profile, never from the request body —
 * the same rule the cancel and reschedule routes follow. This is the write
 * that releases a car, so it is the one that most needs its caller proven.
 */
export async function PUT(req: NextRequest) {
  if (!configured()) return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  const uid = await callerOf(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const profile = await adminDb!.collection('users').doc(uid).get();
  const role = (profile.data()?.role as string) ?? '';
  if (!['admin', 'employee'].includes(role)) {
    return NextResponse.json({ error: 'staff-only' }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as
    { paymentId?: string; expectedAmount?: number; reference?: string } | null;
  const paymentId = typeof body?.paymentId === 'string' ? body.paymentId : '';
  if (!paymentId) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  try {
    const result = await settlePayment(
      { id: uid, name: (profile.data()?.name as string) ?? 'Studio' },
      paymentId,
      {
        /* What the counter believes it received. A mismatch is REFUSED rather
           than reconciled — a settlement for the wrong amount leaves the books
           and the customer's record disagreeing, and only one gets looked at
           again. */
        expectedAmount: typeof body?.expectedAmount === 'number' ? body.expectedAmount : undefined,
        reference: typeof body?.reference === 'string' ? body.reference : undefined,
      },
    );

    if (!result.replayed) {
      const payment = await adminDb!.collection('payments').doc(paymentId).get();
      const customerId = (payment.data()?.customerId as string) ?? '';
      if (customerId) {
        await recordEvent({
          type: 'payment_settled',
          customerId,
          source: { kind: 'payment', id: paymentId },
          subject: 'your visit',
        });
      }
    }

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof PaymentError) {
      return NextResponse.json({ error: e.code }, { status: e.status });
    }
    await reportError(e, { op: 'payment.settle', userId: uid, extra: { paymentId } });
    return NextResponse.json({ error: 'settle-failed' }, { status: 500 });
  }
}
