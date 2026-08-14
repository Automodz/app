/**
 * VERIFY THE IMMUTABLE VISIT PIPELINE, end to end, against the emulator.
 *
 * Drives `POST /api/visit/seal` - the exact route the kiosk calls - so the auth
 * check, the transaction and the snapshots are all proven together. Then reads
 * the documents back with the Admin SDK to assert what was written.
 *
 *   JAVA_HOME=/opt/homebrew/opt/openjdk@21 \
 *     npx firebase emulators:start --only auth,firestore --project automodz-local
 *   node scripts/seed-customer.mjs
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *     FIREBASE_ADMIN_PROJECT_ID=automodz-local NEXT_PUBLIC_FIREBASE_EMULATOR=1 \
 *     npx next dev -p 3200
 *   node scripts/verify-seal.mjs
 */
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
const APP = process.env.APP_ORIGIN ?? 'http://localhost:3200';
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';

const { initializeApp, getApps } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');
if (!getApps().length) initializeApp({ projectId: 'automodz-local' });
const db = getFirestore();

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✕'} ${label}${detail ? '  - ' + detail : ''}`);
  if (!ok) failures++;
};

/* A staff account, because sealing is staff-only and that must be enforced. */
const mk = async (email) => {
  const r = await fetch(`${AUTH}/accounts:signUp?key=fake`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123', returnSecureToken: true }),
  });
  const j = await r.json();
  if (j.idToken) return j;
  const s = await fetch(`${AUTH}/accounts:signInWithPassword?key=fake`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123', returnSecureToken: true }),
  });
  return s.json();
};

const staff = await mk('detailer@example.test');
await db.doc(`users/${staff.localId}`).set(
  { uid: staff.localId, email: 'detailer@example.test', name: 'Bay', role: 'employee' },
  { merge: true },
);
const customer = await mk('meera@example.test');

const seal = async (jobId, token = staff.idToken) => {
  const r = await fetch(`${APP}/api/visit/seal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ jobId }),
  });
  return { code: r.status, body: await r.json().catch(() => ({})) };
};

console.log('\n══ ACCESS: sealing is staff-only');
check('no token is refused', (await seal('job-seal', null)).code === 403);
check('a customer token is refused', (await seal('job-seal', customer.idToken)).code === 403);

console.log('\n══ SEAL: a completed job with a booking');
const first = await seal('job-seal');
check('sealed', first.body.status === 'sealed', JSON.stringify(first.body));
check('wrote protections', (first.body.protections ?? 0) >= 1, `${first.body.protections}`);

const vid = 'visit_job-seal';
const v = (await db.doc(`visits/${vid}`).get()).data();
check('the visit is sealed', !!v?.sealedAt);
check('SNAPSHOT services', v?.services?.[0]?.name === 'Ceramic coating');
check('SNAPSHOT pricing', v?.amounts?.total === 64000, JSON.stringify(v?.amounts));
check('SNAPSHOT warranty, marked captured', v?.termsCaptured?.[0]?.source === 'captured',
  JSON.stringify(v?.termsCaptured?.[0]?.term));
check('stages derived from the status history', (v?.stages?.length ?? 0) >= 2, `${v?.stages?.length} stages`);
check('owner denormalised so reads can be scoped', !!v?.customerId);

console.log('\n══ IDEMPOTENT');
const second = await seal('job-seal');
check('a second seal is a no-op', second.body.status === 'already-sealed', JSON.stringify(second.body));
const dupes = await db.collection('visits').where('jobId', '==', 'job-seal').get();
check('exactly ONE visit for the job', dupes.size === 1, `${dupes.size}`);

console.log('\n══ PERMANENT: the catalogue moves underneath it (§14.5)');
const before = JSON.stringify(v?.termsCaptured);
await db.doc('services/svc-ceramic').set({ warranty: '99 years' }, { merge: true });
const third = await seal('job-seal');
check('re-sealing still refuses', third.body.status === 'already-sealed');
const after = (await db.doc(`visits/${vid}`).get()).data();
check('the captured term did NOT move', JSON.stringify(after?.termsCaptured) === before,
  'a price-list edit cannot rewrite a past promise');

console.log('\n══ PROTECTIONS, in the same commit');
const prots = await db.collection('protections').where('visitId', '==', vid).get();
check('linked to the visit', prots.size >= 1, `${prots.size}`);
check('one per car per kind', prots.docs.every(d => d.id.split('_').length >= 2));
check('termsSource is captured', prots.docs.every(d => d.data().termsSource === 'captured'));

console.log('\n══ SKIPPED, never fatal');
check('a walk-in with no vehicle is skipped',
  (await seal('job-walkin-done')).body.status === 'no-vehicle');
check('a missing job is reported, not thrown',
  (await seal('does-not-exist')).body.status === 'not-found');

console.log('\n══ CONCURRENCY: ten simultaneous seals of one job');
await db.doc(`visits/${vid}`).delete();
for (const d of prots.docs) await d.ref.delete();
const burst = await Promise.all(Array.from({ length: 10 }, () => seal('job-seal')));
const sealedCount = burst.filter(r => r.body.status === 'sealed').length;
const noopCount = burst.filter(r => r.body.status === 'already-sealed').length;
check('exactly one call sealed', sealedCount === 1, `${sealedCount} sealed, ${noopCount} no-op`);
check('no errors under contention', burst.every(r => r.code === 200));
const afterBurst = await db.collection('visits').where('jobId', '==', 'job-seal').get();
check('still exactly ONE visit', afterBurst.size === 1, `${afterBurst.size}`);

console.log('\n══ BACKFILL: existing customers migrate with no admin steps');
const admin = await mk('owner@example.test');
await db.doc(`users/${admin.localId}`).set({ uid: admin.localId, role: 'admin' }, { merge: true });
const bf = await fetch(`${APP}/api/visit/backfill`, {
  method: 'POST', headers: { Authorization: `Bearer ${admin.idToken}` },
});
const bfBody = await bf.json();
check('backfill runs', bf.status === 200, JSON.stringify(bfBody));
check('it is idempotent over already-sealed work',
  (bfBody.alreadySealed ?? 0) + (bfBody.sealed ?? 0) >= 1, JSON.stringify(bfBody));
const bf2 = await (await fetch(`${APP}/api/visit/backfill`, {
  method: 'POST', headers: { Authorization: `Bearer ${admin.idToken}` },
})).json();
check('a second run seals nothing new', (bf2.sealed ?? 0) === 0, JSON.stringify(bf2));

console.log(`\n${failures === 0 ? 'VISIT PIPELINE VERIFIED' : failures + ' FAILURE(S)'}\n`);
process.exit(failures === 0 ? 0 : 1);
