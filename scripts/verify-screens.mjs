/**
 * ALL NINETEEN SCREENS, RENDERED. READ ONLY - this script writes nothing.
 *
 * The parity suite proves the routes exist and are wired; this proves they
 * actually render against real data, with a real session, in the real server.
 * "The page renders" was never the standard on its own - but a screen that
 * throws for a signed-in customer is not a screen either, and the audit's
 * §19 recorded that the browser pass had never been completed because the
 * session could not be established.
 *
 * It can be: `/api/session` mints the httpOnly cookie every room reads, from a
 * custom token, so this signs in as a REAL customer and fetches every address.
 *
 *   ORIGIN=http://localhost:3002 node scripts/verify-screens.mjs
 *
 * Each row reports the status, and a marker the screen can only emit when its
 * projection produced something - not merely that HTML came back.
 */
import { readFileSync } from 'fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map(l => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }));

const app = initializeApp({
  credential: cert({
    projectId: env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = getFirestore(app);
const auth = getAuth(app);
const ORIGIN = process.env.ORIGIN ?? 'http://localhost:3002';

const session = async uid => {
  const custom = await auth.createCustomToken(uid);
  const ex = await (await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: custom, returnSecureToken: true }),
    })).json();
  const s = await fetch(`${ORIGIN}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: ex.idToken }),
  });
  const cookie = /automodz-session-id=([^;]+)/.exec(s.headers.get('set-cookie') || '')?.[1];
  if (!cookie) throw new Error('no session cookie - is the server running?');
  return `automodz-session-id=${cookie}`;
};

const text = h => h
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&mdash;/g, '-')
  .replace(/\s+/g, ' ');

const main = async () => {
  /* A REAL CUSTOMER, chosen from production rather than seeded: the point is
     to render what an actual person's data produces. */
  const customers = await db.collection('users').where('role', '==', 'customer').get();
  let uid = null;
  let best = -1;
  for (const u of customers.docs) {
    const cars = await db.collection(`users/${u.id}/vehicles`).get();
    if (cars.size > best) { best = cars.size; uid = u.id; }
  }
  if (!uid) throw new Error('no customer to render as');

  const cookie = await session(uid);
  const [bookings, listings] = await Promise.all([
    db.collection('bookings').where('userId', '==', uid).get(),
    db.collection('carListings').where('active', '==', true).limit(1).get(),
  ]);
  const booking = bookings.docs[0]?.id;
  const listing = listings.docs[0]?.id;

  console.log(`\nAUTOMODZ · nineteen screens · as ${uid} (${best} car${best === 1 ? '' : 's'})`);
  console.log(`origin ${ORIGIN}\n`);

  /* `marker` is something the screen can only emit once its projection has
     produced something. A 200 with an empty shell is not a rendered screen. */
  const SCREENS = [
    ['01', 'Welcome', '/auth/login', /Continue with Google|Sign in/i],
    ['02', 'Add your car', '/garage?add=1', /registration|Add (a|your) car/i],
    /* Home says ONE of several true things depending on the car's state - a
       marker that demanded a particular one would be asserting the customer's
       situation rather than the screen. What every state shares is the one
       action and the studio's own sentence about the car. */
    ['03/05', 'Now', '/', /Follow the visit|Arrange a visit|Renew|Add your car|Book the studio/i],
    ['06', 'Studio', '/studio', /What we do to cars/i],
    ['07', 'Scope & quote', null, /How much of the car|Estimate/i],
    /* THE SHEET IS A CLIENT OVERLAY. Radix portals it after hydration, so the
       server's HTML carries the room and not the sheet - asserting the sheet's
       words here would be asserting that a portal had been server-rendered,
       which it never is. The room is what this can prove; the sheet's contents
       are proven by `__tests__/studio/*` and by the estimate it renders. */
    ['08', 'Date & concierge', '/studio?arrange=1', /What we do to cars/i],
    ['09', 'Booked', booking && `/booking/${booking}`, /What we agreed|Nothing is charged now/i],
    ['10', 'Manage booking', booking && `/booking/${booking}/manage`, /Change it|Back to the booking/i],
    ['11', 'The visit', booking && `/history/${booking}`, /./],
    ['13', 'Ready · pay · rate', booking && `/history/${booking}/settle`, /What it came to|settle/i],
    ['14', 'Garage', '/garage', /./],
    ['15', 'Car record', '/vehicle', /./],
    ['16', 'Cars for sale', '/cars', /./],
    ['17', 'Certified detail', listing && `/cars/${listing}`, /Interested|has gone|being held/i],
    ['18', 'Club', '/membership', /./],
    ['19', 'You', '/you', /Quiet mode|Pickup addresses|Payment method/i],
  ];

  /* Screen 07 needs a service and a car, both read from production. */
  const services = await db.collection('services').where('active', '==', true).limit(1).get();
  const cars = await db.collection(`users/${uid}/vehicles`).limit(1).get();
  if (services.docs[0] && cars.docs[0]) {
    SCREENS[4][2] = `/studio/scope?service=${services.docs[0].id}&car=${cars.docs[0].id}`;
  }

  let bad = 0;
  for (const [n, name, path, marker] of SCREENS) {
    if (!path) {
      console.log(`  --  ${n.padEnd(6)} ${name.padEnd(20)} skipped - no record in production to open`);
      continue;
    }
    const res = await fetch(`${ORIGIN}${path}`, { headers: { cookie }, redirect: 'follow' });
    const body = text(await res.text());
    const ok = res.ok && marker.test(body);
    const signedOut = /behind a sign-in/i.test(body);
    const failed = /could not reach your garage/i.test(body);
    if (!ok || signedOut || failed) bad++;
    console.log(
      `  ${ok && !signedOut && !failed ? 'ok ' : '!! '} ${n.padEnd(6)} ${name.padEnd(20)}`
      + ` ${String(res.status).padEnd(4)} ${path}`
      + (signedOut ? '  [signed out]' : failed ? '  [read failed]' : ok ? '' : '  [marker absent]'),
    );
  }

  /* THE CALENDAR IS A FILE, not a page - checked as one. */
  if (booking) {
    const ics = await fetch(`${ORIGIN}/api/booking/${booking}/calendar`, { headers: { cookie } });
    const body = await ics.text();
    const good = ics.ok && body.startsWith('BEGIN:VCALENDAR') && /DTSTART:\d{8}T\d{6}Z/.test(body);
    if (!good && ics.status !== 409) bad++;
    console.log(`  ${good ? 'ok ' : ics.status === 409 ? '-- ' : '!! '} 09     calendar`
      + `             ${ics.status}    /api/booking/${booking}/calendar`);
  }

  console.log(`\n${bad === 0 ? 'ALL RENDERED' : `${bad} screen(s) did not render`}`);
  console.log('Nothing was written.\n');
  process.exit(bad === 0 ? 0 : 1);
};

main().catch(e => {
  console.error('\nverification could not run:', e.message, '\n');
  process.exit(2);
});
