import 'server-only';
/**
 * THE SERVER'S VIEW OF WHO IS SIGNED IN.
 *
 * The Firebase client SDK keeps its tokens in browser storage, which a server
 * component cannot see. That single fact is why every customer room used to
 * fetch on the client, ship the whole Firestore SDK, and render a loading bar as
 * its first paint.
 *
 * So the session is ALSO a cookie: signed by Firebase, httpOnly, verified with
 * the Admin SDK on every request. The browser keeps its own session for the
 * client-side sign-in flow; this is the copy the server can read.
 */
import { cache } from 'react';
import { cookies } from 'next/headers';
import { adminAuth } from './firebaseAdmin';

export const SESSION_COOKIE = 'automodz-session-id';

/** Firebase's ceiling for a session cookie is 14 days. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

export interface ServerSession {
  uid: string;
  email?: string;
  name?: string;
}

/**
 * Is there a session cookie at all?
 *
 * This does NOT verify it — an expired or revoked cookie still answers true.
 * It exists for the one decision that must be made ABOVE the page, in the root
 * layout: whether `/` is the public landing or the customer's Home, and so
 * whether the navigation bar exists at all. Verification still happens inside
 * the page, where a bad cookie lands on the sign-in wall exactly as before.
 *
 * The alternative was calling `currentSession()` twice per request — a second
 * `verifySessionCookie` round trip to answer a question a cookie read already
 * answers well enough to choose a shell.
 */
export async function hasSessionCookie(): Promise<boolean> {
  const jar = await cookies();
  return Boolean(jar.get(SESSION_COOKIE)?.value);
}

/**
 * Who is asking, or null.
 *
 * `checkRevoked` is deliberately ON: a signed-out or disabled account must stop
 * rendering someone's garage immediately, not in fourteen days. It costs one
 * lookup per request, which is the correct trade for a surface that shows a
 * customer's own property.
 */
/**
 * MEMOISED FOR THE REQUEST, exactly as `loadCustomerPicture` is.
 *
 * `verifySessionCookie(raw, true)` is a network round trip to check revocation.
 * A page that needs both the picture AND something ownership-scoped beside it
 * — the manage screen needs the studio's openings — would otherwise pay for
 * that twice for one render. `cache` is an RSC-only export, absent in a unit
 * test, so the wrapper degrades to the plain function rather than making the
 * module unimportable.
 */
export const currentSession: typeof _currentSession =
  typeof cache === 'function' ? cache(_currentSession) : _currentSession;

async function _currentSession(): Promise<ServerSession | null> {
  /* THE COOKIE IS READ FIRST, BEFORE ANY OTHER CHECK, AND THAT ORDER IS LOAD
     BEARING. `cookies()` is what tells Next this render depends on the request.
     With the check the other way round, a build without admin credentials
     returned null before touching it — so Next saw no dynamic API and
     PRERENDERED the signed-out screen into static HTML. Every signed-in
     customer would then have been served "your car is behind a sign-in" from
     the CDN, forever. Verified: `.next/server/app/index.html` contained exactly
     that string. */
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw || !adminAuth) return null;
  try {
    const claims = await adminAuth.verifySessionCookie(raw, true);
    return { uid: claims.uid, email: claims.email, name: claims.name as string | undefined };
  } catch {
    // expired, revoked or forged — all indistinguishable to the customer
    return null;
  }
}
