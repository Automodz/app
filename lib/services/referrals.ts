import {
  doc, getDoc, updateDoc, getDocs, collection, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { REFERRAL } from '../config/storeConfig';
import type { User } from '../types';

export interface ReferralRecord {
  id: string;
  code: string;
  referrerUid: string;
  referrerName: string;
  referredUid: string;
  referredName: string;
  status: 'rewarded';
  createdAt?: { toDate?: () => Date };
}

const CODE_KEY = 'automodz-ref';

/** Remember an incoming ?ref= code until the user finishes signing in. */
export const stashReferralCode = (code: string) => {
  try { sessionStorage.setItem(CODE_KEY, code.toUpperCase().trim()); } catch {}
};

/** Get or lazily create this user's shareable referral code (stored on their profile). */
export const getMyReferralCode = async (user: User): Promise<string> => {
  const snap = await getDoc(doc(db, 'users', user.uid));
  const existing = (snap.data() as { referralCode?: string } | undefined)?.referralCode;
  if (existing) return existing;
  const prefix = (user.name || 'AMZ').replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'AMZ';
  const code = `${prefix}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  await updateDoc(doc(db, 'users', user.uid), { referralCode: code });
  return code;
};

export const referralShareLink = (code: string) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/auth/login?ref=${code}`;
};

export const referralWhatsAppLink = (code: string, name: string) => {
  const msg =
`Hey! I use AutoModz for car detailing in Maninagar - PPF, ceramic, washing, the works. 🚗✨

Sign up with my link and we BOTH get ${REFERRAL.label}:
${referralShareLink(code)}`;
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
};

/**
 * Claim a stashed referral code for the freshly signed-in user.
 * Validation + promo creation happen server-side (admin SDK) so promo
 * write rules stay admin-only.
 */
export const claimReferral = async () => {
  let code: string | null = null;
  try { code = sessionStorage.getItem(CODE_KEY); } catch {}
  if (!code) return;
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) return;
  const res = await fetch('/api/referral/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ code }),
  });
  if (res.ok) {
    try { sessionStorage.removeItem(CODE_KEY); } catch {}
  }
};

/** Referrals this user has brought in (for the dashboard referral page). */
export const getMyReferrals = async (uid: string): Promise<ReferralRecord[]> => {
  const snap = await getDocs(query(collection(db, 'referrals'), where('referrerUid', '==', uid)));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as ReferralRecord))
    .sort((a, b) => (b.createdAt?.toDate?.()?.getTime() ?? 0) - (a.createdAt?.toDate?.()?.getTime() ?? 0));
};

// Re-export for callers that only import the barrel
export const touchReferralUpdatedAt = (uid: string) =>
  updateDoc(doc(db, 'users', uid), { updatedAt: serverTimestamp() });
