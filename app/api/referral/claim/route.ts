import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { REFERRAL } from '@/lib/config/storeConfig';

export const dynamic = 'force-dynamic';

const addDays = (days: number) => {
  const d = new Date(Date.now() + days * 86400000);
  return d.toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Claim a referral code for the (newly signed-in) caller.
 * Creates: referrals record + a targeted flat-off promo for BOTH parties.
 * Server-side so promo writes stay admin-only in Firestore rules.
 */
export async function POST(req: NextRequest) {
  try {
    assertAdminConfigured();
  } catch {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let referredUid: string;
  try {
    referredUid = (await adminAuth!.verifyIdToken(authHeader.slice(7))).uid;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { code } = await req.json() as { code?: string };
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });
  const cleanCode = code.toUpperCase().trim();

  // Find the referrer by code
  const refSnap = await adminDb!.collection('users').where('referralCode', '==', cleanCode).limit(1).get();
  if (refSnap.empty) return NextResponse.json({ error: 'Unknown code' }, { status: 404 });
  const referrer = refSnap.docs[0];
  if (referrer.id === referredUid) return NextResponse.json({ error: 'Cannot refer yourself' }, { status: 400 });

  // One claim per referred user, ever
  const existing = await adminDb!.collection('referrals').where('referredUid', '==', referredUid).limit(1).get();
  if (!existing.empty) return NextResponse.json({ error: 'Already claimed' }, { status: 409 });

  const referredDoc = await adminDb!.collection('users').doc(referredUid).get();
  const referredName = referredDoc.data()?.name ?? 'Friend';
  const referrerName = referrer.data()?.name ?? 'Member';

  const promoBase = {
    type: 'flat', value: REFERRAL.amount,
    scope: { kind: 'all' },
    validFrom: today(), validTo: addDays(REFERRAL.validityDays),
    usageLimitTotal: 1, usageLimitPerCustomer: 1, usedCount: 0,
    autoApply: true, active: true,
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  };

  const batch = adminDb!.batch();
  batch.set(adminDb!.collection('referrals').doc(), {
    code: cleanCode,
    referrerUid: referrer.id, referrerName,
    referredUid, referredName,
    status: 'rewarded',
    createdAt: FieldValue.serverTimestamp(),
  });
  batch.set(adminDb!.collection('promos').doc(), {
    ...promoBase,
    code: `WELCOME-${cleanCode}`,
    label: `Welcome gift - ${REFERRAL.label} (from ${referrerName})`,
    target: { kind: 'customers', userIds: [referredUid] },
  });
  batch.set(adminDb!.collection('promos').doc(), {
    ...promoBase,
    code: `THANKS-${cleanCode}-${Date.now().toString(36).toUpperCase().slice(-4)}`,
    label: `Referral reward - ${REFERRAL.label} (you referred ${referredName})`,
    target: { kind: 'customers', userIds: [referrer.id] },
  });
  await batch.commit();

  return NextResponse.json({ ok: true, reward: REFERRAL.label });
}
