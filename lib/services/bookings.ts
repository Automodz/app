import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { Booking, Notification } from '../types';
import { notificationHref } from '@/navigation/resolve';

/**
 * A Timestamp that crossed JSON.
 *
 * `lib/types.ts` is written against the CLIENT Timestamp - the one with
 * `.seconds` and `.toDate()`. The Booking Service runs on the admin SDK, whose
 * Timestamp serialises to `{_seconds, _nanoseconds}`: no methods, and the
 * underscore means `.seconds` reads undefined. Handed straight to the store
 * that would have sorted the new booking to the bottom of the garage and
 * thrown the first time `conciergeLog` called `.toDate()` on it.
 */
const reviveTimestamp = (v: unknown): Timestamp => {
  if (v instanceof Timestamp) return v;
  const o = v as { _seconds?: number; seconds?: number; _nanoseconds?: number; nanoseconds?: number };
  const s = o?._seconds ?? o?.seconds;
  return typeof s === 'number'
    ? new Timestamp(s, o?._nanoseconds ?? o?.nanoseconds ?? 0)
    : Timestamp.now();
};

/**
 * Ask the studio for a visit.
 *
 * This is a WRAPPER, not an implementation. It used to build the booking
 * document itself - including `totalAmount` and `discount` - and write it
 * straight to Firestore, which meant the browser decided what the customer
 * paid. Now it posts intent to the Booking Service and returns whatever the
 * server decided (`/api/booking/create` → lib/server/bookingService.ts).
 *
 * `idempotencyKey` must be stable for one intent: retrying the same selection
 * returns the same booking instead of making a second one.
 */
export const requestBooking = async (intent: {
  vehicleId: string;
  serviceId: string;
  scheduledDate: string;
  scheduledTime: string;
  paymentMethod?: 'upi' | 'cash';
  pickup?: boolean;
  drop?: boolean;
  pickupAddress?: string;
  useMembershipWash?: boolean;
  idempotencyKey: string;
}): Promise<Booking> => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('not-signed-in');
  const res = await fetch('/api/booking/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ kind: 'appointment', ...intent }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? 'booking-failed');
  const b = data.booking as Booking;
  return {
    ...b,
    createdAt: reviveTimestamp(b.createdAt),
    updatedAt: reviveTimestamp(b.updatedAt),
  };
};

export const getUserBookings = async (uid: string): Promise<Booking[]> => {
  const q = query(collection(db, 'bookings'), where('userId', '==', uid));
  const docs = (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() } as Booking));
  return docs.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
};

export const subscribeUserBookings = (
  uid: string,
  handler: (bookings: Booking[]) => void,
): (() => void) => {
  const q = query(collection(db, 'bookings'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
      handler(docs.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)));
    },
    (err) => {
      // Listener death must not look like "no bookings" - keep last data, log it.
      console.error('bookings listener dropped', err);
    },
  );
};

/** Load a single booking (commercial record) by id - for the workspace route. */
export const getBooking = async (id: string): Promise<Booking | null> => {
  const snap = await getDoc(doc(db, 'bookings', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Booking) : null;
};

/** Every booking awaiting admin approval (any date) - the approval queue. */
export const getPendingApprovals = async (): Promise<Booking[]> => {
  const snap = await getDocs(query(collection(db, 'bookings'), where('status', '==', 'pending')));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Booking))
    .sort((a, b) => (a.scheduledDate + a.scheduledTime).localeCompare(b.scheduledDate + b.scheduledTime));
};

/**
 * BOOKINGS AWAITING AN ANSWER, live.
 *
 * The customer's only booking path is in-app now, so a `pending` booking is a
 * customer waiting. A listener rather than a fetch: the studio must not have to
 * reload the board to discover one. Newest first — the newest is the one nobody
 * has seen yet.
 *
 * Needs the composite index on (status, createdAt desc); it is in
 * firestore.indexes.json alongside the rest.
 */
export const subscribePendingBookings = (
  onChange: (bookings: Booking[]) => void,
): (() => void) =>
  onSnapshot(
    query(
      collection(db, 'bookings'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
    ),
    snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking))),
    /* A listener that throws takes the board down with it. The band simply
       stays empty, and `/admin/bookings` still lists everything. */
    () => onChange([]),
  );

