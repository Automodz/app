/**
 * WHAT THE CUSTOMER IS TOLD ABOUT THEIR CERTIFICATE, AND HOW THEY GET BACK.
 *
 * The projection is where a truthful state becomes a truthful sentence, so
 * these are the assertions that the sentence never runs ahead of the fact: no
 * "active" before a studio decision, no invented date, no dead end, and no
 * second car appearing under the back button.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { toVehicle, toPuc } from '@/lib/customer/project';
import { parentOf, hrefForDestination } from '@/navigation/resolve';
import { roomFor, activeSlotFor, surfaceKind, GARAGE, VEHICLE_PUC } from '@/navigation/routes';
import type { CarPicture, CustomerPicture } from '@/lib/customer/source';
import { Timestamp } from 'firebase/firestore';
import type { Declaration, Protection, User, Vehicle } from '@/lib/types';

const NOW = new Date('2026-08-12T09:00:00Z');
const ts = (iso: string) => Timestamp.fromDate(new Date(iso));

const codeOf = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

const vehicle = (over: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v1', name: 'Kia Seltos', registrationNumber: 'GJ01AB8539',
  createdAt: ts('2025-01-01T00:00:00Z'),
  ...over,
} as unknown as Vehicle);

const car = (over: Partial<CarPicture> = {}): CarPicture => ({
  vehicle: vehicle(), protections: [], declarations: [], visits: [], bookings: [], jobs: [],
  ...over,
});

const picture = (over: Partial<CustomerPicture> = {}): CustomerPicture => ({
  user: { uid: 'u1', name: 'A', email: 'a@b.c', role: 'customer' } as User,
  cars: [], subscription: null, subscriptions: [], invoices: [], notifications: [],
  catalogue: [], addresses: [], approvals: [],
  ...over,
});

const decl = (over: Partial<Declaration> = {}): Declaration => ({
  id: 'd1', vehicleId: 'v1', ownerUid: 'u1', kind: 'puc',
  reference: 'GJ01-PUC-88213', issuedOn: '2026-06-01', expiresOn: '2026-12-01',
  status: 'submitted',
  submittedAt: ts('2026-08-10T10:00:00Z'),
  createdAt: ts('2026-08-10T10:00:00Z'), updatedAt: ts('2026-08-10T10:00:00Z'),
  ...over,
} as unknown as Declaration);

const prot = (over: Partial<Protection> = {}): Protection => ({
  id: 'v1_puc_d1', vehicleId: 'v1', kind: 'puc', since: '2026-06-01',
  term: { kind: 'dated', expiresOn: '2026-12-01' }, termsSource: 'declared',
  declarationId: 'd1',
  createdAt: ts('2026-06-01T00:00:00Z'), updatedAt: ts('2026-06-01T00:00:00Z'),
  ...over,
} as unknown as Protection);

/** The certificate's row in the car's ledger. */
const row = (c: CarPicture) =>
  toVehicle(c, picture(), NOW).protections.find(p => p.label === 'Pollution certificate');

/* ── THE LEDGER ROW ──────────────────────────────────────────────────────── */

