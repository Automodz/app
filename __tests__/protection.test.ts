import {
  healthOf, termHolds, termDaysLeft, termState, type Term,
} from '@/lib/os/term';
import {
  termFromWarranty, captureTerms, protectionsFromVisit,
  liveProtection, sortByUrgency, isStudioApplied,
} from '@/lib/os/protection';
import { visitFromPair } from '@/lib/services/visits';
import type { Booking, Job, Protection, Service, Visit } from '@/lib/types';

const NOW = new Date('2026-07-20T10:00:00');
const iso = (offsetDays: number) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

const service = (over: Partial<Service> = {}): Service => ({
  id: 's1', category: 'Ceramic', name: 'Kovalent Graphene', brand: 'Kovalent',
  price: 12000, duration: 480, warranty: '3 Year', description: '',
  popular: false, active: true, order: 1,
  ...over,
} as unknown as Service);

describe('the generalised Term', () => {
  it('maps a dated term through the one lifecycle, unchanged', () => {
    expect(healthOf({ kind: 'dated', expiresOn: iso(90) }, NOW)).toBe('healthy');
    expect(healthOf({ kind: 'dated', expiresOn: iso(20) }, NOW)).toBe('attention');
    expect(healthOf({ kind: 'dated', expiresOn: iso(3) }, NOW)).toBe('urgent');
    expect(healthOf({ kind: 'dated', expiresOn: iso(-1) }, NOW)).toBe('lapsed');
    // membership is the one term that gets grace, and grace still asks for action
    expect(healthOf({ kind: 'dated', expiresOn: iso(-3), grace: true }, NOW)).toBe('urgent');
  });

  it('does not fork the lifecycle - dated health follows termState exactly', () => {
    for (const d of [90, 31, 30, 8, 7, 1, 0, -1]) {
      const term: Term = { kind: 'dated', expiresOn: iso(d) };
      const viaState = termState(iso(d), { now: NOW });
      const viaHealth = healthOf(term, NOW);
      const expected = { active: 'healthy', waning: 'attention', expiring: 'urgent', grace: 'urgent', lapsed: 'lapsed' }[viaState];
      expect(viaHealth).toBe(expected);
    }
  });

  /* A lifetime warranty does not deplete. Asking it for a countdown is how
     "98% protected" gets printed on something that never expires. */
  it('never gives a perpetual term a countdown', () => {
    const term: Term = { kind: 'perpetual' };
    expect(healthOf(term, NOW)).toBe('healthy');
    expect(termDaysLeft(term, NOW)).toBeNull();
    expect(termHolds(term, NOW)).toBe(true);
  });

  it('measures a balance term in money, not days', () => {
    expect(healthOf({ kind: 'balance', value: 500, low: 200 }, NOW)).toBe('healthy');
    expect(healthOf({ kind: 'balance', value: 200, low: 200 }, NOW)).toBe('attention');
    expect(healthOf({ kind: 'balance', value: 0, low: 200 }, NOW)).toBe('urgent');
    expect(termDaysLeft({ kind: 'balance', value: 500, low: 200 }, NOW)).toBeNull();
  });
});

