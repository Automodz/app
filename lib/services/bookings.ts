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
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Booking, Notification } from '../types';

export const createBooking = async (booking: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>) => {
  // JSON round-trip drops all undefined fields (Firestore rejects them)
  const stripped = JSON.parse(JSON.stringify({ ...booking, status: 'pending' }));
  const clean = { ...stripped, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  const r = await addDoc(collection(db, 'bookings'), clean);
  return r.id;
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

export const cancelBooking = async (bookingId: string) =>
  updateDoc(doc(db, 'bookings', bookingId), {
    status: 'cancelled',
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

/**
 * Admin rejects a pending booking (approval workflow). Slot frees automatically
 * because cancelled bookings are excluded from occupancy. The customer gets the
 * reason via in-app + push.
 */
export const rejectBooking = async (
  booking: Pick<Booking, 'id' | 'userId' | 'serviceName' | 'vehicleName'>,
  reason: string,
) => {
  await updateDoc(doc(db, 'bookings', booking.id), {
    status: 'cancelled',
    cancelledAt: serverTimestamp(),
    rejectionReason: reason,
    updatedAt: serverTimestamp(),
  });
  const body = `We couldn't accept your ${booking.serviceName} booking for ${booking.vehicleName}.${reason ? ` Reason: ${reason}` : ''} Please pick another slot - we'd love to have you in.`;
  await writeNotification(booking.userId, 'Booking not accepted', body, 'booking_update', booking.id);
  try {
    const { sendPushToUser } = await import('./push');
    sendPushToUser({ userId: booking.userId, title: 'Booking not accepted', body, url: '/app' });
  } catch { /* best-effort */ }
};

/** Admin marks a confirmed booking as a customer no-show. */
export const markNoShow = async (
  booking: Pick<Booking, 'id' | 'userId' | 'serviceName' | 'vehicleName' | 'scheduledDate' | 'scheduledTime'>,
) => {
  await updateDoc(doc(db, 'bookings', booking.id), {
    status: 'cancelled',
    cancelledAt: serverTimestamp(),
    noShow: true,
    updatedAt: serverTimestamp(),
  });
  const body = `You missed your ${booking.serviceName} appointment for ${booking.vehicleName} on ${booking.scheduledDate} at ${booking.scheduledTime}. Rebook anytime from the app.`;
  await writeNotification(booking.userId, 'Missed appointment', body, 'booking_update', booking.id);
  try {
    const { sendPushToUser } = await import('./push');
    sendPushToUser({ userId: booking.userId, title: 'Missed appointment', body, url: '/app?sheet=arrange' });
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
 * The studio schedules its TWO resources (wash bay ×1, protection bay ×1) — a
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

export const writeNotification = async (
  userId: string, title: string, body: string,
  type: Notification['type'], bookingId?: string,
) => {
  await addDoc(collection(db, 'notifications'), {
    userId, title, body, type, read: false,
    ...(bookingId ? { bookingId } : {}),
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
      sendPushToUser({ userId: booking.userId, title: msg.title, body: msg.body, url: '/app' });
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