describe('the certificate’s row in the car’s own ledger', () => {
  it('MISSING - the car says so, and offers the act', () => {
    const r = row(car());
    expect(r?.term).toBe('Not added');
    expect(r?.action).toEqual({ label: 'Declare certificate', href: '/vehicle/puc?car=v1' });
    /* No bar. A car with no certificate has no proportion to draw. */
    expect(r?.remaining).toBeUndefined();
  });

  it('PENDING - a submission is a wait, never a promise', () => {
    const r = row(car({ declarations: [decl({ expiresOn: '2099-01-01' })] }));
    expect(r?.term).toBe('Verification in progress');
    expect(r?.tone).not.toBe('assent');
    /* The dates on it are nowhere in what the customer is told. */
    expect(r?.term).not.toContain('2099');
    expect(r?.remaining).toBeUndefined();
  });

  it('ACTIVE - the term engine’s own words, and no second date format', () => {
    const r = row(car({
      protections: [prot()], declarations: [decl({ status: 'verified' })],
    }));
    expect(r?.term).toBe('Through December 2026');
    expect(r?.tone).toBe('assent');
    expect(r?.action?.label).toBe('See the certificate');
  });

  it('EXPIRED - said as lapsed, and the act becomes a renewal', () => {
    const r = row(car({
      protections: [prot({ term: { kind: 'dated', expiresOn: '2026-07-30' } })],
    }));
    expect(r?.term).toBe('Lapsed 30 July 2026');
    expect(r?.tone).toBe('lapsed');
    expect(r?.action?.label).toBe('Renew certificate');
  });

  it('RENEWING - the standing certificate still speaks, and the wait is reachable', () => {
    const r = row(car({
      protections: [prot()],
      declarations: [decl({ id: 'd1', status: 'verified' }), decl({ id: 'd2' })],
    }));
    expect(r?.term).toBe('Through December 2026');
    expect(r?.action?.label).toBe('See the renewal');
  });

  it('a certificate close to running out offers the renewal early', () => {
    /* People are re-tested before the day, and a product that will not take
       the new certificate until the old one dies is one that makes somebody
       remember to come back. */
    const r = row(car({ protections: [prot({ term: { kind: 'dated', expiresOn: '2026-08-20' } })] }));
    expect(r?.action?.label).toBe('Renew certificate');
  });

  it('THE ROW IS ALWAYS THERE, whatever else the car has', () => {
    const withOthers = toVehicle(car({
      protections: [{ ...prot({ id: 'p-c', kind: 'ceramic', declarationId: undefined }) }],
    }), picture(), NOW);
    expect(withOthers.protections.map(p => p.label)).toContain('Pollution certificate');
    /* And exactly once - never both as a generic layer and as its own row. */
    expect(withOthers.protections.filter(p => p.label === 'Pollution certificate')).toHaveLength(1);
  });

  it('and the dead WhatsApp declaration is gone from the model entirely', () => {
    expect('declareHref' in toVehicle(car(), picture(), NOW)).toBe(false);
  });

  it('A PROMISE THAT HAS ENDED IS NOT "ACTIVE TO" ANYTHING', () => {
    /* The warranty tile read every dated term including lapsed ones, so a car
       whose only protection was a certificate that ran out on 30 July was
       given "Active to July 2026" - directly under a ledger row saying
       "Lapsed 30 July 2026", on the same screen. */
    const dead = toVehicle(car({
      protections: [prot({ term: { kind: 'dated', expiresOn: '2026-07-30' } })],
    }), picture(), NOW);
    expect(dead.warranty).toBeUndefined();

    /* And a live one still says so. */
    const live = toVehicle(car({ protections: [prot()] }), picture(), NOW);
    expect(live.warranty).toBe('Active to December 2026');
  });
});

/* ── THE CERTIFICATE'S OWN ROOM ──────────────────────────────────────────── */

