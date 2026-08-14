/**
 * ONE PROMISE PER KIND, AND ONE DATE PER VISIT.
 *
 * Both invariants were previously carried by convention rather than by code:
 * "one protection per car per kind" by an id format any writer could ignore
 * (and one did), and "when the work happened" by whichever timestamp a screen
 * reached for. Production showed both failing at once - a car with two glass
 * coatings ten months apart, and July work dated 10 August.
 */
import { oneProtectionPerKind, measurementOf } from '@/lib/os/protection';
import { visitDateOf } from '@/lib/os/visit';
import type { Protection } from '@/lib/types';

const p = (over: Partial<Protection> & { id: string }): Protection => ({
  vehicleId: 'v1', locationId: 'l', kind: 'glass',
  term: { kind: 'dated', expiresOn: '2028-07-16' },
  termsSource: 'captured', since: '2026-07-16',
  ...over,
} as Protection);

/** The two documents production actually holds for the Kia. */
const SEALED = p({ id: 'MfU7e5qLzdLvkvvi8E3o_glass', visitId: 'visit_u6z11', since: '2026-07-16', term: { kind: 'dated', expiresOn: '2028-07-16' } });
const SEEDED = p({ id: 'prot-seltos-glass', visitId: undefined, since: '2026-07-20', term: { kind: 'dated', expiresOn: '2027-09-21' } });

describe('one protection per kind', () => {
  it('collapses duplicates of the same kind to exactly one', () => {
    expect(oneProtectionPerKind([SEALED, SEEDED])).toHaveLength(1);
  });

  it('the visit-linked, captured protection wins - the production case', () => {
    expect(oneProtectionPerKind([SEALED, SEEDED])[0].id).toBe(SEALED.id);
    expect(oneProtectionPerKind([SEEDED, SEALED])[0].id).toBe(SEALED.id);
  });

  it('captured beats declared regardless of dates', () => {
    const declared = p({ id: 'd', termsSource: 'declared', since: '2027-01-01', visitId: 'visit_x' });
    const captured = p({ id: 'c', termsSource: 'captured', since: '2020-01-01' });
    expect(oneProtectionPerKind([declared, captured])[0].id).toBe('c');
  });

  it('a visit-linked protection beats an unlinked one of the same source', () => {
    const linked = p({ id: 'a', visitId: 'visit_1' });
    const loose = p({ id: 'b', visitId: undefined });
    expect(oneProtectionPerKind([loose, linked])[0].id).toBe('a');
  });

  it('a dated protection beats an undated one', () => {
    const dated = p({ id: 'a', since: '2026-01-01', visitId: undefined });
    const undated = p({ id: 'b', since: undefined, visitId: undefined });
    expect(oneProtectionPerKind([undated, dated])[0].id).toBe('a');
  });

  it('the newest `since` wins when everything else ties', () => {
    const older = p({ id: 'a', since: '2025-01-01', visitId: 'v' });
    const newer = p({ id: 'b', since: '2026-01-01', visitId: 'v' });
    expect(oneProtectionPerKind([older, newer])[0].id).toBe('b');
  });

  it('is deterministic whatever order Firestore returns', () => {
    const set = [SEALED, SEEDED, p({ id: 'z', termsSource: 'declared', visitId: undefined, since: undefined })];
    const permutations = [
      [set[0], set[1], set[2]], [set[2], set[1], set[0]],
      [set[1], set[0], set[2]], [set[2], set[0], set[1]],
    ];
    const answers = permutations.map(x => oneProtectionPerKind(x)[0].id);
    expect(new Set(answers).size).toBe(1);
    expect(answers[0]).toBe(SEALED.id);
  });

  it('never merges fields from two documents', () => {
    const [only] = oneProtectionPerKind([SEALED, SEEDED]);
    /* The winner whole - not its `since` with the other's expiry. */
    expect(only).toEqual(SEALED);
    expect(only.term).toEqual({ kind: 'dated', expiresOn: '2028-07-16' });
  });

  it('different kinds stay independent', () => {
    const ceramic = p({ id: 'cer', kind: 'ceramic' });
    expect(oneProtectionPerKind([SEALED, SEEDED, ceramic])).toHaveLength(2);
  });

  it('two vehicles never leak into each other', () => {
    const other = p({ id: 'other', vehicleId: 'v2', since: '2027-01-01' });
    /* Dedupe is applied per car by the projection; given one car's list, a
       foreign document must not be able to displace it. */
    const mine = oneProtectionPerKind([SEALED, SEEDED].filter(x => x.vehicleId === 'v1'));
    expect(mine[0].vehicleId).toBe('v1');
    expect(oneProtectionPerKind([other]).every(x => x.vehicleId === 'v2')).toBe(true);
  });
});

describe('measured versus estimated', () => {
  it('a protection with `since` and a dated term is measured', () => {
    expect(measurementOf(SEALED)).toBe('measured');
  });
  it('without `since` it is only estimated - a bucket, not a measurement', () => {
    expect(measurementOf({ since: undefined, term: { kind: 'dated', expiresOn: '2028-01-01' } })).toBe('estimated');
  });
  it('a perpetual term is never a percentage', () => {
    expect(measurementOf({ since: '2026-01-01', term: { kind: 'perpetual' } })).toBe('estimated');
  });
});

describe('the canonical visit date', () => {
  const ts = (iso: string) => ({ toDate: () => new Date(`${iso}T09:00:00Z`) });

  it('prefers the snapshot taken at seal', () => {
    expect(visitDateOf({
      servicedOn: '2026-07-16',
      requestedFor: { date: '2026-07-20' },
      createdAt: ts('2026-08-10'),
    })).toBe('2026-07-16');
  });

  it('THE PRODUCTION CASE - the seal date never becomes the service date', () => {
    /* Kia: worked on the 16th, sealed by a backfill on 10 August. */
    expect(visitDateOf({
      stages: [{ at: ts('2026-07-16') }],
      requestedFor: { date: '2026-07-20' },
      createdAt: ts('2026-08-10'),
    })).toBe('2026-07-16');

    /* BMW: worked on the 22nd, booked for the 27th, sealed on 10 August. */
    expect(visitDateOf({
      stages: [{ at: ts('2026-07-22') }],
      requestedFor: { date: '2026-07-27' },
      createdAt: ts('2026-08-10'),
    })).toBe('2026-07-22');
  });

  it('takes the LAST stage, whatever order the stages arrive in', () => {
    const stages = [{ at: ts('2026-07-22') }, { at: ts('2026-07-16') }, { at: ts('2026-07-19') }];
    expect(visitDateOf({ stages })).toBe('2026-07-22');
  });

  it('falls back to the booked day only when no stage was recorded', () => {
    expect(visitDateOf({ requestedFor: { date: '2026-07-20' }, createdAt: ts('2026-08-10') }))
      .toBe('2026-07-20');
  });

  it('uses createdAt only as the last resort', () => {
    expect(visitDateOf({ createdAt: ts('2026-08-10') })).toBe('2026-08-10');
  });

  it('a stage with no usable timestamp cannot become the date', () => {
    expect(visitDateOf({
      stages: [{ at: undefined }, { at: { toDate: () => new Date(NaN) } }],
      requestedFor: { date: '2026-07-20' },
    })).toBe('2026-07-20');
  });
});
