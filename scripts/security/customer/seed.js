/* Seed the Firestore + Auth emulators for the pollution-certificate audit.
   Two customers with a car each, one technician, one owner. Nothing here is a
   valid certificate — the point of the matrix is what the CLIENT may write. */
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const fs = require('fs');

const app = initializeApp({
  credential: cert({
    projectId: 'demo-automodz',
    clientEmail: 'test@demo-automodz.iam.gserviceaccount.com',
    privateKey: fs.readFileSync(__dirname + '/fake.pem', 'utf8'),
  }),
  projectId: 'demo-automodz',
});
const db = getFirestore(app);
const auth = getAuth(app);

const users = [
  ['custA', { name: 'Customer A', role: 'customer', email: 'a@x.com' }],
  ['custB', { name: 'Customer B', role: 'customer', email: 'b@x.com' }],
  ['staff1', { name: 'Technician', role: 'employee', email: 's@x.com', employeeId: 'emp1' }],
  ['boss', { name: 'Owner', role: 'admin', email: 'hello.automodz@gmail.com' }],
];

// Vehicles live UNDER their owner. That is what makes ownership unforgeable —
// `ownsVehicle()` is a document lookup, not a field comparison.
const vehicles = [
  ['custA', 'carA', { name: 'Kia Seltos', registrationNumber: 'GJ01AB8539' }],
  ['custB', 'carB', { name: 'BMW M340i', registrationNumber: 'GJ01CD5678' }],
];

const declarations = [
  ['decl-A-open', {
    vehicleId: 'carA', ownerUid: 'custA', kind: 'puc',
    reference: 'GJ01-PUC-88213', issuedOn: '2026-08-01', expiresOn: '2027-02-01',
    status: 'submitted',
  }],
  ['decl-B-open', {
    vehicleId: 'carB', ownerUid: 'custB', kind: 'puc',
    reference: 'GJ01-PUC-00001', issuedOn: '2026-08-01', expiresOn: '2027-02-01',
    status: 'submitted',
  }],
];

const subscriptions = [
  ['sub-A-pending', {
    userId: 'custA', userName: 'Customer A', plan: 'Silver', status: 'pending',
    startDate: '2026-08-01', endDate: '2026-08-31',
    washesTotal: 4, washesUsed: 0, amountDue: 1499, paymentMethod: 'upi',
  }],
  ['sub-B-active', {
    userId: 'custB', userName: 'Customer B', plan: 'Gold', status: 'active',
    startDate: '2026-08-01', endDate: '2026-08-31',
    washesTotal: 8, washesUsed: 2, amountDue: 2999, amountPaid: 2999, paymentMethod: 'cash',
  }],
];

const protections = [
  ['carA_puc_decl-A-old', {
    vehicleId: 'carA', kind: 'puc', since: '2026-01-01',
    term: { kind: 'dated', expiresOn: '2026-07-01' }, termsSource: 'declared',
  }],
  ['carA_ceramic', {
    vehicleId: 'carA', kind: 'ceramic', since: '2026-01-01',
    term: { kind: 'dated', expiresOn: '2029-01-01' }, termsSource: 'captured',
    visitId: 'visit-1',
  }],
];

(async () => {
  const tokens = {};
  for (const [uid, data] of users) {
    await auth.createUser({ uid, email: data.email }).catch(() => {});
    await db.doc(`users/${uid}`).set(data);
    tokens[uid] = await auth.createCustomToken(uid);
  }
  for (const [owner, id, data] of vehicles) {
    await db.doc(`users/${owner}/vehicles/${id}`).set(data);
  }
  for (const [id, data] of declarations) {
    await db.doc(`declarations/${id}`).set({
      ...data,
      submittedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  for (const [id, data] of protections) {
    await db.doc(`protections/${id}`).set({ ...data, createdAt: new Date(), updatedAt: new Date() });
  }
  for (const [id, data] of subscriptions) {
    await db.doc(`subscriptions/${id}`).set({ ...data, createdAt: new Date(), updatedAt: new Date() });
  }
  fs.writeFileSync(__dirname + '/tokens.json', JSON.stringify(tokens, null, 2));
  console.log('seeded: 4 users, 2 cars, 2 declarations, 2 protections, 2 subscriptions');
  process.exit(0);
})();
