/**
 * THE SERVICE THAT OWNS THE PROMISE.
 *
 * `firestore.rules` refuses every client write to `declarations` and to
 * `protections`, so this file is the only path to either. What that buys is
 * only worth having if the path itself refuses the right things, so this is
 * the adversarial half: another customer's car, a forged photograph, a
 * verification asked for by somebody who is not the studio, a double tap, a
 * renewal that goes backwards.
 *
 * ── WHY THE DATABASE IS FAKE ─────────────────────────────────────────────
 * `firebase-admin` cannot be imported under Jest - it pulls in ESM `jose`,
 * which Jest will not parse (see `__tests__/deploy/serialisation.test.ts` for
 * the same constraint). So the SHAPE the Admin SDK presents is modelled:
 * documents, a where-query, and a transaction whose reads all precede its
 * writes. The emulator script (`scripts/security/customer/run.sh`) is what proves
 * this against real Firestore semantics; this proves the decisions.
 */

/* ── the fake ────────────────────────────────────────────────────────────── */

type Row = Record<string, unknown>;

const store = new Map<string, Row>();
/** Every write the service performed, in order, so a test can assert absence. */
const writes: { op: 'create' | 'update'; path: string; data: Row }[] = [];

const snapOf = (path: string) => ({
  id: path.split('/').pop() as string,
  exists: store.has(path),
  data: () => store.get(path),
  ref: refOf(path),
});

function refOf(path: string) {
  return { id: path.split('/').pop() as string, path, get: async () => snapOf(path) };
}

const queryOf = (collection: string, field: string, value: unknown) => ({
  __query: true as const,
  collection,
  field,
  value,
});

const runQuery = (q: { collection: string; field: string; value: unknown }) => ({
  docs: [...store.entries()]
    .filter(([p, d]) => p.startsWith(`${q.collection}/`) && d[q.field] === q.value)
    .map(([p]) => snapOf(p)),
});

const collectionOf = (name: string) => ({
  doc: (id: string) => refOf(`${name}/${id}`),
  where: (field: string, _op: string, value: unknown) => queryOf(name, field, value),
});

/** Reads-before-writes is a real constraint of a transaction, so it is one here. */
let wrote = false;

const tx = {
  get: async (target: { path?: string; __query?: true; collection?: string; field?: string; value?: unknown }) => {
    if (wrote) throw new Error('a transaction may not read after it has written');
    return target.__query
      ? runQuery(target as { collection: string; field: string; value: unknown })
      : snapOf(target.path as string);
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
  Timestamp: {
    fromDate: (d: Date) => ({ toMillis: () => d.getTime(), toDate: () => d }),
  },
}));

import { declarePuc, decidePuc, PucError } from '@/lib/server/pucService';

const NOW = new Date('2026-08-12T09:00:00Z');

const GOOD = {
  vehicleId: 'v1',
  reference: 'GJ01-PUC-88213',
  issuedOn: '2026-08-01',
  expiresOn: '2027-02-01',
};

beforeEach(() => {
  store.clear();
  writes.length = 0;
  wrote = false;
  /* One customer with one car; a second customer with their own. */
  store.set('users/u1', { role: 'customer' });
  store.set('users/u1/vehicles/v1', { name: 'Kia Seltos', registrationNumber: 'GJ01AB8539' });
  store.set('users/u2', { role: 'customer' });
  store.set('users/u2/vehicles/v2', { name: 'BMW M340i', registrationNumber: 'GJ01XX0001' });
  store.set('users/staff', { role: 'employee' });
  store.set('users/boss', { role: 'admin' });
});

const failure = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return { code: '<no error>', status: 0 };
  } catch (e) {
    if (e instanceof PucError) return { code: e.code, status: e.status };
    throw e;
  }
};

const declarations = () => [...store.keys()].filter(k => k.startsWith('declarations/'));
const protections = () => [...store.keys()].filter(k => k.startsWith('protections/'));

/* ── THE CUSTOMER'S HALF ─────────────────────────────────────────────────── */

