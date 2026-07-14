import { NextResponse } from 'next/server';
import { adminAuth, adminDb, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { runRetentionForUser } from '@/lib/server/retention';

/**
 * Manual retention trigger for ONE user (admin-gated). The daily cron sweep
 * (/api/cron/daily) runs the same pass for everyone - this route remains for
 * ad-hoc runs from the admin UI.
 */
export async function POST(req: Request) {
  try {
    assertAdminConfigured();
  } catch (e: unknown) {
    const message = typeof e === 'object' && e !== null && 'message' in e ? String((e as { message?: unknown }).message) : 'Admin not configured';
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!token) return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 });

  const decoded = await adminAuth!.verifyIdToken(token);
  const uid = decoded.uid;

  const userSnap = await adminDb!.collection('users').doc(uid).get();
  if (!userSnap.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (userSnap.data()?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const result = await runRetentionForUser(uid);
  return NextResponse.json({ ok: true, ...result });
}
