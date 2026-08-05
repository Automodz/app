import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { reportError } from '@/lib/server/report';
import { loadListing } from '@/lib/server/marketplace';

export const dynamic = 'force-dynamic';

/**
 * Keep a car, or stop keeping it.
 *
 * The saved list is read on the server when the marketplace renders, so it has
 * to be written on the server too — a client write would be invisible to the
 * next render until Firestore and the request raced to agree.
 *
 * Idempotent by construction: saving what is already saved rewrites the same
 * document, unsaving what is not saved deletes nothing. A double tap on a slow
 * connection cannot produce two of anything.
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

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const listingId = typeof body?.listingId === 'string' ? body.listingId : '';
  const saved = body?.saved === true;
  if (!listingId) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  try {
    /* Only a listing that actually exists may be kept — otherwise the saved
       list fills with ids that render nothing and can never be cleared. */
    if (saved && !(await loadListing(listingId))) {
      return NextResponse.json({ error: 'listing-unavailable' }, { status: 409 });
    }

    const ref = adminDb!.collection('users').doc(uid).collection('savedCars').doc(listingId);
    if (saved) await ref.set({ savedAt: new Date() });
    else await ref.delete();

    return NextResponse.json({ saved });
  } catch (e) {
    await reportError(e, { op: 'cars.save', userId: uid });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