describe('declaring', () => {
  it('an owner may declare against their own car', async () => {
    const r = await declarePuc('u1', GOOD, NOW);
    expect(r.status).toBe('submitted');
    expect(r.replay).toBe(false);
    const stored = store.get(`declarations/${r.declarationId}`);
    expect(stored).toMatchObject({
      vehicleId: 'v1', ownerUid: 'u1', kind: 'puc', status: 'submitted',
      reference: 'GJ01-PUC-88213', issuedOn: '2026-08-01', expiresOn: '2027-02-01',
    });
  });

  it('IT CREATES NO PROTECTION. That is the whole separation', async () => {
    await declarePuc('u1', GOOD, NOW);
    expect(protections()).toEqual([]);
    expect(writes.every(w => !w.path.startsWith('protections/'))).toBe(true);
  });

  it('and the owner cannot smuggle a status in with it', async () => {
    const r = await declarePuc('u1', { ...GOOD, status: 'verified', ownerUid: 'u2' } as never, NOW);
    const stored = store.get(`declarations/${r.declarationId}`) as Row;
    expect(stored.status).toBe('submitted');
    /* The uid comes from the verified session and from nowhere else. */
    expect(stored.ownerUid).toBe('u1');
  });

  it('ANOTHER CUSTOMER’S CAR IS NOT FOUND - cross-user access is impossible', async () => {
    /* `v2` exists, and it is under `u2`. The lookup is `users/u1/vehicles/v2`,
       which simply is not there - there is no ownership FIELD to compare and
       so nothing for a caller to set. */
    expect(await failure(() => declarePuc('u1', { ...GOOD, vehicleId: 'v2' }, NOW)))
      .toEqual({ code: 'vehicle-not-yours', status: 403 });
    expect(declarations()).toEqual([]);
  });

  it('a car that does not exist at all is refused the same way', async () => {
    expect(await failure(() => declarePuc('u1', { ...GOOD, vehicleId: 'nope' }, NOW)))
      .toEqual({ code: 'vehicle-not-yours', status: 403 });
  });

  it('malformed dates are refused before anything is read', async () => {
    for (const [input, code] of [
      [{ ...GOOD, issuedOn: '2026-02-30' }, 'issued-on-invalid'],
      [{ ...GOOD, expiresOn: 'soon' }, 'expires-on-invalid'],
      [{ ...GOOD, issuedOn: '2027-02-01', expiresOn: '2026-08-01' }, 'expiry-not-after-issue'],
      [{ ...GOOD, issuedOn: '2026-01-01', expiresOn: '2026-07-01' }, 'already-expired'],
      [{ ...GOOD, reference: '' }, 'reference-invalid'],
      [null, 'vehicle-required'],
    ] as const) {
      expect(await failure(() => declarePuc('u1', input as never, NOW)))
        .toEqual({ code, status: 400 });
    }
    expect(declarations()).toEqual([]);
  });

  it('a photograph uploaded for a DIFFERENT car is refused', async () => {
    expect(await failure(() => declarePuc('u1', {
      ...GOOD,
      evidenceUrl: 'https://res.cloudinary.com/x/vehicles/u1-puc-v9-1.jpg',
      evidencePath: 'cloudinary:vehicles/u1-puc-v9-1',
    }, NOW))).toEqual({ code: 'evidence-invalid', status: 400 });
  });

  it('a photograph uploaded by a DIFFERENT customer is refused', async () => {
    expect(await failure(() => declarePuc('u1', {
      ...GOOD,
      evidenceUrl: 'https://res.cloudinary.com/x/vehicles/u2-puc-v1-1.jpg',
      evidencePath: 'cloudinary:vehicles/u2-puc-v1-1',
    }, NOW))).toEqual({ code: 'evidence-invalid', status: 400 });
  });

  it('and its own photograph is carried through whole', async () => {
    const r = await declarePuc('u1', {
      ...GOOD,
      evidenceUrl: 'https://res.cloudinary.com/x/vehicles/u1-puc-v1-1.jpg',
      evidencePath: 'cloudinary:vehicles/u1-puc-v1-1',
    }, NOW);
    expect((store.get(`declarations/${r.declarationId}`) as Row).evidence)
      .toEqual({
        url: 'https://res.cloudinary.com/x/vehicles/u1-puc-v1-1.jpg',
        path: 'cloudinary:vehicles/u1-puc-v1-1',
      });
  });

  it('the car is snapshotted, so a plate corrected later cannot re-label it', async () => {
    const r = await declarePuc('u1', GOOD, NOW);
    expect(store.get(`declarations/${r.declarationId}`)).toMatchObject({
      vehicleName: 'Kia Seltos', registrationNumber: 'GJ01AB8539',
    });
  });
});

