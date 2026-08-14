/**
 * SERVICE IDENTITY, AND WHAT IT COSTS TO GET IT WRONG.
 *
 * A real customer lost a real warranty to one capital letter: a job recorded
 * "Glass Coating", the catalogue holds "Glass coating", the match was exact and
 * case-sensitive, and the car's two-year glass protection was never created.
 *
 * These assertions pin the resolution order and, more importantly, its LIMITS.
 * A matcher loose enough to bridge a typo is loose enough to bridge "Ceramic
 * coating" and "Ceramic maintenance", which are different promises.
 */
import { captureTerms, resolveService, protectionsFromVisit } from '@/lib/os/protection';
import type { Service, Visit } from '@/lib/types';

const svc = (over: Partial<Service>): Service => ({
  id: 'svc-glass', category: 'Coating', name: 'Glass coating', brand: 'Kovalent',
  price: 12000, duration: 150, warranty: '2 years', description: '', popular: false,
  active: true, order: 1, createdAt: null as never,
  ...over,
} as Service);

const CATALOGUE: Service[] = [
  svc({}),
  svc({ id: 'svc-ceramic', name: 'Ceramic coating', category: 'Ceramic', warranty: '3 years' }),
  svc({ id: 'svc-ceramic-maint', name: 'Ceramic maintenance', category: 'Ceramic', warranty: '' }),
  svc({ id: 'svc-wash', name: 'Maintenance wash', category: 'Washing', warranty: '' }),
];

const capture = (work: { serviceName: string; serviceId?: string; category: string }) =>
  captureTerms({
    work: [{ ...work, appliedOn: '2026-07-20' }],
    catalogue: CATALOGUE,
    source: 'captured',
  });

describe('service resolution', () => {
  it('a valid serviceId wins, even when the name disagrees', () => {
    /* The id is the identity. A stale or mis-typed display name on the job must
       not be able to select a different promise. */
    const s = resolveService(CATALOGUE, { serviceId: 'svc-ceramic', serviceName: 'Glass coating' });
    expect(s?.id).toBe('svc-ceramic');
  });

  it('falls back to the name when the id belongs to a retired catalogue', () => {
    /* Production jobs carry `s7` and `s14` against today's `svc-*` ids: the
       service catalogue was replaced and the historical ids resolve to nothing.
       The name is then the only key left. */
    for (const legacyId of ['s7', 's14']) {
      const s = resolveService(CATALOGUE, { serviceId: legacyId, serviceName: 'Glass coating' });
      expect(s?.id).toBe('svc-glass');
    }
  });

  it('THE PRODUCTION DEFECT: "Glass Coating" resolves to "Glass coating"', () => {
    const s = resolveService(CATALOGUE, { serviceId: 's14', serviceName: 'Glass Coating' });
    expect(s?.id).toBe('svc-glass');
    expect(s?.warranty).toBe('2 years');
  });

  it('tolerates surrounding and repeated whitespace, and nothing else', () => {
    expect(resolveService(CATALOGUE, { serviceName: '  glass   coating ' })?.id).toBe('svc-glass');
  });

  it('NEVER bridges two different services', () => {
    /* The failure mode a fuzzy matcher would introduce. These two are one word
       apart and carry different terms - 3 years against none. */
    expect(resolveService(CATALOGUE, { serviceName: 'Ceramic' })).toBeUndefined();
    expect(resolveService(CATALOGUE, { serviceName: 'Ceramic coat' })).toBeUndefined();
    expect(resolveService(CATALOGUE, { serviceName: 'Ceramic maintenance' })?.id)
      .toBe('svc-ceramic-maint');
  });

  it('an unknown service resolves to nothing', () => {
    expect(resolveService(CATALOGUE, { serviceId: 's99', serviceName: 'Dry Clean' })).toBeUndefined();
  });
});

describe('what capture does with that', () => {
  it('the recovered glass coating promises two years from the day it was done', () => {
    const [term] = capture({ serviceName: 'Glass Coating', serviceId: 's14', category: 'Coating' });
    expect(term.kind).toBe('glass');
    expect(term.term).toEqual({ kind: 'dated', expiresOn: '2028-07-20' });
    expect(term.source).toBe('captured');
  });

  it('an unresolved service produces NO protection - never a blank one', () => {
    expect(capture({ serviceName: 'Something we do not sell', category: 'Coating' })).toEqual([]);
  });

  it('a resolved service with no warranty produces no protection either', () => {
    expect(capture({ serviceName: 'Ceramic maintenance', category: 'Ceramic' })).toEqual([]);
  });

  it('a category that sells no promise is skipped before resolution', () => {
    expect(capture({ serviceName: 'Maintenance wash', category: 'Washing' })).toEqual([]);
  });
});

describe('`since` is a fact about the car, not about the record', () => {
  const visit = {
    id: 'visit_x', vehicleId: 'v1', locationId: 'maninagar',
    termsCaptured: capture({ serviceName: 'Glass Coating', serviceId: 's14', category: 'Coating' }),
  } as Pick<Visit, 'id' | 'vehicleId' | 'locationId' | 'termsCaptured' | 'requestedFor'>;

  it('is the day the work was done, and is deterministic', () => {
    const a = protectionsFromVisit(visit, '2026-07-20');
    const b = protectionsFromVisit(visit, '2026-07-20');
    expect(a[0].since).toBe('2026-07-20');
    expect(a).toEqual(b);
  });

  it('every captured protection carries one', () => {
    for (const p of protectionsFromVisit(visit, '2026-07-20')) {
      expect(p.since).toBeTruthy();
    }
  });
});

describe('§14.5 - a catalogue edit cannot reach back', () => {
  it('re-pricing or re-wording a warranty does not move an existing protection', () => {
    /* The captured term is the snapshot. `protectionsFromVisit` reads
       `termsCaptured` and never the catalogue, which is the whole reason the
       sealed visit exists. */
    const captured = capture({ serviceName: 'Glass Coating', serviceId: 's14', category: 'Coating' });
    const of = (terms: typeof captured) => protectionsFromVisit(
      { id: 'v', vehicleId: 'v1', locationId: 'l', termsCaptured: terms } as Pick<
        Visit, 'id' | 'vehicleId' | 'locationId' | 'termsCaptured' | 'requestedFor'>,
      '2026-07-20',
    );
    const before = of(captured);

    /* The studio now doubles the warranty and renames the service. */
    CATALOGUE[0] = svc({ warranty: '4 years', name: 'Glass coating PRO' });

    const after = of(captured);
    expect(after).toEqual(before);
    expect(after[0].term).toEqual({ kind: 'dated', expiresOn: '2028-07-20' });
  });
});
