import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { reportError } from '@/lib/server/report';
import { announceBooking } from '@/lib/server/bookingNotify';
import {
  createBookingAuthoritative, BookingError,
  type BookingIntent,
} from '@/lib/server/bookingService';

export const dynamic = 'force-dynamic';

/**
 * The ONE way a visit comes into existence. Customer app, walk-in kiosk, the
 * quote desk, and any future mobile client all arrive here.
 *
 * This route does exactly three things: prove who is calling, narrow the body
 * to an intent, and hand it to the Booking Service. It contains no pricing,
 * no eligibility, no writes - so there is nowhere for a second implementation
 * to grow.
 *
 * Note what is NOT read off the body: totalAmount, discount, serviceBasePrice,
 * promoId, discountAmount. Those aren't rejected with a validation error, they
 * simply have no name here. A caller cannot express them.
 */
export async function POST(req: NextRequest) {
  try {
    assertAdminConfigured();
  } catch {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let uid: string;
  try {
    uid = (await adminAuth!.verifyIdToken(authHeader.slice(7))).uid;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  // an empty string is not an id, not a name and not a key - treat it as absent
  const s = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v : undefined);
  const b = (v: unknown) => v === true;

  let intent: BookingIntent;
  if (body.kind === 'walkin') {
    intent = {
      kind: 'walkin',
      customerId: s(body.customerId),
      customerName: s(body.customerName) ?? '',
      customerPhone: s(body.customerPhone) ?? '',
      vehicleName: s(body.vehicleName) ?? '',
      vehicleRegNo: s(body.vehicleRegNo) ?? '',
      // line prices are honoured for staff only - the service enforces that
      items: Array.isArray(body.items) ? body.items.slice(0, 20) : [],
      useMembershipWash: b(body.useMembershipWash),
      byEmployee: (body.byEmployee ?? {}) as { id: string; name: string },
      assignees: Array.isArray(body.assignees)
        ? (body.assignees.slice(0, 10) as { id: string; name: string }[]) : undefined,
      idempotencyKey: s(body.idempotencyKey) ?? '',
    };
  } else {
    intent = {
      kind: 'appointment',
      vehicleId: s(body.vehicleId) ?? '',
      serviceId: s(body.serviceId) ?? '',
      scheduledDate: s(body.scheduledDate) ?? '',
      scheduledTime: s(body.scheduledTime) ?? '',
      paymentMethod: body.paymentMethod === 'upi' ? 'upi' : 'cash',
      pickup: b(body.pickup),
      drop: b(body.drop),
      pickupAddress: s(body.pickupAddress),
      useMembershipWash: b(body.useMembershipWash),
      forUserId: s(body.forUserId),
      idempotencyKey: s(body.idempotencyKey) ?? '',
    };
  }

  try {
    const result = await createBookingAuthoritative(uid, intent);

    /* A BOOKING MUST BE IMPOSSIBLE TO MISS (lib/server/bookingNotify).
       Fired here rather than from the client: a customer who books and closes
       the tab would otherwise leave a booking nobody is told about. Only on a
       genuine creation — a replayed request already announced itself, which is
       the first of the two guards against a duplicate notification.
       Awaited so a serverless function cannot be frozen mid-fan-out, and
       internally non-throwing so it can never fail the booking itself. */
    if (!result.replayed && result.booking) {
      await announceBooking(result.booking);
    }

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof BookingError) {
      return NextResponse.json({ error: e.code }, { status: e.status });
    }
    /* An unexpected throw here means the studio has stopped taking money.
       Reported with the ids that make it findable - never the body. */
    await reportError(e, {
      op: 'booking.create',
      userId: uid,
      vehicleId: intent.kind === 'appointment' ? intent.vehicleId : undefined,
      serviceId: intent.kind === 'appointment' ? intent.serviceId : undefined,
      extra: { kind: intent.kind },
    });
    return NextResponse.json({ error: 'booking-failed' }, { status: 500 });
  }
}