describe('a second submission', () => {
  it('THE SAME CERTIFICATE TWICE writes one record, not two', async () => {
    const first = await declarePuc('u1', GOOD, NOW);
    const second = await declarePuc('u1', GOOD, NOW);
    expect(second.declarationId).toBe(first.declarationId);
    expect(second.replay).toBe(true);
    expect(declarations()).toHaveLength(1);
  });

  it('a DIFFERENT certificate withdraws the pending one rather than joining it', async () => {
    const first = await declarePuc('u1', GOOD, NOW);
    const second = await declarePuc('u1', { ...GOOD, reference: 'GJ01-PUC-99999', expiresOn: '2027-03-01' }, NOW);
    expect(second.declarationId).not.toBe(first.declarationId);
    expect((store.get(`declarations/${first.declarationId}`) as Row).status).toBe('withdrawn');
    expect((store.get(`declarations/${second.declarationId}`) as Row).status).toBe('submitted');
    /* WITHDRAWN, NOT DELETED - the facts it was sent with survive. */
    expect(store.get(`declarations/${first.declarationId}`)).toMatchObject({
      reference: 'GJ01-PUC-88213', issuedOn: '2026-08-01', expiresOn: '2027-02-01',
    });
  });

  it('a renewal that does not run later than what stands is refused', async () => {
    const d = await declarePuc('u1', GOOD, NOW);
    await decidePuc('staff', { declarationId: d.declarationId, decision: 'verify' }, NOW);
    expect(await failure(() => declarePuc('u1', {
      ...GOOD, reference: 'GJ01-PUC-77777', expiresOn: '2027-01-01',
    }, NOW))).toEqual({ code: 'not-later-than-current', status: 409 });
  });

  it('and a real renewal is accepted while the current one still stands', async () => {
    const d = await declarePuc('u1', GOOD, NOW);
    await decidePuc('staff', { declarationId: d.declarationId, decision: 'verify' }, NOW);
    const next = await declarePuc('u1', {
      ...GOOD, reference: 'GJ01-PUC-77777', expiresOn: '2027-06-01',
    }, NOW);
    expect(next.status).toBe('submitted');
    expect(declarations()).toHaveLength(2);
  });
});

/* ── THE STUDIO'S HALF ───────────────────────────────────────────────────── */

describe('deciding', () => {
  const declared = async () => (await declarePuc('u1', GOOD, NOW)).declarationId;

  it('A CUSTOMER CANNOT VERIFY - not their own, not anybody’s', async () => {
    const id = await declared();
    expect(await failure(() => decidePuc('u1', { declarationId: id, decision: 'verify' }, NOW)))
      .toEqual({ code: 'not-yours-to-make', status: 403 });
    expect(protections()).toEqual([]);
    expect((store.get(`declarations/${id}`) as Row).status).toBe('submitted');
  });

  it('a customer cannot reject one either', async () => {
    const id = await declared();
    expect(await failure(() => decidePuc('u2', { declarationId: id, decision: 'reject' }, NOW)))
      .toEqual({ code: 'not-yours-to-make', status: 403 });
  });

  it('an account with no profile at all is not the studio', async () => {
    const id = await declared();
    expect(await failure(() => decidePuc('ghost', { declarationId: id, decision: 'verify' }, NOW)))
      .toEqual({ code: 'not-yours-to-make', status: 403 });
  });

  it('staff may verify, and THAT is what creates the protection', async () => {
    const id = await declared();
    const r = await decidePuc('staff', { declarationId: id, decision: 'verify' }, NOW);
    expect(r.status).toBe('verified');
    expect(r.protectionId).toBe(`v1_puc_${id}`);
    expect(store.get(`protections/v1_puc_${id}`)).toMatchObject({
      vehicleId: 'v1',
      kind: 'puc',
      since: '2026-08-01',
      term: { kind: 'dated', expiresOn: '2027-02-01' },
      termsSource: 'declared',
      declarationId: id,
      ownerUid: 'u1',
    });
  });

  it('an admin may too', async () => {
    const id = await declared();
    expect((await decidePuc('boss', { declarationId: id, decision: 'verify' }, NOW)).status)
      .toBe('verified');
  });

  it('VERIFYING TWICE is refused, so one certificate is one protection', async () => {
    const id = await declared();
    await decidePuc('staff', { declarationId: id, decision: 'verify' }, NOW);
    expect(await failure(() => decidePuc('staff', { declarationId: id, decision: 'verify' }, NOW)))
      .toEqual({ code: 'no-change', status: 409 });
    expect(protections()).toHaveLength(1);
  });

  it('a REJECTED certificate can never be verified afterwards', async () => {
    const id = await declared();
    await decidePuc('staff', { declarationId: id, decision: 'reject', reason: 'The plate does not match.' }, NOW);
    expect(await failure(() => decidePuc('staff', { declarationId: id, decision: 'verify' }, NOW)))
      .toEqual({ code: 'already-rejected', status: 409 });
    expect(protections()).toEqual([]);
  });

  it('a refusal keeps the studio’s reason, and writes no protection', async () => {
    const id = await declared();
    await decidePuc('staff', { declarationId: id, decision: 'reject', reason: 'The plate does not match.' }, NOW);
    expect(store.get(`declarations/${id}`)).toMatchObject({
      status: 'rejected', decisionReason: 'The plate does not match.',
    });
    expect(protections()).toEqual([]);
  });

  it('a decision that is neither, or on nothing, is refused', async () => {
    const id = await declared();
    expect(await failure(() => decidePuc('staff', { declarationId: id, decision: 'approve' }, NOW)))
      .toEqual({ code: 'decision-invalid', status: 400 });
    expect(await failure(() => decidePuc('staff', { declarationId: '', decision: 'verify' }, NOW)))
      .toEqual({ code: 'declaration-required', status: 400 });
    expect(await failure(() => decidePuc('staff', { declarationId: 'ghost', decision: 'verify' }, NOW)))
      .toEqual({ code: 'not-found', status: 404 });
  });

  it('THE CAR COMES FROM THE DECLARATION, never from the request', async () => {
    const id = await declared();
    /* Every field a caller could hope to steer it with, offered at once. */
    await decidePuc('staff', {
      declarationId: id, decision: 'verify',
      vehicleId: 'v2', ownerUid: 'u2', protectionId: 'v2_puc_forged',
    } as never, NOW);
    expect(store.get(`protections/v1_puc_${id}`)).toMatchObject({ vehicleId: 'v1', ownerUid: 'u1' });
    expect(store.get('protections/v2_puc_forged')).toBeUndefined();
  });
});

