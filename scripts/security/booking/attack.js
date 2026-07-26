/* THE BOOKING SERVICE, ATTACKED.
   Everything here runs against the real route, the real transaction and the
   real firestore.rules in the emulators. Run via ./run.sh. */
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const API = process.env.API || 'http://127.0.0.1:3199/api/booking/create';
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake';

const app = initializeApp({
  credential: cert({
    projectId: 'demo-automodz',
    clientEmail: 'test@demo-automodz.iam.gserviceaccount.com',
    privateKey: fs.readFileSync(__dirname + '/fake.pem', 'utf8'),
  }),
  projectId: 'demo-automodz',
});
const db = getFirestore(app);
const { TOMORROW, YESTERDAY } = JSON.parse(fs.readFileSync(__dirname + '/dates.json', 'utf8'));

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}  ${detail}`); }
};

const post = async (token, body) => {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};

const usedCount = async id => (await db.collection('promos').doc(id).get()).data().usedCount;
const sub = async id => (await db.collection('subscriptions').doc(id).get()).data();
const booking = async id => (await db.collection('bookings').doc(id).get()).data();
const job = async id => (await db.collection('jobs').doc(id).get()).data();
const countBookings = async uid =>
  (await db.collection('bookings').where('userId', '==', uid).get()).size;
const redemptions = async id =>
  (await db.collection('promoRedemptions').where('promoId', '==', id).get()).docs.map(d => d.data());

let n = 0;
const key = (tag) => `atk-${tag}-${++n}-aaaaaaaa`;

/* A FRESH DAY for every booking. The studio has one wash bay and one
   protection bay, so anything sharing a day competes - and slot contention
   would silently mask the money assertions. Section 12 tests contention on
   purpose, on days of its own. */
let dayIdx = 0;
const nextDay = () => new Date(Date.now() + (++dayIdx) * 86400000).toISOString().slice(0, 10);

const appt = (over = {}) => ({
  kind: 'appointment', vehicleId: 'carA', serviceId: 'svc-wash',
  scheduledDate: nextDay(), scheduledTime: '09:00',
  idempotencyKey: key('a'), ...over,
});

(async () => {
  const custom = JSON.parse(fs.readFileSync(__dirname + '/tokens.json', 'utf8'));
  const tok = {};
  for (const [uid, t] of Object.entries(custom)) {
    const r = await fetch(AUTH, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: t, returnSecureToken: true }),
    }).then(r => r.json());
    if (!r.idToken) throw new Error('no idToken for ' + uid + ': ' + JSON.stringify(r));
    tok[uid] = r.idToken;
  }

  console.log('\n1 · AUTHENTICATION AND AUTHORISATION');
  {
    let r = await post(null, appt());
    ok('no bearer token → 401', r.status === 401, JSON.stringify(r));
    r = await post('garbage', appt());
    ok('invalid token → 401', r.status === 401, JSON.stringify(r));
    r = await post(tok.custB, appt({ forUserId: 'custA' }));
    ok('customer cannot book for someone else → 403',
      r.status === 403 && r.json.error === 'forbidden', JSON.stringify(r));
    r = await post(tok.custA, {
      kind: 'walkin', customerName: 'Me', customerPhone: '9000000001',
      vehicleName: 'x', vehicleRegNo: 'y',
      items: [{ serviceId: 'svc-wash', serviceName: 'w', category: 'Washing', price: 1 }],
      byEmployee: { id: 'emp1', name: 'Kiosk' }, idempotencyKey: key('w'),
    });
    ok('customer cannot open a walk-in ticket → 403',
      r.status === 403 && r.json.error === 'staff-only', JSON.stringify(r));
  }

  console.log('\n2 · FORGED VEHICLE OWNERSHIP');
  {
    const before = await countBookings('custA');
    const r = await post(tok.custB, appt({ vehicleId: 'carA' }));
    ok("custB cannot book custA's car → 403",
      r.status === 403 && r.json.error === 'vehicle-not-yours', JSON.stringify(r));
    ok('  …and no booking appeared under custA', (await countBookings('custA')) === before);
    const r2 = await post(tok.custB, appt({ vehicleId: 'no-such-car' }));
    ok('an invented vehicleId is refused', r2.json.error === 'vehicle-not-yours', JSON.stringify(r2));
  }

  console.log('\n3 · MISMATCHED / RETIRED SERVICE IDS');
  {
    let r = await post(tok.custA, appt({ serviceId: 'no-such-service' }));
    ok('unknown serviceId → 404', r.status === 404 && r.json.error === 'unknown-service', JSON.stringify(r));
    r = await post(tok.custA, appt({ serviceId: 'svc-retired' }));
    ok('a retired service is refused', r.json.error === 'service-not-offered', JSON.stringify(r));
    r = await post(tok.custA, appt({ serviceId: 'svc-unpriced' }));
    ok('an unpriced service is refused', r.json.error === 'service-not-priced', JSON.stringify(r));
  }

  console.log('\n4 · FORGED TOTALS, DISCOUNTS AND PROMOS (the whole point)');
  {
    const r = await post(tok.custA, appt({
      serviceId: 'svc-ceramic',
      // every money field a client could dream of naming
      totalAmount: 1, serviceBasePrice: 1, finalAmount: 1, price: 1,
      discount: { source: 'promo', promoId: 'p-targeted', label: 'lol', amount: 11999 },
      discountAmount: 11999, promoId: 'p-targeted', usedMembershipWash: true,
      membershipId: 'sub-gold', status: 'completed', paymentStatus: 'verified',
    }));
    ok('request accepted', r.status === 200, JSON.stringify(r));
    const b = await booking(r.json.id);
    /* custA IS the target of p-targeted (50% of 12000), so the server's own
       answer is 6000 - not the 11999 the client asked for, and not full price. */
    ok('serviceBasePrice is the catalogue price', b.serviceBasePrice === 12000, String(b?.serviceBasePrice));
    ok('discount is the server\'s (₹6,000, 50% targeted promo)', b.discount?.amount === 6000, JSON.stringify(b.discount));
    ok('totalAmount is server arithmetic (₹6,000)', b.totalAmount === 6000, String(b.totalAmount));
    ok('status is pending, not the "completed" it asked for', b.status === 'pending', b.status);
    ok('paymentStatus is pending, not "verified"', b.paymentStatus === 'pending', b.paymentStatus);
    ok('no membership wash was granted to a non-member', b.usedMembershipWash === false, String(b.usedMembershipWash));
    ok('membershipId not carried over from the body', b.membershipId === undefined, String(b.membershipId));
    ok('the promo it spent was counted', (await usedCount('p-targeted')) === 1);
    const reds = await redemptions('p-targeted');
    ok('  …with one redemption, at the server\'s figure',
      reds.length === 1 && reds[0].discountAmount === 6000, JSON.stringify(reds));
  }

  console.log('\n5 · TARGETED PROMO CANNOT BE STOLEN OR RE-SPENT');
  {
    /* p-targeted was usageLimitTotal:1 and is now spent. custA books again: the
       one-use reward must not reappear (a general 25% promo legitimately may). */
    const r = await post(tok.custA, appt({ serviceId: 'svc-detail' }));
    ok('the second booking is accepted', r.status === 200, JSON.stringify(r.json));
    const b = await booking(r.json.id);
    ok('the spent one-use reward is not granted again',
      b.discount?.promoId !== 'p-targeted', JSON.stringify(b.discount));
    ok('  …the count did not move again', (await usedCount('p-targeted')) === 1);
    ok('  …and whatever WAS granted is arithmetically right',
      b.totalAmount === 2500 - (b.discount?.amount ?? 0),
      `${b.totalAmount} / ${JSON.stringify(b.discount)}`);

    const r2 = await post(tok.custB, appt({ vehicleId: 'carB', serviceId: 'svc-detail' }));
    ok("custB's booking is accepted", r2.status === 200, JSON.stringify(r2.json));
    const b2 = await booking(r2.json.id);
    ok("custB never receives custA's targeted promo",
      b2.discount?.promoId !== 'p-targeted', JSON.stringify(b2.discount));
  }

  console.log('\n6 · REPLAY');
  {
    const k = key('replay');
    const body = appt({ serviceId: 'svc-detail', idempotencyKey: k });
    const first = await post(tok.custA, body);
    const second = await post(tok.custA, body);
    const third = await post(tok.custA, body);
    ok('first POST creates', first.status === 200 && first.json.replayed === false, JSON.stringify(first.json));
    ok('replay returns the SAME booking', second.json.id === first.json.id, JSON.stringify(second.json));
    ok('  …flagged as a replay', second.json.replayed === true && third.json.replayed === true);
    const all = await db.collection('bookings')
      .where('userId', '==', 'custA').where('scheduledDate', '==', body.scheduledDate).get();
    ok('exactly one booking exists for that day', all.size === 1, String(all.size));
  }

  console.log('\n7 · CONCURRENT BOOKING');
  {
    // same key, fired eight times at once → one booking, seven replays
    const k = key('race');
    const body = appt({ serviceId: 'svc-detail', idempotencyKey: k });
    const rs = await Promise.all(Array.from({ length: 8 }, () => post(tok.custA, body)));
    const ids = new Set(rs.map(r => r.json.id));
    ok('8 simultaneous identical requests → 1 booking', ids.size === 1,
      JSON.stringify(rs.map(r => r.json.id)));
    ok('  …created exactly once', rs.filter(r => r.json.replayed === false).length === 1,
      JSON.stringify(rs.map(r => r.json.replayed)));

    // distinct keys against a 3-use promo → the limit holds under contention
    const before = await usedCount('p-three');
    ok('p-three starts at 0', before === 0, String(before));
    const rs2 = await Promise.all(Array.from({ length: 8 }, () =>
      post(tok.custB, appt({ vehicleId: 'carB', serviceId: 'svc-detail', idempotencyKey: key('r3') }))));
    const created = rs2.filter(r => r.status === 200);
    const withPromo = [];
    for (const r of created) {
      const b = await booking(r.json.id);
      if (b.discount?.source === 'promo') withPromo.push(b.discount.promoId);
    }
    const threes = withPromo.filter(p => p === 'p-three').length;
    ok('a 3-use promo is granted at most 3 times under 8-way contention',
      threes <= 3, `granted ${threes}`);
    ok('  …and usedCount equals the number granted',
      (await usedCount('p-three')) === threes, `${await usedCount('p-three')} vs ${threes}`);
  }

  console.log('\n8 · MEMBERSHIP — ACTIVE, EXPIRED, EXHAUSTED');
  {
    /* BEST-OF, never stacked. Gold is 15% (₹1,800); the open promo is 25%
       (₹3,000). The member must get the BETTER of the two, so the promo wins
       here - and the total must be exactly one of them, never their sum. */
    const r = await post(tok.gold, appt({ vehicleId: 'carG', serviceId: 'svc-ceramic' }));
    const b = await booking(r.json.id);
    ok('a member gets the BETTER of membership 15% and promo 25% (₹3,000 off)',
      b.discount?.amount === 3000 && b.totalAmount === 9000,
      `${b.totalAmount} ${JSON.stringify(b.discount)}`);
    ok('  …and never both (₹12,000 − 1,800 − 3,000 would be ₹7,200)',
      b.totalAmount !== 7200, String(b.totalAmount));

    /* Deactivate the better promo. The server reads promo state at booking
       time, so the very next request must fall back to the membership rate -
       nothing about the earlier decision is cached or carried. */
    const allPromos = await db.collection('promos').get();
    await Promise.all(allPromos.docs.map(d => d.ref.update({ active: false })));
    const rm = await post(tok.gold, appt({ vehicleId: 'carG', serviceId: 'svc-ceramic' }));
    const bm = await booking(rm.json.id);
    ok('with every promo switched off, the member falls back to 15% (₹10,200)',
      bm.discount?.source === 'membership' && bm.totalAmount === 10200,
      `${bm.totalAmount} ${JSON.stringify(bm.discount)}`);
    await Promise.all(allPromos.docs.map(d => d.ref.update({ active: d.data().active })));

    const r2 = await post(tok.lapsed, appt({ vehicleId: 'carL', serviceId: 'svc-detail' }));
    const b2 = await booking(r2.json.id);
    ok('an EXPIRED membership grants no percentage',
      b2.discount?.source !== 'membership', JSON.stringify(b2.discount));

    const r3 = await post(tok.lapsed, appt({
      vehicleId: 'carL', serviceId: 'svc-wash', useMembershipWash: true,
    }));
    const b3 = await booking(r3.json.id);
    ok('an EXPIRED membership cannot spend a wash',
      b3.usedMembershipWash === false && b3.totalAmount > 0,
      `${b3.usedMembershipWash} ${b3.totalAmount}`);
    ok('  …and no wash was deducted', (await sub('sub-lapsed')).washesUsed === 0);
  }

  console.log('\n9 · MEMBERSHIP WASH — SPENT ATOMICALLY, AND ONLY WHERE VALID');
  {
    const before = (await sub('sub-gold')).washesUsed;
    const r = await post(tok.gold, appt({
      vehicleId: 'carG', serviceId: 'svc-wash', useMembershipWash: true,
    }));
    const b = await booking(r.json.id);
    ok('a covered wash costs ₹0', b.totalAmount === 0, String(b.totalAmount));
    ok('  …is marked as covered', b.usedMembershipWash === true && !!b.membershipId, JSON.stringify(b.membershipId));
    ok('  …and deducted exactly one wash in the same commit',
      (await sub('sub-gold')).washesUsed === before + 1);
    ok('  …with no discount stacked on top', b.discount === undefined, JSON.stringify(b.discount));

    const r2 = await post(tok.gold, appt({
      vehicleId: 'carG', serviceId: 'svc-ceramic', useMembershipWash: true,
    }));
    const b2 = await booking(r2.json.id);
    ok('a wash cannot be spent on a CERAMIC',
      b2.usedMembershipWash === false
        && b2.totalAmount === 12000 - (b2.discount?.amount ?? 0),
      `${b2.usedMembershipWash} ${b2.totalAmount} ${JSON.stringify(b2.discount)}`);

    // drain the remaining washes, then prove the next one is charged
    const used = (await sub('sub-gold')).washesUsed;
    const total = (await sub('sub-gold')).washesTotal;
    for (let i = used; i < total; i++) {
      await post(tok.gold, appt({ vehicleId: 'carG', serviceId: 'svc-wash', useMembershipWash: true }));
    }
    ok('washes drain to exactly the allowance',
      (await sub('sub-gold')).washesUsed === total, String((await sub('sub-gold')).washesUsed));
    const r3 = await post(tok.gold, appt({
      vehicleId: 'carG', serviceId: 'svc-wash', useMembershipWash: true,
    }));
    const b3 = await booking(r3.json.id);
    ok('the wash after the last one is charged',
      b3.usedMembershipWash === false && b3.totalAmount > 0, `${b3.usedMembershipWash} ${b3.totalAmount}`);
    ok('  …and washesUsed never exceeded the total',
      (await sub('sub-gold')).washesUsed === total, String((await sub('sub-gold')).washesUsed));
  }

  console.log('\n10 · EXPIRED AND EXHAUSTED PROMOS');
  {
    ok('an expired promo is never granted',
      (await usedCount('p-expired')) === 0, String(await usedCount('p-expired')));
    ok('an exhausted promo is never granted again',
      (await usedCount('p-exhausted')) === 1, String(await usedCount('p-exhausted')));
    const reds = await redemptions('p-expired');
    ok('  …and neither wrote a redemption', reds.length === 0, JSON.stringify(reds));
  }

  console.log('\n11 · DUPLICATE REDEMPTION ACROSS DIFFERENT BOOKINGS');
  {
    /* p-percustomer allows one per customer. custB has been booking above;
       whatever they were granted, they can never hold two of it. */
    const reds = await redemptions('p-percustomer');
    const perUser = reds.reduce((m, r) => (m[r.userId] = (m[r.userId] ?? 0) + 1, m), {});
    ok('no customer holds more than one redemption of a per-customer promo',
      Object.values(perUser).every(v => v <= 1), JSON.stringify(perUser));
    ok('  …and usedCount equals the number of redemption documents',
      (await usedCount('p-percustomer')) === reds.length,
      `${await usedCount('p-percustomer')} vs ${reds.length}`);
  }

  console.log('\n12 · SLOTS');
  {
    const day = nextDay();
    const first = await post(tok.custA, appt({ serviceId: 'svc-ceramic', scheduledDate: day }));
    ok('an 8h ceramic takes the day', first.status === 200, JSON.stringify(first.json));
    const second = await post(tok.custB, appt({
      vehicleId: 'carB', serviceId: 'svc-ceramic', scheduledDate: day,
    }));
    ok('the same bay cannot be sold twice',
      second.json.error === 'slot-taken', JSON.stringify(second.json));

    let r = await post(tok.custA, appt({ scheduledDate: YESTERDAY }));
    ok('a slot in the past is refused', r.json.error === 'slot-in-the-past', JSON.stringify(r.json));
    r = await post(tok.custA, appt({ scheduledTime: '03:17' }));
    ok('a time the studio does not offer is refused', r.json.error === 'not-a-slot', JSON.stringify(r.json));
    r = await post(tok.custA, appt({ scheduledDate: 'lol' }));
    ok('a malformed date is refused', r.json.error === 'bad-slot', JSON.stringify(r.json));
  }

  console.log('\n13 · ATOMICITY — A REFUSAL COSTS NOTHING');
  {
    /* This request reaches the promo read and the pricing decision, then dies
       at the slot check. If the writes were not one commit, the count would
       have moved for a booking that does not exist. */
    const beforeOpen = await usedCount('p-open');
    const beforeGold = (await sub('sub-gold')).washesUsed;
    const beforeCount = (await db.collection('bookings').get()).size;
    const r = await post(tok.custA, appt({ scheduledDate: YESTERDAY, serviceId: 'svc-detail' }));
    ok('the request is refused', r.status >= 400, JSON.stringify(r.json));
    ok('  …no promo was counted', (await usedCount('p-open')) === beforeOpen);
    ok('  …no wash was spent', (await sub('sub-gold')).washesUsed === beforeGold);
    ok('  …no booking was written', (await db.collection('bookings').get()).size === beforeCount);
    const intents = await db.collection('bookingIntents').get();
    const orphan = [];
    for (const d of intents.docs) {
      const v = d.data();
      const ref = v.bookingId
        ? await db.collection('bookings').doc(v.bookingId).get()
        : await db.collection('jobs').doc(v.jobId).get();
      if (!ref.exists) orphan.push(d.id);
    }
    ok('every idempotency marker points at a record that exists',
      orphan.length === 0, JSON.stringify(orphan));
  }

  console.log('\n14 · WALK-IN (staff) — negotiated prices, server-decided benefits');
  {
    const r = await post(tok.staff1, {
      kind: 'walkin', customerId: 'custB',
      customerName: 'Customer B', customerPhone: '9000000002',
      vehicleName: 'Audi A4', vehicleRegNo: 'gj01cd5678',
      items: [
        { serviceId: 'svc-detail', serviceName: 'Detail SPA', category: 'Washing', price: 1800 },
        { serviceId: 'svc-wash', serviceName: 'Regular Wash', category: 'Washing', price: 400 },
      ],
      // the forged fields again, this time from a staff caller
      subtotal: 1, totalAmount: 1, discount: { source: 'promo', promoId: 'p-expired', label: 'x', amount: 9999 },
      byEmployee: { id: 'emp1', name: 'Kiosk' },
      idempotencyKey: key('walk'),
    });
    ok('staff may open a ticket', r.status === 200, JSON.stringify(r.json));
    const j = await job(r.json.id);
    ok('the counter\'s line prices stand (₹2,200 subtotal)', j.subtotal === 2200, String(j.subtotal));
    ok('the forged discount was ignored',
      j.discount?.promoId !== 'p-expired', JSON.stringify(j.discount));
    ok('total is server arithmetic',
      j.totalAmount === 2200 - (j.discount?.amount ?? 0), `${j.totalAmount} / ${JSON.stringify(j.discount)}`);
    ok('reg number normalised', j.vehicleRegNo === 'GJ01CD5678', j.vehicleRegNo);

    const r2 = await post(tok.staff1, {
      kind: 'walkin', customerName: 'Nobody', customerPhone: '9111111111',
      vehicleName: 'Nano', vehicleRegNo: 'GJ99ZZ0001',
      items: [{ serviceId: 'svc-wash', serviceName: 'Regular Wash', category: 'Washing', price: 400 }],
      byEmployee: { id: 'emp1', name: 'Kiosk' }, idempotencyKey: key('walk'),
    });
    ok('an accountless walk-in is accepted', r2.status === 200, JSON.stringify(r2.json));
    const crm = await db.collection('walkinCustomers').doc('9111111111').get();
    ok('  …and its CRM row was written in the same commit',
      crm.exists && crm.data().visits === 1, JSON.stringify(crm.data()));
    const j2 = await job(r2.json.id);
    ok('  …with no customer-targeted promo applied',
      j2.discount?.promoId !== 'p-targeted', JSON.stringify(j2.discount));

    const r3 = await post(tok.staff1, {
      kind: 'walkin', customerName: 'x', customerPhone: '9111111112',
      vehicleName: 'x', vehicleRegNo: 'x',
      items: [{ serviceId: 'svc-wash', serviceName: 'w', category: 'Washing', price: -5000 }],
      byEmployee: { id: 'emp1', name: 'Kiosk' }, idempotencyKey: key('walk'),
    });
    ok('a negative line price is refused', r3.json.error === 'bad-items', JSON.stringify(r3.json));

    const r4 = await post(tok.staff1, {
      kind: 'walkin', customerName: 'x', customerPhone: '9111111113',
      vehicleName: 'x', vehicleRegNo: 'x',
      items: [{ serviceId: 'svc-wash', serviceName: 'w', category: 'Washing', price: 400 }],
      byEmployee: { id: 'ghost', name: 'Ghost' }, idempotencyKey: key('walk'),
    });
    ok('an unknown operator is refused', r4.json.error === 'unknown-operator', JSON.stringify(r4.json));
  }

  console.log('\n15 · MALFORMED');
  {
    let r = await post(tok.custA, appt({ idempotencyKey: 'short' }));
    ok('a too-short idempotency key → 400', r.status === 400, JSON.stringify(r.json));
    r = await post(tok.custA, appt({ idempotencyKey: 'has spaces and $$$' }));
    ok('a key with junk characters → 400', r.status === 400, JSON.stringify(r.json));
    r = await post(tok.custA, appt({ vehicleId: '' }));
    ok('no vehicleId → 400', r.status === 400, JSON.stringify(r.json));
    r = await post(tok.custA, { kind: 'appointment' });
    ok('an empty intent → 400', r.status === 400, JSON.stringify(r.json));
    r = await post(tok.custA, appt({ pickup: true }));
    ok('pickup without an address → 400',
      r.json.error === 'pickup-address-required', JSON.stringify(r.json));
    r = await post(tok.custA, appt({ pickup: true, drop: true, pickupAddress: '12 Maninagar' }));
    const b = await booking(r.json.id);
    ok('pickup + drop priced at the studio\'s ₹50 a leg',
      b.pickupDropFee === 100 && b.totalAmount === b.pickupDropFee + (500 - (b.discount?.amount ?? 0)),
      `${b.pickupDropFee} ${b.totalAmount} ${JSON.stringify(b.discount)}`);
  }

  console.log('\n16 · THE WIRE — what the client actually receives');
  {
    const r = await post(tok.custA, appt({ serviceId: 'svc-detail' }));
    const b = r.json.booking;
    ok('the response carries the canonical booking', !!b && b.id === r.json.id, JSON.stringify(r.json).slice(0, 120));
    ok('  …priced by the server', b.totalAmount === 2500 - (b.discount?.amount ?? 0),
      `${b.totalAmount} ${JSON.stringify(b.discount)}`);
    /* Admin Timestamps serialise to {_seconds,_nanoseconds}: no `.seconds`, no
       `.toDate()`. The client wrapper revives them; this asserts the shape it
       has to revive FROM has not silently changed. */
    const secs = b.createdAt?._seconds ?? b.createdAt?.seconds;
    ok('  …with a timestamp the client can revive', typeof secs === 'number',
      JSON.stringify(b.createdAt));
    ok('  …and matching what was stored',
      (await booking(b.id)).totalAmount === b.totalAmount);
  }

  console.log('\n17 · CANCEL, THEN BOOK THE SAME SLOT AGAIN');
  {
    /* The idempotency key is DERIVED from the intent now, so it survives a
       reload - and a customer who cancels and changes their mind arrives with
       the very same key. A marker whose booking is cancelled must not swallow
       the second request. */
    const body = appt({ serviceId: 'svc-detail', idempotencyKey: key('cancel') });
    const first = await post(tok.custA, body);
    ok('the first booking is made', first.status === 200 && first.json.replayed === false,
      JSON.stringify(first.json));

    const same = await post(tok.custA, body);
    ok('  …replaying while it stands returns the same one',
      same.json.id === first.json.id && same.json.replayed === true, JSON.stringify(same.json));

    await db.collection('bookings').doc(first.json.id).update({ status: 'cancelled' });
    const again = await post(tok.custA, body);
    ok('after cancelling, the same intent books afresh',
      again.status === 200 && again.json.replayed === false && again.json.id !== first.json.id,
      JSON.stringify(again.json));
    ok('  …and the cancelled one is left alone',
      (await booking(first.json.id)).status === 'cancelled');
  }

  console.log('\n18 · MEDIA — signed upload, real delete');
  {
    const MEDIA_SIGN = API.replace('/booking/create', '/media/sign');
    const MEDIA_DEL = API.replace('/booking/create', '/media/delete');
    const call = async (url, token, payload) => {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      return { status: r.status, json: await r.json().catch(() => ({})) };
    };

    let r = await call(MEDIA_SIGN, null, { path: 'vehicles/custA-1' });
    ok('signing without a token → 401', r.status === 401, JSON.stringify(r));

    r = await call(MEDIA_SIGN, tok.custA, { path: 'gallery/anything' });
    ok('a customer cannot sign an upload into the studio gallery',
      r.status === 403, JSON.stringify(r));
    r = await call(MEDIA_SIGN, tok.custA, { path: 'vehicles/custB-sneaky' });
    ok("a customer cannot sign into another customer's namespace",
      r.status === 403, JSON.stringify(r));
    r = await call(MEDIA_SIGN, tok.custA, { path: '../../etc/passwd' });
    ok('path traversal is refused', r.status === 403, JSON.stringify(r));

    r = await call(MEDIA_SIGN, tok.custA, { path: 'vehicles/custA-123-abc' });
    ok('a customer CAN sign into their own vehicle folder', r.status === 200, JSON.stringify(r));
    ok('  …and the signature is bound to that exact public_id',
      r.json.publicId === 'vehicles/custA-123-abc' && typeof r.json.signature === 'string'
      && r.json.signature.length === 40, JSON.stringify(r.json).slice(0, 160));
    ok('  …and no secret is handed to the browser',
      !JSON.stringify(r.json).toLowerCase().includes('secret'), JSON.stringify(r.json).slice(0, 120));

    r = await call(MEDIA_SIGN, tok.staff1, { path: 'gallery/showcase-1' });
    ok('staff CAN sign into the studio gallery', r.status === 200, JSON.stringify(r));

    r = await call(MEDIA_DEL, tok.custA, { path: 'cloudinary:gallery/showcase-1' });
    ok('a customer cannot delete a studio image', r.status === 403, JSON.stringify(r));
    r = await call(MEDIA_DEL, tok.custA, { path: 'cloudinary:vehicles/custB-1' });
    ok("a customer cannot delete another customer's image", r.status === 403, JSON.stringify(r));
    r = await call(MEDIA_DEL, null, { path: 'cloudinary:vehicles/custA-1' });
    ok('deleting without a token → 401', r.status === 401, JSON.stringify(r));
    r = await call(MEDIA_DEL, tok.custA, {});
    ok('deleting with no path → 400', r.status === 400, JSON.stringify(r));
  }

  console.log('\n19 · LEDGER CONSISTENCY (whole-database invariants)');
  {
    const bs = await db.collection('bookings').get();
    const badTotals = [];
    for (const d of bs.docs) {
      const b = d.data();
      const expected = (b.usedMembershipWash ? 0 : b.serviceBasePrice - (b.discount?.amount ?? 0))
        + (b.pickupDropFee ?? 0);
      if (b.totalAmount !== expected) badTotals.push({ id: d.id, got: b.totalAmount, expected });
    }
    ok(`every one of ${bs.size} bookings recomputes to its stored total`,
      badTotals.length === 0, JSON.stringify(badTotals));

    const promoIds = ['p-open', 'p-targeted', 'p-percustomer', 'p-washonly', 'p-three'];
    const mismatch = [];
    for (const id of promoIds) {
      const c = await usedCount(id);
      const r = (await redemptions(id)).length;
      if (c !== r) mismatch.push({ id, usedCount: c, redemptions: r });
    }
    ok('every promo count equals its redemption documents',
      mismatch.length === 0, JSON.stringify(mismatch));

    const washBookings = bs.docs.filter(d => d.data().usedMembershipWash === true).length;
    ok('washes deducted equal bookings that used one',
      (await sub('sub-gold')).washesUsed === washBookings,
      `${(await sub('sub-gold')).washesUsed} vs ${washBookings}`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
