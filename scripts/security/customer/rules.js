/* THE CUSTOMER'S TRUST BOUNDARY, PROVEN AGAINST REAL FIRESTORE SEMANTICS.
 *
 * `npx jest` reads `firestore.rules` as TEXT — it can prove the file SAYS the
 * right thing, and nothing more. This runs the real rules engine in the
 * emulator and asks it the questions that matter:
 *
 *   can an owner read their own car's papers?          must be YES
 *   can they read another customer's?                  must be NO
 *   can they write a declaration at all?               must be NO
 *   can they verify one?                               must be NO
 *   can they write themselves a protection?            must be NO
 *   can staff read the queue?                          must be YES
 *   can staff verify from the CLIENT?                  must be NO — the
 *                                                      server owns that write
 *
 * The last one is the one worth stating plainly: the studio's authority is
 * real, but it is exercised through /api/protection/puc/verify with the Admin
 * SDK, never from a browser. So the rules refuse even an admin, and a devtools
 * console on the owner's own laptop cannot manufacture a promise.
 */
const { initializeApp } = require('firebase/app');
const {
  getFirestore, connectFirestoreEmulator, doc, collection, addDoc, updateDoc,
  setDoc, getDoc, getDocs, deleteDoc, query, where,
} = require('firebase/firestore');
const { getAuth, connectAuthEmulator, signInWithCustomToken } = require('firebase/auth');
const fs = require('fs');

const app = initializeApp({ apiKey: 'fake', projectId: 'demo-automodz' });
const db = getFirestore(app);
const auth = getAuth(app);
connectFirestoreEmulator(db, '127.0.0.1', 8085);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

let pass = 0, fail = 0;
const ok = (n, c, d = '') => {
  c ? (pass++, console.log(`  PASS  ${n}`)) : (fail++, console.log(`  FAIL  ${n}  ${d}`));
};
const denied = async fn => {
  try { await fn(); return false; } catch (e) { return String(e.code || e).includes('permission-denied'); }
};
const allowed = async fn => {
  try { await fn(); return true; } catch (e) { return false; }
};

const CERT = {
  vehicleId: 'carA', ownerUid: 'custA', kind: 'puc',
  reference: 'FORGED-1', issuedOn: '2026-08-01', expiresOn: '2027-02-01',
  status: 'submitted', submittedAt: new Date(),
};

