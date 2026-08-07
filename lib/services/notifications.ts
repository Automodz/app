import {
  collection, doc, updateDoc, getDocs, writeBatch,
  query, where, limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import { idToken } from '../clientSession';
import type { Notification } from '../types';

export const getUserNotifications = async (uid: string): Promise<Notification[]> => {
  // No orderBy = no composite index needed; sort client-side
  const q = query(collection(db, 'notifications'), where('userId', '==', uid), limit(20));
  const docs = (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() } as Notification));
  return docs.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
};

export const markNotificationRead = (id: string) =>
  updateDoc(doc(db, 'notifications', id), { read: true });

export const markAllNotificationsRead = async (uid: string) => {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', uid), where('read', '==', false), limit(100),
  );
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
};


/** Fire-and-forget ops event → owner gets notified (server-verified ownership). */
export const fireOpsEvent = async (event: 'booking_created' | 'booking_cancelled' | 'membership_pending' | 'quote_requested', id: string) => {
  try {
    const token = await idToken();
    if (!token) return;
    await fetch('/api/notify/event', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, id }),
    });
  } catch { /* never blocks the user flow */ }
};
