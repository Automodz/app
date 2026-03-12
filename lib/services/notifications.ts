import {
  collection, doc, updateDoc, getDocs,
  query, where, limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Notification } from '../types';
import { DEMO_NOTIFICATIONS } from '../demo-data';

export const getUserNotifications = async (uid: string): Promise<Notification[]> => {
  if (uid === 'demo-user' || uid === 'demo-user-001') return DEMO_NOTIFICATIONS;
  // No orderBy = no composite index needed; sort client-side
  const q = query(collection(db, 'notifications'), where('userId', '==', uid), limit(20));
  const docs = (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() } as Notification));
  return docs.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
};

export const markNotificationRead = (id: string) =>
  updateDoc(doc(db, 'notifications', id), { read: true });
