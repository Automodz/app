/**
 * SIGNING IN, AND ACTUALLY ARRIVING.
 *
 * TWO BUGS, both of which broke the same journey - land on the front page,
 * tap Book, sign in with Google, and end up back on the front page still
 * signed out.
 *
 *   THE DESTINATION CAME FROM THE CLIENT ROUTER CACHE. Every customer room
 *   renders on the SERVER and reads an httpOnly session cookie. Sign-in minted
 *   that cookie and then called `router.replace('/')` - a SOFT navigation,
 *   which Next serves from the client Router Cache. That cache already held
 *   the signed-out landing page fetched moments earlier, so the server was
 *   never asked again and never saw the new cookie.
 *
 *   `router.refresh()` is not the fix: it clears the cache for the CURRENT
 *   route, and the current route at that moment is `/auth/login`, not the
 *   destination. A document load is what guarantees a fresh server render.
 *
 *   AND THE REDIRECT WAS BEING SWALLOWED. `ServerRoom` called
 *   `children(picture)` inside its own `try`. `redirect()` works by throwing,
 *   so Home sending a first-time customer to their arrival - and `/welcome`
 *   sending a returning one home - were both caught and rendered as "We could
 *   not reach your garage." A brand-new customer's first sign-in landed there.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { isSameOrigin } from '@/lib/os/origin';

const codeOf = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

const login = codeOf('app/auth/login/page.tsx');
const room = codeOf('components/screens/ServerRoom.tsx');

describe('a redirect from a room actually redirects', () => {
  it('ServerRoom guards ONLY the read, never the children', () => {
    /* The scope of this `try` is the whole bug. */
    const guarded = room.slice(room.indexOf('let picture'), room.indexOf('return <>'));
    expect(guarded).toMatch(/picture = await loadCustomerPicture\(session\)/);
    expect(guarded).not.toMatch(/children\(picture\)/);
  });

  it('the children are rendered outside the catch', () => {
    const catchEnd = room.lastIndexOf('}');
    const render = room.indexOf('{children(picture)}');
    expect(render).toBeGreaterThan(-1);
    expect(render).toBeLessThan(catchEnd);
    /* And after the catch block closes, not inside it. */
    expect(room.indexOf('We could not reach your garage')).toBeLessThan(render);
  });

  it('the rooms that redirect still do', () => {
    /* Home sends a first-time customer to their arrival; `/welcome` sends a
       returning one home. Both call `redirect()` inside ServerRoom's
       children. */
    expect(codeOf('app/page.tsx')).toMatch(/redirect\(hrefForDestination\(\{ to: 'welcome' \}\)\)/);
    expect(codeOf('app/welcome/page.tsx')).toMatch(/redirect\(/);
  });
});

