/* THE CUSTOMER'S SERVER DOORS, END TO END.
 *
 * `npx jest` proves the DECISIONS with a modelled database. This proves the
 * ROUTES: the session cookie, the CSRF guard on it, staff authorisation read
 * from a real profile, and the Admin SDK writing against real Firestore
 * semantics in the emulator.
 *
 * Every assertion here is something a jest test cannot reach.
 */
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const fs = require('fs');

const ORIGIN = process.env.API_ORIGIN || 'http://127.0.0.1:3199';
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake';

const app = initializeApp({
  credential: cert({
    projectId: 'demo-automodz',
    clientEmail: 'test@demo-automodz.iam.gserviceaccount.com',
    privateKey: fs.readFileSync(__dirname + '/fake.pem', 'utf8'),
  }),
  projectId: 'demo-automodz',
}, 'api');
const db = getFirestore(app);
const auth = getAuth(app);

let pass = 0, fail = 0;
const ok = (n, c, d = '') => {
  c ? (pass++, console.log(`  PASS  ${n}`)) : (fail++, console.log(`  FAIL  ${n}  ${d}`));
};

const cookieFor = async uid => {
  const custom = await auth.createCustomToken(uid);
  const r = await fetch(AUTH, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: custom, returnSecureToken: true }),
  });
  const { idToken } = await r.json();
  const s = await fetch(`${ORIGIN}/api/session`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const c = /automodz-session-id=([^;]+)/.exec(s.headers.get('set-cookie') || '')?.[1];
  if (!c) throw new Error(`no cookie for ${uid} (${s.status})`);
  return `automodz-session-id=${c}`;
};

