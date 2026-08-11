import { NextResponse, type NextRequest } from 'next/server';
import { adminDb, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { currentSession } from '@/lib/server/session';
import { eventForBooking, toICS } from '@/lib/os/calendar';
import { scheduledEpochMs } from '@/lib/os/lifecycle';
import { COMPANY } from '@/lib/company';
import type { Booking } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * ADD TO CALENDAR — design screen 09's primary control.
 *
 * A GENERATED file, not a template. Every value comes from the booking as it
 * stands at the moment of the request: the hour, the duration, whether the
 * studio is collecting the car, and whether the visit is still on at all. A
 * customer who moves their visit and re-adds it gets an event that REPLACES
 * the one their calendar holds, because the UID is stable and the SEQUENCE has
 * risen — which is exactly what a static file with the words swapped in could
 * never do.
 *
 * ── WHY THE SESSION COOKIE AND NOT A BEARER TOKEN ────────────────────────
 * The customer taps a link and the BROWSER fetches it — there is no
 * opportunity to attach an Authorization header, and an ICS endpoint that
 * needed one would simply never be reachable from a download control. The
 * httpOnly session cookie is what every other server-rendered surface already
 * authenticates with, and it travels with a top-level navigation.
 *
 * Ownership is checked against that session. A booking that is not the
 * caller's is a 404 — the same answer as one that does not exist, so the
 * endpoint cannot be used to discover which ids are real.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertAdminConfigured();
  } catch {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const session = await currentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const snap = await adminDb!.collection('bookings').doc(id).get();
  if (!snap.exists) return NextResponse.json({ error: 'not-found' }, { status: 404 });

  const booking = { id: snap.id, ...(snap.data() as object) } as Booking;
  if (booking.userId !== session.uid) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }

  const startMs = scheduledEpochMs(booking.scheduledDate, booking.scheduledTime);
  if (startMs === null) {
    /* A booking with no workable date has no event. Exporting one anyway would
       put an invented hour in somebody's calendar. */
    return NextResponse.json({ error: 'unschedulable' }, { status: 409 });
  }

  const ics = toICS(eventForBooking({
    id: booking.id,
    serviceName: booking.serviceName || 'Studio visit',
    vehicleName: booking.vehicleName || booking.vehicleRegNo || 'your car',
    startMs,
    durationMinutes: booking.serviceDurationMinutes ?? 60,
    address: COMPANY.address,
    /* A cancelled or expired booking still exports — as a CANCELLATION, so the
       event disappears from the calendar it was added to rather than sitting
       there for ever announcing a visit that is not happening. */
    cancelled: booking.status === 'cancelled' || booking.status === 'expired',
    sequence: booking.rescheduleCount ?? 0,
    pickup: booking.pickupRequired === true,
    stampMs: Date.now(),
  }));

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="automodz-${booking.id.slice(-6)}.ics"`,
      /* A customer's own booking, and it moves. Never cached anywhere. */
      'Cache-Control': 'private, no-store',
    },
  });
}
