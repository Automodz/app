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
       as Firestore does — chainably, and without losing the filters. */
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
  /* §17.1 — read to resolve an unread record to the surface that owns it,
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
  // and the two keyed by a vehicle read from under that uid
  for (const c of [...byPath('protections'), ...byPath('visits')]) {
    expect(c.wheres.some(([f, op]) => f === 'vehicleId' && op === '==')).toBe(true);
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

it('normalises the plate the way the stored documents are keyed', async () => {
  await loadCustomerPicture({ uid: 'u1' });
  const regs = calls.flatMap(c => c.wheres)
    .filter(([f]) => f === 'vehicleRegNo').map(([, , v]) => v);
  expect(regs).toEqual(expect.arrayContaining(['GJ01KP4471', 'GJ01ZZ9999']));
  for (const r of regs) expect(String(r)).not.toMatch(/\s/);
});

it('does one query per car per collection — no N+1 walk', async () => {
  await loadCustomerPicture({ uid: 'u1' });
  expect(calls.filter(c => c.path === 'protections')).toHaveLength(2);
  expect(calls.filter(c => c.path === 'services')).toHaveLength(1);
});

it('throws rather than rendering half a garage when Admin is unconfigured', async () => {
  jest.resetModules();
  jest.doMock('@/lib/server/firebaseAdmin', () => ({ adminAuth: null, adminDb: null }));
  const { loadCustomerPicture: unconfigured } = await import('@/lib/server/customerPicture');
  await expect(unconfigured({ uid: 'u1' })).rejects.toThrow(/not configured/i);
});
