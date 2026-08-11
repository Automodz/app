import { NextResponse, type NextRequest } from 'next/server';
import { adminAuth, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { rateVisit, RatingError } from '@/lib/server/ratingService';
import { reportError } from '@/lib/server/report';

export const dynamic = 'force-dynamic';

/**
 * RATE A VISIT — design screen 13.
 *
 * The rating attaches to the SEALED visit and to nothing else. The old one
 * hung off the public invoice, so anybody holding a shared link could rate
 * somebody else's work, and a visit with no invoice — most of them — could not
 * be rated at all.
 *
 * Once is structural: the rating's document id IS the visit id, so a second
 * rating is refused by the database rather than by a check that could race
 * with itself.
 */
export async function POST(req: NextRequest) {
  try {
    assertAdminConfigured();
  } catch {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let uid: string;
  try {
    uid = (await adminAuth!.verifyIdToken(header.slice(7))).uid;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as
    { visitId?: string; rating?: number; comment?: string } | null;
  const visitId = typeof body?.visitId === 'string' ? body.visitId : '';
  const rating = Number(body?.rating);
  if (!visitId || !Number.isFinite(rating)) {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  try {
    return NextResponse.json(await rateVisit(
      uid, visitId, Math.round(rating),
      typeof body?.comment === 'string' ? body.comment : undefined,
    ));
  } catch (e) {
    if (e instanceof RatingError) {
      return NextResponse.json({ error: e.code }, { status: e.status });
    }
    /* Firestore refuses a `create` on a document that exists. That is the
       once-only guarantee doing its job, not a fault. */
    if ((e as { code?: number })?.code === 6) {
      return NextResponse.json({ error: 'already-rated' }, { status: 409 });
    }
    await reportError(e, { op: 'rating.create', userId: uid, extra: { visitId } });
    return NextResponse.json({ error: 'rating-failed' }, { status: 500 });
  }
}
