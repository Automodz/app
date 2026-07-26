import {
  collection, doc, addDoc, updateDoc, getDocs,
  query, where, orderBy, limit, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Subscription } from '../types';

const todayStr = () => new Date().toISOString().split('T')[0];

/** Expiry is COMPUTED here, never written - customers aren't allowed to write
 *  status changes (rules), and a lapsed member must still see their card.
 *  Persistence happens admin-side via expireLapsedSubscriptions(). */
const withComputedExpiry = (sub: Subscription): Subscription =>
  sub.status === 'active' && sub.endDate < todayStr()
    ? { ...sub, status: 'expired' }
    : sub;

export const getUserSubscription = async (uid: string): Promise<Subscription | null> => {
  const q = query(
    collection(db, 'subscriptions'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const sub = { id: snap.docs[0].id, ...snap.docs[0].data() } as Subscription;
  return withComputedExpiry(sub);
};

export const createSubscription = async (
  data: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> => {
  const ref = await addDoc(collection(db, 'subscriptions'), {
    ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return ref.id;
};

/* `deductMembershipWash` lived here, calling /api/membership/deduct-wash after
   the job had already been written - so a wash could be spent on a visit that
   failed, or a visit could be given away free without spending one. Both routes
   are deleted: the deduction now rides the same commit as the record that
   consumes it (lib/server/bookingService.ts). */

export const getAllSubscriptions = async (): Promise<Subscription[]> => {
  const snap = await getDocs(query(collection(db, 'subscriptions'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => withComputedExpiry({ id: d.id, ...d.data() } as Subscription));
};

export const updateSubscriptionStatus = async (
  id: string, status: Subscription['status'], notes?: string,
) => {
  const data: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
  if (notes) data.adminNotes = notes;
  await updateDoc(doc(db, 'subscriptions', id), data);
};

/**
 * ADMIN ONLY: persist expiry for all lapsed-but-still-'active' subscriptions.
 * Called from the admin subscriptions page on load (admin may write per rules).
 */
export const expireLapsedSubscriptions = async (): Promise<number> => {
  const snap = await getDocs(query(collection(db, 'subscriptions'), where('status', '==', 'active')));
  const today = todayStr();
  const lapsed = snap.docs.filter(d => (d.data() as Subscription).endDate < today);
  await Promise.all(lapsed.map(d =>
    updateDoc(doc(db, 'subscriptions', d.id), { status: 'expired', updatedAt: serverTimestamp() }),
  ));
  return lapsed.length;
};
