/**
 * THE DEMO CUSTOMER, FILLED IN.
 *
 * `sheth871@gmail.com` is a REAL account with real records — four cars, ten
 * bookings, jobs against them. Nothing here creates a parallel demo world: it
 * fills the gaps that made the product look empty, using the same collections
 * and the same document shapes the studio's own admin writes.
 *
 * What was missing, and why each mattered:
 *
 *   SERVICES        the catalogue was EMPTY in production. Nothing could be
 *                   booked, and `os/proposal` maps a protection to a service
 *                   CATEGORY, so no recommendation could resolve either.
 *   PROTECTIONS     none at all, so Home's protection region never drew and
 *                   the proposal engine had nothing to reason from.
 *   JOB PHOTOS      the live job had none, so the one thing the product is
 *                   for — watching your car being worked on — showed nothing.
 *   MEMBERSHIP      stuck at `pending`, so the club never appeared.
 *   INVOICE         none, so a finished visit had no papers behind it.
 *
 *   node scripts/seed-demo.mjs           # writes
 *   node scripts/seed-demo.mjs --dry     # prints what it would write
 *
 * Idempotent: every write is a `set(..., { merge: true })` on a deterministic
 * id, so running it twice changes nothing. It never deletes.
 */
import { readFileSync } from 'fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const DRY = process.argv.includes('--dry');
const EMAIL = process.env.DEMO_EMAIL ?? 'sheth871@gmail.com';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
);

