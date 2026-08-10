import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/server/firebaseAdmin';
import { resealVisitTerms } from '@/lib/server/sealVisit';

/**
 * Remediate a visit sealed with a resolution defect. Admin only — it edits a
 * sealed record, under the guards documented on `resealVisitTerms`.
 */
export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!adminAuth || !adminDb) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
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
  const visitId = new URL(req.url).searchParams.get('visitId');
  if (!visitId) return NextResponse.json({ error: 'visitId-required' }, { status: 400 });
  return NextResponse.json(await resealVisitTerms(visitId));
}
