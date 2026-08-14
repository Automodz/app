/**
 * A CAR IN A GARAGE - and the id nobody but the server may choose.
 *
 * `ownsVehicle()` is the ownership primitive for protections, visits and
 * declarations, and it asks only whether a document EXISTS at
 * `users/{me}/vehicles/{thatId}`. So the one thing this service must never do
 * is let a caller name the document it creates.
 */
type Row = Record<string, unknown>;

const store = new Map<string, Row>();
let allocated = 0;

const snapOf = (path: string) => ({
  id: path.split('/').pop() as string,
  exists: store.has(path),
  data: () => store.get(path),
});
const refOf = (path: string) => ({
  id: path.split('/').pop() as string,
  path,
  get: async () => snapOf(path),
  set: async (data: Row) => { store.set(path, data); },
  update: async (data: Row) => {
    const next = { ...(store.get(path) ?? {}) };
    for (const [k, v] of Object.entries(data)) {
      if (v === '<delete>') delete next[k];
      else next[k] = v;
    }
    store.set(path, next);
  },
});
const collectionOf = (name: string) => ({
  /* NO ARGUMENT - the id is the database's. That is the whole point. */
  doc: (id?: string) => refOf(`${name}/${id ?? `auto-${++allocated}`}`),
  get: async () => ({
    docs: [...store.keys()]
      .filter(p => p.startsWith(`${name}/`) && !p.slice(name.length + 1).includes('/'))
      .map(p => snapOf(p)),
  }),
});

const adminDb = { doc: (p: string) => refOf(p), collection: collectionOf };

jest.mock('@/lib/server/firebaseAdmin', () => ({ adminDb, adminAuth: null }));
jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => '<server-time>', delete: () => '<delete>' },
}));

import { addCar, correctCar, normalisePlate, plateKey, VehicleError } from '@/lib/server/vehicleService';

beforeEach(() => {
  store.clear();
  allocated = 0;
});

const failure = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return { code: '<no error>', status: 0 };
  } catch (e) {
    if (e instanceof VehicleError) return { code: e.code, status: e.status };
    throw e;
  }
};

const cars = (uid: string) =>
  [...store.keys()].filter(k => k.startsWith(`users/${uid}/vehicles/`));

describe('adding a car', () => {
  it('THE SERVER ALLOCATES THE ID - nothing in the request names a document', async () => {
    const r = await addCar('u1', {
      name: 'Kia Seltos', registrationNumber: ' gj01 ab 8539 ',
      /* Every field a caller might hope steers the document. */
      id: 'someone-elses-car', vehicleId: 'someone-elses-car', docId: 'x',
    } as never);
    expect(r.vehicleId).toBe('auto-1');
    expect(cars('u1')).toEqual(['users/u1/vehicles/auto-1']);
    expect(store.get('users/u1/vehicles/someone-elses-car')).toBeUndefined();
  });

  it('stores the plate as the customer reads it, and COMPARES it without spaces', () => {
    /* Two normalisers, and they do different jobs. Display keeps the spacing
       a plate is printed and read aloud with; matching removes it, because
       "GJ01AB8539" and "GJ01 AB 8539" are one car. The duplicate check
       compared the STORED form, so typing the plate a second time with
       different spacing produced a second record - two histories for one car,
       which is the exact thing the check exists to prevent. */
    expect(normalisePlate(' gj01  ab 8539 ')).toBe('GJ01 AB 8539');
    expect(normalisePlate('gj01ab8539')).toBe('GJ01AB8539');
    expect(plateKey('GJ01 AB 8539')).toBe(plateKey('gj01ab8539'));
  });

  it('SO THE SAME CAR SPACED DIFFERENTLY IS STILL THE SAME CAR', async () => {
    await addCar('u1', { name: 'Kia Seltos', registrationNumber: 'GJ01 AB 8539' });
    expect(await failure(() => addCar('u1', { name: 'The Kia', registrationNumber: 'gj01ab8539' })))
      .toEqual({ code: 'registration-taken', status: 409 });
    expect(cars('u1')).toHaveLength(1);
  });

  it('refuses a second record for a car already in the garage', async () => {
    await addCar('u1', { name: 'Kia Seltos', registrationNumber: 'GJ01AB8539' });
    expect(await failure(() => addCar('u1', { name: 'The Kia', registrationNumber: ' gj01ab8539 ' })))
      .toEqual({ code: 'registration-taken', status: 409 });
    expect(cars('u1')).toHaveLength(1);
  });

  it('refuses a car with no name and one with no plate', async () => {
    expect(await failure(() => addCar('u1', { name: 'K', registrationNumber: 'GJ01AB8539' })))
      .toEqual({ code: 'name-required', status: 400 });
    expect(await failure(() => addCar('u1', { name: 'Kia Seltos', registrationNumber: 'GJ' })))
      .toEqual({ code: 'registration-required', status: 400 });
    expect(await failure(() => addCar('u1', null)))
      .toEqual({ code: 'name-required', status: 400 });
    expect(cars('u1')).toEqual([]);
  });

  it('stores only the five facts a customer can legitimately give', async () => {
    const r = await addCar('u1', {
      name: 'Kia Seltos', registrationNumber: 'GJ01AB8539',
      year: '2023', odometer: '41,208', color: 'Phantom Black',
      /* Not a field a customer authors. */
      photo: 'https://evil.test/x.jpg', ownerUid: 'u2', createdAt: 'yesterday',
    } as never);
    const stored = store.get(`users/u1/vehicles/${r.vehicleId}`) as Row;
    expect(stored).toMatchObject({
      name: 'Kia Seltos', registrationNumber: 'GJ01AB8539',
      year: 2023, odometer: 41208, color: 'Phantom Black',
    });
    expect(stored.photo).toBeUndefined();
    expect(stored.ownerUid).toBeUndefined();
    expect(stored.createdAt).toBe('<server-time>');
  });

  it('NO KEY IS WRITTEN AS `undefined` - Firestore refuses one outright', async () => {
    /* The car form's optional fields are usually blank. Only the DELETE half
       of this rule came across when the write moved to the server, so the
       first real request through the new door was refused by the database for
       a car with no year. Caught by the end-to-end matrix, which is the only
       thing that talks to a real one. */
    const r = await addCar('u1', { name: 'Kia Seltos', registrationNumber: 'GJ01AB8539' });
    const stored = store.get(`users/u1/vehicles/${r.vehicleId}`) as Row;
    for (const [k, v] of Object.entries(stored)) {
      expect({ k, v }).toEqual({ k, v: expect.anything() });
    }
    expect(Object.keys(stored).sort())
      .toEqual(['createdAt', 'name', 'registrationNumber', 'updatedAt']);
  });

  it('a garage is per customer - two people may hold the same plate', async () => {
    await addCar('u1', { name: 'Kia Seltos', registrationNumber: 'GJ01AB8539' });
    const other = await addCar('u2', { name: 'Kia Seltos', registrationNumber: 'GJ01AB8539' });
    expect(other.vehicleId).toBe('auto-2');
    expect(cars('u2')).toEqual(['users/u2/vehicles/auto-2']);
  });
});

