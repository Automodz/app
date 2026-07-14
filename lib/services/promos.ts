import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs,
  query, where, increment, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { isPromoEligible, type PromoEligibilityContext } from './pricing';
import type { Promo, PromoRedemption } from '../types';

export const createPromo = async (data: Omit<Promo, 'id' | 'usedCount' | 'createdAt' | 'updatedAt'>) => {
  const r = await addDoc(collection(db, 'promos'), {
    ...data, code: data.code.toUpperCase().trim(), usedCount: 0,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return r.id;
};

export const updatePromo = (id: string, data: Partial<Omit<Promo, 'id' | 'createdAt'>>) =>
  updateDoc(doc(db, 'promos', id), {
    ...data,
    ...(data.code ? { code: data.code.toUpperCase().trim() } : {}),
    updatedAt: serverTimestamp(),
  });

export const listPromos = async (): Promise<Promo[]> => {
  const snap = await getDocs(collection(db, 'promos'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Promo))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
};

export const getActivePromos = async (): Promise<Promo[]> => {
  const snap = await getDocs(query(collection(db, 'promos'), where('active', '==', true)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Promo));
};

const getUserRedemptionCount = async (promoId: string, userId: string): Promise<number> => {
  const snap = await getDocs(query(
    collection(db, 'promoRedemptions'),
    where('promoId', '==', promoId), where('userId', '==', userId),
  ));
  return snap.size;
};

/** Auto-applicable promos for a service+customer (client-side filtering per rules design). */
export const getEligiblePromos = async (
  ctx: Omit<PromoEligibilityContext, 'userRedemptionCount'>,
  opts: { autoApplyOnly?: boolean } = {},
): Promise<Promo[]> => {
  const promos = await getActivePromos();
  const out: Promo[] = [];
  for (const p of promos) {
    if (opts.autoApplyOnly && !p.autoApply) continue;
    let userRedemptionCount = 0;
    if (p.usageLimitPerCustomer != null && ctx.userId) {
      userRedemptionCount = await getUserRedemptionCount(p.id, ctx.userId);
    }
    if (isPromoEligible(p, { ...ctx, userRedemptionCount })) out.push(p);
  }
  return out;
};

/** Validate a manually entered promo code; returns the promo or a rejection reason. */
export const validatePromoCode = async (
  code: string,
  ctx: Omit<PromoEligibilityContext, 'userRedemptionCount'>,
): Promise<{ promo: Promo } | { error: string }> => {
  const snap = await getDocs(query(
    collection(db, 'promos'), where('code', '==', code.toUpperCase().trim()),
  ));
  if (snap.empty) return { error: 'Invalid code' };
  const promo = { id: snap.docs[0].id, ...snap.docs[0].data() } as Promo;
  let userRedemptionCount = 0;
  if (promo.usageLimitPerCustomer != null && ctx.userId) {
    userRedemptionCount = await getUserRedemptionCount(promo.id, ctx.userId);
  }
  if (!isPromoEligible(promo, { ...ctx, userRedemptionCount })) {
    if (!promo.active || ctx.date > promo.validTo) return { error: 'This code has expired' };
    if (promo.usageLimitTotal != null && promo.usedCount >= promo.usageLimitTotal) return { error: 'Code fully redeemed' };
    if (userRedemptionCount > 0) return { error: 'You have already used this code' };
    return { error: 'Code not valid for this service' };
  }
  return { promo };
};

export const recordPromoRedemption = async (data: {
  promoId: string; userId?: string; customerPhone?: string;
  bookingId?: string; jobId?: string; discountAmount: number;
}) => {
  const clean: Record<string, unknown> = { promoId: data.promoId, discountAmount: data.discountAmount };
  if (data.userId) clean.userId = data.userId;
  if (data.customerPhone) clean.customerPhone = data.customerPhone;
  if (data.bookingId) clean.bookingId = data.bookingId;
  if (data.jobId) clean.jobId = data.jobId;
  await addDoc(collection(db, 'promoRedemptions'), { ...clean, createdAt: serverTimestamp() });
  await updateDoc(doc(db, 'promos', data.promoId), { usedCount: increment(1) });
};

export const getPromo = async (id: string): Promise<Promo | null> => {
  const snap = await getDoc(doc(db, 'promos', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Promo) : null;
};

export const getRedemptionsForPromo = async (promoId: string): Promise<PromoRedemption[]> => {
  const snap = await getDocs(query(collection(db, 'promoRedemptions'), where('promoId', '==', promoId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as PromoRedemption));
};
