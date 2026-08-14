/**
 * LIVE VERIFICATION OF THE CUSTOMER READ PATH.
 *
 * Signs a real customer in against the Auth emulator with the real Firebase SDK
 * and issues exactly the queries `lib/customer/source.ts#loadPicture` issues, in
 * the same order, then asserts the documents that come back.
 *
 * This exists because the customer data layer had only ever been type-checked.
 * The dev-auth shim fakes a store user without a Firebase session, so every
 * rule-guarded read was refused, and the failure was indistinguishable from a
 * network problem.
 *
 *   JAVA_HOME=/opt/homebrew/opt/openjdk@21 \
 *     npx firebase emulators:start --only auth,firestore --project automodz-local
 *   node scripts/seed-customer.mjs
 *   node scripts/verify-read-path.mjs
 *
 * A non-zero exit means the read path is broken for real customers.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, collection, query, where, getDocs,
} from 'firebase/firestore';

const app = initializeApp({ projectId: 'automodz-local', apiKey: 'fake' });
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✕'} ${label}${detail ? '  - ' + detail : ''}`);
  if (!ok) failures++;
};
const denied = async (label, q) => {
  try { await getDocs(q); check(label, false, 'ALLOWED but should be denied'); }
  catch { check(label, true, 'denied'); }
};

const { user } = await signInWithEmailAndPassword(auth, 'meera@example.test', 'password123');
const uid = user.uid;
console.log(`\nsigned in as ${uid}\n`);

console.log('══ loadPicture, step by step');
const vehicles = (await getDocs(collection(db, 'users', uid, 'vehicles')))
  .docs.map(d => ({ id: d.id, ...d.data() }));
check('vehicles', vehicles.length === 2, `${vehicles.length} cars`);

const subs = await getDocs(query(collection(db, 'subscriptions'), where('userId', '==', uid)));
check('subscription', subs.size === 1, `${subs.size}`);

const services = await getDocs(collection(db, 'services'));
check('service catalogue', services.size >= 1, `${services.size}`);

for (const v of vehicles) {
  const reg = v.registrationNumber.replace(/\s+/g, '').toUpperCase();
  const [prot, vis, bk, jb] = await Promise.all([
    getDocs(query(collection(db, 'protections'), where('vehicleId', '==', v.id))),
    getDocs(query(collection(db, 'visits'), where('vehicleId', '==', v.id))),
    getDocs(query(collection(db, 'bookings'), where('userId', '==', uid), where('vehicleRegNo', '==', reg))),
    getDocs(query(collection(db, 'jobs'), where('customerId', '==', uid), where('vehicleRegNo', '==', reg))),
  ]);
  console.log(`  ${v.name}: ${prot.size} protection · ${vis.size} visit · ${bk.size} booking · ${jb.size} job`);
}

console.log('\n══ the sealed visit that used to deny every read');
const sealed = await getDocs(query(collection(db, 'visits'), where('vehicleId', '==', 'car-superb')));
check('a sealed visit is readable by its owner', sealed.size === 1);
check('its captured term survived', sealed.docs[0]?.data()?.termsCaptured?.length === 1);

console.log('\n══ the unscoped queries that used to be issued');
await denied('bookings by plate alone', query(collection(db, 'bookings'), where('vehicleRegNo', '==', 'GJ01KP4471')));
await denied('jobs by plate alone', query(collection(db, 'jobs'), where('vehicleRegNo', '==', 'GJ01KP4471')));

console.log('\n══ the unlinked walk-in job must be absent, not fatal');
const mine = await getDocs(query(collection(db, 'jobs'), where('customerId', '==', uid), where('vehicleRegNo', '==', 'GJ01KP4471')));
check('only the linked job is returned', mine.size === 1 && mine.docs[0].id === 'job-done');

console.log('\n══ isolation');
await denied('every user document', collection(db, 'users'));
await denied('every job', collection(db, 'jobs'));
await denied('every booking', collection(db, 'bookings'));
await denied("another owner's protections", query(collection(db, 'protections'), where('vehicleId', '==', 'not-mine')));
await denied("another owner's visits", query(collection(db, 'visits'), where('vehicleId', '==', 'not-mine')));

console.log(`\n${failures === 0 ? 'READ PATH VERIFIED' : failures + ' FAILURE(S)'}\n`);
process.exit(failures === 0 ? 0 : 1);
