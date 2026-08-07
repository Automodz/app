/**
 * `auth.currentUser` IS NOT AN ANSWER, IT IS A RACE.
 *
 * The SDK restores the persisted session from IndexedDB asynchronously, so
 * `currentUser` is null for the first moments of every page load. Reading it
 * straight after an import does not return "signed out" — it returns "not
 * yet", and the two are indistinguishable at the call site.
 *
 * On the admin and kiosk trees that was survivable: `ClientSession` mounts
 * `AuthProvider`, whose `onAuthStateChanged` subscription drives the restore
 * and holds the answer before anything is clickable. THE CUSTOMER ROOMS MOUNT
 * NONE OF IT — they render on the server and ship no provider — so nothing
 * ever subscribes and the race is live at every press.
 *
 * It produced three separate incidents that were each diagnosed as their own
 * bug before the cause was seen:
 *
 *   · finishing the first arrival threw `signed-out`, told the customer "that
 *     didn't save", and never wrote `welcomedAt` — so the welcome greeted them
 *     again on every sign-in, for ever. This is the one the owner reported.
 *   · a booking went out with no Authorization header and came back 401.
 *   · the availability lookup behind it did the same, silently, so the sheet
 *     offered slots that were already taken.
 *
 * This sweep is the thing that stops the fourth.
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

describe('nothing in the browser reads currentUser without waiting', () => {
  it('the one helper exists and waits for the SDK to decide', () => {
    const src = codeOf('lib/clientSession.ts');
    /* Subscribes rather than polls, and answers immediately when already
       known so the common case costs nothing. */
    expect(src).toMatch(/onAuthStateChanged/);
    expect(src).toMatch(/if \(auth\.currentUser\) return auth\.currentUser;/);
    /* Unsubscribed on the first answer — a question, not a feed. */
    expect(src).toMatch(/stop\(\);\s*resolve\(/);
  });

  it('it answers null rather than throwing', () => {
    /* "We could not tell" and "nobody" are the same answer to every caller,
       and a throw would turn a signed-out state into an error to catch. */
    const src = codeOf('lib/clientSession.ts');
    expect(src).not.toMatch(/throw new Error/);
  });

  /**
   * The sweep. `lib/services/auth.ts` is the one permitted reader: it runs on
   * `/auth/login`, which DOES mount `ClientSession`, and it runs immediately
   * after `signInWithPopup` has resolved — the single moment in the product
   * where `currentUser` is guaranteed to be populated.
   */
  it('no client file reaches for currentUser directly', () => {
    const allowed = new Set([
      /* Runs on `/auth/login`, which DOES mount `ClientSession`, and only ever
         straight after `signInWithPopup` resolves or once `AuthProvider` has
         already put the user in the store — the two moments where the SDK is
         known to have decided. */
      'lib/services/auth.ts',
      'app/auth/login/page.tsx',
      'lib/clientSession.ts',
      'context/AuthContext.tsx',
    ]);
    const offenders: string[] = [];

    for (const file of [...walk('components'), ...walk('lib'), ...walk('app')]) {
      if (allowed.has(file) || file.includes('/server/')) continue;
      const src = codeOf(file);
      if (/auth\??\.currentUser/.test(src)) offenders.push(file);
    }

    expect(offenders).toEqual([]);
  });

  it('the arrival records itself through the helper', () => {
    /* The reported bug, pinned: the write that ends the welcome must not be
       able to ask before the SDK knows who is asking. */
    const src = codeOf('components/screens/WelcomeScreen.tsx');
    const finish = src.slice(src.indexOf('const finish'), src.indexOf('welcome/complete') + 200);
    expect(finish).toMatch(/await idToken\(\)/);
    expect(finish).toMatch(/Authorization: `Bearer \$\{token\}`/);
  });
});

/**
 * THE FLAG IS ONLY USEFUL IF SOMETHING READS IT.
 *
 * `loadCustomerPicture` built its `User` field by field and `as User` silenced
 * the compiler about every field it did not list — so `welcomedAt` never
 * reached the projection. `shouldWelcome` fell through to "has no car", and
 * every customer without a car in their garage was greeted by the first-arrival
 * flow ON EVERY SINGLE SIGN-IN, no matter how many times they finished it. The
 * flag was being written correctly the whole time; nothing ever read it.
 */
describe('the first arrival happens once', () => {
  const picture = codeOf('lib/server/customerPicture.ts');

  it('the profile is carried, not re-typed field by field', () => {
    /* The spread is the fix: a field added to `User` arrives here without
       anybody remembering to add it — which is exactly what went wrong. */
    expect(picture).toMatch(/const user: User = \{\s*\.\.\.\(profile \?\? \{\}\),/);
  });

  it('welcomedAt survives the read', () => {
    /* Either explicitly, or via the spread above. Asserted on behaviour rather
       than on the spelling so a later refactor is free to change how. */
    const built = picture.slice(picture.indexOf('const user: User'), picture.indexOf('const vehicles'));
    expect(built).toMatch(/\.\.\.\(profile \?\? \{\}\)|welcomedAt/);
  });
});

/**
 * A CONTROL ON A CUSTOMER ROOM MAY NOT DEPEND ON THE CLIENT STORE'S USER.
 *
 * `ClientSession` — and with it `AuthProvider`, the only thing that ever puts
 * a user in the Zustand store — is mounted by `/admin`, `/auth` and `/store`
 * alone. Every customer room renders on the server and mounts none of it, so
 * `useAppStore().user` is ALWAYS null there.
 *
 * Code written against it does not fail loudly. It returns at the guard and
 * the press does nothing at all:
 *
 *   · "Add the car" — a car could not be added to the garage, from the garage
 *   · joining the club — the one act that takes a standing payment
 *   · "Save" on your details, and every notification switch
 *   · the push toggle
 *   · the referral panel, which loaded no code and stayed empty for ever
 *
 * Five separate features, one cause, none of them reported by a test — each
 * was found only by pressing the button. This is the test that presses them.
 */
describe('no customer-room control depends on the store user', () => {
  /** Components reached only from `/admin`, `/store` or `/auth`. */
  const behindAProvider = [
    'components/workspace/', 'components/intake/', 'components/admin/',
  ];

  it('none of them guards on it', () => {
    const offenders: string[] = [];
    for (const file of walk('components')) {
      if (behindAProvider.some(d => file.startsWith(d))) continue;
      const src = codeOf(file);
      if (!/useAppStore/.test(src)) continue;
      /* The shapes that silently do nothing: an early return, or a uid taken
         straight off the store user without a fallback. */
      if (/if \(!user[^)]*\)\s*(return|\{)/.test(src)) offenders.push(`${file} — guards on !user`);
      if (/\buser\.uid\b/.test(src)) offenders.push(`${file} — writes with user.uid`);
    }
    expect(offenders).toEqual([]);
  });

  it('the account sheet reads the account it loaded', () => {
    const src = codeOf('components/you/AccountSettings.tsx');
    /* Every write and every read that needs an identity goes through the
       profile this sheet fetched, never through the store. */
    expect(src).toMatch(/const uid = await currentUid\(\)/);
    expect(src).toMatch(/updateUserProfile\(account\.uid/);
    expect(src).toMatch(/getMyReferralCode\(account\)/);
    expect(src).toMatch(/disablePush\(account\.uid\)/);
  });
});
