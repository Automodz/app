import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs,
  query, where, orderBy, limit, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Subscription } from '../types';
import { MEMBERSHIP_PLANS } from '../types';
import { isLapsed } from '../os/club';


/** Expiry is COMPUTED here, never written - customers aren't allowed to write
 *  status changes (rules), and a lapsed member must still see their card.
 *  Persistence happens admin-side via expireLapsedSubscriptions(). */
const withComputedExpiry = (sub: Subscription): Subscription =>
  isLapsed(sub) ? { ...sub, status: 'expired' } : sub;

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
  const ref = doc(db, 'subscriptions', id);
  const data: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
  if (notes) data.adminNotes = notes;

  /* ACTIVATION IS THE MOMENT MONEY CHANGED HANDS, and it is stamped once.
     `paidAt` is what membership revenue is reported on, so re-activating a
     subscription must not move it into a later month — and the amount is
     captured with it so a future price change cannot rewrite past revenue. */
  if (status === 'active') {
    const snap = await getDoc(ref);
    const existing = snap.data() as Subscription | undefined;
    if (existing && !existing.paidAt) {
      data.paidAt = serverTimestamp();
      const plan = MEMBERSHIP_PLANS.find(p => p.id === existing.plan);
      if (plan) data.amountPaid = plan.price;
    }
  }

  await updateDoc(ref, data);
};

/**
 * ADMIN ONLY: persist expiry for all lapsed-but-still-'active' subscriptions.
 * Called from the admin subscriptions page on load (admin may write per rules).
 */
export const expireLapsedSubscriptions = async (): Promise<number> => {
  const snap = await getDocs(query(collection(db, 'subscriptions'), where('status', '==', 'active')));
  const lapsed = snap.docs.filter(d => isLapsed(d.data() as Subscription));
  await Promise.all(lapsed.map(d =>
    updateDoc(doc(db, 'subscriptions', d.id), { status: 'expired', updatedAt: serverTimestamp() }),
  ));
  return lapsed.length;
};