const app = initializeApp({
  credential: cert({
    projectId: env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = getFirestore(app);
const auth = getAuth(app);

const now = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const plus = (days) => { const d = new Date(now); d.setDate(d.getDate() + days); return iso(d); };
const ts = (d) => Timestamp.fromDate(d instanceof Date ? d : new Date(d));

const wrote = [];
async function put(path, data) {
  wrote.push(path);
  if (DRY) return;
  await db.doc(path).set({ ...data, updatedAt: ts(now) }, { merge: true });
}

/* Studio photography. Unsplash is already whitelisted in next.config, and
   these are the same curated frames `lib/media.ts` uses — placeholders until
   real AutoModz shoots replace them, exactly as that file says. */
const shot = (id, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const user = await auth.getUserByEmail(EMAIL);
const uid = user.uid;
console.log(`\ndemo customer: ${EMAIL}  uid=${uid}${DRY ? '  (DRY RUN)' : ''}\n`);

/* ── 1 · THE CATALOGUE ────────────────────────────────────────────────────
   Production had NO services. Categories are the ones `os/proposal` maps a
   protection to (`PPF`, `Ceramic`, `Coating`) plus `Washing`, so a
   recommendation can resolve to something bookable. */
const SERVICES = [
  { id: 'svc-ppf-full', name: 'Paint protection film — full body', category: 'PPF',
    brand: 'LLumar', price: 145000, duration: 2880, warranty: '5 years', popular: true, order: 1,
    description: 'Every painted panel wrapped in self-healing film, cut to the car.' },
  { id: 'svc-ppf-front', name: 'Paint protection film — front', category: 'PPF',
    brand: 'LLumar', price: 48000, duration: 1440, warranty: '5 years', popular: false, order: 2,
    description: 'Bonnet, bumper, fenders and mirrors — the panels that take the road.' },
  { id: 'svc-ceramic', name: 'Ceramic coating', category: 'Ceramic',
    brand: 'Kovalent', price: 64000, duration: 300, warranty: '3 years', popular: true, order: 3,
    description: 'Paint corrected by hand, then a ceramic coat cured in the booth.' },
  { id: 'svc-ceramic-maint', name: 'Ceramic maintenance', category: 'Ceramic',
    brand: 'Kovalent', price: 8500, duration: 180, warranty: '', popular: false, order: 4,
    description: 'The coat decontaminated and topped, so its years run their course.' },
  { id: 'svc-glass', name: 'Glass coating', category: 'Coating',
    brand: 'Kovalent', price: 12000, duration: 150, warranty: '2 years', popular: false, order: 5,
    description: 'Windscreen and windows sealed — rain beads and leaves.' },
  { id: 'svc-interior', name: 'Interior deep clean', category: 'Coating',
    brand: '', price: 9500, duration: 240, warranty: '', popular: false, order: 6,
    description: 'Every surface lifted, leather fed, glass finished last.' },
  { id: 'svc-wash', name: 'Maintenance wash', category: 'Washing',
    brand: '', price: 1200, duration: 75, warranty: '', popular: true, order: 7,
    description: 'A wash for cars already protected here.' },
];
for (const s of SERVICES) {
  await put(`services/${s.id}`, { ...s, active: true, createdAt: ts('2025-01-01') });
}

/* ── 2 · THE CARS, AND WHAT PROTECTS THEM ─────────────────────────────────
   The four cars already exist; this gives them the layers a real owner
   would have. Different states on purpose, so Home demonstrates the
   product rather than one happy path. */
const vs = await db.collection('users').doc(uid).collection('vehicles').get();
const byName = Object.fromEntries(vs.docs.map(d => [d.data().name, d.id]));
console.log('cars:', Object.entries(byName).map(([n, id]) => `${n}=${id}`).join(', '));

const protection = (id, vehicleId, kind, term, extra = {}) =>
  put(`protections/${id}`, {
    id, vehicleId, kind, term, termsSource: 'captured',
    createdAt: ts('2025-06-01'), ...extra,
  });

const seltos = byName['Kia Seltos'];
const bmw = byName['BMW'];
const defender = byName['Defender'];
const i20 = byName['I20 NLine'];

if (seltos) {
  /* The car currently in care. Fully protected, one layer worth watching. */
  await protection('prot-seltos-ppf', seltos, 'ppf', { kind: 'perpetual' },
    { provider: 'LLumar', plan: 'Gloss', coverage: 'Full body', since: '2025-08-14' });
  await protection('prot-seltos-ceramic', seltos, 'ceramic', { kind: 'dated', expiresOn: plus(46) },
    { provider: 'Kovalent', plan: 'Prolong', coverage: 'Paint', since: '2025-08-14' });
  await protection('prot-seltos-glass', seltos, 'glass', { kind: 'dated', expiresOn: plus(410) },
    { provider: 'Kovalent', coverage: 'All glass', since: '2026-07-20' });
  await protection('prot-seltos-insurance', seltos, 'insurance', { kind: 'dated', expiresOn: plus(122) },
    { provider: 'ICICI Lombard', plan: 'Comprehensive', termsSource: 'declared' });
  await protection('prot-seltos-puc', seltos, 'puc', { kind: 'dated', expiresOn: plus(19) },
    { termsSource: 'declared' });
  await protection('prot-seltos-rc', seltos, 'rc', { kind: 'perpetual' }, { termsSource: 'declared' });
  await protection('prot-seltos-fastag', seltos, 'fastag', { kind: 'balance', value: 640, low: 500 },
    { provider: 'HDFC', termsSource: 'declared' });
}
if (bmw) {
  /* The booked car — protected, nothing urgent. */
  await protection('prot-bmw-ceramic', bmw, 'ceramic', { kind: 'dated', expiresOn: plus(690) },
    { provider: 'Kovalent', plan: 'Prolong', coverage: 'Paint', since: '2026-02-02' });
  await protection('prot-bmw-interior', bmw, 'interior', { kind: 'dated', expiresOn: plus(300) },
    { coverage: 'Leather and trim', since: '2026-02-02' });
  await protection('prot-bmw-insurance', bmw, 'insurance', { kind: 'dated', expiresOn: plus(240) },
    { provider: 'Bajaj Allianz', plan: 'Comprehensive', termsSource: 'declared' });
}
if (defender) {
  /* The car that needs attention — its paint is bare and its PUC is out.
     This is what makes the recommendation on Home legitimate. */
  await protection('prot-defender-puc', defender, 'puc', { kind: 'dated', expiresOn: plus(-8) },
    { termsSource: 'declared' });
  await protection('prot-defender-insurance', defender, 'insurance', { kind: 'dated', expiresOn: plus(58) },
    { provider: 'HDFC Ergo', plan: 'Comprehensive', termsSource: 'declared' });
}
if (i20) {
  /* 22 days puts this in the term engine's `waning` band (8–30), which is
     the ONLY thing that makes `os/proposal` speak. The recommendation on Home
     is therefore real reasoning about a real coat, not copy written to fill a
     section — and it disappears by itself once the coat is renewed. */
  await protection('prot-i20-ceramic', i20, 'ceramic', { kind: 'dated', expiresOn: plus(22) },
    { provider: 'Kovalent', coverage: 'Paint', since: '2025-11-10' });
  await protection('prot-i20-warranty', i20, 'warranty', { kind: 'dated', expiresOn: plus(520) },
    { provider: 'Hyundai', plan: 'Manufacturer', termsSource: 'declared' });
}

/* ── 3 · THE VISIT HAPPENING NOW ──────────────────────────────────────────
   `R5wpXq08ytxLIxxAR65g` is in progress on the Seltos and its job carried no
   photographs, so Home's live experience had nothing to show. */
const LIVE_BOOKING = 'R5wpXq08ytxLIxxAR65g';
const liveJob = (await db.collection('jobs').where('bookingId', '==', LIVE_BOOKING).get()).docs[0];
if (liveJob) {
  await put(`jobs/${liveJob.id}`, {
    photos: [
      { url: shot('photo-1618843479313-40f8afb4b4d8'), kind: 'before' },
      { url: shot('photo-1601362840469-51e4d8d58785'), kind: 'during' },
      { url: shot('photo-1520340356584-f9917d1eea6f'), kind: 'during' },
    ],
    notes: 'Paint decontaminated and corrected by hand. Film going on panel by panel.',
  });
  console.log(`live job ${liveJob.id}: 3 studio photographs`);
}

/* ── 4 · WHAT IS ALREADY DONE ─────────────────────────────────────────────
   The completed Glass Coating gets its photographs and its papers, so the
   record and the receipt behind it are both real. */
const DONE_BOOKING = 'bobpS34tY0JlesdtH0cd';
const doneJob = (await db.collection('jobs').where('bookingId', '==', DONE_BOOKING).get()).docs[0];
if (doneJob) {
  await put(`jobs/${doneJob.id}`, {
    photos: [
      { url: shot('photo-1580273916550-e323be2ae537'), kind: 'before' },
      { url: shot('photo-1600661653561-629509216228'), kind: 'during' },
      { url: shot('photo-1617531653332-bd46c24f2068'), kind: 'after' },
    ],
    notes: 'Glass polished, then sealed. Cured overnight before handover.',
  });
  console.log(`completed job ${doneJob.id}: 3 photographs`);
}

/* ── 4b · THE RECORD ──────────────────────────────────────────────────────
   `visitsOf` reads SEALED VISIT documents, and production had none — so no
   car had a life, on Home or in History, however many bookings it had
   completed. A completed booking is not a visit; `sealVisit` makes one, and
   these are what that would have produced. */
const visit = (id, vehicleId, on, services, stages, terms, amounts, bookingId) =>
  put(`visits/${id}`, {
    id, vehicleId, locationId: 'maninagar', source: 'requested', authoredBy: 'studio',
    services, amounts, stages, termsCaptured: terms,
    status: 'sealed', sealedAt: ts(`${on}T18:00:00Z`), bookingId,
    createdAt: ts(`${on}T09:00:00Z`),
  });

const svc = (serviceId, name, category, price) => ({ serviceId, name, category, price });
const stage = (name, on, note, media = []) => ({ stage: name, at: ts(on), note, media });
const photo = (url) => ({ kind: 'photo', url });

if (seltos) {
  await visit('vis-demo-glass', seltos, '2026-07-20',
    [svc('svc-glass', 'Glass coating', 'Coating', 12000), svc('svc-wash', 'Maintenance wash', 'Washing', 1200)],
    [stage('ready', '2026-07-20T17:00:00Z', 'Glass polished, then sealed. Cured overnight before handover.',
      [photo(shot('photo-1580273916550-e323be2ae537')), photo(shot('photo-1617531653332-bd46c24f2068'))])],
    [{ kind: 'glass', term: { kind: 'dated', expiresOn: plus(410) }, source: 'captured' }],
    { subtotal: 13200, discount: 1980, total: 13240 }, DONE_BOOKING);

  await visit('vis-demo-ppf', seltos, '2025-08-14',
    [svc('svc-ppf-full', 'Paint protection film — full body', 'PPF', 145000)],
    [stage('ready', '2025-08-16T16:00:00Z', 'Every panel wrapped. Edges wrapped in, not cut at the line.',
      [photo(shot('photo-1618843479313-40f8afb4b4d8')), photo(shot('photo-1600661653561-629509216228'))])],
    [{ kind: 'ppf', term: { kind: 'perpetual' }, source: 'captured' }],
    { subtotal: 145000, discount: 0, total: 145000 }, '');

  await visit('vis-demo-ceramic', seltos, '2025-08-14',
    [svc('svc-ceramic', 'Ceramic coating', 'Ceramic', 64000)],
    [stage('ready', '2025-08-14T18:00:00Z', 'Two-stage correction by hand, then the coat, cured overnight.',
      [photo(shot('photo-1601362840469-51e4d8d58785'))])],
    [{ kind: 'ceramic', term: { kind: 'dated', expiresOn: plus(46) }, source: 'captured' }],
    { subtotal: 64000, discount: 9600, total: 54400 }, '');
}

if (bmw) {
  await visit('vis-demo-bmw-ceramic', bmw, '2026-02-02',
    [svc('svc-ceramic', 'Ceramic coating', 'Ceramic', 64000),
     svc('svc-interior', 'Interior deep clean', 'Coating', 9500)],
    [stage('ready', '2026-02-02T18:00:00Z', 'Paint corrected, coated and cured. Interior lifted and the leather fed.',
      [photo(shot('photo-1503736334956-4c8f8e92946d'))])],
    [{ kind: 'ceramic', term: { kind: 'dated', expiresOn: plus(690) }, source: 'captured' }],
    { subtotal: 73500, discount: 11025, total: 62475 }, '');
}

await put(`invoices/inv-demo-glass`, {
  id: 'inv-demo-glass',
  userId: uid,
  bookingId: DONE_BOOKING,
  jobId: doneJob?.id ?? '',
  visitId: 'vis-demo-glass',
  number: 'AM-2026-0184',
  items: [
    { name: 'Glass coating', qty: 1, rate: 12000, amount: 12000 },
    { name: 'Maintenance wash', qty: 1, rate: 1200, amount: 1200 },
  ],
  subtotal: 13200,
  discount: 1980,
  discountLabel: 'Gold member 15% off',
  tax: 2020,
  total: 13240,
  paymentStatus: 'paid',
  paymentMethod: 'upi',
  publicToken: 'demo-glass-0184',
  issuedOn: '2026-07-20',
  createdAt: ts('2026-07-20'),
});

/* ── 5 · THE CLUB ─────────────────────────────────────────────────────────
   The subscription existed but sat at `pending`, so it never counted as a
   membership anywhere — no washes, no discount, no club on Home. */
const subs = await db.collection('subscriptions').where('userId', '==', uid).get();
const sub = subs.docs[0];
if (sub) {
  await put(`subscriptions/${sub.id}`, {
    plan: 'Gold',
    status: 'active',
    startDate: plus(-24),
    endDate: plus(6),
    washesUsed: 6,
    washesIncluded: 8,
    userName: user.displayName ?? 'Meet Sheth',
    userEmail: EMAIL,
  });
  console.log(`membership ${sub.id}: Gold, active, 2 of 8 washes left`);
}

/* ── 6 · THE MARKET ───────────────────────────────────────────────────────
   One listing already exists. Two more so the discovery rail can be judged
   with more than a single card in it. THESE ARE PUBLICLY VISIBLE on /cars. */
const LISTINGS = [
  { id: 'demo-listing-city', title: '2019 Honda City VX', make: 'Honda', model: 'City',
    year: 2019, price: 920000, kmDriven: 52000, fuel: 'petrol', transmission: 'manual',
    ownership: 2, color: 'Silver', featured: false,
    description: 'Second owner, serviced with us since 2022. Ceramic coated last year.',
    photos: [{ url: shot('photo-1494976388531-d1058494cdd8'), path: 'demo/city' }] },
  { id: 'demo-listing-creta', title: '2021 Hyundai Creta SX', make: 'Hyundai', model: 'Creta',
    year: 2021, price: 1450000, kmDriven: 38000, fuel: 'petrol', transmission: 'automatic',
    ownership: 1, color: 'White', featured: true,
    description: 'Single owner. Full paint protection film from new.',
    photos: [{ url: shot('photo-1583121274602-3e2820c69888'), path: 'demo/creta' }] },
];
for (const l of LISTINGS) {
  await put(`carListings/${l.id}`, { ...l, status: 'available', active: true, createdAt: ts('2026-06-01') });
}

console.log(`\n${DRY ? 'would write' : 'wrote'} ${wrote.length} documents`);
console.log(wrote.map(w => '  ' + w).join('\n'));
process.exit(0);
