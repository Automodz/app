/**
 * PRODUCTION INTEGRITY — READ ONLY. This script writes nothing, ever.
 *
 * The audit's findings were about data, not code: 15 of 18 jobs with no
 * customer, bookings carrying another car's plate, three requests sitting
 * `pending` seventeen days past their day, `protections.since` at 43%. Code
 * that assumes those are fixed is code that fails quietly.
 *
 * So this asks production the questions the new subsystems depend on, and
 * reports what it finds. It is the read-only half of every migration: run it
 * BEFORE deciding whether a write is needed, and again after, and diff.
 *
 *   node scripts/verify-integrity.mjs
 *
 * Every check names the screen it protects, because a red line here is a
 * screen that will be wrong for a real customer.
 */
import { readFileSync } from 'fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map(l => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }));

const app = initializeApp({
  credential: cert({
    projectId: env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = getFirestore(app);

const rows = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
const pct = (n, of) => (of === 0 ? '—' : `${Math.round((n / of) * 100)}%`);

const findings = [];
const check = (ok, screen, line) => {
  findings.push({ ok, screen, line });
  console.log(`${ok ? '  ok ' : '  !! '}${screen.padEnd(10)} ${line}`);
};

const main = async () => {
  console.log('\nAUTOMODZ · production integrity · READ ONLY\n');

  const [users, vehicles, bookings, jobs, visits, protections, listings, services,
    estimates, approvals, payments, ratings] = await Promise.all([
    db.collection('users').get(),
    db.collectionGroup('vehicles').get(),
    db.collection('bookings').get(),
    db.collection('jobs').get(),
    db.collection('visits').get(),
    db.collection('protections').get(),
    db.collection('carListings').get(),
    db.collection('services').get(),
    db.collection('estimates').get().catch(() => ({ docs: [], size: 0 })),
    db.collection('approvals').get().catch(() => ({ docs: [], size: 0 })),
    db.collection('payments').get().catch(() => ({ docs: [], size: 0 })),
    db.collection('ratings').get().catch(() => ({ docs: [], size: 0 })),
  ]);

  console.log('counts');
  console.log(`  users ${users.size}  vehicles ${vehicles.size}  bookings ${bookings.size}`);
  console.log(`  jobs ${jobs.size}  visits ${visits.size}  protections ${protections.size}`);
  console.log(`  listings ${listings.size}  services ${services.size}`);
  console.log(`  estimates ${estimates.size}  approvals ${approvals.size}`
    + `  payments ${payments.size}  ratings ${ratings.size}\n`);

  const B = rows(bookings), J = rows(jobs), V = rows(visits), P = rows(protections);
  const L = rows(listings), S = rows(services);

  console.log('checks');

  /* ── ownership is by ID, never by plate (screens 04, 11, 14, 15) ── */
  const mismatched = B.filter(b => !b.vehicleId);
  check(mismatched.length === 0, '04/14/15',
    `bookings with no vehicleId: ${mismatched.length} of ${B.length}`);

  const jobsNoCustomer = J.filter(j => j.source === 'booking' && !j.customerId);
  check(jobsNoCustomer.length === 0, '04/11',
    `booking-jobs with no customerId: ${jobsNoCustomer.length}`);

  /* ── the 24-hour rule and the multi-day bay (screens 08, 09, 10) ── */
  const noEnd = B.filter(b => !b.endDate);
  check(true, '08/09',
    `bookings with no endDate (legacy, read as same-day): ${noEnd.length} of ${B.length}`);

  const stale = B.filter(b =>
    ['pending', 'confirmed'].includes(b.status)
    && b.scheduledDate < new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10));
  check(stale.length === 0, '10',
    `requests past their day and not yet expired: ${stale.length}`
    + (stale.length ? ` — the nightly sweep retires these` : ''));

  /* ── one calculation (screens 07, 09, 13) ── */
  const noBreakdown = B.filter(b => !b.breakdown);
  check(true, '09/13',
    `bookings with no stored breakdown (legacy): ${noBreakdown.length} of ${B.length}`);

  const scoped = S.filter(s => Array.isArray(s.scopes) && s.scopes.length > 0);
  check(true, '07',
    `services with coverages defined: ${scoped.length} of ${S.length}`
    + (scoped.length === 0 ? ' — every service is bookable whole until one is' : ''));

  /* ── protection percentages are measurements (screens 05, 14, 15, 17) ── */
  const withSince = P.filter(p => !!p.since);
  check(true, '05/15',
    `protections with a start date: ${withSince.length} of ${P.length} (${pct(withSince.length, P.length)})`);

  const dated = P.filter(p => p.term?.kind === 'dated');
  const measurable = dated.filter(p => !!p.since);
  check(true, '17',
    `protections a PUBLIC listing could quote a % for: ${measurable.length} of ${P.length}`);

  /* ── the seal (screens 11, 13, 15) ── */
  const completed = J.filter(j => j.status === 'completed');
  const sealed = V.filter(v => v.status === 'sealed');
  const sealedWithJob = sealed.filter(v => !!v.jobId);
  check(true, '11/13/15',
    `completed jobs ${completed.length} · sealed visits ${sealed.length}`
    + ` · of which carry a jobId ${sealedWithJob.length}`);

  /* ── the consent boundary (screen 17) ── */
  const linked = L.filter(l => l.vehicleId && l.vehicleOwnerId);
  check(true, '17', `listings linked to a car: ${linked.length} of ${L.length}`);

  let published = 0;
  let brokenLinks = 0;
  for (const l of linked) {
    const v = await db.doc(`users/${l.vehicleOwnerId}/vehicles/${l.vehicleId}`).get();
    if (!v.exists) { brokenLinks++; continue; }
    if (v.data()?.publicHistoryConsent?.granted === true) published++;
  }
  check(brokenLinks === 0, '17',
    `linked listings whose car is NOT in the stated garage: ${brokenLinks}`);
  check(true, '17',
    `listings whose owner has consented to publish: ${published} of ${linked.length}`);

  const halfLinked = L.filter(l => Boolean(l.vehicleId) !== Boolean(l.vehicleOwnerId));
  check(halfLinked.length === 0, '17', `half-linked listings: ${halfLinked.length}`);

  /* ── the new objects, and whether anything is orphaned ── */
  const orphanApprovals = rows(approvals).filter(a => !a.customerId || !a.jobId);
  check(orphanApprovals.length === 0, '12',
    `approvals with no customer or no job: ${orphanApprovals.length}`);

  const orphanPayments = rows(payments).filter(p => !p.customerId);
  check(orphanPayments.length === 0, '13',
    `payments with no customer: ${orphanPayments.length}`);

  const badRatings = rows(ratings).filter(r => r.id !== r.visitId);
  check(badRatings.length === 0, '13',
    `ratings whose id is not their visit: ${badRatings.length}`);

  const openEstimates = rows(estimates).filter(e => e.status === 'open');
  check(true, '07', `estimates still open: ${openEstimates.length} of ${estimates.size}`);

  /* ── GST stays absent while the studio is unregistered ── */
  const withTax = B.filter(b => b.breakdown?.tax);
  check(withTax.length === 0, '13',
    `bookings carrying a tax block while GSTIN is empty: ${withTax.length}`);

  /* ── summary ── */
  const bad = findings.filter(f => !f.ok);
  console.log(`\n${bad.length === 0 ? 'CLEAN' : `${bad.length} finding(s)`}`);
  for (const f of bad) console.log(`  · ${f.screen} ${f.line}`);
  console.log('\nNothing was written.\n');
  process.exit(bad.length === 0 ? 0 : 1);
};

main().catch(e => {
  console.error('\nCould not complete the read:', e.message, '\n');
  process.exit(2);
});