/** Same-origin, as the product's own pages send it. */
const call = (method, path, body, cookie, extra = {}) => fetch(`${ORIGIN}${path}`, {
  method,
  headers: {
    'Content-Type': 'application/json',
    ...(cookie ? { cookie } : {}),
    'sec-fetch-site': 'same-origin',
    ...extra,
  },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const iso = ms => new Date(ms).toISOString().slice(0, 10);
const D = 86400000, NOW = Date.now();

(async () => {
  /* ITS OWN CUSTOMERS. `custA` and `custB` are the RULES matrix's, and they
     are seeded with a pending and an active membership on purpose - reusing
     them here would have this matrix arguing with that one's fixtures. */
  for (const [uid, name] of [['apiA', 'API A'], ['apiB', 'API B']]) {
    await auth.createUser({ uid, email: `${uid}@x.com` }).catch(() => {});
    await db.doc(`users/${uid}`).set({ name, role: 'customer', email: `${uid}@x.com` });
  }
  await db.doc('users/apiB/vehicles/theirs').set({ name: 'Their car', registrationNumber: 'GJ99ZZ0001' });
  await db.doc('users/staff1').set({ name: 'Technician', role: 'employee' }, { merge: true });

  const custA = await cookieFor('apiA');
  const custB = await cookieFor('apiB');
  const staff = await cookieFor('staff1');

  /* ── THE GARAGE ─────────────────────────────────────────────────────── */
  console.log('\nAPI · /api/vehicle');

  const anonCar = await call('POST', '/api/vehicle', { name: 'Kia Seltos', registrationNumber: 'GJ01ZZ0001' }, null);
  ok('UNAUTHENTICATED is refused 401', anonCar.status === 401, anonCar.status);

  const crossSite = await fetch(`${ORIGIN}/api/vehicle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: custA, 'sec-fetch-site': 'cross-site' },
    body: JSON.stringify({ name: 'Kia Seltos', registrationNumber: 'GJ01ZZ0002' }),
  });
  ok('A CROSS-SITE POST carrying the cookie is refused 401', crossSite.status === 401, crossSite.status);

  const made = await call('POST', '/api/vehicle', {
    name: 'Kia Seltos', registrationNumber: 'gj01 zz 0003',
    /* every field a caller might hope names the document */
    id: 'carB', vehicleId: 'carB', docId: 'carB',
  }, custA);
  const madeBody = await made.json();
  ok('an owner may add a car', made.status === 200 && madeBody.vehicleId, JSON.stringify(madeBody));
  ok('  …AT AN ID THE SERVER CHOSE, never the one it asked for',
    madeBody.vehicleId !== 'carB' && (await db.doc(`users/apiA/vehicles/${madeBody.vehicleId}`).get()).exists);
  ok('  …with the plate normalised',
    (await db.doc(`users/apiA/vehicles/${madeBody.vehicleId}`).get()).data().registrationNumber === 'GJ01 ZZ 0003');

  const dupe = await call('POST', '/api/vehicle', { name: 'The Kia', registrationNumber: 'GJ01ZZ0003' }, custA);
  ok('the same plate twice is refused 409', dupe.status === 409, dupe.status);

  const spaced = await call('POST', '/api/vehicle', { name: 'The Kia', registrationNumber: 'GJ 01 ZZ 0003' }, custA);
  ok('  …and so is the SAME plate spaced differently - one car, one record',
    spaced.status === 409, spaced.status);

  const theirs = await call('PATCH', '/api/vehicle', {
    vehicleId: 'theirs', name: 'Taken over', registrationNumber: 'GJ01ZZ0009',
  }, custA);
  ok('ANOTHER CUSTOMER’S CAR IS NOT FOUND - 404', theirs.status === 404, theirs.status);
  ok('  …and it is untouched',
    (await db.doc('users/apiB/vehicles/theirs').get()).data().name === 'Their car');

  /* ── THE CLUB ───────────────────────────────────────────────────────── */
  console.log('\nAPI · /api/membership');

  const anonJoin = await call('POST', '/api/membership', { plan: 'Silver', paymentMethod: 'upi' }, null);
  ok('UNAUTHENTICATED is refused 401', anonJoin.status === 401);

  const forged = await call('POST', '/api/membership', {
    plan: 'Platinum', paymentMethod: 'upi',
    status: 'active', washesTotal: 999, endDate: '2099-12-31', amountDue: 1, amountPaid: 1,
  }, custA);
  const forgedBody = await forged.json();
  ok('a forged payload joins as PENDING on the catalogue’s terms',
    forged.status === 200 && forgedBody.status === 'pending' && forgedBody.amountDue === 5999,
    JSON.stringify(forgedBody));
  const sub = (await db.doc(`subscriptions/${forgedBody.subscriptionId}`).get()).data();
  ok('  …and every forged field was ignored',
    sub.status === 'pending' && sub.washesTotal === 16 && sub.endDate !== '2099-12-31'
    && sub.amountDue === 5999 && sub.amountPaid === undefined,
    JSON.stringify(sub));

  const second = await call('POST', '/api/membership', { plan: 'Gold', paymentMethod: 'upi' }, custA);
  ok('a SECOND open request is refused 409', second.status === 409, second.status);

  const selfActivate = await call('PUT', '/api/membership', {
    subscriptionId: forgedBody.subscriptionId, decision: 'activate',
  }, custA);
  ok('THE CUSTOMER CANNOT ACTIVATE THEIR OWN - 403', selfActivate.status === 403, selfActivate.status);

  const otherActivate = await call('PUT', '/api/membership', {
    subscriptionId: forgedBody.subscriptionId, decision: 'activate',
  }, custB);
  ok('nor can another customer - 403', otherActivate.status === 403);

  ok('  …and after both it is still merely pending',
    (await db.doc(`subscriptions/${forgedBody.subscriptionId}`).get()).data().status === 'pending');

  const claim = await call('PATCH', '/api/membership', {
    subscriptionId: forgedBody.subscriptionId, reference: 'upi-4471-9920',
  }, custA);
  ok('the customer may CLAIM a payment, and it grants nothing',
    claim.status === 200
    && (await db.doc(`subscriptions/${forgedBody.subscriptionId}`).get()).data().status === 'pending');

  const otherClaim = await call('PATCH', '/api/membership', {
    subscriptionId: forgedBody.subscriptionId, reference: 'UPI-1',
  }, custB);
  ok('but not on somebody else’s membership - 403', otherClaim.status === 403, otherClaim.status);

  const activated = await call('PUT', '/api/membership', {
    subscriptionId: forgedBody.subscriptionId, decision: 'activate',
  }, staff);
  ok('THE STUDIO MAY ACTIVATE, and that is what grants the Club', activated.status === 200);
  const live = (await db.doc(`subscriptions/${forgedBody.subscriptionId}`).get()).data();
  ok('  …stamping the revenue exactly once, at the catalogue price',
    live.status === 'active' && live.amountPaid === 5999 && live.paidAt);

  const twice = await call('PUT', '/api/membership', {
    subscriptionId: forgedBody.subscriptionId, decision: 'activate',
  }, staff);
  ok('activating twice is refused 409', twice.status === 409, twice.status);

  const downgrade = await call('POST', '/api/membership', { plan: 'Silver', paymentMethod: 'upi' }, custA);
  ok('a downgrade mid-cycle is refused 409', downgrade.status === 409, downgrade.status);

  const staffStart = await call('POST', '/api/membership', {
    userId: 'apiB', plan: 'Silver', paymentMethod: 'cash',
  }, custA);
  ok('A CUSTOMER NAMING ANOTHER CUSTOMER IS REFUSED - 403', staffStart.status === 403, staffStart.status);

  const counter = await call('POST', '/api/membership', {
    userId: 'apiB', plan: 'Silver', paymentMethod: 'cash',
  }, staff);
  ok('the studio may start one at the counter', counter.status === 200, counter.status);

  /* ── THE CERTIFICATE ────────────────────────────────────────────────── */
  console.log('\nAPI · /api/protection/puc');

  const good = {
    vehicleId: madeBody.vehicleId,
    reference: 'GJ01-API-0001',
    issuedOn: iso(NOW - 2 * D),
    expiresOn: iso(NOW + 170 * D),
  };

  ok('UNAUTHENTICATED is refused 401',
    (await call('POST', '/api/protection/puc/declare', good, null)).status === 401);

  ok('another customer’s car is refused 403',
    (await call('POST', '/api/protection/puc/declare', { ...good, vehicleId: 'theirs' }, custA)).status === 403);

  ok('a malformed date is refused 400',
    (await call('POST', '/api/protection/puc/declare', { ...good, issuedOn: '2026-02-30' }, custA)).status === 400);

  const declared = await call('POST', '/api/protection/puc/declare', good, custA);
  const declaredBody = await declared.json();
  ok('an owner may declare against their own car',
    declared.status === 200 && declaredBody.status === 'submitted', JSON.stringify(declaredBody));
  ok('  …and it creates NO protection',
    !(await db.doc(`protections/${madeBody.vehicleId}_puc_${declaredBody.declarationId}`).get()).exists);

  ok('THE CUSTOMER CANNOT VERIFY THEIR OWN - 403',
    (await call('POST', '/api/protection/puc/verify',
      { declarationId: declaredBody.declarationId, decision: 'verify' }, custA)).status === 403);

  const verified = await call('POST', '/api/protection/puc/verify',
    { declarationId: declaredBody.declarationId, decision: 'verify' }, staff);
  ok('the studio may, and THAT writes the protection', verified.status === 200, verified.status);
  const prot = (await db.doc(`protections/${madeBody.vehicleId}_puc_${declaredBody.declarationId}`).get()).data();
  ok('  …against the car the DECLARATION names',
    prot && prot.vehicleId === madeBody.vehicleId && prot.termsSource === 'declared');

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
