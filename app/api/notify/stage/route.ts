import { NextResponse, type NextRequest } from 'next/server';
import { adminAuth, adminDb, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { callerOf as sessionCaller } from '@/lib/server/session';
import { recordEvent } from '@/lib/server/events';
import { settlementOf } from '@/lib/os/settlement';
import { reportError } from '@/lib/server/report';
import type { Booking, Job } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * TELLING A CUSTOMER THE VISIT HAS MOVED.
 *
 * ── WHY THIS EXISTS AT ALL ───────────────────────────────────────────────
 * `updateBookingStatusWithNotification` wrote the notification document and
 * fired the push FROM THE BROWSER. Two things followed, and the second is the
 * reason this route exists:
 *
 *   · Quiet mode is decided on the server (`recordEvent` reads the profile),
 *     so a client-written notification bypassed it entirely. A customer who
 *     had asked for quiet got every stage ping anyway.
 *   · Nothing de-duplicated. An admin advancing, undoing and re-advancing a
 *     stage sent the same message three times.
 *
 * Now the studio writes the STATUS from the console — which rules permit and
 * which is a fact about the studio's own work — and asks here for the customer
 * to be told. One notification path, one place quiet mode is honoured, and an
 * event id derived from the fact so a repeat collapses onto one document.
 *
 * ── AND THE MIDDLE OF THE VISIT NO LONGER PUSHES ─────────────────────────
 * `vehicle_received`, `in_progress` and `quality_check` used to each send a
 * message. §17.1 — "state changes surface as state" — and the live visit
 * screen already shows exactly where the car is, act by act, with the
 * photographs. Three pushes to say the car moved between acts a customer can
 * watch is the noise quiet mode was invented to escape. What still reaches
 * them is what they lose by not hearing: the handover, the money, and a
 * question the studio is waiting on.
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

  const profile = await adminDb!.collection('users').doc(uid).get();
  if (!['admin', 'employee'].includes((profile.data()?.role as string) ?? '')) {
    return NextResponse.json({ error: 'staff-only' }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as
    { bookingId?: string; status?: string } | null;
  const bookingId = typeof body?.bookingId === 'string' ? body.bookingId : '';
  const status = typeof body?.status === 'string' ? body.status : '';
  if (!bookingId || !status) {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  try {
    const snap = await adminDb!.collection('bookings').doc(bookingId).get();
    if (!snap.exists) return NextResponse.json({ error: 'not-found' }, { status: 404 });
    const booking = { id: snap.id, ...(snap.data() as object) } as Booking;

    const subject = booking.vehicleName || booking.serviceName || 'your car';
    const source = { kind: 'booking' as const, id: booking.id };
    const common = {
      customerId: booking.userId,
      source,
      vehicleId: booking.vehicleId,
      subject,
    };

    const told: string[] = [];

    if (status === 'confirmed') {
      const when = booking.scheduledTime
        ? `${booking.scheduledDate} at ${booking.scheduledTime}` : booking.scheduledDate;
      const r = await recordEvent({ ...common, type: 'booking_confirmed', detail: when });
      told.push(r.id);
    }

    if (status === 'cancelled') {
      const r = await recordEvent({ ...common, type: 'booking_cancelled' });
      told.push(r.id);
    }

    if (status === 'ready_for_delivery') {
      const r = await recordEvent({ ...common, type: 'vehicle_ready' });
      told.push(r.id);

      /* AND WHETHER THERE IS ANYTHING TO SETTLE. A car called ready with money
         outstanding is a customer arriving to collect and being stopped at the
         counter; saying so first is the difference between a handover and an
         argument. The figure itself is never in the message — a price on a
         lock screen is a price shown to the room. */
      const job = booking.jobId
        ? ((await adminDb!.collection('jobs').doc(booking.jobId).get()).data() as Job | undefined)
        : undefined;
      const owed = settlementOf({
        jobTotal: job?.totalAmount,
        bookingTotal: booking.totalAmount,
        received: job?.amountPaid ?? 0,
      });
      if (!owed.settled) {
        const p = await recordEvent({ ...common, type: 'payment_required' });
        told.push(p.id);
      }
    }

    if (status === 'completed') {
      const r = await recordEvent({ ...common, type: 'visit_completed' });
      told.push(r.id);
    }

    return NextResponse.json({ ok: true, events: told });
  } catch (e) {
    await reportError(e, { op: 'notify.stage', userId: uid, extra: { bookingId, status } });
    /* Telling the customer late is a problem; failing the studio's own status
       update because the telling failed is a worse one. */
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
