/**
 * THE DOOR HAS TO SAY WHAT WENT WRONG.
 *
 * A production sign-in failure was reported in Chrome AND Safari, for both new
 * and returning Google accounts, and every one of them produced the same
 * sentence: "That did not go through. Please try again."
 *
 * That sentence was the `else` of four handled codes. A disabled provider, an
 * unauthorised domain, a browser refusing third-party storage and a Firestore
 * rule refusing the profile write all arrived as it - so there was nothing in
 * the report to tell the causes apart by, and the one place the SDK's own code
 * was available threw it away.
 *
 * These are the regression tests for that failure mode: not for one cause, but
 * for the property that made it undiagnosable.
 */
import { readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { authFault, authDiagnostic, type AuthFaultKind } from '@/lib/authError';

const codeOf = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const err = (code: string, message = 'Firebase: an error.') =>
  Object.assign(new Error(message), { code });

/* ── the property that broke ─────────────────────────────────────────────── */

describe('the code is never thrown away', () => {
  const CODES = [
    'auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled',
    'auth/popup-blocked', 'auth/network-request-failed',
    'auth/internal-error', 'auth/timeout', 'auth/web-storage-unsupported',
    'auth/account-exists-with-different-credential',
    'auth/unauthorized-domain', 'auth/operation-not-allowed', 'auth/invalid-api-key',
    'auth/configuration-not-found', 'auth/user-disabled',
    'permission-denied', 'unavailable', 'deadline-exceeded',
    'auth/something-nobody-has-seen-yet',
  ];

  it.each(CODES)('%s survives into the diagnostic', code => {
    const fault = authFault(err(code));
    expect(fault.code).toBe(code);
    expect(authDiagnostic(fault, err(code))).toContain(code);
  });

  it('an error with no code at all still produces one to report', () => {
    /* A TypeError from anywhere in the chain used to be indistinguishable from
       a Firebase refusal. */
    expect(authFault(new TypeError('x is not a function')).code).toBe('js/TypeError');
    expect(authFault('a string').code).toBe('unknown');
    expect(authFault(undefined).code).toBe('unknown');
  });

  it('the diagnostic carries the SDK’s own message beside the code', () => {
    const d = authDiagnostic(authFault(err('auth/internal-error', 'relay failed')), err('auth/internal-error', 'relay failed'));
    expect(d).toContain('auth/internal-error');
    expect(d).toContain('relay failed');
  });
});

/* ── and the customer never sees it ──────────────────────────────────────── */

describe('the customer’s sentence stays clean', () => {
  const EVERY = [
    'auth/popup-blocked', 'auth/network-request-failed', 'auth/internal-error',
    'auth/timeout', 'auth/web-storage-unsupported', 'auth/unauthorized-domain',
    'auth/operation-not-allowed', 'auth/invalid-api-key', 'auth/user-disabled',
    'permission-denied', 'unavailable', 'auth/never-seen',
  ];

  it.each(EVERY)('%s says nothing technical', code => {
    const { message } = authFault(err(code));
    expect(message).not.toMatch(/auth\/|firebase|firestore|permission-denied|undefined|null/i);
    expect(message).not.toMatch(/[A-Z]{2,}_[A-Z]/);      // no SCREAMING_CONSTANTS
    expect(message.length).toBeGreaterThan(10);
  });

  it('abandoning the pop-up says nothing at all', () => {
    /* Changing your mind is not a failure, and an error message for it is the
       product scolding somebody for closing a window. */
    for (const code of ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']) {
      const f = authFault(err(code));
      expect(f.kind).toBe('abandoned');
      expect(f.message).toBe('');
    }
  });
});

/* ── each cause is told apart from the others ────────────────────────────── */

describe('the causes are distinguishable, which is the whole point', () => {
  it.each([
    ['auth/popup-blocked', 'browser'],
    ['auth/network-request-failed', 'browser'],
    ['auth/internal-error', 'browser'],
    ['auth/web-storage-unsupported', 'browser'],
    ['auth/unauthorized-domain', 'studio'],
    ['auth/operation-not-allowed', 'studio'],
    ['auth/invalid-api-key', 'studio'],
    ['permission-denied', 'studio'],
    ['auth/popup-closed-by-user', 'abandoned'],
    ['auth/who-knows', 'unknown'],
  ] as [string, AuthFaultKind][])('%s is attributed to %s', (code, kind) => {
    expect(authFault(err(code)).kind).toBe(kind);
  });

  it('no two of the studio-side codes read identically to the customer by accident', () => {
    /* They may share a sentence deliberately - a customer cannot act on the
       difference between a disabled provider and a bad key - but the KIND and
       the CODE must still separate them for whoever is on call. */
    const a = authFault(err('auth/unauthorized-domain'));
    const b = authFault(err('permission-denied'));
    expect(a.code).not.toBe(b.code);
    expect(a.message).not.toBe(b.message);
  });

  it('an in-app browser is told to leave, not to change a setting it has none of', () => {
    /* Instagram's webview has no pop-up preference, so "allow pop-ups" is an
       instruction the customer cannot follow. */
    expect(authFault(err('auth/popup-blocked'), true).message).toMatch(/Safari or Chrome/);
    expect(authFault(err('auth/popup-blocked'), false).message).toMatch(/Allow pop-ups/);
  });

  it('a Firestore refusal is not reported as a failed sign-in', () => {
    /* The customer IS signed in at that moment; saying the sign-in failed
       sends them round the loop again to hit the same wall. */
    expect(authFault(err('permission-denied')).message).toMatch(/signed you in/i);
  });
});

/* ── the door actually uses it ───────────────────────────────────────────── */

describe('the door reports every failure it catches', () => {
  const door = codeOf('app/auth/login/page.tsx');

  it('the hand-rolled branch ladder is gone', () => {
    expect(door).not.toMatch(/code === 'auth\/popup-closed-by-user'/);
    expect(door).toMatch(/authFault\(err, isInAppBrowser\(currentUserAgent\(\)\)\)/);
  });

  it('and the code reaches the console on EVERY environment', () => {
    /* A customer will never open devtools. The owner can, and this is the
       difference between "it says it did not go through" and a cause. */
    expect(door).toMatch(/console\.error\(authDiagnostic\(fault, err\)\)/);
    const call = door.slice(door.indexOf('console.error(authDiagnostic'));
    expect(call.slice(0, 200)).not.toMatch(/NODE_ENV/);
  });

  it('the raw code is shown on screen only in development or behind ?debug=1', () => {
    /* It reveals an error code and nothing else - no token, no address, no
       account - but a customer has no use for it and should not meet it. */
    expect(door).toMatch(/process\.env\.NODE_ENV !== 'production' \|\| params\.get\('debug'\) === '1'/);
    expect(door).toMatch(/showDiagnostic && diagnostic/);
  });
});

/* ── the policy that would have blocked the relay ────────────────────────── */

describe('the CSP trusts the auth hosts consistently', () => {
  /**
   * ASSERTED ON THE HEADER THAT ACTUALLY SHIPS, not on the source text.
   *
   * The first version of this sliced `next.config.js` between the directive
   * names and was promptly defeated by the words "frame-src" appearing in a
   * comment I had just written - a test that reads a file for a value the file
   * COMPUTES is testing the prose around it.
   *
   * `headers()` is asked for its answer instead. It runs in a child node
   * process because `next.config.js` pulls in the PWA plugin, which jest's
   * module runtime cannot parse - and with NODE_ENV=production, so what is
   * measured is the production policy and not the looser development one.
   */
  const headers: { key: string; value: string }[] = JSON.parse(
    execFileSync('node', ['-e', `
      require('${process.cwd()}/next.config.js').headers()
        .then(g => console.log(JSON.stringify(g[0].headers)));
    `], { env: { ...process.env, NODE_ENV: 'production' }, encoding: 'utf8' }),
  );

  const csp = headers.find(h => h.key === 'Content-Security-Policy')?.value ?? '';
  const directive = (name: string) =>
    csp.split(';').map(d => d.trim()).find(d => d.startsWith(`${name} `)) ?? '';

  it('the policy is actually being sent', () => {
    /* Guards the five tests below from passing vacuously on an empty string. */
    expect(csp).toContain('default-src');
    expect(directive('connect-src')).not.toBe('');
  });

  it('apis.google.com is trusted to RUN code and to be SPOKEN to', () => {
    /* A host in `script-src` but not `connect-src` is not a boundary, it is a
       gap - and `apis.google.com` is a different host from `*.googleapis.com`,
       so the wildcard never covered it. Measured against production: that URL
       is reported as a `connect-src` violation while loading fine as a
       script. */
    expect(directive('script-src')).toContain('https://apis.google.com');
    expect(directive('connect-src')).toContain('https://apis.google.com');
  });

  it('the wildcard genuinely does not cover it, which is why it is listed', () => {
    /* If this ever stops being true the entry above is redundant and can go. */
    expect('apis.google.com'.endsWith('.googleapis.com')).toBe(false);
  });

  it('accounts.google.com is trusted as a frame and as a connection', () => {
    expect(directive('frame-src')).toContain('https://accounts.google.com');
    expect(directive('connect-src')).toContain('https://accounts.google.com');
  });

  it('the auth-domain iframe the credential returns through is allowed', () => {
    /* `sendAuthEventViaIframeRelay` - leave this out and the pop-up completes
       and the sign-in never resolves. */
    expect(directive('frame-src')).toContain('https://*.firebaseapp.com');
  });

  it('identity toolkit and secure token are reachable', () => {
    expect(directive('connect-src')).toContain('https://identitytoolkit.googleapis.com');
    expect(directive('connect-src')).toContain('https://securetoken.googleapis.com');
  });

  it('no Cross-Origin-Opener-Policy is sent, because it severs the pop-up', () => {
    /* COOP: same-origin cuts the `window.opener` reference `signInWithPopup`
       depends on to hand the credential back. Verified absent on production
       during this diagnosis; this keeps it absent. */
    const keys = headers.map(h => h.key.toLowerCase());
    expect(keys).not.toContain('cross-origin-opener-policy');
    expect(keys).not.toContain('cross-origin-embedder-policy');
  });
});
