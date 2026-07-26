/* THE OTHER HALF: prove firestore.rules closes the doors the Booking Service
   now owns. A server that prices correctly is worthless if the client can still
   write the document itself. Runs against the project's real rules file. */
const { initializeApp } = require('firebase/app');
const {
  getFirestore, connectFirestoreEmulator, doc, collection, addDoc, updateDoc,
  setDoc, getDoc, getDocs, deleteDoc, query, where, increment,
} = require('firebase/firestore');
const { getAuth, connectAuthEmulator, signInWithCustomToken } = require('firebase/auth');
const fs = require('fs');

const app = initializeApp({ apiKey: 'fake', projectId: 'demo-automodz' });
const db = getFirestore(app);
const auth = getAuth(app);
connectFirestoreEmulator(db, '127.0.0.1', 8085);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

let pass = 0, fail = 0;
const ok = (n, c, d = '') => { c ? (pass++, console.log(`  PASS  ${n}`)) : (fail++, console.log(`  FAIL  ${n}  ${d}`)); };
const denied = async fn => {
  try { await fn(); return false; } catch (e) { return String(e.code || e).includes('permission-denied'); }
};

(async () => {
  const tokens = JSON.parse(fs.readFileSync(__dirname + '/tokens.json', 'utf8'));
  const dates = JSON.parse(fs.readFileSync(__dirname + '/dates.json', 'utf8'));
  await signInWithCustomToken(auth, tokens.custA);
  console.log('\nRULES · signed in as custA (role: customer)');

  ok('CANNOT create a booking at all - not even an honest one',
    await denied(() => addDoc(collection(db, 'bookings'), {
      userId: 'custA', vehicleId: 'carA', serviceId: 'svc-wash',
      serviceBasePrice: 500, totalAmount: 500, status: 'pending',
      scheduledDate: dates.TOMORROW, scheduledTime: '09:00',
    })));
  ok('  …and certainly not a ₹1 ceramic',
    await denied(() => addDoc(collection(db, 'bookings'), {
      userId: 'custA', serviceId: 'svc-ceramic', serviceBasePrice: 1, totalAmount: 1,
    })));

  const mine = await getDocs(query(collection(db, 'bookings'), where('userId', '==', 'custA')));
  ok('can still READ own bookings', mine.size > 0, String(mine.size));
  const bId = mine.docs[0]?.id;
  ok('can still cancel own booking (the one write left)',
    !(await denied(() => updateDoc(doc(db, 'bookings', bId), {
      status: 'cancelled', updatedAt: new Date(),
    }))));
  ok('cannot change own booking\'s total',
    await denied(() => updateDoc(doc(db, 'bookings', bId), { totalAmount: 1 })));

  ok('cannot increment promos.usedCount',
    await denied(() => updateDoc(doc(db, 'promos', 'p-open'), { usedCount: increment(1) })));
  ok('cannot overwrite a promo',
    await denied(() => setDoc(doc(db, 'promos', 'p-open'), { usedCount: 0 }, { merge: true })));
  ok('cannot forge a promoRedemptions document',
    await denied(() => setDoc(doc(db, 'promoRedemptions', 'forged'), {
      promoId: 'p-open', userId: 'custA', discountAmount: 99999 })));

  ok('cannot read the idempotency ledger',
    await denied(() => getDocs(collection(db, 'bookingIntents'))));
  ok('cannot delete an idempotency marker to unlock a replay',
    await denied(async () => {
      const s = await getDocs(collection(db, 'bookingIntents'));
      return deleteDoc(doc(db, 'bookingIntents', s.docs[0]?.id ?? 'x'));
    }));
  ok('cannot forge an idempotency marker',
    await denied(() => setDoc(doc(db, 'bookingIntents', 'custA_forged'), { bookingId: 'x' })));

  ok('cannot open a job (the walk-in path is staff + server only)',
    await denied(() => addDoc(collection(db, 'jobs'), {
      customerId: 'custA', subtotal: 0, totalAmount: 0, status: 'checked_in',
      serviceItems: [], assignedIds: [], assignments: [], statusHistory: [],
      customerName: 'x', customerPhone: '9000000001', vehicleName: 'x', vehicleRegNo: 'x',
      createdByEmployeeId: 'x', createdByEmployeeName: 'x', paymentStatus: 'pending',
      date: dates.TODAY,
    })));
  ok('cannot spend someone\'s membership wash',
    await denied(() => updateDoc(doc(db, 'subscriptions', 'sub-gold'), { washesUsed: 0 })));

  // reads that MUST keep working, or the app cannot quote a price honestly
  ok('can read a promo (needed to quote one)', (await getDoc(doc(db, 'promos', 'p-open'))).exists());
  const own = await getDocs(query(collection(db, 'promoRedemptions'), where('userId', '==', 'custA')));
  ok('can count own redemptions (per-customer limits quote honestly)', own.size >= 0);

  await signInWithCustomToken(auth, tokens.custB);
  console.log('\nRULES · signed in as custB');
  ok("cannot read another customer's bookings",
    await denied(() => getDocs(query(collection(db, 'bookings'), where('userId', '==', 'custA')))));
  ok("cannot read another customer's redemptions",
    await denied(() => getDocs(query(collection(db, 'promoRedemptions'), where('userId', '==', 'custA')))));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
