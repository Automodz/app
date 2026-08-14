import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/server/firebaseAdmin';
import { sealVisitForJob } from '@/lib/server/sealVisit';

/**
 * Seal the visit for one completed job. Called by the kiosk the moment a job
 * completes; safe to call again, because sealing is idempotent.
 *
 * STAFF ONLY, verified server-side against the role on the user document - the
 * caller's own claim about who they are is never trusted (§22.8).
 */
export const runtime = 'nodejs';

async function callerIsStaff(req: Request): Promise<boolean> {
  if (!adminAuth || !adminDb) return false;
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return false;
  try {
    const { uid } = await adminAuth.verifyIdToken(token, true);
    const role = (await adminDb.doc(`users/${uid}`).get()).data()?.role;
    return role === 'admin' || role === 'employee';
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!adminDb) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  if (!await callerIsStaff(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let jobId: unknown;
  try { ({ jobId } = await req.json()); } catch {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }
  if (typeof jobId !== 'string' || !jobId) {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  try {
    return NextResponse.json(await sealVisitForJob(jobId));
  } catch (err) {
    console.error('[seal] failed', jobId, err);
    return NextResponse.json({ error: 'seal-failed' }, { status: 500 });
  }
}
