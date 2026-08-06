/**
 * LIVE VERIFICATION OF THE DEPLOYED SIGN-IN LIFECYCLE.
 *
 * Everything after Google hands back an identity is origin-independent, so the
 * deployed session lifecycle can be proven without a password: the Admin SDK
 * mints a custom token for an account that already exists, Identity Toolkit
 * exchanges it for a real ID token, and that token goes to the DEPLOYED
 * `/api/session` exactly as the browser's would. What comes back is the real
 * production cookie, and every room is then asked for with it.
 *
 *   node scripts/verify-production-login.mjs
 *
 * Reads FIREBASE_ADMIN_* and NEXT_PUBLIC_FIREBASE_API_KEY from .env.local.
 * Signs in as the studio's own account (VERIFY_AS overrides) — never a
 * customer's, so no one else's records are touched. The cookie is dropped
 * again at the end.
 *
 * A non-zero exit means a customer who has just signed in would not be inside
 * their application ON PRODUCTION.
 */
import { readFileSync } from 'fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

/* .env.local, read directly — this script is run by hand, not by Next. */
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map(l => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const ORIGIN = process.env.ORIGIN ?? 'https://automodz.vercel.app';
const AS = process.env.VERIFY_AS ?? env.NEXT_PUBLIC_ADMIN_EMAIL ?? 'hello.automodz@gmail.com';
const API_KEY = env.NEXT_PUBLIC_FIREBASE_API_KEY;

const missing = ['FIREBASE_ADMIN_PROJECT_ID', 'FIREBASE_ADMIN_CLIENT_EMAIL', 'FIREBASE_ADMIN_PRIVATE_KEY']
  .filter(k => !env[k]);
if (missing.length) {
  console.error(`\n.env.local is missing: ${missing.join(', ')}\n`);
  process.exit(2);
}

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✕'} ${label}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
};

const app = initializeApp({
  credential: cert({
    projectId: env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const adminAuth = getAuth(app);

console.log(`\nverifying ${ORIGIN}\n`);

/* 1 · an identity that already exists — nothing is created */
const account = await adminAuth.getUserByEmail(AS);
console.log(`signing in as ${AS} (${account.uid})\n`);

const customToken = await adminAuth.createCustomToken(account.uid);
const exchanged = await (await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  },
)).json();
if (!exchanged.idToken) {
  console.error('could not obtain an ID token:', JSON.stringify(exchanged));
  process.exit(1);
}

/* 2 · the exchange, against the DEPLOYED route */
console.log('══ 2 · POST /api/session (production)');
const res = await fetch(`${ORIGIN}/api/session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ idToken: exchanged.idToken }),
});
check('status 200', res.status === 200, String(res.status));
if (res.status !== 200) console.log('    body:', (await res.text()).slice(0, 200));

const setCookie = res.headers.get('set-cookie') ?? '';
check('session cookie created', setCookie.includes('automodz-session-id'));
check('httpOnly', /httponly/i.test(setCookie));
check('Secure (production)', /secure/i.test(setCookie));
check('SameSite=Lax', /samesite=lax/i.test(setCookie));

const value = /automodz-session-id=([^;]+)/.exec(setCookie)?.[1] ?? '';
const jar = `automodz-session-id=${value}`;
const get = (path) => fetch(`${ORIGIN}${path}`, { headers: { cookie: jar }, redirect: 'manual' });

const verdict = async (path, name) => {
  const r = await get(path);
  const html = r.status < 300 ? await r.text() : '';
  const bounced = r.status >= 300 && r.status < 400;
  const wall = html.includes('behind a sign-in');
  const landing = html.includes('>SIGN IN<');
  const boundary = html.includes('Something went wrong at our end');
  const unreachable = html.includes('could not reach your garage');
  check(
    `${name} (${path})`,
    r.status === 200 && !wall && !landing && !boundary && !unreachable,
    [
      `status ${r.status}`,
      bounced ? `→ ${r.headers.get('location')}` : '',
      wall ? 'SIGN-IN WALL' : '', landing ? 'PUBLIC LANDING' : '',
      boundary ? 'ERROR BOUNDARY' : '', unreachable ? 'READ FAILED' : '',
    ].filter(Boolean).join(' '),
  );
  return { html, status: r.status };
};

/* 3 · inside the application */
console.log('\n══ 3 · the customer lands inside the application');
await verdict('/', 'Home');

/* 4 · a refresh keeps them there */
console.log('\n══ 4 · a refresh keeps the session');
const again = await verdict('/', 'Home, asked a second time');
check('still not the public landing on reload', !again.html.includes('>SIGN IN<'));

/* 5 · the door, while signed in */
console.log('\n══ 5 · /auth/login while signed in');
const door = await get('/auth/login');
const doorHtml = await door.text();
check('the door still answers (the guard is client-side)', door.status === 200, `status ${door.status}`);
check('and it carries the guard that opens a session before it leaves',
  /api\/session/.test(
    // the door's own chunk, which is what performs the redirect
    await (await fetch(`${ORIGIN}${/\/_next\/static\/chunks\/app\/auth\/login\/page-[^"]*\.js/.exec(doorHtml)?.[0] ?? ''}`)).text(),
  ));

/* 6 · every protected room */
console.log('\n══ 6 · every protected route');
for (const [p, n] of [
  ['/garage', 'Garage'], ['/history', 'History'], ['/studio', 'Studio'],
  ['/membership', 'Membership'], ['/vehicle', 'Vehicle'], ['/you', 'You'],
]) await verdict(p, n);

/* 7 · no loop — nothing above may 3xx back to the door */
console.log('\n══ 7 · no redirect loops');
const hops = [];
let at = '/';
for (let i = 0; i < 6; i++) {
  const r = await get(at);
  if (r.status < 300 || r.status >= 400) break;
  at = r.headers.get('location') ?? '';
  hops.push(at);
  if (hops.filter(h => h === at).length > 1) break;
}
check('Home settles without bouncing', hops.length <= 1, hops.join(' → ') || 'no redirect');

/* 9 · nothing diagnostic shipped */
console.log('\n══ 9 · no debug instrumentation in the deployed bundle');
const loginChunk = /\/_next\/static\/chunks\/app\/auth\/login\/page-[^"]*\.js/.exec(doorHtml)?.[0];
const chunkSrc = loginChunk ? await (await fetch(`${ORIGIN}${loginChunk}`)).text() : '';
check('no stage trace', !/automodz-auth-trace|POST \/api\/session started|popup NEVER opened/.test(chunkSrc));
check('no console calls on the door', !/console\.(log|debug|info)\(/.test(chunkSrc));

/* leave nothing behind */
await fetch(`${ORIGIN}/api/session`, { method: 'DELETE', headers: { cookie: jar } });

console.log(`\n${failures === 0
  ? '✓ PRODUCTION: sign-in lands inside the application and stays there'
  : `✕ PRODUCTION: ${failures} failing`}\n`);
process.exit(failures === 0 ? 0 : 1);
