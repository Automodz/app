/**
 * THE PRODUCTION SMOKE TEST. READ ONLY - this script writes nothing, anywhere.
 *
 *   ORIGIN=https://automodz.vercel.app node scripts/verify-production.mjs
 *
 * It answers the three questions a deploy has to answer:
 *
 *   1. IS THE RIGHT COMMIT LIVE?  `next.config.js` puts twelve characters
 *      of the commit on every response, so a deploy can name itself.
 *   2. DOES EVERY PUBLIC SURFACE ANSWER?  A 404 where a route should exist,
 *      or a 500 anywhere, is a deploy that did not work.
 *   3. DOES EVERY PRIVATE DOOR REFUSE?  Signed out, every route that writes
 *      must answer 401 - and the customer rooms must show the sign-in
 *      invitation rather than somebody's garage.
 *
 * WHAT IT DELIBERATELY DOES NOT DO is sign in. Minting a session against
 * production needs the service-account key, and a smoke test that writes to a
 * real customer's data is not a smoke test. Everything a signed-in customer
 * does is covered by the emulator matrices (`scripts/security/customer`).
 *
 * NO SECRET IS PRINTED. Configuration is verified by BEHAVIOUR - a route that
 * answers 401 rather than 503 proves the Admin SDK is configured, without
 * anything having to read a key.
 */
const ORIGIN = (process.env.ORIGIN ?? 'https://automodz.vercel.app').replace(/\/$/, '');

let pass = 0, fail = 0;
const ok = (n, c, d = '') => {
  c ? (pass++, console.log(`  PASS  ${n}`)) : (fail++, console.log(`  FAIL  ${n}  ${d}`));
};

const get = async (path) => {
  const r = await fetch(`${ORIGIN}${path}`, { redirect: 'manual', headers: { 'user-agent': 'automodz-smoke' } });
  const body = r.status < 400 || r.status === 404 ? await r.text().catch(() => '') : '';
  return { status: r.status, body, headers: r.headers };
};

const post = (path, body) => fetch(`${ORIGIN}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'sec-fetch-site': 'same-origin' },
  body: JSON.stringify(body ?? {}),
});

/** Every public address, and a marker only the real page can emit. */
const PUBLIC = [
  ['the landing', '/', /AutoModz/i],
  ['sign in', '/auth/login', /Continue with Google|Sign in/i],
  ['the showroom', '/cars', /./],
  ['sell us your car', '/dashboard/sell-car', /./],
  ['privacy', '/privacy', /Privacy/i],
  ['terms', '/terms', /Terms/i],
  ['offline', '/offline', /./],
  ['robots', '/robots.txt', /Disallow/],
  ['the sitemap', '/sitemap.xml', /<urlset/],
];

/** Signed in only. Signed out these must be an invitation, never a garage. */
const PRIVATE = ['/', '/garage', '/vehicle', '/vehicle/puc', '/history', '/studio', '/membership', '/you'];

/** Every door that writes. Signed out, every one must refuse. */
const DOORS = [
  '/api/vehicle',
  '/api/membership',
  '/api/protection/puc/declare',
  '/api/protection/puc/verify',
  '/api/booking/create',
  '/api/booking/cancel',
  '/api/payment',
  '/api/estimate',
  '/api/rating',
];

(async () => {
  console.log(`\nAUTOMODZ · production smoke test\norigin ${ORIGIN}\n`);

  console.log('WHAT IS LIVE');
  const home = await get('/');
  ok('the site answers', home.status === 200, home.status);

  /* The deploy names itself. Nothing in the rendered HTML carries the build,
     so `next.config.js` puts twelve characters of the commit on every
     response - which is what makes this "THIS deploy" rather than "a deploy". */
  const release = home.headers.get('x-automodz-release');
  ok('it says which commit it is', Boolean(release) && release !== 'local', release ?? 'none');
  if (release) console.log(`        release ${release}`);
  if (process.env.EXPECT_RELEASE) {
    ok(`and it is the commit that was pushed (${process.env.EXPECT_RELEASE.slice(0, 12)})`,
      release === process.env.EXPECT_RELEASE.slice(0, 12), release ?? 'none');
  }

  console.log('\nEVERY PUBLIC SURFACE ANSWERS');
  for (const [name, path, marker] of PUBLIC) {
    const r = await get(path);
    ok(`${name} · ${path}`, r.status === 200 && marker.test(r.body), `${r.status}`);
  }

  console.log('\nA DEAD ADDRESS IS A 404, NOT A 500');
  const missing = await get('/no-such-address-at-all');
  ok('an unknown address answers 404', missing.status === 404, missing.status);
  ok('  …and it is the product’s own room, not a stack trace',
    /can.t find that|Nothing here/i.test(missing.body));

  console.log('\nSIGNED OUT, A ROOM IS AN INVITATION - NEVER SOMEBODY’S GARAGE');
  for (const path of PRIVATE) {
    const r = await get(path);
    const shown = r.status === 200 && /behind a sign-in|Sign in|Continue with Google/i.test(r.body);
    const redirected = r.status >= 300 && r.status < 400;
    ok(`${path}`, shown || redirected, `${r.status}`);
  }

  console.log('\nEVERY DOOR THAT WRITES REFUSES A STRANGER');
  for (const path of DOORS) {
    const r = await post(path, { probe: true });
    /* 401 is the answer. 503 would mean the Admin SDK is not configured - a
       different failure, and one worth telling apart. */
    ok(`${path} → 401`, r.status === 401, `${r.status}${r.status === 503 ? ' (Admin SDK not configured)' : ''}`);
  }

  console.log('\nCONFIGURATION, PROVEN BY BEHAVIOUR (no secret is read)');
  const session = await post('/api/session', { idToken: 'not-a-token' });
  ok('the Admin SDK is configured - /api/session refuses rather than 503',
    session.status === 400 || session.status === 401, session.status);

  const cron = await get('/api/cron/daily');
  ok('the nightly job is protected and FAILS CLOSED', cron.status === 401, cron.status);

  const sign = await post('/api/media/sign', { path: 'vehicles/x-1' });
  ok('media signing is configured - it refuses the CALLER, not the config',
    sign.status === 401, `${sign.status}${sign.status === 503 ? ' (Cloudinary not configured)' : ''}`);

  console.log('\nWHAT THE WORLD MAY INDEX');
  const robots = await get('/robots.txt');
  for (const room of ['/garage', '/vehicle', '/history', '/you', '/membership', '/admin']) {
    ok(`${room} is kept out of the index`, robots.body.includes(`Disallow: ${room}`));
  }
  ok('the showroom is NOT kept out', !/Disallow: \/cars\b/.test(robots.body));

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