describe('correcting a car', () => {
  const mine = async () =>
    (await addCar('u1', { name: 'Kia Seltos', registrationNumber: 'GJ01AB8539', odometer: '41208' })).vehicleId;

  it('ANOTHER CUSTOMER’S CAR IS NOT FOUND - the path is the whole check', async () => {
    const id = await mine();
    expect(await failure(() => correctCar('u2', id, { name: 'Theirs now', registrationNumber: 'GJ01AB8539' })))
      .toEqual({ code: 'not-found', status: 404 });
    expect((store.get(`users/u1/vehicles/${id}`) as Row).name).toBe('Kia Seltos');
  });

  it('a car that does not exist is refused the same way', async () => {
    expect(await failure(() => correctCar('u1', 'ghost', { name: 'X Y', registrationNumber: 'GJ01ZZ0001' })))
      .toEqual({ code: 'not-found', status: 404 });
    expect(await failure(() => correctCar('u1', '', { name: 'X Y', registrationNumber: 'GJ01ZZ0001' })))
      .toEqual({ code: 'not-found', status: 404 });
  });

  it('AN EMPTIED FIELD IS REMOVED, not left standing at its old value', async () => {
    const id = await mine();
    await correctCar('u1', id, { name: 'Kia Seltos', registrationNumber: 'GJ01AB8539', odometer: '' });
    expect((store.get(`users/u1/vehicles/${id}`) as Row).odometer).toBeUndefined();
  });

  it('and it cannot be corrected onto a plate the garage already holds', async () => {
    const first = await mine();
    await addCar('u1', { name: 'BMW M340i', registrationNumber: 'GJ01CD5678' });
    expect(await failure(() => correctCar('u1', first, { name: 'Kia Seltos', registrationNumber: 'GJ01CD5678' })))
      .toEqual({ code: 'registration-taken', status: 409 });
  });

  it('but correcting a car onto its OWN plate is not a duplicate', async () => {
    const id = await mine();
    const r = await correctCar('u1', id, { name: 'Kia Seltos X-Line', registrationNumber: 'gj01ab8539' });
    expect(r).toEqual({ vehicleId: id, name: 'Kia Seltos X-Line', registrationNumber: 'GJ01AB8539' });
  });
});
