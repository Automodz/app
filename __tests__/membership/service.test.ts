/**
 * THE CLUB, AS A SERVER-AUTHORITATIVE LIFECYCLE.
 *
 * One fact is being defended: a customer may ASK to be in the Club and may not
 * PUT themselves in it. Everything below is a way of trying to, and failing.
 *
 * The fake database models the shape the Admin SDK presents — documents, a
 * where-query, and a transaction whose reads all precede its writes.
 * `firebase-admin` cannot be imported under Jest (ESM `jose`), and the
 * emulator matrix is what proves the rules; this proves the decisions.
 */
type Row = Record<string, unknown>;

const store = new Map<string, Row>();
const writes: { op: 'create' | 'update'; path: string; data: Row }[] = [];

const snapOf = (path: string) => ({
  id: path.split('/').pop() as string,
  exists: store.has(path),
  data: () => store.get(path),
  ref: refOf(path),
});
function refOf(path: string) {
  return {
    id: path.split('/').pop() as string,
    path,
    get: async () => snapOf(path),
    /* The nightly sweep writes outside a transaction, one document at a time,
       so the reference has to answer for that too. */
    update: async (data: Row) => {
      store.set(path, { ...(store.get(path) ?? {}), ...data });
      writes.push({ op: 'update', path, data });
    },
  };
}
const runQuery = (q: { collection: string; field: string; value: unknown }) => ({
  docs: [...store.entries()]
    .filter(([p, d]) => p.startsWith(`${q.collection}/`) && !p.slice(q.collection.length + 1).includes('/')
      && d[q.field] === q.value)
    .map(([p]) => snapOf(p)),
});
const queryOf = (collection: string, field: string, value: unknown) => ({
  __query: true as const,
  collection,
  field,
  value,
  /* A query is awaitable outside a transaction too — the nightly sweep reads
     it directly, and modelling that is what caught it being missing here. */
  get: async () => runQuery({ collection, field, value }),
});

const collectionOf = (name: string) => ({
  doc: (id: string) => refOf(`${name}/${id}`),
  where: (field: string, _op: string, value: unknown) => queryOf(name, field, value),
  get: async () => ({
    docs: [...store.keys()]
      .filter(p => p.startsWith(`${name}/`) && !p.slice(name.length + 1).includes('/'))
      .map(p => snapOf(p)),
  }),
});

let wrote = false;
const tx = {
  get: async (t: { path?: string; __query?: true; collection?: string; field?: string; value?: unknown }) => {
    if (wrote) throw new Error('a transaction may not read after it has written');
    return t.__query
      ? runQuery(t as { collection: string; field: string; value: unknown })
      : snapOf(t.path as string);
  },
  create: (ref: { path: string }, data: Row) => {
    wrote = true;
    if (store.has(ref.path)) throw new Error(`ALREADY_EXISTS: ${ref.path}`);
    store.set(ref.path, data);
    writes.push({ op: 'create', path: ref.path, data });
  },
  update: (ref: { path: string }, data: Row) => {
    wrote = true;
    store.set(ref.path, { ...(store.get(ref.path) ?? {}), ...data });
    writes.push({ op: 'update', path: ref.path, data });
  },
};

const adminDb = {
  doc: (path: string) => refOf(path),
  collection: collectionOf,
  runTransaction: async <T>(fn: (t: typeof tx) => Promise<T>): Promise<T> => {
    wrote = false;
    return fn(tx);
  },
};

jest.mock('@/lib/server/firebaseAdmin', () => ({ adminDb, adminAuth: null }));
jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => '<server-time>' },
  Timestamp: { fromDate: (d: Date) => ({ toMillis: () => d.getTime(), toDate: () => d }) },
}));

import {
  joinMembership, claimMembershipPayment, cancelMembership, decideMembership,
  startMembershipForCustomer, expireLapsedMemberships, MembershipError,
} from '@/lib/server/membershipService';
import { MEMBERSHIP_PLANS } from '@/lib/types';

const NOW = new Date('2026-08-12T09:00:00Z');
const SILVER = MEMBERSHIP_PLANS.find(p => p.id === 'Silver')!;
const GOLD = MEMBERSHIP_PLANS.find(p => p.id === 'Gold')!;

/* The studio's day, which is what the service derives from. */
const TODAY = '2026-08-12';