describe('the certificate’s own room', () => {
  it('MISSING - offers the form and says what will happen to it', () => {
    const m = toPuc(car(), picture(), NOW);
    expect(m.state).toBe('Not added');
    expect(m.declare?.vehicleId).toBe('v1');
    expect(m.standing).toBeUndefined();
    expect(m.pending).toBeUndefined();
    expect(m.record).toEqual([]);
  });

  it('PENDING - the form is withdrawn while the studio holds one', () => {
    const m = toPuc(car({ declarations: [decl()] }), picture(), NOW);
    expect(m.state).toBe('Verification in progress');
    /* §10.5 - a control is never offered for an act the server would refuse. */
    expect(m.declare).toBeUndefined();
    /* Bare dates: the row's label is the word, so a value never repeats it. */
    expect(m.pending).toEqual({
      reference: 'GJ01-PUC-88213',
      until: '1 December 2026',
      sent: '10 August 2026',
    });
    expect(m.standing).toBeUndefined();
  });

  it('ACTIVE - the date is said in full, and the certificate number with it', () => {
    const m = toPuc(car({
      protections: [prot()], declarations: [decl({ status: 'verified' })],
    }), picture(), NOW);
    expect(m.state).toBe('Valid until 1 December 2026');
    expect(m.standing).toEqual({
      reference: 'GJ01-PUC-88213',
      issued: '1 June 2026',
      untilLabel: 'Valid until',
      until: '1 December 2026',
      evidenceUrl: undefined,
    });
  });

  it('EXPIRED - and the way out of it is the form', () => {
    const m = toPuc(car({
      protections: [prot({ term: { kind: 'dated', expiresOn: '2026-07-30' } })],
    }), picture(), NOW);
    expect(m.state).toBe('Expired 30 July 2026');
    expect(m.declare?.title).toBe('Renew it');
    /* A CERTIFICATE THAT HAS GONE IS NOT FILED UNDER "VALID". The room said
       "Expired 30 July" in its headline and "Valid · Valid until 30 July" two
       lines below it - found by looking at the rendered screen, not by any
       assertion that existed before. */
    expect(m.standing?.untilLabel).toBe('Ran out');
    expect(m.standing?.until).toBe('30 July 2026');
  });

  it('RENEWING - both facts are said, and neither is the other', () => {
    const m = toPuc(car({
      protections: [prot()],
      declarations: [
        decl({ id: 'd1', status: 'verified' }),
        decl({ id: 'd2', reference: 'GJ01-PUC-99001', expiresOn: '2027-06-01' }),
      ],
    }), picture(), NOW);
    expect(m.state).toBe('Valid until 1 December 2026');
    expect(m.pending?.reference).toBe('GJ01-PUC-99001');
    expect(m.declare).toBeUndefined();
  });

  it('REJECTED - the studio’s own sentence, verbatim, and never a person’s name', () => {
    const m = toPuc(car({
      declarations: [decl({
        status: 'rejected',
        decisionReason: 'The registration on the certificate is not this car.',
        decidedAt: ts('2026-08-11T10:00:00Z'),
      })],
    }), picture(), NOW);
    expect(m.state).toBe('Not accepted');
    expect(m.refused).toEqual({
      reference: 'GJ01-PUC-88213',
      on: '11 August 2026',
      because: 'The registration on the certificate is not this car.',
    });
    expect(m.declare?.title).toBe('Declare the certificate');
  });

  it('NO FACT IS INVENTED where the studio never had one', () => {
    /* Every pollution certificate in production was seeded, not declared: no
       `since`, no declaration, so no issue date and no certificate number. */
    const m = toPuc(car({
      protections: [prot({ id: 'prot-seltos-puc', since: undefined, declarationId: undefined })],
    }), picture(), NOW);
    expect(m.standing?.until).toBe('1 December 2026');
    expect(m.standing?.reference).toBeUndefined();
    expect(m.standing?.issued).toBeUndefined();
    expect(JSON.stringify(m)).not.toContain('undefined');
  });

  it('THE RECORD IS EVERY CERTIFICATE, newest first, none of them edited', () => {
    const m = toPuc(car({
      protections: [prot({ id: 'v1_puc_d2', declarationId: 'd2', since: '2026-07-25', term: { kind: 'dated', expiresOn: '2027-01-25' } })],
      declarations: [
        decl({ id: 'd1', status: 'superseded', expiresOn: '2026-12-01', submittedAt: ts('2026-01-01T00:00:00Z') }),
        decl({ id: 'd2', status: 'verified', expiresOn: '2027-01-25', submittedAt: ts('2026-07-25T00:00:00Z') }),
      ],
    }), picture(), NOW);
    expect(m.record.map(r => r.id)).toEqual(['d2', 'd1']);
    expect(m.record.map(r => r.state)).toEqual(['Verified', 'Replaced']);
    /* The superseded one keeps its OWN date - this is the whole point. */
    expect(m.record[1].validity).toBe('Until 1 December 2026');
  });

  it('the way to a person survives, and it is not the path', () => {
    const m = toPuc(car(), picture(), NOW);
    expect(m.askHref).toContain('wa.me');
    /* Secondary: the form is what the room offers, and it is offered here. */
    expect(m.declare).toBeDefined();
  });

  it('every string it produces is plain - a Timestamp never crosses to a screen', () => {
    const m = toPuc(car({
      protections: [prot()], declarations: [decl({ id: 'd2' }), decl({ status: 'verified' })],
    }), picture(), NOW);
    expect(JSON.parse(JSON.stringify(m))).toEqual(m);
  });
});