(async () => {
  const tokens = JSON.parse(fs.readFileSync(__dirname + '/tokens.json', 'utf8'));

  /* ── THE OWNER ─────────────────────────────────────────────────────── */
  await signInWithCustomToken(auth, tokens.custA);
  console.log('\nRULES · signed in as custA (role: customer, owns carA)');

  ok('CAN read their own car’s declarations',
    await allowed(() => getDocs(query(collection(db, 'declarations'), where('vehicleId', '==', 'carA')))));

  ok('CAN read their own car’s protections',
    await allowed(() => getDocs(query(collection(db, 'protections'), where('vehicleId', '==', 'carA')))));

  ok('CANNOT read another customer’s declarations',
    await denied(() => getDocs(query(collection(db, 'declarations'), where('vehicleId', '==', 'carB')))));

  ok('CANNOT read another customer’s declaration by id',
    await denied(() => getDoc(doc(db, 'declarations', 'decl-B-open'))));

  ok('CANNOT read the whole queue',
    await denied(() => getDocs(collection(db, 'declarations'))));

  ok('CANNOT create a declaration — not even an honest one',
    await denied(() => addDoc(collection(db, 'declarations'), CERT)));

  ok('  …nor at a chosen id',
    await denied(() => setDoc(doc(db, 'declarations', 'forged-1'), CERT)));

  ok('CANNOT verify their own declaration',
    await denied(() => updateDoc(doc(db, 'declarations', 'decl-A-open'), { status: 'verified' })));

  ok('CANNOT verify somebody else’s',
    await denied(() => updateDoc(doc(db, 'declarations', 'decl-B-open'), { status: 'verified' })));

  ok('CANNOT withdraw one either — every write is the server’s',
    await denied(() => updateDoc(doc(db, 'declarations', 'decl-A-open'), { status: 'withdrawn' })));

  ok('CANNOT delete a declaration, so the record cannot be edited by deletion',
    await denied(() => deleteDoc(doc(db, 'declarations', 'decl-A-open'))));

  ok('CANNOT write themselves a protection valid until 2099',
    await denied(() => setDoc(doc(db, 'protections', 'carA_puc_forged'), {
      vehicleId: 'carA', kind: 'puc', termsSource: 'declared',
      term: { kind: 'dated', expiresOn: '2099-01-01' }, since: '2026-01-01',
    })));

  ok('  …not even one that honestly says `declared`',
    await denied(() => setDoc(doc(db, 'protections', 'carA_puc_honest'), {
      vehicleId: 'carA', kind: 'puc', termsSource: 'declared',
      term: { kind: 'dated', expiresOn: '2027-01-01' },
    })));

  ok('CANNOT extend the protection they already have',
    await denied(() => updateDoc(doc(db, 'protections', 'carA_puc_decl-A-old'), {
      term: { kind: 'dated', expiresOn: '2099-01-01' },
    })));

  ok('CANNOT delete the ceramic warranty the STUDIO captured at seal',
    await denied(() => deleteDoc(doc(db, 'protections', 'carA_ceramic'))));

  /* ── THE CLUB ─────────────────────────────────────────────────────── */
  ok('CAN read their own membership',
    await allowed(() => getDocs(query(collection(db, 'subscriptions'), where('userId', '==', 'custA')))));

  ok('CANNOT read another customer’s membership',
    await denied(() => getDoc(doc(db, 'subscriptions', 'sub-B-active'))));

  ok('CANNOT write themselves a membership — not even a `pending` one',
    await denied(() => setDoc(doc(db, 'subscriptions', 'forged-1'), {
      userId: 'custA', plan: 'Platinum', status: 'pending',
      startDate: '2026-08-01', endDate: '2099-12-31',
      washesTotal: 999, washesUsed: 0, paymentMethod: 'cash',
    })));

  ok('  …nor with addDoc, which is the same write with a generated id',
    await denied(() => addDoc(collection(db, 'subscriptions'), {
      userId: 'custA', plan: 'Silver', status: 'pending',
      startDate: '2026-08-01', endDate: '2026-08-31',
      washesTotal: 4, washesUsed: 0, paymentMethod: 'cash',
    })));

  ok('CANNOT activate their own pending membership',
    await denied(() => updateDoc(doc(db, 'subscriptions', 'sub-A-pending'), { status: 'active' })));

  ok('CANNOT give themselves washes back',
    await denied(() => updateDoc(doc(db, 'subscriptions', 'sub-A-pending'), { washesUsed: 0, washesTotal: 99 })));

  ok('CANNOT extend their own cycle',
    await denied(() => updateDoc(doc(db, 'subscriptions', 'sub-A-pending'), { endDate: '2099-12-31' })));

  ok('CANNOT even cancel from the browser — leaving is a transition too',
    await denied(() => updateDoc(doc(db, 'subscriptions', 'sub-A-pending'), { status: 'cancelled' })));

  ok('CANNOT stamp their own payment',
    await denied(() => updateDoc(doc(db, 'subscriptions', 'sub-A-pending'), {
      paidAt: new Date(), amountPaid: 1,
    })));

  /* ── EVERYTHING ELSE A CUSTOMER MUST NOT WRITE ────────────────────── */
  ok('CANNOT create a payment, so no amount is ever theirs to name',
    await denied(() => setDoc(doc(db, 'payments', 'forged-p1'), {
      customerId: 'custA', bookingId: 'b1', amount: 1, status: 'paid',
    })));

  ok('CANNOT mark an existing payment paid',
    await denied(() => updateDoc(doc(db, 'payments', 'any'), { status: 'paid' })));

  ok('CANNOT approve their own approval',
    await denied(() => setDoc(doc(db, 'approvals', 'forged-a1'), {
      customerId: 'custA', status: 'approved', amount: 0,
    })));

  ok('CANNOT write an estimate, so no price is theirs to name',
    await denied(() => setDoc(doc(db, 'estimates', 'forged-e1'), {
      userId: 'custA', total: 1,
    })));

  ok('CANNOT create a booking at all',
    await denied(() => addDoc(collection(db, 'bookings'), {
      userId: 'custA', vehicleId: 'carA', status: 'pending', totalAmount: 1,
    })));

  ok('CANNOT seal a visit',
    await denied(() => setDoc(doc(db, 'visits', 'forged-v1'), {
      vehicleId: 'carA', status: 'sealed', sealedAt: new Date(), termsCaptured: [],
    })));

  ok('CANNOT promote themselves to staff',
    await denied(() => updateDoc(doc(db, 'users', 'custA'), { role: 'admin' })));

  ok('CANNOT rate on somebody else’s behalf',
    await denied(() => setDoc(doc(db, 'ratings', 'v-any'), { customerId: 'custB', stars: 5 })));

  /* ── ANOTHER CUSTOMER ──────────────────────────────────────────────── */
  await signInWithCustomToken(auth, tokens.custB);
  console.log('\nRULES · signed in as custB (owns carB, not carA)');

  ok('CANNOT read carA’s declarations',
    await denied(() => getDocs(query(collection(db, 'declarations'), where('vehicleId', '==', 'carA')))));

  ok('CANNOT declare against carA',
    await denied(() => setDoc(doc(db, 'declarations', 'cross-1'), { ...CERT, ownerUid: 'custB' })));

  ok('CANNOT associate a declaration with a car that is not theirs',
    await denied(() => setDoc(doc(db, 'declarations', 'cross-2'), {
      ...CERT, vehicleId: 'carA', ownerUid: 'custB',
    })));

  /* ── THE STUDIO ────────────────────────────────────────────────────── */
  await signInWithCustomToken(auth, tokens.staff1);
  console.log('\nRULES · signed in as staff1 (role: employee)');

  ok('CAN read the whole queue — the studio has to see what was sent',
    await allowed(() => getDocs(collection(db, 'declarations'))));

  ok('CAN read any car’s declarations',
    await allowed(() => getDocs(query(collection(db, 'declarations'), where('vehicleId', '==', 'carB')))));

  ok('CANNOT verify from a browser — the write is /api/protection/puc/verify’s',
    await denied(() => updateDoc(doc(db, 'declarations', 'decl-A-open'), { status: 'verified' })));

  ok('CANNOT create a declaration on a customer’s behalf from a browser',
    await denied(() => addDoc(collection(db, 'declarations'), CERT)));

  ok('CANNOT activate a membership from a browser either',
    await denied(() => updateDoc(doc(db, 'subscriptions', 'sub-A-pending'), { status: 'active' })));

  ok('CAN read every membership — the counter has to see them',
    await allowed(() => getDocs(collection(db, 'subscriptions'))));

  ok('CAN still write a protection — the seal runs as staff',
    await allowed(() => setDoc(doc(db, 'protections', 'carA_glass'), {
      vehicleId: 'carA', kind: 'glass', termsSource: 'captured',
      term: { kind: 'dated', expiresOn: '2029-01-01' }, visitId: 'visit-1',
    })));

  /* ── THE OWNER OF THE BUSINESS ─────────────────────────────────────── */
  await signInWithCustomToken(auth, tokens.boss);
  console.log('\nRULES · signed in as boss (role: admin)');

  ok('CANNOT verify from the admin console either',
    await denied(() => updateDoc(doc(db, 'declarations', 'decl-A-open'), { status: 'verified' })));

  ok('CANNOT delete a declaration — the record is the record',
    await denied(() => deleteDoc(doc(db, 'declarations', 'decl-A-open'))));

  ok('CANNOT activate a membership from the admin console',
    await denied(() => updateDoc(doc(db, 'subscriptions', 'sub-A-pending'), { status: 'active' })));

  ok('CANNOT create one either — /api/membership is the one door',
    await denied(() => addDoc(collection(db, 'subscriptions'), {
      userId: 'custA', plan: 'Gold', status: 'active',
    })));

  /* ── SIGNED OUT ────────────────────────────────────────────────────── */
  await auth.signOut();
  console.log('\nRULES · signed out');

  ok('CANNOT read any declaration',
    await denied(() => getDoc(doc(db, 'declarations', 'decl-A-open'))));

  ok('CANNOT read any protection',
    await denied(() => getDoc(doc(db, 'protections', 'carA_ceramic'))));

  ok('CANNOT read any membership',
    await denied(() => getDoc(doc(db, 'subscriptions', 'sub-A-pending'))));

  ok('CANNOT read anybody’s bookings, payments or visits',
    await denied(() => getDocs(collection(db, 'bookings')))
    && await denied(() => getDocs(collection(db, 'payments')))
    && await denied(() => getDocs(collection(db, 'visits'))));

  ok('CANNOT write anything at all',
    await denied(() => setDoc(doc(db, 'declarations', 'anon-1'), CERT)));

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