describe('sign-in lands on a server render that can see the cookie', () => {
  it('the session cookie is minted before anything navigates', () => {
    const mint = login.indexOf('await openServerSession()');
    const go = login.indexOf('enter(homeFor(profile.role),');
    expect(mint).toBeGreaterThan(-1);
    expect(go).toBeGreaterThan(mint);
  });

  it('entering is a DOCUMENT load, not a soft navigation', () => {
    /* A soft navigation is served from the client Router Cache, which holds
       the signed-out landing fetched before the customer signed in. */
    expect(login).toMatch(
      /const enter = useCallback\(\(href: string, after = 0\) => \{[\s\S]{0,320}window\.location\.replace\(href\)/,
    );
    expect(login).not.toMatch(/router\.replace/);
    expect(login).not.toMatch(/router\.push/);
  });

  it('the door is left exactly once', () => {
    /* Two paths can decide it is time to go and both are async, so without a
       latch they can both fire and the second navigation cancels the first. */
    expect(login).toMatch(/if \(leaving\.current\) return;\s*leaving\.current = true;/);
  });

  /**
   * THE RACE THAT BROKE SIGNING IN.
   *
   * `onAuthStateChanged` fires INSIDE `signInWithPopup`, so `AuthProvider`
   * reached `setUser` several round trips before `handleGoogle` reached
   * `POST /api/session`. The already-signed-in effect then replaced the
   * document while the cookie was still in flight: the request died with the
   * page, the server saw no cookie, and `/` answered with the public landing.
   * Measured against the emulator - `setUser` at +2.3s, the session POST at
   * +13.3s, so it was not marginal, it was the normal case.
   */
  it('a sign-in in flight is never overtaken by the already-signed-in guard', () => {
    /* Claimed BEFORE the popup, because the credential - and so `setUser` -
       lands while `signInWithGoogle` is still awaiting. */
    const claim = login.indexOf('signingIn.current = true');
    const popup = login.indexOf('await signInWithGoogle()');
    expect(claim).toBeGreaterThan(-1);
    expect(popup).toBeGreaterThan(claim);
    expect(login).toMatch(/if \(authLoading \|\| !user \|\| signingIn\.current/);
  });

  it('a customer who is already signed in leaves WITH a session, not before one', () => {
    /* The other half: a returning customer whose Firebase session is still on
       disk but whose cookie has expired. Navigating on the strength of the
       store alone bounces them to the landing, which sends them back to the
       door, forever. The cookie is minted here first. */
    const effect = login.slice(
      login.indexOf('if (authLoading || !user || signingIn.current'),
      login.indexOf("const ref = params.get('ref')"),
    );
    expect(effect).not.toBe('');
    const mint = effect.indexOf('await openServerSession()');
    const go = effect.indexOf('enter(href)');
    expect(mint).toBeGreaterThan(-1);
    expect(go).toBeGreaterThan(mint);
  });

  /**
   * THE WELCOME BEAT MUST NOT RE-OPEN THE RACE.
   *
   * The success state holds the screen for a moment before the document is
   * replaced, and `handleGoogle`'s `finally` runs INSIDE that window. If the
   * exit were only claimed when the timeout fired, `finally` would re-arm the
   * guard effect mid-passage and a second session would be minted behind the
   * welcome. So the claim is synchronous and the move is what waits.
   */
  it('the exit is claimed synchronously, even when the move is delayed', () => {
    const body = login.slice(login.indexOf('const enter = useCallback'),
      login.indexOf('ALREADY SIGNED IN'));
    const claim = body.indexOf('leaving.current = true');
    const delayed = body.indexOf('setTimeout');
    expect(claim).toBeGreaterThan(-1);
    expect(delayed).toBeGreaterThan(claim);
  });

  it('the guard is only re-armed when the door was NOT left', () => {
    expect(login).toMatch(/if \(!leaving\.current\) \{\s*signingIn\.current = false;/);
  });

  it('a failed cookie mint is SAID, not swallowed', () => {
    /* It was `catch {}` with a comment saying the rooms would ask again. They
       do not - they render the signed-out landing, and the customer sees
       themselves bounced to the front page for no stated reason. */
    expect(login).toMatch(/if \(session !== 'ok'\)/);
    expect(login).toMatch(/could not open your studio/);
  });

  it('a failed mint does not leave a half-signed-in client', () => {
    /* Signed in to Firebase but with no server session is the state that
       produced the bounce loop; it must not be a state anyone can sit in. */
    /* Bounded on real code after the branch - `claimReferral` alone matches
       its own import at the top of the file, which made this slice empty. */
    const branch = login.slice(login.indexOf("if (session !== 'ok')"),
      login.indexOf('void claimReferral()'));
    expect(branch).not.toBe('');
    expect(branch).toMatch(/signOut\(auth\)/);
    expect(branch).toMatch(/setUser\(null\)/);
  });

  it('the destination can never be pointed off-site', () => {
    expect(login).toMatch(/safeDest\(params\.get\('redirect'\)\)/);
  });
});

/**
 * NOTHING DIAGNOSTIC SURVIVES ON A SURFACE A CUSTOMER CAN SEE.
 *
 * The stage trail that found the race rendered numbered stages, timings and a
 * decoded token audience directly on the door. It was temporary and it is
 * gone; this is what stops the next one being left behind.
 */
describe('the door carries no instrumentation', () => {
  it('the stage trace is gone, module and all', () => {
    expect(() => readFileSync('lib/authTrace.ts', 'utf8')).toThrow();
  });

  it('nothing imports it, and the door renders no trail', () => {
    const all = [...walk('app'), ...walk('components'), ...walk('lib'), ...walk('navigation')];
    for (const f of all) {
      expect({ f, traced: /authTrace|traceStart\(|traceSubscribe\(/.test(codeOf(f)) })
        .toEqual({ f, traced: false });
    }
  });

  /**
   * REVISED, DELIBERATELY. This read `expect(login).not.toMatch(/console\./)`.
   *
   * That was right about the stage trail and wrong as a general rule, and the
   * cost came due in production: a sign-in failure was reported in Chrome and
   * Safari, on new and returning accounts, and the door had thrown the SDK's
   * error code away at the only point it existed. A silent door is not a clean
   * door - it is one nobody can diagnose.
   *
   * So: exactly one console call, an `error`, carrying the code and nothing
   * about the customer. The instrumentation ban above is unchanged.
   */
  it('the door reports failures and narrates nothing else', () => {
    /* `console.error` and nothing else - `removeConsole` strips every other
       level from a production build anyway, so a `console.log` here is a line
       that exists only to be missing when it is needed. */
    const levels = new Set((login.match(/console\.(\w+)/g) ?? []));
    expect([...levels]).toEqual(['console.error']);
    expect(login).toMatch(/console\.error\(authDiagnostic\(fault, err\)\)/);
  });

  it('and the line it logs cannot carry the customer', () => {
    /* The diagnostic is built from the fault and the SDK's own message. No
       email, no token, no profile - a console is not a private place. */
    const diag = codeOf('lib/authError.ts');
    const fn = diag.slice(diag.indexOf('export function authDiagnostic'));
    expect(fn).not.toMatch(/email|uid|token|profile|user/i);
  });
});

describe('leaving clears what the server rendered', () => {
  it('signing out is a document load', () => {
    /* The Router Cache still holds rooms rendered while the cookie existed.
       On a shared phone a soft navigation can put somebody else's garage back
       on screen. */
    const you = codeOf('components/screens/YouRoom.tsx');
    expect(you).toMatch(/window\.location\.replace\('\/auth\/login'\)/);
    expect(you).not.toMatch(/router\.replace\('\/auth\/login'\)/);
  });

  it('the cookie is dropped before the page goes', () => {
    const you = codeOf('components/screens/YouRoom.tsx');
    expect(you.indexOf("fetch('/api/session', { method: 'DELETE' })"))
      .toBeLessThan(you.indexOf('window.location.replace'));
  });

  it('deleting an account is a document load too', () => {
    const settings = codeOf('components/you/AccountSettings.tsx');
    expect(settings).toMatch(/window\.location\.replace\('\/'\)/);
  });

  it('finishing the first arrival is a document load', () => {
    /* Home reads the flag that was just written to decide whether to send the
       customer back; a stale payload loops them into the arrival they just
       finished. */
    expect(codeOf('components/screens/WelcomeScreen.tsx'))
      .toMatch(/window\.location\.replace\(href\)/);
  });
});

describe('nothing soft-navigates across a change the server must see', () => {
  it('every auth-state transition leaves with a document load', () => {
    /* Written as a sweep rather than a list, so a new one cannot slip in
       using `router.replace` and reintroduce the bounce.

       Only the LEAVING matters. `WelcomeScreen` also calls `router.push` to
       move between its own steps, which is an ordinary soft navigation across
       no state the server has to re-read - flagging that would be noise. */
    const suspects = [...walk('app'), ...walk('components')]
      .filter(f => !f.includes('node_modules') && !f.startsWith('app/api/'))
      .filter(f => /\/api\/session'|clearSession\(\)|welcome\/complete/.test(codeOf(f)));

    expect(suspects.length).toBeGreaterThan(2);
    for (const f of suspects) {
      expect({ f, hard: /window\.location\.replace\(/.test(codeOf(f)) })
        .toEqual({ f, hard: true });
    }
  });

  it('the door itself never soft-navigates at all', () => {
    /* Every path out of `/auth/login` crosses the cookie. */
    expect(login).not.toMatch(/router\./);
  });
});

/**
 * TWO SESSIONS, AND A CUSTOMER WHO IS SIGNED IN TO BOTH.
 *
 * The rooms authenticate with the httpOnly cookie; the API routes
 * authenticated with a Bearer token from the Firebase client SDK. They lapse
 * independently - the token after an hour, the cookie after fourteen days - so
 * a customer could reach a room that rendered perfectly and find its one
 * control saying "your session has expired". Observed on the scope screen: the
 * coverages drew and the estimate beside them refused to price.
 *
 * A route may now accept either. The cookie path is same-origin only, because
 * a cookie travels on a cross-site request and a bearer token does not.
 */
describe('a route accepts a token OR the session the rooms already trust', () => {
  const request = (headers: Record<string, string>) =>
    ({ headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } }) as unknown as Request;

  it('a same-origin request may fall back to the cookie', () => {
    expect(isSameOrigin(request({ 'sec-fetch-site': 'same-origin' }))).toBe(true);
  });

  it('A CROSS-SITE REQUEST MAY NOT - that is the CSRF door', () => {
    /* Without this, another origin could post a form that books, cancels or
       pays as the customer, because their cookie would ride along. */
    expect(isSameOrigin(request({ 'sec-fetch-site': 'cross-site' }))).toBe(false);
    expect(isSameOrigin(request({ 'sec-fetch-site': 'same-site' }))).toBe(false);
    expect(isSameOrigin(request({ 'sec-fetch-site': 'none' }))).toBe(false);
  });

  it('an older browser is judged on Origin against the host we were reached on', () => {
    expect(isSameOrigin(request({ origin: 'https://automodz.app', host: 'automodz.app' }))).toBe(true);
    expect(isSameOrigin(request({ origin: 'https://evil.test', host: 'automodz.app' }))).toBe(false);
  });

  it('and NO Origin is not treated as same-origin - that is what a form post sends', () => {
    expect(isSameOrigin(request({ host: 'automodz.app' }))).toBe(false);
    expect(isSameOrigin(request({}))).toBe(false);
  });

  it('the token is tried FIRST, and the cookie only behind the guard', () => {
    /* Asserted on the source because `callerOf` composes the Admin SDK, which
       cannot load in this environment - and what matters is the ORDER: a
       token, then a same-origin check, then the cookie. */
    const session = readFileSync('lib/server/session.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const fn = session.slice(session.indexOf('export async function callerOf'));
    expect(fn.indexOf('verifyBearer')).toBeLessThan(fn.indexOf('isSameOrigin'));
    expect(fn.indexOf('isSameOrigin')).toBeLessThan(fn.indexOf('currentSession'));
    expect(fn).toMatch(/if \(!isSameOrigin\(req\)\) return null;/);
  });

  it('every route that takes the cookie takes it through that one helper', () => {
    /* A route that read the cookie itself would be a route with no CSRF
       guard, and it would look exactly like the others. */
    const routes = walk('app/api').filter(f => /route\.tsx?$/.test(f));
    const offenders = routes.filter(f => {
      const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      return /currentSession\(\)/.test(src) && /POST|PATCH|PUT|DELETE/.test(src)
        && !/callerOf/.test(src);
    });
    expect(offenders).toEqual([]);
  });
});
