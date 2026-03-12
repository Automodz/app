import {
  collection, doc, addDoc, updateDoc, getDocs,
  query, where, orderBy, limit, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Subscription } from '../types';
import { DEMO_SUBSCRIPTION } from '../demo-data';

export const getUserSubscription = async (uid: string): Promise<Subscription | null> => {
  if (uid === 'demo-user') return DEMO_SUBSCRIPTION;
  const q = query(
    collection(db, 'subscriptions'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const sub = { id: snap.docs[0].id, ...snap.docs[0].data() } as Subscription;
  const today = new Date().toISOString().split('T')[0];
  if (sub.status === 'active' && sub.endDate < today) {
    await updateDoc(doc(db, 'subscriptions', sub.id), {
      status: 'expired', updatedAt: serverTimestamp(),
    });
    return { ...sub, status: 'expired' };
  }
  return sub;
};

export const createSubscription = async (
  data: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> => {
  const ref = await addDoc(collection(db, 'subscriptions'), {
    ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const deductMembershipWash = async (uid: string): Promise<{ success: boolean; subscriptionId?: string }> => {
  const sub = await getUserSubscription(uid);
  if (!sub || sub.status !== 'active') return { success: false };
  const today = new Date().toISOString().split('T')[0];
  if (sub.endDate < today || sub.washesUsed >= sub.washesTotal) return { success: false };
  await updateDoc(doc(db, 'subscriptions', sub.id), {
    washesUsed: sub.washesUsed + 1, updatedAt: serverTimestamp(),
  });
  return { success: true, subscriptionId: sub.id };
};

export const getAllSubscriptions = async (): Promise<Subscription[]> => {
  const snap = await getDocs(query(collection(db, 'subscriptions'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Subscription));
};

export const updateSubscriptionStatus = async (
  id: string, status: Subscription['status'], notes?: string,
) => {
  const data: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
  if (notes) data.adminNotes = notes;
  await updateDoc(doc(db, 'subscriptions', id), data);
};

export const checkAndExpireSubscription = async (uid: string): Promise<Subscription | null> => {
  const sub = await getUserSubscription(uid);
  if (!sub || sub.status !== 'active') return null;
  const today = new Date().toISOString().split('T')[0];
  if (sub.endDate < today) {
    await updateDoc(doc(db, 'subscriptions', sub.id), {
      status: 'expired', updatedAt: serverTimestamp(),
    });
    return { ...sub, status: 'expired' };
  }
  return null;
};