beforeEach(() => {
  store.clear();
  writes.length = 0;
  wrote = false;
  store.set('users/u1', { role: 'customer', name: 'Aarav', email: 'a@x.com', phone: '9000000001' });
  store.set('users/u2', { role: 'customer', name: 'Other' });
  store.set('users/staff', { role: 'employee', name: 'Technician' });
  store.set('users/boss', { role: 'admin' });
});

const failure = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return { code: '<no error>', status: 0 };
  } catch (e) {
    if (e instanceof MembershipError) return { code: e.code, status: e.status };
    throw e;
  }
};

const subs = () => [...store.keys()].filter(k => k.startsWith('subscriptions/'));
const sub = (id: string) => store.get(`subscriptions/${id}`) as Row;

/* ── JOINING ─────────────────────────────────────────────────────────────── */

describe('asking to join', () => {
  it('EVERY TERM IS DERIVED — the request carries a plan name and nothing else', async () => {
    const r = await joinMembership('u1', { plan: 'Silver', paymentMethod: 'upi' }, NOW);
    expect(r).toMatchObject({ status: 'pending', act: 'join', amountDue: SILVER.price, replay: false });
    expect(sub(r.subscriptionId)).toMatchObject({
      userId: 'u1',
      plan: 'Silver',
      status: 'pending',
      startDate: TODAY,
      endDate: '2026-09-11',
      washesTotal: SILVER.washesPerMonth,
      washesIncluded: SILVER.washesPerMonth,
      washesUsed: 0,
      amountDue: SILVER.price,
      paymentMethod: 'upi',
    });
  });

  it('A FORGED PAYLOAD CHANGES NOTHING. Every field it hopes to set is derived', async () => {
    const r = await joinMembership('u1', {
      plan: 'Silver',
      paymentMethod: 'upi',
      /* the whole old payload, offered at once */
      status: 'active',
      washesTotal: 999,
      washesIncluded: 999,
      washesUsed: -50,
      startDate: '2020-01-01',
      endDate: '2099-12-31',
      amountDue: 1,
      amountPaid: 1,
      paidAt: new Date(0),
      userId: 'u2',
      userName: 'Somebody Else',
    } as never, NOW);

    const stored = sub(r.subscriptionId);
    expect(stored).toMatchObject({
      status: 'pending',
      washesTotal: SILVER.washesPerMonth,
      washesUsed: 0,
      startDate: TODAY,
      endDate: '2026-09-11',
      amountDue: SILVER.price,
      /* The uid is the SESSION's, and the name is the PROFILE's. */
      userId: 'u1',
      userName: 'Aarav',
    });
    expect(stored.amountPaid).toBeUndefined();
    expect(stored.paidAt).toBeUndefined();
  });

  it('a plan that is not in the catalogue is not a plan', async () => {
    expect(await failure(() => joinMembership('u1', { plan: 'Diamond', paymentMethod: 'upi' }, NOW)))
      .toEqual({ code: 'plan-unknown', status: 400 });
    expect(await failure(() => joinMembership('u1', { plan: null, paymentMethod: 'upi' }, NOW)))
      .toEqual({ code: 'plan-unknown', status: 400 });
    expect(subs()).toEqual([]);
  });

  it('and a payment method that is not one either', async () => {
    expect(await failure(() => joinMembership('u1', { plan: 'Silver', paymentMethod: 'crypto' }, NOW)))
      .toEqual({ code: 'payment-method-invalid', status: 400 });
  });

  it('THE SAME REQUEST TWICE writes one record', async () => {
    const a = await joinMembership('u1', { plan: 'Silver', paymentMethod: 'upi' }, NOW);
    const b = await joinMembership('u1', { plan: 'Silver', paymentMethod: 'upi' }, NOW);
    expect(b.subscriptionId).toBe(a.subscriptionId);
    expect(b.replay).toBe(true);
    expect(subs()).toHaveLength(1);
  });

  it('a SECOND open request is refused — the studio answers one at a time', async () => {
    await joinMembership('u1', { plan: 'Silver', paymentMethod: 'upi' }, NOW);
    expect(await failure(() => joinMembership('u1', { plan: 'Gold', paymentMethod: 'upi' }, NOW)))
      .toEqual({ code: 'already-pending', status: 409 });
    expect(subs()).toHaveLength(1);
  });
});

