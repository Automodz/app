/* Seed ONE real customer into the emulator, through the Auth + REST APIs so the
   documents are exactly what production would hold. */
const PROJECT = 'automodz-local';
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const AUTH = `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1`;

const ts = (iso) => ({ timestampValue: new Date(iso).toISOString() });
const S = (v) => ({ stringValue: v });
const N = (v) => ({ integerValue: String(v) });
const B = (v) => ({ booleanValue: v });
const A = (vals) => ({ arrayValue: { values: vals } });
const M = (fields) => ({ mapValue: { fields } });

async function put(path, fields) {
  const r = await fetch(`${FS}/${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields }),
  });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
}

// 1 · the account
const signUp = await (await fetch(`${AUTH}/accounts:signUp?key=fake`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'meera@example.test', password: 'password123', returnSecureToken: true }),
})).json();
const uid = signUp.localId;
if (!uid) throw new Error('signUp failed: ' + JSON.stringify(signUp));
console.log('  uid:', uid);

await put(`users/${uid}`, {
  uid: S(uid), name: S('Meera Shah'), email: S('meera@example.test'),
  phone: S('+91 90000 00000'), role: S('customer'),
  createdAt: ts('2023-03-01T10:00:00Z'),
});

// 2 · two cars, one photographed and one not
const V1 = 'car-superb', V2 = 'car-nexon';
await put(`users/${uid}/vehicles/${V1}`, {
  id: S(V1), name: S('Skoda Superb'), registrationNumber: S('GJ 01 KP 4471'),
  photo: S('https://res.cloudinary.com/demo/image/upload/w_1600/sample.jpg'),
  createdAt: ts('2023-03-01T10:00:00Z'),
});
await put(`users/${uid}/vehicles/${V2}`, {
  id: S(V2), name: S('Tata Nexon'), registrationNumber: S('GJ 01 ZZ 9999'),
  createdAt: ts('2026-07-20T10:00:00Z'),
});

// 3 · a completed booking + its job, and a LIVE booking on the other car
const common = (over) => ({
  userId: S(uid), userName: S('Meera Shah'), userEmail: S('meera@example.test'),
  userPhone: S('+91 90000 00000'),
  serviceId: S('svc-ceramic'), serviceName: S('Ceramic coating'),
  serviceCategory: S('Ceramic'), servicePrice: N(64000), serviceBasePrice: N(64000),
  totalAmount: N(64000), scheduledTime: S('10:00'),
  ...over,
});
await put('bookings/bk-done', common({
  id: S('bk-done'), vehicleId: S(V1), vehicleName: S('Skoda Superb'),
  vehicleRegNo: S('GJ01KP4471'), scheduledDate: S('2026-07-18'),
  status: S('completed'), createdAt: ts('2026-07-18T09:00:00Z'),
}));
await put('bookings/bk-live', common({
  id: S('bk-live'), vehicleId: S(V2), vehicleName: S('Tata Nexon'),
  vehicleRegNo: S('GJ01ZZ9999'), scheduledDate: S('2026-07-30'),
  serviceName: S('Interior deep clean'), serviceCategory: S('Interior'),
  status: S('in_progress'), createdAt: ts('2026-07-30T09:00:00Z'),
}));

// a job WITH customerId, and one WITHOUT — the exact shape that used to deny
await put('jobs/job-done', {
  id: S('job-done'), bookingId: S('bk-done'), customerId: S(uid),
  vehicleRegNo: S('GJ01KP4471'), status: S('archived'),
  photos: A([
    M({ url: S('https://res.cloudinary.com/demo/image/upload/w_1600/sample.jpg'), kind: S('before') }),
    M({ url: S('https://res.cloudinary.com/demo/image/upload/w_1600/sample.jpg'), kind: S('after') }),
  ]),
  statusHistory: A([]),
  createdAt: ts('2026-07-18T09:00:00Z'), completedAt: ts('2026-07-18T17:00:00Z'),
});
await put('jobs/job-walkin', {
  id: S('job-walkin'), vehicleRegNo: S('GJ01KP4471'), status: S('archived'),
  photos: A([]), statusHistory: A([]), createdAt: ts('2025-01-01T09:00:00Z'),
});

// 4 · A SEALED VISIT — the document that used to break every customer's app
await put('visits/vis-1', {
  id: S('vis-1'), vehicleId: S(V1), locationId: S('maninagar'),
  source: S('requested'), authoredBy: S('studio'),
  services: A([M({ serviceId: S('svc-ceramic'), name: S('Ceramic coating'), category: S('Ceramic'), price: N(64000) })]),
  amounts: M({ subtotal: N(64000), discount: N(0), total: N(64000) }),
  stages: A([M({ stage: S('ready'), at: ts('2026-07-18T17:00:00Z'),
                 note: S('Two-stage correction, then the coat. Cured overnight.'),
                 media: A([]) })]),
  termsCaptured: A([M({ kind: S('ceramic'), term: M({ kind: S('dated'), expiresOn: S('2029-03-01') }), source: S('captured') })]),
  status: S('sealed'), sealedAt: ts('2026-07-18T18:00:00Z'), bookingId: S('bk-done'),
  createdAt: ts('2026-07-18T09:00:00Z'), updatedAt: ts('2026-07-18T18:00:00Z'),
});

// 5 · protections + a membership
await put('protections/prot-ceramic', {
  id: S('prot-ceramic'), vehicleId: S(V1), kind: S('ceramic'), since: S('2026-07-18'),
  term: M({ kind: S('dated'), expiresOn: S('2029-03-01') }),
  termsSource: S('captured'), visitId: S('vis-1'),
  createdAt: ts('2026-07-18T18:00:00Z'), updatedAt: ts('2026-07-18T18:00:00Z'),
});
await put('protections/prot-puc', {
  id: S('prot-puc'), vehicleId: S(V1), kind: S('puc'), since: S('2026-01-05'),
  term: M({ kind: S('dated'), expiresOn: S('2026-08-05') }),
  termsSource: S('declared'),
  createdAt: ts('2026-01-05T10:00:00Z'), updatedAt: ts('2026-01-05T10:00:00Z'),
});
await put('subscriptions/sub-1', {
  id: S('sub-1'), userId: S(uid), userName: S('Meera Shah'),
  userEmail: S('meera@example.test'), userPhone: S('+91 90000 00000'),
  plan: S('Gold'), status: S('active'),
  startDate: S('2026-07-01'), endDate: S('2026-08-14'),
  washesTotal: N(8), washesUsed: N(6), paymentMethod: S('upi'),
  createdAt: ts('2026-07-01T10:00:00Z'), updatedAt: ts('2026-07-01T10:00:00Z'),
});
await put('services/svc-ceramic', {
  id: S('svc-ceramic'), name: S('Ceramic coating'), category: S('Ceramic'),
  basePrice: N(64000), active: B(true), warranty: S('3 years'),
});

console.log('  seeded: 2 cars · 2 bookings · 2 jobs (one unlinked) · 1 SEALED visit · 2 protections · 1 membership');
