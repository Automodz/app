import { NextResponse, type NextRequest } from 'next/server';
import { adminAuth, adminDb, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { callerOf as sessionCaller } from '@/lib/server/session';
import { cancelBookingAuthoritative, BookingError } from '@/lib/server/bookingService';
import { reportError } from '@/lib/server/report';

export const dynamic = 'force-dynamic';

/**
 * CANCEL A BOOKING, AND GIVE BACK WHAT IT CONSUMED.
 *
 * A client cannot do this. `firestore.rules` lets a customer set a booking's
 * status to `cancelled`, but a membership wash lives on the SUBSCRIPTION and a
 * promo use lives on the PROMO - and the rules let a customer touch neither.
 * So `cancelBooking` in lib/services/bookings.ts could only ever mark the
 * booking, and the wash was lost for good.
 *
 * Ownership is verified server-side. Staff may cancel any booking, because the
 * studio refusing work must still return the customer's wash.
 */
export async function POST(req: NextRequest) {
  try {
    assertAdminConfigured();
  } catch {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  /* A bearer token, or the session cookie the rooms already use - the two
     lapse independently, and a customer signed in enough to SEE a screen is
     signed in enough to use it. Same-origin only; see lib/server/session.ts. */
  const uid = await sessionCaller(req, t => adminAuth!.verifyIdToken(t));
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as
    { expectedVersion?: number; bookingId?: string; reason?: string; noShow?: boolean } | null;
  const bookingId = typeof body?.bookingId === 'string' ? body.bookingId : '';
  if (!bookingId) return NextResponse.json({ error: 'bookingId required' }, { status: 400 });

  /* Staff are recognised from their own profile, never from the request body. */
  let byStaff = false;
  try {
    const profile = await adminDb!.collection('users').doc(uid).get();
    byStaff = ['admin', 'employee'].includes((profile.data()?.role as string) ?? '');
  } catch {
    byStaff = false;
  }

  try {
    const result = await cancelBookingAuthoritative(uid, bookingId, {
      byStaff,
      reason: typeof body?.reason === 'string' ? body.reason.slice(0, 300) : undefined,
      /* THE VERSION THE CLIENT WAS LOOKING AT. Optional, because a caller that
         does not send one simply forgoes the protection - but the customer app
         always does, so a phone that has been open while the studio moved the
         booking is refused rather than applied on top. */
      expectedVersion: typeof body?.expectedVersion === 'number' ? body.expectedVersion : undefined,
      noShow: byStaff ? body?.noShow === true : false,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof BookingError) {
      return NextResponse.json({ error: e.code }, { status: e.status });
    }
    await reportError(e, { op: 'booking.cancel', userId: uid, extra: { bookingId } });
    return NextResponse.json({ error: 'cancel-failed' }, { status: 500 });
  }
}
