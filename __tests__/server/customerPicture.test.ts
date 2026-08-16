/**
 * The server read. Ownership is enforced HERE, not by rules: the Admin SDK
 * bypasses them entirely, so every query must be filtered by the uid from the
 * verified session. These assertions are the only thing standing between one
 * customer and another's garage.
 */
const calls: { path: string; wheres: [string, string, unknown][] }[] = [];

const makeQuery = (path: string, docs: unknown[]) => {
  const wheres: [string, string, unknown][] = [];
  const q = {
    where(f: string, op: string, v: unknown) { wheres.push([f, op, v]); return q; },
    /* The notification read caps its page, so the fake has to answer `limit`
       as Firestore does - chainably, and without losing the filters. */
    limit(_n: number) { return q; },
    async get() {
      calls.push({ path, wheres });
      return { docs: docs.map((d, i) => ({ id: `${path}-${i}`, data: () => d })) };
    },
  };
  return q;
};

const DATA: Record<string, unknown[]> = {
  'users/u1/vehicles': [
    { name: 'Skoda Superb', registrationNumber: 'GJ 01 KP 4471' },
    { name: 'Tata Nexon', registrationNumber: 'GJ 01 ZZ 9999' },
  ],
  subscriptions: [{ userId: 'u1', plan: 'Gold', status: 'active' }],
  services: [{ name: 'Ceramic coating' }],
  protections: [{ vehicleId: 'x', kind: 'ceramic' }],
  visits: [{ vehicleId: 'x', status: 'sealed' }],
  bookings: [{ userId: 'u1', status: 'completed' }],
  jobs: [{ customerId: 'u1' }],
  /* §17.1 - read to resolve an unread record to the surface that owns it,
     never to draw a list. Owned data, so it is scoped like everything else. */
  notifications: [
    { userId: 'u1', title: 'Ready for Pickup', type: 'booking_update', read: false },
  ],
};

jest.mock('@/lib/server/firebaseAdmin', () => ({
  adminAuth: {},
  adminDb: {
    doc: (p: string) => ({ get: async () => ({ data: () => ({ name: 'Meera Shah', email: 'm@x.test', role: 'customer' }) }) }),
    collection: (p: string) => makeQuery(p, DATA[p] ?? []),
  },
}));

import { loadCustomerPicture } from '@/lib/server/customerPicture';

beforeEach(() => { calls.length = 0; });

it('loads the whole picture for one verified customer', async () => {
  const p = await loadCustomerPicture({ uid: 'u1' });
  expect(p.user.uid).toBe('u1');
  expect(p.user.name).toBe('Meera Shah');
  expect(p.cars).toHaveLength(2);
  expect(p.subscription).not.toBeNull();
  expect(p.catalogue).toHaveLength(1);
  expect(p.notifications).toHaveLength(1);
});

it('SCOPES EVERY collection query by the session uid or by a vehicle under it', async () => {
  await loadCustomerPicture({ uid: 'u1' });

  const byPath = (p: string) => calls.filter(c => c.path === p);

  // the two collections whose rules key on the owner
  for (const c of byPath('bookings')) {
    expect(c.wheres).toEqual(expect.arrayContaining([['userId', '==', 'u1']]));
  }
  for (const c of byPath('jobs')) {
    expect(c.wheres).toEqual(expect.arrayContaining([['customerId', '==', 'u1']]));
  }
  // and the three keyed by vehicles read from under that uid
  for (const c of [...byPath('protections'), ...byPath('visits'), ...byPath('declarations')]) {
    expect(c.wheres.some(([f, op]) => f === 'vehicleId' && op === 'in')).toBe(true);
  }
  expect(byPath('subscriptions')[0].wheres).toEqual([['userId', '==', 'u1']]);
  /* And the notifications, which are as much this customer's as their cars. */
  expect(byPath('notifications')[0].wheres).toEqual([['userId', '==', 'u1']]);
});