describe('capturing a term', () => {
  it('reads a catalogue warranty once, as at the date of the work', () => {
    expect(termFromWarranty('3 Year', '2026-04-20'))
      .toEqual({ kind: 'dated', expiresOn: '2029-04-20' });
    expect(termFromWarranty('6 Month', '2026-04-20'))
      .toEqual({ kind: 'dated', expiresOn: '2026-10-20' });
    expect(termFromWarranty('Lifetime', '2026-04-20')).toEqual({ kind: 'perpetual' });
  });

  /* The predecessor turned a missing warranty into an endlessly "active"
     protection, which renders as *Protected* forever - a promise nobody
     made. Art. 1.6: nothing is faked. */
  it('promises nothing when the catalogue promises nothing', () => {
    expect(termFromWarranty(null, '2026-04-20')).toBeNull();
    expect(termFromWarranty('', '2026-04-20')).toBeNull();
    const captured = captureTerms({
      work: [{ serviceName: 'Signature Wash', category: 'Washing', appliedOn: '2026-04-20' }],
      catalogue: [service({ name: 'Signature Wash', category: 'Washing', warranty: null })],
      source: 'captured',
    });
    expect(captured).toEqual([]);
  });

  it('keeps one promise per kind - a re-coat replaces its ancestor', () => {
    const captured = captureTerms({
      work: [
        { serviceName: 'Kovalent Graphene', category: 'Ceramic', appliedOn: '2024-01-01' },
        { serviceName: 'Kovalent Graphene', category: 'Ceramic', appliedOn: '2026-04-20' },
      ],
      catalogue: [service()],
      source: 'captured',
    });
    expect(captured).toHaveLength(1);
    expect(captured[0].term).toEqual({ kind: 'dated', expiresOn: '2029-04-20' });
  });
});

/* THE REASON THE ANCHOR EXISTS (docs/VISIT-OBJECT.md §1).
   Warranties used to be resolved from the live catalogue on every read, so a
   typo fix in admin silently rewrote what past customers had been promised. */
describe('a sealed promise cannot be rewritten by the catalogue', () => {
  const visit = (): Visit => ({
    id: 'v1', vehicleId: 'car1', locationId: 'maninagar',
    termsCaptured: captureTerms({
      work: [{ serviceName: 'Kovalent Graphene', category: 'Ceramic', appliedOn: '2026-04-20' }],
      catalogue: [service({ warranty: '3 Year' })],
      source: 'captured',
    }),
  } as unknown as Visit);

  it('captures the term as sold', () => {
    const [p] = protectionsFromVisit(visit(), '2026-04-20');
    expect(p.kind).toBe('ceramic');
    expect(p.term).toEqual({ kind: 'dated', expiresOn: '2029-04-20' });
    expect(p.termsSource).toBe('captured');
    expect(p.visitId).toBe('v1');
  });

  it('is unaffected when the catalogue changes afterwards', () => {
    const sealed = visit();
    const before = protectionsFromVisit(sealed, '2026-04-20')[0].term;

    // the owner edits the catalogue: 3 Year becomes 1 Year
    const editedCatalogue = [service({ warranty: '1 Year' })];
    // re-reading the SEALED visit consults no catalogue at all
    const after = protectionsFromVisit(sealed, '2026-04-20')[0].term;

    expect(after).toEqual(before);
    expect(after).toEqual({ kind: 'dated', expiresOn: '2029-04-20' });
    // and a NEW sale correctly gets the new, shorter term
    const fresh = captureTerms({
      work: [{ serviceName: 'Kovalent Graphene', category: 'Ceramic', appliedOn: '2026-07-20' }],
      catalogue: editedCatalogue, source: 'captured',
    });
    expect(fresh[0].term).toEqual({ kind: 'dated', expiresOn: '2027-07-20' });
  });
});

describe('reading protections', () => {
  const p = (over: Partial<Protection>): Protection => ({
    id: 'p', vehicleId: 'car1', kind: 'ceramic', term: { kind: 'dated', expiresOn: iso(90) },
    termsSource: 'captured', ...over,
  } as unknown as Protection);

  it('leads with whatever most needs attention', () => {
    const list = [
      p({ id: 'healthy', kind: 'ppf', term: { kind: 'perpetual' } }),
      p({ id: 'urgent', kind: 'puc', term: { kind: 'dated', expiresOn: iso(3) } }),
      p({ id: 'attention', kind: 'insurance', term: { kind: 'dated', expiresOn: iso(20) } }),
    ].map(x => liveProtection(x, NOW));

    expect(sortByUrgency(list).map(x => x.id)).toEqual(['urgent', 'attention', 'healthy']);
  });

  it('knows which promises AutoModz makes and which the owner brings', () => {
    expect(isStudioApplied('ppf')).toBe(true);
    expect(isStudioApplied('ceramic')).toBe(true);
    expect(isStudioApplied('insurance')).toBe(false);
    expect(isStudioApplied('puc')).toBe(false);
    expect(isStudioApplied('fastag')).toBe(false);
  });
});