export const getAllBookings = async (): Promise<Booking[]> => {
  const snap = await getDocs(query(collection(db, 'bookings'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
};

/** Bookings for a set of days (max 10 - Firestore `in` limit). Cancelled excluded. */
export const getBookingsForDates = async (dates: string[]): Promise<Booking[]> => {
  if (dates.length === 0) return [];
  const snap = await getDocs(query(
    collection(db, 'bookings'),
    where('scheduledDate', 'in', dates.slice(0, 10)),
  ));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Booking))
    .filter(b => b.status !== 'cancelled')
    .sort((a, b) => (a.scheduledDate + a.scheduledTime).localeCompare(b.scheduledDate + b.scheduledTime));
};

/**
 * CANCEL — through the server, always.
 *
 * This used to be a direct `updateDoc` setting `status: 'cancelled'`, and that
 * was a silent bug: a booking that had consumed a membership wash or a promo
 * gave neither back, because `firestore.rules` lets a client touch neither the
 * subscription nor the promo. The customer lost a wash they had paid for.
 *
 * The restore has to be server-authoritative, so this is the one way to cancel
 * and every caller — customer, admin refusal, no-show — goes through it.
 */
export const cancelBooking = async (
  bookingId: string,
  opts: { reason?: string; noShow?: boolean } = {},
): Promise<void> => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('not-signed-in');
  const res = await fetch('/api/booking/cancel', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId, ...opts }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string })?.error ?? 'cancel-failed');
  }
};

/**
 * Admin rejects a pending booking (approval workflow). Slot frees automatically
 * because cancelled bookings are excluded from occupancy. The customer gets the
 * reason via in-app + push.
 */
export const rejectBooking = async (
  booking: Pick<Booking, 'id' | 'userId' | 'serviceName' | 'vehicleName'>,
  reason: string,
) => {
  /* Through the same server path, so a refused booking returns the wash. */
  await cancelBooking(booking.id, { reason });
  const body = `We couldn't accept your ${booking.serviceName} booking for ${booking.vehicleName}.${reason ? ` Reason: ${reason}` : ''} Please pick another slot - we'd love to have you in.`;
  await writeNotification(booking.userId, 'Booking not accepted', body, 'booking_update', booking.id);
  try {
    const { sendPushToUser } = await import('./push');
    sendPushToUser({ userId: booking.userId, title: 'Booking not accepted', body, url: notificationHref({ type: 'booking_update', bookingId: booking.id }) });
  } catch { /* best-effort */ }
};

/** Admin marks a confirmed booking as a customer no-show. */
export const markNoShow = async (
  booking: Pick<Booking, 'id' | 'userId' | 'serviceName' | 'vehicleName' | 'scheduledDate' | 'scheduledTime'>,
) => {
  /* `noShow` forfeits the wash — the bay was held. The rule lives in
     lib/server/bookingService.ts; this only names the case. */
  await cancelBooking(booking.id, { noShow: true });
  const body = `You missed your ${booking.serviceName} appointment for ${booking.vehicleName} on ${booking.scheduledDate} at ${booking.scheduledTime}. Rebook anytime from the app.`;
  await writeNotification(booking.userId, 'Missed appointment', body, 'booking_update', booking.id);
  try {
    const { sendPushToUser } = await import('./push');
    sendPushToUser({ userId: booking.userId, title: 'Missed appointment', body, url: notificationHref({ type: 'booking_update', bookingId: booking.id }) });
  } catch { /* best-effort */ }
};

export const updateBookingStatus = async (id: string, status: Booking['status'], notes?: string) => {
  const data: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
  if (notes) data.adminNotes = notes;
  await updateDoc(doc(db, 'bookings', id), data);
};

export const rescheduleBooking = (id: string, scheduledDate: string, scheduledTime: string) =>
  updateDoc(doc(db, 'bookings', id), { scheduledDate, scheduledTime, updatedAt: serverTimestamp() });

export const saveBookingAdminNotes = (id: string, adminNotes: string) =>
  updateDoc(doc(db, 'bookings', id), { adminNotes, updatedAt: serverTimestamp() });

export const verifyPayment = async (bookingId: string) =>
  updateDoc(doc(db, 'bookings', bookingId), {
    paymentStatus: 'verified',
    updatedAt: serverTimestamp(),
  });

/**
 * Resource-aware availability for the customer booking flow.
 * The studio schedules its TWO resources (wash bay ×1, protection bay ×1) - a
 * 3-day PPF blocks its bay for the whole span. Computed SERVER-SIDE
 * (/api/availability, Admin SDK) because Firestore rules stop customers
 * reading other people's bookings or any jobs, which is exactly the data
 * occupancy derives from.
 */