describe('upgrading, renewing, and the ways round a cycle', () => {
  const activate = async (id: string) =>
    decideMembership('staff', { subscriptionId: id, decision: 'activate' }, NOW);

  it('an UPGRADE is allowed, and names what it will replace', async () => {
    const first = await joinMembership('u1', { plan: 'Silver', paymentMethod: 'cash' }, NOW);
    await activate(first.subscriptionId);
    const up = await joinMembership('u1', { plan: 'Gold', paymentMethod: 'cash' }, NOW);
    expect(up.act).toBe('upgrade');
    expect(sub(up.subscriptionId).supersedesId).toBe(first.subscriptionId);
    expect(up.amountDue).toBe(GOLD.price);
  });

  it('A DOWNGRADE MID-CYCLE IS REFUSED — it is a way to restart a cycle early', async () => {
    const g = await joinMembership('u1', { plan: 'Gold', paymentMethod: 'cash' }, NOW);
    await activate(g.subscriptionId);
    expect(await failure(() => joinMembership('u1', { plan: 'Silver', paymentMethod: 'cash' }, NOW)))
      .toEqual({ code: 'already-a-member', status: 409 });
  });

  it('and so is re-joining the SAME plan while it is running', async () => {
    const s = await joinMembership('u1', { plan: 'Silver', paymentMethod: 'cash' }, NOW);
    await activate(s.subscriptionId);
    /* A different day, so the id differs and only the rule can refuse it. */
    const later = new Date('2026-08-20T09:00:00Z');
    expect(await failure(() => joinMembership('u1', { plan: 'Silver', paymentMethod: 'cash' }, later)))
      .toEqual({ code: 'already-a-member', status: 409 });
  });

  it('a cycle that has RUN OUT may be renewed, and it is a new record', async () => {
    const s = await joinMembership('u1', { plan: 'Silver', paymentMethod: 'cash' }, NOW);
    await activate(s.subscriptionId);
    /* Well past the cycle and its grace week. */
    const later = new Date('2026-10-01T09:00:00Z');
    const again = await joinMembership('u1', { plan: 'Silver', paymentMethod: 'cash' }, later);
    expect(again.act).toBe('renew');
    expect(again.subscriptionId).not.toBe(s.subscriptionId);
    expect(subs()).toHaveLength(2);
    /* THE OLD CYCLE KEEPS ITS OWN DATES AND ITS OWN REVENUE. */
    expect(sub(s.subscriptionId)).toMatchObject({
      startDate: TODAY, endDate: '2026-09-11', amountPaid: SILVER.price,
    });
  });
});

/* ── ACTIVATION ──────────────────────────────────────────────────────────── */

