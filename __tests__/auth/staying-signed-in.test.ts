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
 * cover four things that are correct on their own merits and that make the
 * failure survivable and diagnosable, and they claim nothing about its cause.
 *
 *   1  A STALE TOKEN NEVER ENDS A SIGN-IN, AND NOBODY ELSE PAYS FOR IT. This
 *      file used to assert the opposite — "always force a refresh" — and the
 *      opposite was itself a fault: a mandatory round trip to Google wedged
 *      into the one second between the credential being granted and the studio
 *      being handed it. The cached token goes first; the forced refresh happens
 *      where staleness is known, because the server named it.
 *
 *   4  A FAILURE SAYS WHICH FAILURE IT WAS. `/api/session` answers with a
 *      reason and the door used to discard it, so every cause arrived as one
 *      sentence. The reason now reaches the console always and the screen under
 *      `?debug=1`, and the customer's sentence still carries no code.
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

describe('a stale ID token is recovered from, without a round trip for everyone else', () => {
  /**
   * THIS USED TO ASSERT THE OPPOSITE, AND THE OPPOSITE WAS THE BUG.
   *
   * The rule was "the door forces a refresh before minting a cookie", defended
   * by the header above as removing a real class of failure for one round trip.
   * The round trip is the problem. `getIdToken(true)` is a mandatory call to
   * `securetoken.googleapis.com` placed in the one second between Google
   * granting a credential and the studio being handed it — and a customer who
   * loses it there is told "we signed you in, but could not open your studio",
   * which is exactly what was reported from production.
   *
   * The guarantee that was actually wanted is not "always forced", it is "a
   * stale token never ends the sign-in". So: the cached token first, and the
   * forced refresh only where staleness is KNOWN — the server names it.
   */
  it('the door offers the cached token first', () => {
    const open = login.slice(login.indexOf('async function openServerSession'));
    expect(open).toMatch(/exchange\(false\)/);
  });

  it('and forces a refresh only when the server says the token expired', () => {
    const open = login.slice(login.indexOf('async function openServerSession'));
    expect(login).toMatch(/STALE_TOKEN = 'auth\/id-token-expired'/);
    expect(open).toMatch(
      /result === 'refused' && [\s\S]{0,40}code === STALE_TOKEN[\s\S]{0,40}exchange\(true\)/,
    );
  });

  it('the retry is bounded — a second refusal is not exchanged again', () => {
    /* `exchange(true)` is returned, not looped over. A studio refusing every
       token must not become an unbounded run at Google's rate limits. */
    const open = login.slice(login.indexOf('async function openServerSession'));
    expect(open.match(/exchange\(true\)/g)?.length).toBe(1);
  });

  it('the silent recovery still forces, because there the token really is old', () => {
    /* Different path, different truth: `SessionKeeper` runs for a customer
       whose fourteen-day cookie has lapsed, whose cached token may be an hour
       old, and who is not waiting on a popup. Forcing costs them nothing. */
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
  it('only an outright refusal signs the customer out — the returning customer', () => {
    const guard = login.slice(login.indexOf('const { result, code } = await openServerSession()'));
    const branch = guard.slice(0, guard.indexOf('enter(href)'));
    /* The sign-out must sit inside the `refused` branch and nowhere else. */
    expect(branch).toMatch(/if \(result === 'refused'\)[\s\S]{0,120}signOut/);
  });

  /**
   * THE DOOR'S OWN COPY OF THE RULE, WHICH IT DID NOT OBEY.
   *
   * The rule was stated one screen above `handleGoogle` and enforced only on
   * the returning-customer path. `handleGoogle` signed out on EVERY non-`ok`
   * result — so a phone that dropped its connection for the second between
   * Google answering and the studio being asked threw away a credential that
   * had just been granted, and sent the customer back through Google.
   */
  it('only an outright refusal signs the customer out — the sign-in itself', () => {
    const start = login.indexOf('const { result: session, code } = await openServerSession()');
    expect(start).toBeGreaterThan(-1);
    const branch = login.slice(start, login.indexOf('setUser(profile)', start));
    expect(branch).toMatch(/if \(session === 'refused'\)[\s\S]{0,120}signOut/);
    /* And nowhere else in that branch. */
    expect(branch.match(/signOut/g)?.length).toBe(1);
  });

  it('a dead network is reported as a network, not as a rejection', () => {
    const open = login.slice(login.indexOf('async function openServerSession'));
    /* No response object at all means the fetch never landed. */
    expect(open).toMatch(/if \(!res\) return \{ result: 'offline'/);
    /* And a token that could not be refreshed is the same failure, one hop
       earlier — Google unreachable, not the studio refusing anybody. */
    expect(open).toMatch(/result: 'offline',\s*code: \(err as \{ code\?: string \}\)\?\.code/);
  });

  it('a misconfigured studio is not the customer’s fault either', () => {
    const open = login.slice(login.indexOf('async function openServerSession'));
    expect(open).toMatch(/if \(res\.status === 503\) \{[\s\S]{0,140}result: 'unavailable'/);
  });

  /**
   * THE FAILURE THAT WAS ACTUALLY HAPPENING, AND THE ONE 401 IT DID NOT DESERVE.
   *
   * Measured in production 2026-08-13: every `POST /api/session` answered 401
   * `app/invalid-credential` — "invalid_grant: Invalid JWT Signature", the
   * Admin SDK unable to get an access token because the service-account key had
   * been revoked. A forged token never reaches that call: signature checking is
   * local and refuses it first. So the 401 was reserved, exactly, for customers
   * who had done everything right — and it signed them out for it.
   */
  it('a service-account key that no longer works answers 503, not 401', () => {
    const route = liveCodeOf('app/api/session/route.ts');
    /* `app/` is the Admin SDK's prefix for faults in its own configuration, as
       against `auth/` codes that describe a token. */
    expect(route).toMatch(/if \(code\.startsWith\('app\/'\)\)[\s\S]{0,160}status: 503/);
    /* And a token fault still refuses, so a forgery is not excused by this. */
    expect(route).toMatch(/error: 'invalid-token', reason: code \}, \{ status: 401 \}/);
  });

  it('and the door shows WHICH part of the studio is broken, not a generic 503', () => {
    const open = login.slice(login.indexOf('async function openServerSession'));
    expect(open).toMatch(/status === 503[\s\S]{0,140}code: body\?\.reason/);
  });

  /**
   * AND THE FAILURE NAMES ITSELF.
   *
   * `/api/session` answers `{ error, reason }` and says at length why: the
   * code is what makes a customer's screenshot actionable. The door threw it
   * away, so a production sign-in failure arrived as one sentence with nothing
   * in it to tell an expired token from a revoked one from a service account
   * for the wrong project — the same hole `authFault` was built to close on
   * the Google half of the door, left open on the studio's half.
   */
  it('the studio’s reason travels with the verdict', () => {
    const open = login.slice(login.indexOf('async function openServerSession'));
    expect(open).toMatch(/body\?\.reason \?\? `session\/http-\$\{res\.status\}`/);
  });

  it('and reaches the console on every environment, and `?debug=1` on screen', () => {
    /* Both callers, so a failure is diagnosable wherever it happens. */
    expect(login.match(/console\.error\('\[session\]'/g)?.length).toBe(2);
    expect(login.match(/setDiagnostic\(code\)/g)?.length).toBe(2);
  });

  it('but never as a slug shown to a customer who did not ask for one', () => {
    /* `showDiagnostic` is the one gate, and the sentence itself carries no
       code. §20.2 — a customer is told what happened, not what broke. */
    expect(login).toMatch(/showDiagnostic && diagnostic/);
    expect(login).toMatch(/params\.get\('debug'\) === '1'/);
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
