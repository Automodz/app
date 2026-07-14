import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, assertAdminConfigured } from '@/lib/server/firebaseAdmin';

export const dynamic = 'force-dynamic';

/**
 * Deduct one wash from an active membership.
 * - Customers deduct from their OWN membership (no body needed).
 * - Staff (admin/employee) may pass { forUserId } to deduct for a walk-in
 *   member at the kiosk.
 * Server-side because the hardened Firestore rules (correctly) forbid clients
 * from writing washesUsed. Transactional: re-checks status, expiry and
 * remaining washes so concurrent taps can't over-deduct.
 */
export async function POST(req: NextRequest) {
  try {
    assertAdminConfigured();
  } catch {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let uid: string;
  try {
    uid = (await adminAuth!.verifyIdToken(authHeader.slice(7))).uid;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Staff may deduct on behalf of a walk-in member
  let targetUid = uid;
  try {
    const body = await req.json().catch(() => null) as { forUserId?: string } | null;
    if (body?.forUserId && body.forUserId !== uid) {
      const caller = await adminDb!.collection('users').doc(uid).get();
      const role = caller.data()?.role;
      if (role !== 'admin' && role !== 'employee') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      targetUid = body.forUserId;
    }
  } catch { /* no body - self-deduct */ }

  // Latest subscription owned by the target
  const snap = await adminDb!
    .collection('subscriptions')
    .where('userId', '==', targetUid)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  if (snap.empty) return NextResponse.json({ error: 'No membership' }, { status: 404 });
  const subRef = snap.docs[0].ref;

  const today = new Date().toISOString().split('T')[0];
  try {
    const subscriptionId = await adminDb!.runTransaction(async (t) => {
      const doc = await t.get(subRef);
      const sub = doc.data() as {
        userId: string; status: string; endDate: string;
        washesUsed: number; washesTotal: number;
      };
      if (sub.userId !== targetUid) throw new Error('not-owner');
      if (sub.status !== 'active') throw new Error('not-active');
      if (sub.endDate < today) throw new Error('expired');
      if (sub.washesUsed >= sub.washesTotal) throw new Error('no-washes-left');
      t.update(subRef, { washesUsed: sub.washesUsed + 1, updatedAt: new Date() });
      return doc.id;
    });
    return NextResponse.json({ ok: true, subscriptionId });
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'failed';
    return NextResponse.json({ error: reason }, { status: 409 });
  }
}