export const getAvailability = async (
  dates: string[],
  serviceCategory: string,
  durationMinutes = 60,
): Promise<{ fullSlots: Record<string, string[]>; fullDates: string[] }> => {
  const { auth } = await import('../firebase');
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('Not signed in');
  const res = await fetch('/api/availability', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ dates, category: serviceCategory, durationMinutes }),
  });
  if (!res.ok) throw new Error('availability failed');
  return res.json();
};

/**
 * §17.3 — a notification is a doorway, so it is written WITH its destination.
 * Every one of these used to land on `/app`, an address that stopped existing
 * when the rooms moved to the root.
 */
export const writeNotification = async (
  userId: string, title: string, body: string,
  type: Notification['type'], bookingId?: string,
) => {
  await addDoc(collection(db, 'notifications'), {
    userId, title, body, type, read: false,
    ...(bookingId ? { bookingId } : {}),
    url: notificationHref({ type, bookingId }),
    createdAt: serverTimestamp(),
  });
};

export const updateBookingStatusWithNotification = async (
  booking: Pick<
    Booking,
    | 'id'
    | 'userId'
    | 'vehicleId'
    | 'vehicleName'
    | 'vehicleRegNo'
    | 'serviceId'
    | 'serviceName'
    | 'serviceCategory'
    | 'serviceBasePrice'
    | 'serviceDurationMinutes'
    | 'scheduledDate'
    | 'scheduledTime'
  >,
  status: Booking['status'],
  notes?: string,
) => {
  await updateBookingStatus(booking.id, status, notes);

  const MESSAGES: Partial<Record<Booking['status'], { title: string; body: string }>> = {
    confirmed:          { title: 'Booking Confirmed',     body: `Your ${booking.serviceName} for ${booking.vehicleName} on ${booking.scheduledDate} is confirmed.` },
    vehicle_received:   { title: 'Vehicle Received',      body: `We have received your ${booking.vehicleName}. Work will begin shortly.` },
    in_progress:        { title: 'Service In Progress',   body: `Our team is now working on your ${booking.vehicleName} - ${booking.serviceName}.` },
    quality_check:      { title: 'Quality Check',         body: `Your ${booking.vehicleName} is in final quality inspection. Almost done!` },
    ready_for_delivery: { title: 'Ready for Pickup',      body: `Your ${booking.vehicleName} is ready! Come collect it at AutoModz, Maninagar.` },
    completed:          { title: 'Service Completed',     body: `${booking.serviceName} on your ${booking.vehicleName} is complete. Thank you for choosing AutoModz!` },
    cancelled:          { title: 'Booking Cancelled',     body: `Your booking for ${booking.serviceName} (${booking.vehicleName}) has been cancelled.` },
  };

  const msg = MESSAGES[status];
  if (msg) {
    await writeNotification(booking.userId, msg.title, msg.body, 'booking_update', booking.id);
    // Web push to the customer's devices - fire-and-forget, never blocks the update
    try {
      const { sendPushToUser } = await import('./push');
      sendPushToUser({ userId: booking.userId, title: msg.title, body: msg.body, url: notificationHref({ type: 'booking_update', bookingId: booking.id }) });
    } catch { /* push is best-effort */ }
  }

  if (status === 'completed') {
    const recordRef = doc(db, 'users', booking.userId, 'vehicles', booking.vehicleId, 'serviceHistory', booking.id);
    await setDoc(
      recordRef,
      {
        bookingId: booking.id,
        vehicleId: booking.vehicleId,
        vehicleName: booking.vehicleName,
        vehicleRegNo: booking.vehicleRegNo,
        serviceId: booking.serviceId,
        serviceName: booking.serviceName,
        serviceCategory: booking.serviceCategory,
        serviceBasePrice: booking.serviceBasePrice,
        serviceDurationMinutes: booking.serviceDurationMinutes ?? null,
        scheduledDate: booking.scheduledDate,
        scheduledTime: booking.scheduledTime,
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );

    // Inventory auto-consumption - fire-and-forget, never blocks completion
    try {
      const { consumeForService } = await import('./inventory');
      await consumeForService([booking.serviceId], 'booking', booking.id);
    } catch (e) {
      console.error('inventory consumption failed', e);
    }
  }
};