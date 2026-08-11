import { NextResponse, type NextRequest } from 'next/server';
import { adminAuth, adminDb, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { callerOf as sessionCaller } from '@/lib/server/session';
import { rescheduleBookingAuthoritative, BookingError } from '@/lib/server/bookingService';
import { announceReschedule } from '@/lib/server/bookingNotify';
import { reportError } from '@/lib/server/report';

export const dynamic = 'force-dynamic';

/**
 * MOVING A VISIT — design screen 10.
 *
 * A client cannot do this, and until now it did. `rescheduleBooking` wrote
 * `scheduledDate` and `scheduledTime` straight from the browser under a rule
 * that checked only which KEYS had changed — so the destination was never
 * tested for capacity, the 24-hour rule was decided from a clock the customer
 * controls, and the past was a legal destination. That door is closed in
 * `firestore.rules`; this is the only way through.
 *
 * Everything of consequence happens in the Booking Service, inside one
 * transaction: the window, the capacity, the multi-day span and the audit
 * trail. This route proves who is asking and narrows the body.
 */
export async function POST(req: NextRequest) {
  try {
    assertAdminConfigured();
  } catch {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  /* A bearer token, or the session cookie the rooms already use — the two
     lapse independently, and a customer signed in enough to SEE a screen is
     signed in enough to use it. Same-origin only; see lib/server/session.ts. */
  const uid = await sessionCaller(req, t => adminAuth!.verifyIdToken(t));
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as
    { bookingId?: string; scheduledDate?: string; scheduledTime?: string } | null;
  const bookingId = typeof body?.bookingId === 'string' ? body.bookingId : '';
  const scheduledDate = typeof body?.scheduledDate === 'string' ? body.scheduledDate : '';
  const scheduledTime = typeof body?.scheduledTime === 'string' ? body.scheduledTime : '';
  if (!bookingId || !scheduledDate || !scheduledTime) {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  /* Staff are recognised from their OWN profile, never from the request body —
     the same rule the cancel route follows. The studio may move a booking
     inside the 24-hour window; a customer may not, and a body that claims to
     be staff is just a body. */
  let byStaff = false;
  try {
    const profile = await adminDb!.collection('users').doc(uid).get();
    byStaff = ['admin', 'employee'].includes((profile.data()?.role as string) ?? '');
  } catch {
    byStaff = false;
  }

  try {
    const result = await rescheduleBookingAuthoritative(
      uid, bookingId, { scheduledDate, scheduledTime }, { byStaff },
    );
    /* Announced only when something actually moved — a double tap on the same
       slot returns `unchanged` and must not tell the customer twice. */
    if (!result.unchanged) await announceReschedule(bookingId, result.to);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof BookingError) {
      return NextResponse.json({ error: e.code }, { status: e.status });
    }
    await reportError(e, { op: 'booking.reschedule', userId: uid, extra: { bookingId } });
    return NextResponse.json({ error: 'reschedule-failed' }, { status: 500 });
  }
}
