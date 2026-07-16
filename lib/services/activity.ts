import {
  collection, addDoc, getDocs, query, where, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Activity events — the heartbeat of the business. EVERY meaningful action
 * (status change, assignment, photo, payment, invoice, message, delivery…)
 * writes one event here. The workspace timeline reads them back.
 *
 * Scale: a flat top-level `activity` collection keyed by the entities it
 * touches (bookingId / jobId / customerId), designed for millions of rows.
 * We query by a single equality (`bookingId`) and sort client-side, so no
 * composite index is needed and reads stay cheap per-entity.
 */
export type ActivityType =
  | 'booking_created' | 'confirmed' | 'rescheduled' | 'checked_in'
  | 'stage' | 'assigned' | 'photo' | 'payment' | 'invoice'
  | 'whatsapp' | 'call' | 'note' | 'cancelled' | 'delivered';

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  title: string;
  bookingId?: string;
  jobId?: string;
  customerId?: string;
  meta?: Record<string, unknown>;
  actorId: string;
  actorName: string;
  at: Timestamp;
}

export interface LogActivityInput {
  type: ActivityType;
  title: string;
  bookingId?: string;
  jobId?: string;
  customerId?: string;
  meta?: Record<string, unknown>;
  actor: { id: string; name: string };
}

/** Fire-and-forget — logging must never block or break an operational action. */
export const logActivity = async (input: LogActivityInput): Promise<void> => {
  try {
    const doc: Record<string, unknown> = {
      type: input.type,
      title: input.title,
      actorId: input.actor.id,
      actorName: input.actor.name,
      at: serverTimestamp(),
    };
    if (input.bookingId) doc.bookingId = input.bookingId;
    if (input.jobId) doc.jobId = input.jobId;
    if (input.customerId) doc.customerId = input.customerId;
    if (input.meta) doc.meta = input.meta;
    await addDoc(collection(db, 'activity'), doc);
  } catch (e) {
    console.error('activity log failed', e);
  }
};

/** All events for one booking, newest first. */
export const listBookingActivity = async (bookingId: string): Promise<ActivityEvent[]> => {
  const snap = await getDocs(query(collection(db, 'activity'), where('bookingId', '==', bookingId)));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as ActivityEvent))
    .sort((a, b) => (b.at?.toMillis?.() ?? 0) - (a.at?.toMillis?.() ?? 0));
};

/** All events for one job, newest first. */
export const listJobActivity = async (jobId: string): Promise<ActivityEvent[]> => {
  const snap = await getDocs(query(collection(db, 'activity'), where('jobId', '==', jobId)));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as ActivityEvent))
    .sort((a, b) => (b.at?.toMillis?.() ?? 0) - (a.at?.toMillis?.() ?? 0));
};

/** All events for one customer (for the customer workspace later), newest first. */
export const listCustomerActivity = async (customerId: string): Promise<ActivityEvent[]> => {
  const snap = await getDocs(query(collection(db, 'activity'), where('customerId', '==', customerId)));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as ActivityEvent))
    .sort((a, b) => (b.at?.toMillis?.() ?? 0) - (a.at?.toMillis?.() ?? 0));
};