describe('who may put a customer in the Club', () => {
  const pending = async () =>
    (await joinMembership('u1', { plan: 'Silver', paymentMethod: 'upi' }, NOW)).subscriptionId;

  it('THE CUSTOMER CANNOT ACTIVATE THEIR OWN', async () => {
    const id = await pending();
    expect(await failure(() => decideMembership('u1', { subscriptionId: id, decision: 'activate' }, NOW)))
      .toEqual({ code: 'not-yours-to-make', status: 403 });
    expect(sub(id).status).toBe('pending');
  });

  it('nor can another customer, nor an account with no profile', async () => {
    const id = await pending();
    for (const who of ['u2', 'ghost']) {
      expect(await failure(() => decideMembership(who, { subscriptionId: id, decision: 'activate' }, NOW)))
        .toEqual({ code: 'not-yours-to-make', status: 403 });
    }
  });

  it('staff may, and THAT is what grants the entitlement', async () => {
    const id = await pending();
    const r = await decideMembership('staff', { subscriptionId: id, decision: 'activate' }, NOW);
    expect(r.status).toBe('active');
    expect(sub(id)).toMatchObject({
      status: 'active', amountPaid: SILVER.price, startDate: TODAY, endDate: '2026-09-11',
    });
    expect(sub(id).paidAt).toBeDefined();
  });

  it('THE CYCLE STARTS WHEN THE MONEY IS SEEN, not when the request was typed', async () => {
    const id = await pending();
    /* Asked for on the 12th, paid for on the 20th. */
    await decideMembership('staff', { subscriptionId: id, decision: 'activate' }, new Date('2026-08-20T09:00:00Z'));
    expect(sub(id)).toMatchObject({ startDate: '2026-08-20', endDate: '2026-09-19' });
  });

  it('activating twice is refused, so revenue is counted once', async () => {
    const id = await pending();
    await decideMembership('staff', { subscriptionId: id, decision: 'activate' }, NOW);
    expect(await failure(() => decideMembership('staff', { subscriptionId: id, decision: 'activate' }, NOW)))
      .toEqual({ code: 'no-change', status: 409 });
  });

  it('a REFUSED membership can never be activated afterwards', async () => {
    const id = await pending();
    await decideMembership('staff', { subscriptionId: id, decision: 'reject', reason: 'No payment received.' }, NOW);
    expect(sub(id)).toMatchObject({ status: 'rejected', adminNotes: 'No payment received.' });
    expect(await failure(() => decideMembership('staff', { subscriptionId: id, decision: 'activate' }, NOW)))
      .toEqual({ code: 'already-rejected', status: 409 });
  });

  it('ONE STANDING MEMBERSHIP — activating an upgrade closes what it replaced', async () => {
    const first = (await joinMembership('u1', { plan: 'Silver', paymentMethod: 'cash' }, NOW)).subscriptionId;
    await decideMembership('staff', { subscriptionId: first, decision: 'activate' }, NOW);
    const up = (await joinMembership('u1', { plan: 'Gold', paymentMethod: 'cash' }, NOW)).subscriptionId;
    const r = await decideMembership('staff', { subscriptionId: up, decision: 'activate' }, NOW);

    expect(r.supersededId).toBe(first);
    expect(sub(first).status).toBe('cancelled');
    expect(sub(up).status).toBe('active');
    /* And the superseded one keeps every fact it was activated with. */
    expect(sub(first)).toMatchObject({ amountPaid: SILVER.price, plan: 'Silver' });
  });

  it('ACTIVATING ONE CLOSES EVERY OTHER OPEN REQUEST for that customer', async () => {
    /* `mayJoin` refuses a second open request going forward — but production
       already holds two for one customer, from before that rule existed. The
       studio has just answered the question; a second open request is one
       nobody will ask again, and the nightly job would nag about it daily. */
    const first = (await joinMembership('u1', { plan: 'Silver', paymentMethod: 'upi' }, NOW)).subscriptionId;
    /* A second, as the old code allowed — written straight into the store. */
    store.set('subscriptions/legacy-pending', {
      userId: 'u1', plan: 'Platinum', status: 'pending',
      startDate: TODAY, endDate: '2026-09-11', washesTotal: 16, washesUsed: 0,
    });

    await decideMembership('staff', { subscriptionId: first, decision: 'activate' }, NOW);

    expect(sub('legacy-pending')).toMatchObject({
      status: 'cancelled', adminNotes: `Superseded by ${first}`,
    });
    expect(sub(first).status).toBe('active');
  });

  it('but REFUSING one leaves the others alone — nothing was answered', async () => {
    const first = (await joinMembership('u1', { plan: 'Silver', paymentMethod: 'upi' }, NOW)).subscriptionId;
    store.set('subscriptions/legacy-pending', {
      userId: 'u1', plan: 'Platinum', status: 'pending', endDate: '2026-09-11',
    });
    await decideMembership('staff', { subscriptionId: first, decision: 'reject' }, NOW);
    expect(sub('legacy-pending').status).toBe('pending');
  });

  it('a decision that is neither, or on nothing, is refused', async () => {
    const id = await pending();
    expect(await failure(() => decideMembership('staff', { subscriptionId: id, decision: 'maybe' }, NOW)))
      .toEqual({ code: 'decision-invalid', status: 400 });
    expect(await failure(() => decideMembership('staff', { subscriptionId: '', decision: 'activate' }, NOW)))
      .toEqual({ code: 'subscription-required', status: 400 });
    expect(await failure(() => decideMembership('staff', { subscriptionId: 'ghost', decision: 'activate' }, NOW)))
      .toEqual({ code: 'not-found', status: 404 });
  });
});

/* ── THE CLAIM, AND LEAVING ──────────────────────────────────────────────── */

describe('saying you have paid', () => {
  it('records a reference and GRANTS NOTHING', async () => {
    const id = (await joinMembership('u1', { plan: 'Silver', paymentMethod: 'upi' }, NOW)).subscriptionId;
    const r = await claimMembershipPayment('u1', { subscriptionId: id, reference: ' upi-8891-2200 ' }, NOW);
    expect(r.status).toBe('pending');
    expect(sub(id)).toMatchObject({ status: 'pending', transactionId: 'UPI-8891-2200' });
  });

  it('another customer cannot speak for this one', async () => {
    const id = (await joinMembership('u1', { plan: 'Silver', paymentMethod: 'upi' }, NOW)).subscriptionId;
    expect(await failure(() => claimMembershipPayment('u2', { subscriptionId: id, reference: 'UPI-1' }, NOW)))
      .toEqual({ code: 'not-yours', status: 403 });
  });

  it('a reference that is not one is refused', async () => {
    const id = (await joinMembership('u1', { plan: 'Silver', paymentMethod: 'upi' }, NOW)).subscriptionId;
    expect(await failure(() => claimMembershipPayment('u1', { subscriptionId: id, reference: 'x' }, NOW)))
      .toEqual({ code: 'reference-invalid', status: 400 });
  });
});

