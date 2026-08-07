import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/server/firebaseAdmin';
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/server/session';

/**
 * THE SESSION DOOR.
 *
 * POST   exchange a freshly-minted ID token for an httpOnly session cookie, so
 *        server components can render a customer's own rooms.
 * DELETE drop the cookie and revoke nothing else — the client SDK owns its own
 *        sign-out; this only removes the copy the server reads.
 *
 * The ID token is verified before anything is issued, so a forged token never
 * reaches cookie minting.
 */
export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!adminAuth) {
    /* The single most common way a working checkout cannot sign anybody in:
       no service account, so no cookie can be minted and every room renders
       signed out. Said once, plainly, where whoever ran `npm run dev` will
       actually see it. */
    console.error(
      '[session] no Firebase Admin credentials — set FIREBASE_ADMIN_PROJECT_ID, '
      + 'FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY in .env.local. '
      + 'Sign-in cannot complete without them.',
    );
    return NextResponse.json({ error: 'auth-unavailable' }, { status: 503 });
  }
  let idToken: unknown;
  try {
    ({ idToken } = await req.json());
  } catch {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }
  if (typeof idToken !== 'string' || idToken.length < 20) {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  try {
    await adminAuth.verifyIdToken(idToken, true);
    const cookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set({
      name: SESSION_COOKIE,
      value: cookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return res;
  } catch (err) {
    /**
     * SAY WHY, WHERE IT CAN BE READ, AND NOWHERE ELSE.
     *
     * This branch used to be a bare `catch {}` returning 401. Every reason a
     * sign-in can be refused — an expired token, a revoked session, a clock
     * that disagrees with Google's, a service account for the wrong project —
     * arrived at the customer as one sentence and left no trace anywhere. The
     * only way to tell them apart was to guess.
     *
     * `removeConsole` in next.config keeps `console.error` in production
     * precisely so a route like this can still be read from the platform log.
     *
     * The CODE goes back to the caller — `auth/id-token-expired` names a
     * condition, not a secret, and it is what makes a customer's screenshot
     * actionable. The message does NOT: it can carry token fragments and
     * project internals. Nothing here is ever rendered (§ the door shows its
     * own sentence); it exists for the log and for a support conversation.
     */
    const code = (err as { code?: string }).code ?? 'unknown';
    console.error('[session] refused', code, (err as Error)?.message);
    return NextResponse.json({ error: 'invalid-token', reason: code }, { status: 401 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: SESSION_COOKIE, value: '', httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', path: '/', maxAge: 0,
  });
  return res;
}
