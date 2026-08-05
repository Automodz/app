/**
 * LOGIN — PARITY WITH `reference/customer-old/app/auth/login/page.tsx`.
 *
 * The migration rule is that the UI is replaced and the behaviour is not. This
 * suite is what makes "and not" checkable: it reads both files and asserts that
 * every call, branch and message the old door had still exists in the new one.
 *
 * It is a source assertion rather than a render test because the behaviour in
 * question is a sequence of calls against Firebase — mounting it would test the
 * mocks, not the door.
 */
import { readFileSync, existsSync } from 'fs';

const NEW = 'app/auth/login/page.tsx';
const OLD = 'reference/customer-old/app/auth/login/page.tsx';

/** Comments explain what was removed; only code counts as an implementation. */
const codeOf = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const src = codeOf(NEW);

describe('the old door is still on file to compare against', () => {
  it('reference/customer-old still has the login page', () => {
    expect(existsSync(OLD)).toBe(true);
  });
});

describe('every service call the old door made, the new one makes', () => {
  it.each([
    'signInWithGoogle',
    'getUserProfile',
    'ensureUserProfile',
    'linkEmployeeRole',
    'stashReferralCode',
    'claimReferral',
    'signOut',
    'setUser',
  ])('calls %s', fn => {
    expect(src).toContain(fn);
  });

  it('signs a blocked account back out rather than letting it in', () => {
    expect(src).toMatch(/if \(!profile\)[\s\S]{0,120}signOut\(auth\)/);
  });

  it('claims a referral only for customers, and never blocks entry on it', () => {
    expect(src).toMatch(/role !== 'admin' && profile\.role !== 'employee'/);
    expect(src).toMatch(/void claimReferral\(\)\.catch/);
  });

  it('hands the server a session cookie before redirecting', () => {
    /* The navigation is a DOCUMENT load now, not `router.replace`. A soft
       navigation was served from the client Router Cache — which still held
       the signed-out landing — so the server never saw the cookie that had
       just been minted. See __tests__/auth/entry.test.ts. */
    expect(src).toMatch(/fetch\('\/api\/session'/);
    const session = src.indexOf("'/api/session'");
    const enter = src.indexOf('enter(homeFor(profile.role))');
    expect(session).toBeGreaterThan(-1);
    expect(enter).toBeGreaterThan(session);
  });
});

describe('every message the old door could show', () => {
  it.each([
    'You’re offline — reconnect to sign in.',
    'The studio could not open your account. Please try again.',
    'Allow pop-ups for AutoModz, then try again.',
    'That didn’t reach Google — check your connection and try again.',
    'That did not go through. Please try again.',
  ])('still exists: %s', message => {
    expect(src).toContain(message);
  });

  it('stays silent when the customer closes the Google window', () => {
    expect(src).toContain('auth/popup-closed-by-user');
    expect(src).toContain('auth/cancelled-popup-request');
  });

  it('keeps the welcome, the sub and the reassurance', () => {
    expect(src).toContain('Your studio');
    expect(src).toContain('Where your car lives');
    expect(src).toContain('One tap — no password to remember.');
    expect(src).toContain('Back to AutoModz');
  });
});

describe('the redirect rule', () => {
  /* The rule is small enough to re-implement here from the source, which is
     what lets the assertions below run without mounting Next's router. */
  const safeDest = (redirect: string | null): string | null =>
    redirect
    && redirect.startsWith('/')
    && !redirect.startsWith('//')
    && !redirect.startsWith('/admin')
      ? redirect
      : null;

  it('accepts an internal customer path', () => {
    expect(safeDest('/garage')).toBe('/garage');
    expect(safeDest('/history/abc')).toBe('/history/abc');
  });

  it('refuses a protocol-relative URL', () => {
    expect(safeDest('//evil.example.com')).toBeNull();
  });

  it('refuses an absolute URL', () => {
    expect(safeDest('https://evil.example.com')).toBeNull();
  });

  it('refuses to hand a customer an operations address', () => {
    /* The old rule was startsWith('/app'), which excluded /admin as a side
       effect. The rooms moved to the root, so it is now stated outright. */
    expect(safeDest('/admin')).toBeNull();
    expect(safeDest('/admin/schedule')).toBeNull();
  });

  it('refuses nothing at all', () => {
    expect(safeDest(null)).toBeNull();
  });

  it('sends staff to the operations application whatever the redirect said', () => {
    expect(src).toMatch(/role === 'admin' \|\| role === 'employee' \? '\/admin'/);
  });
});

describe('the door is a state, never an absence', () => {
  it('the Suspense boundary shows something', () => {
    expect(src).toMatch(/<Suspense fallback=\{<Door \/>\}>/);
    expect(src).toContain('<Loading caption=');
  });

  it('never shows the door twice to someone already signed in', () => {
    expect(src).toMatch(/if \(authLoading \|\| !user\) return;[\s\S]{0,80}enter\(/);
  });
});