describe('leaving', () => {
  it('the customer may leave their own, pending or running', async () => {
    const id = (await joinMembership('u1', { plan: 'Silver', paymentMethod: 'cash' }, NOW)).subscriptionId;
    expect((await cancelMembership('u1', { subscriptionId: id })).status).toBe('cancelled');
    expect(sub(id).status).toBe('cancelled');
  });

  it('but not somebody else’s', async () => {
    const id = (await joinMembership('u1', { plan: 'Silver', paymentMethod: 'cash' }, NOW)).subscriptionId;
    expect(await failure(() => cancelMembership('u2', { subscriptionId: id })))
      .toEqual({ code: 'not-yours', status: 403 });
  });

  it('and leaving twice is refused rather than written twice', async () => {
    const id = (await joinMembership('u1', { plan: 'Silver', paymentMethod: 'cash' }, NOW)).subscriptionId;
    await cancelMembership('u1', { subscriptionId: id });
    expect(await failure(() => cancelMembership('u1', { subscriptionId: id })))
      .toEqual({ code: 'already-cancelled', status: 409 });
  });
});

/* ── THE COUNTER, AND THE CLOCK ──────────────────────────────────────────── */

describe('the studio starting one at the counter', () => {
  it('is staff-only, and a customer naming a userId is refused', async () => {
    expect(await failure(() => startMembershipForCustomer('u1', { userId: 'u1', plan: 'Gold', paymentMethod: 'cash' }, NOW)))
      .toEqual({ code: 'not-yours-to-make', status: 403 });
    expect(await failure(() => startMembershipForCustomer('u1', { userId: 'u2', plan: 'Gold', paymentMethod: 'cash' }, NOW)))
      .toEqual({ code: 'not-yours-to-make', status: 403 });
    expect(subs()).toEqual([]);
  });

  it('derives the same terms, and records the revenue the console never did', async () => {
    const r = await startMembershipForCustomer('boss', { userId: 'u1', plan: 'Gold', paymentMethod: 'cash' }, NOW);
    expect(sub(r.subscriptionId)).toMatchObject({
      userId: 'u1', userName: 'Aarav', plan: 'Gold', status: 'active',
      startDate: TODAY, endDate: '2026-09-11',
      washesTotal: GOLD.washesPerMonth, amountDue: GOLD.price, amountPaid: GOLD.price,
    });
  });

  it('and closes anything the customer was already running', async () => {
    const first = (await joinMembership('u1', { plan: 'Silver', paymentMethod: 'cash' }, NOW)).subscriptionId;
    await decideMembership('staff', { subscriptionId: first, decision: 'activate' }, NOW);
    await startMembershipForCustomer('boss', { userId: 'u1', plan: 'Gold', paymentMethod: 'cash' }, NOW);
    expect(sub(first).status).toBe('cancelled');
  });

  it('a customer who does not exist is refused', async () => {
    expect(await failure(() => startMembershipForCustomer('boss', { userId: 'nobody', plan: 'Gold', paymentMethod: 'cash' }, NOW)))
      .toEqual({ code: 'customer-not-found', status: 404 });
  });
});

describe('the clock ends a cycle, and nobody else does', () => {
  it('expires exactly what has run out, and leaves the rest', async () => {
    const live = (await joinMembership('u1', { plan: 'Silver', paymentMethod: 'cash' }, NOW)).subscriptionId;
    await decideMembership('staff', { subscriptionId: live, decision: 'activate' }, NOW);
    store.set('subscriptions/old', {
      userId: 'u2', plan: 'Silver', status: 'active', endDate: '2026-08-01',
    });

    expect(await expireLapsedMemberships(NOW)).toBe(1);
    expect(sub('old').status).toBe('expired');
    expect(sub(live).status).toBe('active');
  });

  it('and a second sweep on the same day writes nothing', async () => {
    store.set('subscriptions/old', {
      userId: 'u2', plan: 'Silver', status: 'active', endDate: '2026-08-01',
    });
    await expireLapsedMemberships(NOW);
    writes.length = 0;
    expect(await expireLapsedMemberships(NOW)).toBe(0);
    expect(writes).toEqual([]);
  });
});
