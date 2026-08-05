import 'server-only';
/**
 * A BOOKING MUST BE IMPOSSIBLE TO MISS.
 *
 * The customer's only booking path is now in-app. That makes this file the
 * difference between a request the studio answers and a request that sits in a
 * collection nobody is watching.
 *
 * WHY SERVER-SIDE. The old application fired ops events from the client
 * (`fireOpsEvent` → `/api/notify/event`), which has zero callers today and was
 * never reliable anyway: a customer who books and immediately closes the tab
 * never sends it. The booking exists, and nobody is told. The fan-out therefore
 * runs on the same request that created the booking, after the transaction has
 * committed.
 *
 * WHY AFTER THE TRANSACTION, NEVER INSIDE. `createBookingAuthoritative` runs
 * with `maxAttempts: 12`. A notification inside it would fire up to twelve
 * times for one booking. Side effects belong outside the retry.
 *
 * HOW IT CANNOT DOUBLE-FIRE. Two guards, and both are needed:
 *   1. The caller only invokes this when `replayed === false` — a retried
 *      request returns the first booking and notifies nobody again.
 *   2. `notifyAdmins` is itself idempotent per `kind + dedupeKey`, writing to a
 *      deterministic document id. The booking id is the dedupe key, so even a
 *      duplicate invocation collapses onto the same document.
 *
 * NOTHING HERE MAY THROW. A studio that is told late is a problem; a booking
 * that fails because the studio could not be told is a worse one. Every channel
 * is best-effort and independently wrapped, so WhatsApp being unconfigured
 * cannot cost the in-app notification.
 */
import { adminDb } from './firebaseAdmin';
import { notifyAdmins, whatsAppToStudio } from './notify';
import { reportError } from './report';
import type { Booking } from '@/lib/types';

/** The one place the studio's ops address is written. */
const ADMIN_BOOKING_URL = (id: string) => `/admin/bookings/${id}`;

/**
 * Tell the studio a visit has been requested.
 *
 * Call ONLY when the booking was newly created (`replayed === false`).
 */
export async function announceBooking(booking: Booking): Promise<void> {
  if (!adminDb) return;

  const when = booking.scheduledTime
    ? `${booking.scheduledDate} at ${booking.scheduledTime}`
    : booking.scheduledDate;

  const title = 'New booking';
  const body = `${booking.serviceName} · ${booking.vehicleName || booking.vehicleRegNo} · ${when}`;

  /* 1 · in-app document + web push, to every admin. Idempotent on the booking
     id, so this cannot produce a second notification for the same booking. */
  try {
    await notifyAdmins('booking_created', title, body, {
      url: ADMIN_BOOKING_URL(booking.id),
      dedupeKey: booking.id,
    });
  } catch (e) {
    await reportError(e, { op: 'booking.notify.admins', extra: { bookingId: booking.id } });
  }

  /* 2 · WhatsApp to the studio. Guarded by its own marker rather than by
     `notifyAdmins`'s, because the two channels fail independently and a
     WhatsApp outage must not make the in-app notice look sent. */
  const markerRef = adminDb.collection('notificationLog').doc(`wa_booking_created_${booking.id}`);
  try {
    const existing = await markerRef.get();
    if (!existing.exists) {
      const sent = await whatsAppToStudio(
        `New booking — ${booking.serviceName}\n`
        + `${booking.vehicleName || booking.vehicleRegNo}\n`
        + `${when}\n`
        + `${booking.userName || 'Customer'} · ${booking.userPhone || 'no phone'}`,
      );
      /* The marker records the ATTEMPT, not the success, and says which it
         was. Writing it only on success would retry forever against a
         misconfigured number; not writing it at all would send twice. */
      await markerRef.set({
        kind: 'booking_created',
        channel: 'whatsapp',
        bookingId: booking.id,
        delivered: sent,
        createdAt: new Date(),
      });
    }
  } catch (e) {
    await reportError(e, { op: 'booking.notify.whatsapp', extra: { bookingId: booking.id } });
  }

  /* 3 · the operational record. `activity` is the studio's own timeline and
     every other write to it is server-side; a booking that appears on the
     board with no entry explaining where it came from is a gap in the audit. */
  try {
    await adminDb.collection('activity').doc(`booking_created_${booking.id}`).set({
      kind: 'booking_created',
      bookingId: booking.id,
      customerId: booking.userId,
      vehicleId: booking.vehicleId,
      summary: `${booking.serviceName} requested for ${when}`,
      actorKind: 'customer',
      createdAt: new Date(),
    });
  } catch (e) {
    await reportError(e, { op: 'booking.notify.activity', extra: { bookingId: booking.id } });
  }
}