/* ── NAVIGATION ──────────────────────────────────────────────────────────── */

describe('the way back from the certificate', () => {
  it('the address carries the car, so a garage of four cannot lose which', () => {
    expect(hrefForDestination({ to: 'vehicle.puc', vehicleId: 'v1' })).toBe('/vehicle/puc?car=v1');
    expect(hrefForDestination({ to: 'vehicle.puc' })).toBe('/vehicle/puc');
  });

  it('BACK GOES TO THE CAR IT WAS ABOUT - never to another one', () => {
    expect(parentOf('/vehicle/puc?car=v1')).toEqual({ href: '/vehicle?car=v1', name: 'The car' });
    expect(parentOf('/vehicle/puc?car=v2')).toEqual({ href: '/vehicle?car=v2', name: 'The car' });
  });

  it('two cars, two chains, and neither leaks into the other', () => {
    for (const id of ['v1', 'v2']) {
      const puc = hrefForDestination({ to: 'vehicle.puc', vehicleId: id });
      const up = parentOf(puc);
      expect({ id, up }).toEqual({ id, up: { href: `/vehicle?car=${id}`, name: 'The car' } });
      /* And one step further is the collection, as it is from any car. */
      expect(parentOf(up!.href)).toEqual({ href: GARAGE, name: 'Your garage' });
    }
  });

  it('a cold deep link with no car still lands somewhere real', () => {
    /* No `?car=` - the room leads with the same car `/vehicle` does, so the
       screen and its parent agree rather than handing over a different one. */
    expect(parentOf('/vehicle/puc')).toEqual({ href: '/vehicle', name: 'The car' });
  });

  it('and the chain terminates at a dock slot, so it is never a loop', () => {
    expect(parentOf(GARAGE)).toBeNull();
  });

  it('it is the car’s room as far as the dock is concerned', () => {
    expect(roomFor(VEHICLE_PUC)?.path).toBe('/vehicle');
    expect(activeSlotFor(VEHICLE_PUC)).toBe(GARAGE);
    /* And it is a room, so it wears the dark palette like every other. */
    expect(surfaceKind(VEHICLE_PUC)).toBe('room');
  });

  it('there is exactly one Back implementation, and the screen uses it', () => {
    const src = codeOf('components/screens/PucScreen.tsx');
    expect(/<RoomHeader\b/.test(src) || /<Back\b/.test(src)).toBe(true);
    /* No hand-rolled parent: the address decides, as it does everywhere. */
    expect(src).not.toMatch(/history\.back|router\.back/);
  });
});

/* ── ARCHITECTURE ────────────────────────────────────────────────────────── */

