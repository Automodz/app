import {
  collection,
  doc,
  addDoc,
  updateDoc,
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
import { DEMO_BOOKINGS } from '../demo-data';
import { STATIC_SERVICES } from '../constants';
import { generateTimeSlots } from '../utils';
import { SLOT_CAPACITY } from '../config/bookingConfig';

const SERVICE_DURATION_LOOKUP: Record<string, number> = STATIC_SERVICES.reduce(
  (acc, svc) => {
    acc[`${svc.category}:${svc.name}`] = svc.duration;
    return acc;
  },
  {} as Record<string, number>,
);

export const createBooking = async (booking: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>) => {
  // JSON round-trip drops all undefined fields (Firestore rejects them)
  const stripped = JSON.parse(JSON.stringify({ ...booking, status: 'pending' }));
  const clean = { ...stripped, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  const r = await addDoc(collection(db, 'bookings'), clean);
  return r.id;
};

export const getUserBookings = async (uid: string): Promise<Booking[]> => {
  if (uid === 'demo-user' || uid === 'demo-user-001') return DEMO_BOOKINGS;
  const q = query(collection(db, 'bookings'), where('userId', '==', uid));
  const docs = (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() } as Booking));
  return docs.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
};

export const subscribeUserBookings = (
  uid: string,
  handler: (bookings: Booking[]) => void,
): (() => void) => {
  if (uid === 'demo-user' || uid === 'demo-user-001') {
    handler(DEMO_BOOKINGS);
    return () => {};
  }
  const q = query(collection(db, 'bookings'), where('userId', '==', uid));
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
    handler(docs.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)));
  });
};

export const getAllBookings = async (): Promise<Booking[]> => {
  const snap = await getDocs(query(collection(db, 'bookings'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
};

export const cancelBooking = async (bookingId: string) =>
  updateDoc(doc(db, 'bookings', bookingId), {
    status: 'cancelled',
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

export const updateBookingStatus = async (id: string, status: Booking['status'], notes?: string) => {
  const data: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
  if (notes) data.adminNotes = notes;
  await updateDoc(doc(db, 'bookings', id), data);
};

export const verifyPayment = async (bookingId: string) =>
  updateDoc(doc(db, 'bookings', bookingId), {
    paymentStatus: 'verified',
    updatedAt: serverTimestamp(),
  });

/**
 * Returns time slots that are at full capacity for the given date and requested service duration.
 * Capacity is calculated across all services and bays, using a 30-minute sub-slot resolution.
 */
export const getBookedSlotsForDate = async (
  date: string,
  _serviceCategory: string,
  requestedDurationMinutes = 60,
): Promise<string[]> => {
  const q = query(
    collection(db, 'bookings'),
    where('scheduledDate', '==', date),
  );
  const snap = await getDocs(q);
  const bookings = snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Booking))
    .filter(b => b.status !== 'cancelled');

  const SUB_SLOT_MINUTES = 30;
  const occupancy = new Map<number, number>();

  for (const b of bookings) {
    const [h, m] = b.scheduledTime.split(':').map(Number);
    const start = h * 60 + m;
    const key = `${b.serviceCategory}:${b.serviceName}`;
    const fallback = SERVICE_DURATION_LOOKUP[key] ?? 60;
    const duration = b.serviceDurationMinutes ?? fallback;
    const end = start + duration;

    for (let t = start; t < end; t += SUB_SLOT_MINUTES) {
      occupancy.set(t, (occupancy.get(t) ?? 0) + 1);
    }
  }

  const fullSlots: string[] = [];
  const candidateSlots = generateTimeSlots(requestedDurationMinutes);

  for (const slot of candidateSlots) {
    const [h, m] = slot.split(':').map(Number);
    const start = h * 60 + m;
    const end = start + requestedDurationMinutes;
    let blocked = false;

    for (let t = start; t < end; t += SUB_SLOT_MINUTES) {
      if ((occupancy.get(t) ?? 0) >= SLOT_CAPACITY) {
        blocked = true;
        break;
      }
    }

    if (blocked) fullSlots.push(slot);
  }

  return fullSlots;
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
  if (booking.userId === 'demo-user' || booking.userId === 'demo-user-001') return;

  const MESSAGES: Partial<Record<Booking['status'], { title: string; body: string }>> = {
    confirmed:          { title: 'Booking Confirmed',     body: `Your ${booking.serviceName} for ${booking.vehicleName} on ${booking.scheduledDate} is confirmed.` },
    vehicle_received:   { title: 'Vehicle Received',      body: `We have received your ${booking.vehicleName}. Work will begin shortly.` },
    in_progress:        { title: 'Service In Progress',   body: `Our team is now working on your ${booking.vehicleName} — ${booking.serviceName}.` },
    quality_check:      { title: 'Quality Check',         body: `Your ${booking.vehicleName} is in final quality inspection. Almost done!` },
    ready_for_delivery: { title: 'Ready for Pickup',      body: `Your ${booking.vehicleName} is ready! Come collect it at AutoModz, Maninagar.` },
    completed:          { title: 'Service Completed',     body: `${booking.serviceName} on your ${booking.vehicleName} is complete. Thank you for choosing AutoModz!` },
    cancelled:          { title: 'Booking Cancelled',     body: `Your booking for ${booking.serviceName} (${booking.vehicleName}) has been cancelled.` },
  };

  const msg = MESSAGES[status];
  if (msg) await writeNotification(booking.userId, msg.title, msg.body, 'booking_update', booking.id);

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
  }
};