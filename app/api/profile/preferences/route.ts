import { NextResponse, type NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { callerOf as sessionCaller } from '@/lib/server/session';
import { isVpa, normaliseVpa } from '@/lib/os/upi';
import { reportError } from '@/lib/server/report';

export const dynamic = 'force-dynamic';

/**
 * QUIET MODE AND THE PAYMENT ADDRESS — design screen 19.
 *
 * Both are on the user document and both are refused to clients in
 * `firestore.rules`, for different reasons:
 *
 *   · `upiVpa` needs validating, and a malformed address is not a cosmetic
 *     problem — it is a customer tapping "Pay" and their bank application
 *     refusing to open, at the counter, with the car behind a closed shutter.
 *   · `quietMode` is read by the server when it decides whether a push may be
 *     delivered. A preference the server has to honour is a preference the
 *     server should own, so that "it saved" and "it took effect" are the same
 *     event rather than two.
 *
 * The uid comes from the verified token. No body field names a user.
 */
export async function POST(req: NextRequest) {
  try {
    assertAdminConfigured();
  } catch {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  /* A bearer token, or the session cookie the rooms already use — the two
     lapse independently, and a customer signed in enough to SEE a screen is
     signed in enough to use it. Same-origin only; see lib/server/session.ts. */
  const uid = await sessionCaller(req, t => adminAuth!.verifyIdToken(t));
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as
    { quietMode?: unknown; upiVpa?: unknown } | null;
  if (!body) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  const patch: Record<string, unknown> = {};

  if ('quietMode' in body) {
    if (typeof body.quietMode !== 'boolean') {
      return NextResponse.json({ error: 'quiet-mode-invalid' }, { status: 400 });
    }
    patch.quietMode = body.quietMode;
  }

  if ('upiVpa' in body) {
    const raw = typeof body.upiVpa === 'string' ? body.upiVpa : '';
    if (raw.trim() === '') {
      /* REMOVING IT IS A REAL ACT, and it must actually remove the field —
         writing an empty string would leave a payment address the intent
         builder would happily put in a link. */
      patch.upiVpa = FieldValue.delete();
    } else if (!isVpa(raw)) {
      return NextResponse.json({ error: 'vpa-invalid' }, { status: 400 });
    } else {
      patch.upiVpa = normaliseVpa(raw);
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing-to-change' }, { status: 400 });
  }

  try {
    await adminDb!.collection('users').doc(uid).set(
      { ...patch, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return NextResponse.json({
      ok: true,
      ...('quietMode' in patch ? { quietMode: patch.quietMode } : {}),
      ...('upiVpa' in body
        ? { upiVpa: typeof patch.upiVpa === 'string' ? patch.upiVpa : '' } : {}),
    });
  } catch (e) {
    await reportError(e, { op: 'profile.preferences', userId: uid });
    return NextResponse.json({ error: 'save-failed' }, { status: 500 });
  }
}