describe('the Booking + Job → Visit projection', () => {
  const ts = (d: Date) => ({ toDate: () => d, toMillis: () => d.getTime() }) as unknown as import('firebase/firestore').Timestamp;

  const booking = (over: Partial<Booking> = {}): Booking => ({
    id: 'b1', vehicleId: 'car1', status: 'completed',
    serviceId: 's1', serviceName: 'Kovalent Graphene', serviceCategory: 'Ceramic',
    serviceBasePrice: 12000, totalAmount: 12000,
    scheduledDate: '2026-04-20', scheduledTime: '09:00',
    createdAt: ts(new Date('2026-04-20T09:00:00')), updatedAt: ts(new Date('2026-04-20T17:30:00')),
    ...over,
  } as unknown as Booking);

  const job = (): Job => ({
    id: 'j1', source: 'booking', status: 'completed', bay: 2,
    statusHistory: [
      { status: 'checked_in', at: ts(new Date('2026-04-20T09:05:00')), byEmployeeId: 'e1', byEmployeeName: 'Ravi Sharma' },
      { status: 'in_progress', at: ts(new Date('2026-04-20T09:40:00')), byEmployeeId: 'e1', byEmployeeName: 'Ravi Sharma', note: 'Two-stage paint correction before the coat.' },
      { status: 'completed', at: ts(new Date('2026-04-20T17:30:00')), byEmployeeId: 'e1', byEmployeeName: 'Ravi Sharma' },
    ],
    photos: [
      { url: 'before.jpg', path: 'p1', kind: 'before' },
      { url: 'after.jpg', path: 'p2', kind: 'after' },
    ],
  } as unknown as Job);

  it('seals a completed visit and captures its terms as reconstructed', () => {
    const v = visitFromPair(booking(), job(), [service()]);
    expect(v.status).toBe('sealed');
    expect(v.sealedAt).toBeDefined();
    expect(v.termsCaptured).toHaveLength(1);
    expect(v.termsCaptured[0].source).toBe('reconstructed');
    expect(v.termsCaptured[0].term).toEqual({ kind: 'dated', expiresOn: '2029-04-20' });
  });

  it('captures nothing for a visit still in flight', () => {
    const v = visitFromPair(booking({ status: 'in_progress' }), job(), [service()]);
    expect(v.status).toBe('open');
    expect(v.sealedAt).toBeUndefined();
    expect(v.termsCaptured).toEqual([]);
  });

  it('projects the floor’s record into stages, keeping the studio’s own words', () => {
    const v = visitFromPair(booking(), job(), [service()]);
    expect(v.stages.map(s => s.stage)).toEqual(['received', 'deep_clean', 'ready']);
    expect(v.stages[1].note).toBe('Two-stage paint correction before the coat.');
    expect(v.stages[0].media).toEqual([{ url: 'before.jpg', kind: 'photo' }]);
  });

  /* THE ACTOR LAW (Constitution Art. 8). The projection keeps byEmployeeId so
     the studio retains accountability; no NAME may survive into the anchor. */
  it('never carries an individual’s name into the anchor', () => {
    const v = visitFromPair(booking(), job(), [service()]);
    expect(JSON.stringify(v)).not.toContain('Ravi Sharma');
    expect(v.stages[0].byEmployeeId).toBe('e1');
  });

  it('is idempotent - the projection is keyed by the booking', () => {
    const [bk, jb, cat] = [booking(), job(), [service()]];
    const a = visitFromPair(bk, jb, cat);
    const b = visitFromPair(bk, jb, cat);
    expect(a.id).toBe(bk.id);
    // Timestamps are mocks carrying function refs, so compare by value
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
