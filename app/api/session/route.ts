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
  } catch {
    return NextResponse.json({ error: 'invalid-token' }, { status: 401 });
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