it('never issues an unscoped query against an owned collection', async () => {
  await loadCustomerPicture({ uid: 'u1' });
  const owned = ['bookings', 'jobs', 'protections', 'visits', 'subscriptions', 'notifications'];
  for (const c of calls) {
    if (owned.includes(c.path)) expect(c.wheres.length).toBeGreaterThan(0);
  }
});

it('NEVER joins a record to a car by its registration', async () => {
  /* The production defect: a booking labelled "Honda City" carrying the BMW's
     plate appeared in the BMW's room, while its own `vehicleId` named the i20.
     The query - not the data - mis-parented it. §P1.6, §P1.9. */
  await loadCustomerPicture({ uid: 'u1' });
  const fields = calls.flatMap(c => c.wheres).map(([f]) => f);
  expect(fields).not.toContain('vehicleRegNo');

  /* Both are scoped by the OWNER and grouped by `vehicleId` in memory. The
     edge is still the id and never the plate; the query simply no longer asks
     the database to repeat itself once per car. */
  for (const c of calls.filter(x => x.path === 'bookings')) {
    expect(c.wheres).toEqual([['userId', '==', 'u1']]);
  }
  for (const c of calls.filter(x => x.path === 'jobs')) {
    expect(c.wheres).toEqual([['customerId', '==', 'u1']]);
  }
});

/**
 * WHAT THIS READ COSTS, AND WHY THE NUMBER IS THE POINT.
 *
 * It used to fan out five queries PER VEHICLE - protections, declarations,
 * visits, bookings and jobs - on top of the eight above, on every page view of
 * every room. Four cars meant twenty-eight queries and well over a hundred
 * billed document reads per screen, re-paid on every navigation, because
 * `cache` dedupes inside one request and nothing spans two.
 *
 * The project exhausted its daily Firestore read quota and every customer room
 * started answering "We could not reach your garage." That is what a read cost
 * that scales with the garage buys you, so the cost is now a tested property
 * rather than a thing somebody has to notice.
 */
describe('the read does not grow with the garage', () => {
  const CARS = 'users/u1/vehicles';

  it('costs the same for one car as for two', async () => {
    await loadCustomerPicture({ uid: 'u1' });
    const two = calls.length;

    calls.length = 0;
    const all = DATA[CARS];
    DATA[CARS] = [all[0]];
    try {
      await loadCustomerPicture({ uid: 'u1' });
      expect(calls.length).toBe(two);
    } finally {
      DATA[CARS] = all;
    }
  });

  it('asks each collection once, however many cars there are', async () => {
    await loadCustomerPicture({ uid: 'u1' });
    for (const path of ['protections', 'declarations', 'visits', 'bookings', 'jobs', 'services']) {
      expect({ path, n: calls.filter(c => c.path === path).length }).toEqual({ path, n: 1 });
    }
  });

  it('and a garage larger than Firestore’s `in` limit is chunked, not looped', async () => {
    /* Thirty is the cap on an `in` filter. Thirty-one cars is two queries per
       keyed collection - not thirty-one. */
    const all = DATA[CARS];
    DATA[CARS] = Array.from({ length: 31 }, (_, i) => ({ name: `Car ${i}`, registrationNumber: `R${i}` }));
    calls.length = 0;
    try {
      await loadCustomerPicture({ uid: 'u1' });
      expect(calls.filter(c => c.path === 'protections')).toHaveLength(2);
      expect(calls.filter(c => c.path === 'bookings')).toHaveLength(1);
    } finally {
      DATA[CARS] = all;
    }
  });
});

it('throws rather than rendering half a garage when Admin is unconfigured', async () => {
  jest.resetModules();
  jest.doMock('@/lib/server/firebaseAdmin', () => ({ adminAuth: null, adminDb: null }));
  const { loadCustomerPicture: unconfigured } = await import('@/lib/server/customerPicture');
  await expect(unconfigured({ uid: 'u1' })).rejects.toThrow(/not configured/i);
});