/* ── HISTORICAL INTEGRITY, AT THE WRITE ──────────────────────────────────── */

describe('a renewal, all the way through', () => {
  it('supersedes the old declaration and leaves every fact on it alone', async () => {
    const first = (await declarePuc('u1', GOOD, NOW)).declarationId;
    await decidePuc('staff', { declarationId: first, decision: 'verify' }, NOW);
    const before = { ...(store.get(`declarations/${first}`) as Row) };
    const beforeProtection = { ...(store.get(`protections/v1_puc_${first}`) as Row) };

    const second = (await declarePuc('u1', {
      ...GOOD, reference: 'GJ01-PUC-77777', issuedOn: '2026-08-05', expiresOn: '2027-08-01',
    }, NOW)).declarationId;
    await decidePuc('staff', { declarationId: second, decision: 'verify' }, NOW);

    const after = store.get(`declarations/${first}`) as Row;
    expect(after.status).toBe('superseded');
    /* Its dates, its reference and its owner are exactly what they were. */
    for (const k of ['reference', 'issuedOn', 'expiresOn', 'ownerUid', 'submittedAt']) {
      expect({ k, v: after[k] }).toEqual({ k, v: before[k] });
    }
    /* AND THE PROTECTION IT CREATED IS UNTOUCHED - no `since` rewritten, no
       expiry moved. This is the whole reason a renewal writes a new document. */
    expect(store.get(`protections/v1_puc_${first}`)).toEqual(beforeProtection);
  });

  it('writes a SECOND protection rather than editing the first', async () => {
    const first = (await declarePuc('u1', GOOD, NOW)).declarationId;
    await decidePuc('staff', { declarationId: first, decision: 'verify' }, NOW);
    const second = (await declarePuc('u1', {
      ...GOOD, reference: 'GJ01-PUC-77777', issuedOn: '2026-08-05', expiresOn: '2027-08-01',
    }, NOW)).declarationId;
    await decidePuc('staff', { declarationId: second, decision: 'verify' }, NOW);

    expect(protections().sort()).toEqual([`protections/v1_puc_${first}`, `protections/v1_puc_${second}`]);
    /* Nothing in the whole sequence ever updated a protection document. */
    expect(writes.filter(w => w.path.startsWith('protections/') && w.op === 'update')).toEqual([]);
  });

  it('and it never touches the deterministic slot the seed data uses', async () => {
    const id = (await declarePuc('u1', GOOD, NOW)).declarationId;
    await decidePuc('staff', { declarationId: id, decision: 'verify' }, NOW);
    /* `prot-seltos-puc` and `v1_puc` are somebody else's records. */
    expect(writes.map(w => w.path)).not.toContain('protections/v1_puc');
  });
});
