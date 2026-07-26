/* Seed the Firestore + Auth emulators for the Booking Service audit. */
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

const iso = d => d.toISOString().slice(0, 10);
const TODAY = iso(new Date());
const TOMORROW = iso(new Date(Date.now() + 86400000));
const YESTERDAY = iso(new Date(Date.now() - 86400000));
const FROM = '2020-01-01', TO = '2099-12-31';

const users = [
  ['custA',  { name: 'Customer A', role: 'customer', email: 'a@x.com', phone: '9000000001' }],
  ['custB',  { name: 'Customer B', role: 'customer', email: 'b@x.com', phone: '9000000002' }],
  ['gold',   { name: 'Gold Member', role: 'customer', email: 'g@x.com', phone: '9000000003' }],
  ['lapsed', { name: 'Lapsed Member', role: 'customer', email: 'l@x.com', phone: '9000000004' }],
  ['staff1', { name: 'Kiosk', role: 'employee', email: 's@x.com', employeeId: 'emp1' }],
];

// vehicles live UNDER their owner, which is what makes ownership unforgeable
const vehicles = [
  ['custA',  'carA', { name: 'BMW M340i', registrationNumber: 'GJ01AB1234' }],
  ['custB',  'carB', { name: 'Audi A4', registrationNumber: 'GJ01CD5678' }],
  ['gold',   'carG', { name: 'Merc C300', registrationNumber: 'GJ01EF9012' }],
  ['lapsed', 'carL', { name: 'Skoda Slavia', registrationNumber: 'GJ01GH3456' }],
];

const services = [
  ['svc-ceramic',  { name: 'Kovalent Graphene', price: 12000, category: 'Ceramic', duration: 480, active: true }],
  ['svc-wash',     { name: 'Regular Wash', price: 500, category: 'Washing', duration: 60, active: true }],
  ['svc-detail',   { name: 'Detail SPA', price: 2500, category: 'Washing', duration: 120, active: true }],
  ['svc-retired',  { name: 'Old Polish', price: 900, category: 'Washing', duration: 60, active: false }],
  ['svc-unpriced', { name: 'Consult', price: 0, category: 'Washing', duration: 60, active: true }],
];

const basePromo = {
  code: 'X', label: 'X', type: 'percent', value: 25, autoApply: true, active: true,
  validFrom: FROM, validTo: TO, usedCount: 0,
  scope: { kind: 'all' }, target: { kind: 'all' },
};

const promos = [
  ['p-open',        { ...basePromo, code: 'OPEN', label: '25% off' }],
  ['p-targeted',    { ...basePromo, code: 'WELCOME-A', label: 'Referral reward', value: 50,
                      usageLimitTotal: 1, target: { kind: 'customers', userIds: ['custA'] } }],
  ['p-percustomer', { ...basePromo, code: 'ONCE', label: 'Once each', value: 10, usageLimitPerCustomer: 1 }],
  ['p-washonly',    { ...basePromo, code: 'WASH', label: 'Wash only', type: 'flat', value: 200,
                      scope: { kind: 'category', categories: ['Washing'] } }],
  ['p-expired',     { ...basePromo, code: 'OLD', label: 'Expired', validTo: YESTERDAY }],
  ['p-exhausted',   { ...basePromo, code: 'GONE', label: 'Exhausted', usageLimitTotal: 1, usedCount: 1 }],
  ['p-three',       { ...basePromo, code: 'THREE', label: 'Three only', usageLimitTotal: 3 }],
];

const subs = [
  ['sub-gold',   { userId: 'gold', plan: 'Gold', status: 'active', startDate: FROM, endDate: TO,
                   washesTotal: 4, washesUsed: 0, paymentMethod: 'upi' }],
  ['sub-lapsed', { userId: 'lapsed', plan: 'Platinum', status: 'active', startDate: FROM,
                   endDate: YESTERDAY, washesTotal: 4, washesUsed: 0, paymentMethod: 'upi' }],
];

(async () => {
  for (const c of ['users', 'services', 'promos', 'promoRedemptions', 'bookings', 'jobs',
                   'subscriptions', 'bookingIntents', 'walkinCustomers', 'employees']) {
    const s = await db.collection(c).get();
    await Promise.all(s.docs.map(d => d.ref.delete()));
  }
  for (const [id, d] of users) await db.collection('users').doc(id).set(d);
  for (const [uid, id, d] of vehicles) {
    await db.collection('users').doc(uid).collection('vehicles').doc(id).set(d);
  }
  for (const [id, d] of services) await db.collection('services').doc(id).set(d);
  for (const [id, d] of promos) await db.collection('promos').doc(id).set(d);
  for (const [id, d] of subs) {
    await db.collection('subscriptions').doc(id).set({ ...d, createdAt: new Date() });
  }
  await db.collection('employees').doc('emp1').set({ name: 'Kiosk', role: 'washer', active: true });
  await db.collection('studioConfig').doc('resources').set({ washCapacity: 1 });

  for (const [uid, d] of users) {
    try { await auth.deleteUser(uid); } catch {}
    await auth.createUser({ uid, email: d.email });
  }
  const tokens = {};
  for (const [uid] of users) tokens[uid] = await auth.createCustomToken(uid);
  fs.writeFileSync(__dirname + '/tokens.json', JSON.stringify(tokens, null, 2));
  fs.writeFileSync(__dirname + '/dates.json',
    JSON.stringify({ TODAY, TOMORROW, YESTERDAY }, null, 2));
  console.log('seeded · today', TODAY, '· tomorrow', TOMORROW);
  process.exit(0);
})();
