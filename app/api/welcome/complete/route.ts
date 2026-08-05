import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { reportError } from '@/lib/server/report';

export const dynamic = 'force-dynamic';

/**
 * THE ONE PLACE A FIRST ARRIVAL IS RECORDED.
 *
 * It used to be `localStorage.setItem('automodz-welcomed', '1')`, which meant
 * the fact lived on one browser on one device. Signing in on a phone after a
 * laptop welcomed the same person twice; clearing site data welcomed them
 * forever; and nobody at the studio could reset it for a customer who asked.
 *
 * RESET (`{ reset: true }`) is deliberately part of the same route, because a
 * flag that can only be set is a flag nobody can fix:
 *   - an ADMIN may reset anybody, by uid — the studio's own escape hatch;
 *   - anyone may reset THEMSELVES outside production, which is what makes the
 *     flow testable without hand-editing Firestore.
 * A customer cannot reset another customer, and in production cannot reset
 * even themselves — that would be a way to make the welcome reappear for
 * someone by handing them a link.
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
  const reset = body?.reset === true;
  const target = typeof body?.uid === 'string' ? body.uid : uid;

  try {
    const db = adminDb!;

    if (!reset) {
      /* Recording an arrival is only ever about the caller. The `uid` in the
         body is ignored here entirely — it exists for the reset path alone. */
      await db.collection('users').doc(uid).set(
        { welcomedAt: new Date(), updatedAt: new Date() }, { merge: true },
      );
      return NextResponse.json({ welcomed: true });
    }

    if (target !== uid) {
      const caller = await db.collection('users').doc(uid).get();
      if (caller.data()?.role !== 'admin') {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
    } else if (process.env.NODE_ENV === 'production') {
      const caller = await db.collection('users').doc(uid).get();
      if (caller.data()?.role !== 'admin') {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
    }

    /* Deleted rather than set false — absent is what "never arrived" means
       everywhere else, and two spellings of the same fact is one too many. */
    const { FieldValue } = await import('firebase-admin/firestore');
    await db.collection('users').doc(target).set(
      { welcomedAt: FieldValue.delete(), updatedAt: new Date() }, { merge: true },
    );
    return NextResponse.json({ welcomed: false, uid: target });
  } catch (e) {
    await reportError(e, { op: 'welcome.complete', userId: uid });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
