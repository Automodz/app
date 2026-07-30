import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/server/firebaseAdmin';
import { backfillSealedVisits } from '@/lib/server/sealVisit';

/**
 * Seal every completed job that has no sealed visit yet, so existing customers
 * get their history without anyone touching the admin.
 *
 * Idempotent, so it may be run repeatedly and while the studio is working. Admin
 * only — it walks every job in the business.
 */
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!adminAuth || !adminDb) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  try {
    const { uid } = await adminAuth.verifyIdToken(token, true);
    if ((await adminDb.doc(`users/${uid}`).get()).data()?.role !== 'admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const limit = Number(new URL(req.url).searchParams.get('limit') ?? 500);
  try {
    return NextResponse.json(await backfillSealedVisits(Math.min(limit, 1000)));
  } catch (err) {
    console.error('[backfill] failed', err);
    return NextResponse.json({ error: 'backfill-failed' }, { status: 500 });
  }
}
