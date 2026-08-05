/**
 * SIGNING IN, AND ACTUALLY ARRIVING.
 *
 * TWO BUGS, both of which broke the same journey — land on the front page,
 * tap Book, sign in with Google, and end up back on the front page still
 * signed out.
 *
 *   THE DESTINATION CAME FROM THE CLIENT ROUTER CACHE. Every customer room
 *   renders on the SERVER and reads an httpOnly session cookie. Sign-in minted
 *   that cookie and then called `router.replace('/')` — a SOFT navigation,
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
 *   so Home sending a first-time customer to their arrival — and `/welcome`
 *   sending a returning one home — were both caught and rendered as "We could
 *   not reach your garage." A brand-new customer's first sign-in landed there.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

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
    const mint = login.indexOf("fetch('/api/session'");
    const go = login.indexOf('enter(homeFor(profile.role))');
    expect(mint).toBeGreaterThan(-1);
    expect(go).toBeGreaterThan(mint);
  });

  it('entering is a DOCUMENT load, not a soft navigation', () => {
    /* A soft navigation is served from the client Router Cache, which holds
       the signed-out landing fetched before the customer signed in. */
    expect(login).toMatch(/const enter = \(href: string\) => \{ window\.location\.replace\(href\); \};/);
    expect(login).not.toMatch(/router\.replace/);
    expect(login).not.toMatch(/router\.push/);
  });

  it('a customer who is already signed in leaves the same way', () => {
    expect(login).toMatch(/enter\(homeFor\(user\.role\)\)/);
  });

  it('a failed cookie mint is SAID, not swallowed', () => {
    /* It was `catch {}` with a comment saying the rooms would ask again. They
       do not — they render the signed-out landing, and the customer sees
       themselves bounced to the front page for no stated reason. */
    expect(login).toMatch(/if \(!session\?\.ok\)/);
    expect(login).toMatch(/could not open your studio/);
  });

  it('a failed mint does not leave a half-signed-in client', () => {
    /* Signed in to Firebase but with no server session is the state that
       produced the bounce loop; it must not be a state anyone can sit in. */
    /* Bounded on real code after the branch — `claimReferral` alone matches
       its own import at the top of the file, which made this slice empty. */
    const branch = login.slice(login.indexOf('if (!session?.ok)'),
      login.indexOf('void claimReferral()'));
    expect(branch).not.toBe('');
    expect(branch).toMatch(/signOut\(auth\)/);
    expect(branch).toMatch(/setUser\(null\)/);
  });

  it('the destination can never be pointed off-site', () => {
    expect(login).toMatch(/safeDest\(params\.get\('redirect'\)\)/);
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
       no state the server has to re-read — flagging that would be noise. */
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
