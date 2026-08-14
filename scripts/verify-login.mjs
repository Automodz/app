/**
 * LIVE VERIFICATION OF THE SIGN-IN LIFECYCLE.
 *
 * Everything after the Google popup is origin-independent: a fresh ID token is
 * exchanged at `POST /api/session`, the httpOnly cookie comes back, and every
 * room is asked for with it. That is exactly the segment that was broken, and
 * it is the segment a headless run can prove.
 *
 *   JAVA_HOME=/opt/homebrew/opt/openjdk@21 \
 *     npx firebase emulators:start --only auth,firestore --project automodz-local
 *   node scripts/seed-customer.mjs
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *   NEXT_PUBLIC_FIREBASE_EMULATOR=1 \
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID=automodz-local \
 *   NEXT_PUBLIC_FIREBASE_API_KEY=fake npm run dev
 *   node scripts/verify-login.mjs
 *
 * A non-zero exit means a customer who has just signed in would not be inside
 * their application.
 */
const ORIGIN = process.env.ORIGIN ?? 'http://127.0.0.1:3000';
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✕'} ${label}${detail ? '  - ' + detail : ''}`);
  if (!ok) failures++;
};

/* 1 · the token the popup would have produced */
const signIn = await (await fetch(`${AUTH}/accounts:signInWithPassword?key=fake`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'meera@example.test', password: 'password123', returnSecureToken: true,
  }),
})).json();
if (!signIn.idToken) throw new Error('emulator sign-in failed: ' + JSON.stringify(signIn));
console.log(`\nsigned in as ${signIn.localId}\n`);

/* 2 · the exchange */
console.log('══ POST /api/session');
const res = await fetch(`${ORIGIN}/api/session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ idToken: signIn.idToken }),
});
check('status 200', res.status === 200, String(res.status));
if (res.status !== 200) console.log('    body:', await res.text());

const setCookie = res.headers.get('set-cookie') ?? '';
check('Set-Cookie names the session', setCookie.includes('automodz-session-id'), setCookie.slice(0, 90));
check('httpOnly', /httponly/i.test(setCookie));
check('Path=/', /path=\//i.test(setCookie));

const value = /automodz-session-id=([^;]+)/.exec(setCookie)?.[1] ?? '';
const jar = `automodz-session-id=${value}`;

/* 3 · every room, with the cookie the exchange just handed back */
const rooms = [
  ['/', 'Home'],
  ['/garage', 'Garage'],
  ['/history', 'History'],
  ['/studio', 'Studio'],
  ['/membership', 'Membership'],
  ['/vehicle', 'Vehicle'],
  ['/you', 'You'],
];

console.log('\n══ the rooms, signed in');
for (const [path, name] of rooms) {
  const r = await fetch(`${ORIGIN}${path}`, { headers: { cookie: jar }, redirect: 'manual' });
  const html = r.status < 300 ? await r.text() : '';
  const bounced = r.status >= 300 && r.status < 400;
  const wall = html.includes('behind a sign-in');
  const unreachable = html.includes('could not reach your garage');
  /* The landing's own sign-in link, which no room renders. */
  const landing = path === '/' && html.includes('>SIGN IN<');
  const boundary = html.includes('Something went wrong at our end');
  check(
    `${name} (${path})`,
    r.status === 200 && !wall && !unreachable && !landing && !boundary,
    [
      `status ${r.status}`,
      bounced ? `→ ${r.headers.get('location')}` : '',
      wall ? 'SIGN-IN WALL' : '',
      unreachable ? 'READ FAILED' : '',
      landing ? 'PUBLIC LANDING' : '',
      boundary ? 'ERROR BOUNDARY' : '',
    ].filter(Boolean).join(' '),
  );
}

/* 4 · and the same rooms without one, which must still be refused */
console.log('\n══ the rooms, signed out');
const out = await fetch(`${ORIGIN}/garage`, { redirect: 'manual' });
const outHtml = out.status < 300 ? await out.text() : '';
check('garage refuses an anonymous caller',
  outHtml.includes('behind a sign-in') || (out.status >= 300 && out.status < 400),
  `status ${out.status}`);

console.log(`\n${failures === 0 ? '✓ sign-in lands inside the application' : `✕ ${failures} failing`}\n`);
process.exit(failures === 0 ? 0 : 1);
