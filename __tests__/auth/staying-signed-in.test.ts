/**
 * A CUSTOMER SIGNS IN ONCE.
 *
 * ── WHAT IS PROVEN, AND WHAT IS NOT ─────────────────────────────────────────
 * I first wrote this file asserting a root cause: that `createSessionCookie`
 * refuses an ID token older than five minutes, so every return visit handed
 * over a stale cached token and was refused. THAT IS WRONG. Measured against
 * production afterwards: a token 377 seconds old was accepted with a 200. The
 * five-minute rule in Firebase's documentation concerns `auth_time` and
 * re-authentication for sensitive operations, not minting a session cookie.
 *
 * The reported failure — sign in, come back, "We could not open your studio.
 * Please sign in again." — is therefore STILL UNDIAGNOSED. These assertions
 * cover three things that are correct on their own merits and that make the
 * failure survivable and diagnosable, and they claim nothing about its cause.
 *
 *   1  THE TOKEN IS ALWAYS FRESH. A cached ID token lives an hour and refreshes
 *      only near expiry, so a device that slept through that boundary offers an
 *      expired one. Forcing removes a whole class of failure for one round trip.
 *
 *   2  A FAILURE DOES NOT DESTROY THE SESSION. Every failure used to end in
 *      `signOut`, so a dropped connection or a studio with no Admin credentials
 *      threw away a Firebase session that was on disk and perfectly valid — the
 *      customer had to go through Google again to recover what they already had.
 *      Whatever the true cause turns out to be, this is what made it hurt.
 *
 *   3  THE COOKIE CAN BE REOPENED WITHOUT THE DOOR. The Firebase session on a
 *      device outlives the server's fourteen-day cookie, and only the cookie is
 *      readable by a room, so a signed-in customer was served the public landing
 *      page and had to find the sign-in themselves.
 */
import { readFileSync } from 'fs';

const codeOf = (p: string) => readFileSync(p, 'utf8');
/** Source with comments stripped — so prose about a bug cannot pass for a fix. */
const liveCodeOf = (p: string) =>
  codeOf(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const login = liveCodeOf('app/auth/login/page.tsx');
const keeper = liveCodeOf('components/auth/SessionKeeper.tsx');
const layout = liveCodeOf('app/layout.tsx');
const you = liveCodeOf('components/screens/YouRoom.tsx');

describe('the ID token handed to the server is always fresh', () => {
  it('the door forces a refresh before minting a cookie', () => {
    /* Not a proven fix for the reported bug — see the header. It removes the
       expired-cached-token failure, which is real but is not that bug. */
    expect(login).toMatch(/getIdToken\(true\)/);
    expect(login).not.toMatch(/getIdToken\(\s*\)/);
  });

  it('so does the silent recovery', () => {
    expect(keeper).toMatch(/idToken\(true\)/);
  });

  it('and `idToken` actually passes the flag through to Firebase', () => {
    /* A `force` parameter that is accepted and dropped would make both of the
       assertions above meaningless. */
    const session = liveCodeOf('lib/clientSession.ts');
    expect(session).toMatch(/getIdToken\(force\)/);
  });
});

/* THIS is the part that made the reported failure hurt, whatever causes it. */
describe('a failure to open the session does not destroy the session', () => {
  it('only an outright refusal signs the customer out', () => {
    const guard = login.slice(login.indexOf('const result = await openServerSession()'));
    const branch = guard.slice(0, guard.indexOf('enter(href)'));
    /* The sign-out must sit inside the `refused` branch and nowhere else. */
    expect(branch).toMatch(/if \(result === 'refused'\)[\s\S]{0,120}signOut/);
  });

  it('a dead network is reported as a network, not as a rejection', () => {
    expect(login).toMatch(/'offline'/);
    const open = login.slice(login.indexOf('async function openServerSession'));
    /* No response object at all means the fetch never landed. */
    expect(open).toMatch(/if \(!res\) return 'offline'/);
  });

  it('a misconfigured studio is not the customer’s fault either', () => {
    expect(login).toMatch(/503 \? 'unavailable'/);
  });
});

describe('the cookie can be reopened without going through the door', () => {
  it('the keeper is mounted above every room, for signed-out renders', () => {
    expect(layout).toMatch(/<SessionKeeper signedIn=\{signedIn\} \/>/);
  });

  it('it does nothing when the server already knows who this is', () => {
    expect(keeper).toMatch(/if \(signedIn\)/);
  });

  it('an anonymous browser never loads the Firebase SDK for it', () => {
    /* The marker is checked first and the SDK import is dynamic, so the public
       landing page carries none of it. A static import here would put Firebase
       auth into the first load of every route in the product. */
    expect(keeper).not.toMatch(/^import .*(firebase|clientSession)/m);
    expect(keeper).toMatch(/await import\('@\/lib\/clientSession'\)/);
    expect(keeper.indexOf('localStorage.getItem(KNOWN)'))
      .toBeLessThan(keeper.indexOf("await import('@/lib/clientSession')"));
  });

  it('it tries once per tab, and records the attempt BEFORE making it', () => {
    /* Recorded afterwards, a failed attempt would re-render, find no session
       and try again for ever. */
    expect(keeper.indexOf('sessionStorage.setItem(TRIED')).toBeGreaterThan(-1);
    expect(keeper.indexOf('sessionStorage.setItem(TRIED'))
      .toBeLessThan(keeper.indexOf("fetch('/api/session'"));
  });

  it('a refusal stops the device claiming to know anybody', () => {
    expect(keeper).toMatch(/status === 401\) forgetDevice\(\)/);
  });

  it('a 503 or a dead network leaves the marker alone', () => {
    const after = keeper.slice(keeper.indexOf("fetch('/api/session'"));
    expect(after).not.toMatch(/status === 503[\s\S]{0,40}forgetDevice/);
  });
});

describe('signing out really signs out', () => {
  it('the device stops being remembered, before the page goes', () => {
    /* Otherwise the keeper would reopen, on the next load, the very session
       the customer had just closed — on a shared phone, someone else's. */
    expect(you).toMatch(/forgetDevice\(\)/);
    expect(you.indexOf('forgetDevice()')).toBeLessThan(you.indexOf('window.location.replace'));
  });

  it('and the marker carries no identity to leak', () => {
    /* One bit. Whatever it says, the Admin SDK still verifies a real token. */
    expect(keeper).toMatch(/localStorage\.setItem\(KNOWN, '1'\)/);
    expect(keeper).not.toMatch(/setItem\(KNOWN, (?!'1')/);
  });
});

describe('the session cookie is as long-lived as Firebase allows', () => {
  it('fourteen days, which is the ceiling', () => {
    const session = liveCodeOf('lib/server/session.ts');
    expect(session).toMatch(/SESSION_MAX_AGE_SECONDS = 60 \* 60 \* 24 \* 14/);
  });

  it('and the cookie is httpOnly, so no script can read or forge it', () => {
    const route = liveCodeOf('app/api/session/route.ts');
    expect(route).toMatch(/httpOnly: true/);
    expect(route).toMatch(/sameSite: 'lax'/);
    expect(route).toMatch(/secure: process\.env\.NODE_ENV === 'production'/);
  });

  it('revocation still takes effect immediately', () => {
    /* The long cookie is only safe because every render re-checks it. */
    const session = liveCodeOf('lib/server/session.ts');
    expect(session).toMatch(/verifySessionCookie\(raw, true\)/);
  });
});