describe('the certificate flow obeys the product’s own laws', () => {
  it('no screen reads Firestore, and neither does the form', () => {
    for (const f of ['components/screens/PucScreen.tsx', 'components/protection/PucForm.tsx']) {
      const src = codeOf(f);
      expect({ f, sdk: /from ['"]firebase\//.test(src) }).toEqual({ f, sdk: false });
      expect({ f, db: /from ['"]@\/lib\/firebase/.test(src) }).toEqual({ f, db: false });
    }
  });

  it('the screen builds no address of its own', () => {
    const src = codeOf('components/screens/PucScreen.tsx')
      .replace(/^import[\s\S]*?from\s+['"][^'"]*['"];?$/gm, '');
    expect(src).not.toMatch(/['"`]\/(studio|garage|history|membership|vehicle|you)\b/);
  });

  it('the engine holds every rule, and knows nothing about React or Firestore', () => {
    const src = codeOf('lib/os/puc.ts');
    expect(src).not.toMatch(/from ['"]react['"]/);
    expect(src).not.toMatch(/from ['"]firebase/);
    expect(src).not.toMatch(/from ['"]@\/components/);
  });

  it('THE BROWSER NEVER WRITES A PROTECTION - one door, and the server holds it', () => {
    const rules = readFileSync('firestore.rules', 'utf8');
    const block = rules.slice(
      rules.indexOf('match /protections/{id}'),
      rules.indexOf('match /declarations/{id}'),
    );
    expect(block).toMatch(/allow create, update: if request\.auth != null && isStaff\(\);/);
    expect(block).not.toMatch(/termsSource == 'declared'/);
  });

  it('and never writes a declaration either - every write is the server’s', () => {
    const rules = readFileSync('firestore.rules', 'utf8');
    const at = rules.indexOf('match /declarations/{id}');
    expect(at).toBeGreaterThan(-1);
    const block = rules.slice(at, rules.indexOf('match /', at + 10));
    expect(block).toMatch(/allow create: if false;/);
    expect(block).toMatch(/allow update: if false;/);
    expect(block).toMatch(/allow delete: if false;/);
  });

  it('a customer reads their own papers and nobody else’s', () => {
    const rules = readFileSync('firestore.rules', 'utf8');
    const at = rules.indexOf('match /declarations/{id}');
    const block = rules.slice(at, rules.indexOf('match /', at + 10));
    expect(block).toMatch(/allow read: if request\.auth != null &&/);
    expect(block).toMatch(/ownsVehicle\(resource\.data\.vehicleId\)/);
    expect(block).toMatch(/isStaff\(\)/);
  });

  it('both routes prove who is calling, and neither trusts a uid from its body', () => {
    for (const f of [
      'app/api/protection/puc/declare/route.ts',
      'app/api/protection/puc/verify/route.ts',
    ]) {
      const src = codeOf(f);
      expect({ f, verified: /verifyIdToken/.test(src) }).toEqual({ f, verified: true });
      /* `callerOf` is the one place the cookie fallback is CSRF-guarded, by
         `isSameOrigin`. A route that read the cookie itself would skip it. */
      expect({ f, caller: /sessionCaller\(req/.test(src) }).toEqual({ f, caller: true });
      expect({ f, trusts: /body\.uid|body\.userId|body\.ownerUid/.test(src) })
        .toEqual({ f, trusts: false });
      expect({ f, unauth: /status: 401/.test(src) }).toEqual({ f, unauth: true });
    }
  });

  it('the client may only ever READ a declaration', () => {
    const src = codeOf('lib/services/declarations.ts');
    expect(src).not.toMatch(/setDoc|addDoc|updateDoc|deleteDoc|writeBatch/);
  });

  it('there is no second media pipeline behind the certificate photograph', () => {
    const form = codeOf('components/protection/PucForm.tsx');
    expect(form).toMatch(/from '@\/lib\/services\/storage'/);
    expect(form).not.toMatch(/api\.cloudinary\.com|FormData|firebase\/storage/);
    /* And the path the server checks is the one the form builds. */
    expect(form).toMatch(/evidencePathFor/);
    expect(codeOf('lib/server/pucService.ts')).toMatch(/evidenceBelongsTo/);
  });

  it('pricing is untouched: nothing here decides what anything costs', () => {
    for (const f of ['lib/os/puc.ts', 'lib/server/pucService.ts',
      'components/screens/PucScreen.tsx', 'components/protection/PucForm.tsx']) {
      expect({ f, priced: /priceVisit|decidePrice|totalAmount/.test(codeOf(f)) })
        .toEqual({ f, priced: false });
    }
  });

  it('no employee is ever named on a customer surface', () => {
    for (const f of ['components/screens/PucScreen.tsx', 'components/protection/PucForm.tsx',
      'lib/customer/project.ts']) {
      expect({ f, named: /byEmployeeId|employeeName/.test(codeOf(f)) })
        .toEqual({ f, named: false });
    }
  });

  it('and every engine added here has a caller', () => {
    const callers = [...walk('lib'), ...walk('app'), ...walk('components')]
      .filter(f => f !== 'lib/os/puc.ts')
      .filter(f => /from '@\/lib\/os\/puc'/.test(codeOf(f)));
    expect(callers.length).toBeGreaterThan(2);
  });
});
