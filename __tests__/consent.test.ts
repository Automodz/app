/**
 * PUBLIC HISTORY CONSENT.
 *
 * Screen 17 publishes a real customer's service record to strangers. These
 * assertions are the boundary: absent means no, revocation is immediate, and
 * a surface that forgets to check is handed `null` rather than a zero - because
 * "0 visits" is itself a claim about the car.
 */
import { hasPublicHistoryConsent, publicHistoryOf } from '@/lib/os/consent';
import type { Vehicle, Visit } from '@/lib/types';

const ts = (iso: string) => ({
  toMillis: () => new Date(iso).getTime(),
  toDate: () => new Date(iso),
}) as unknown as import('firebase/firestore').Timestamp;

const car = (c?: Vehicle['publicHistoryConsent']) =>
  ({ publicHistoryConsent: c }) as Pick<Vehicle, 'publicHistoryConsent'>;

const VISITS = [{}, {}, {}] as Pick<Visit, 'servicedOn' | 'stages'>[];
const history = (v: Pick<Vehicle, 'publicHistoryConsent'> | null | undefined) =>
  publicHistoryOf({
    vehicle: v,
    visits: VISITS,
    protections: [{ label: 'Full-body PPF', detail: '68% life' }],
    photographs: 340,
    since: '2021',
  });

describe('absent means no - nobody is grandfathered in', () => {
  it('a car with no consent record is private', () => {
    expect(hasPublicHistoryConsent(car(undefined))).toBe(false);
    expect(history(car(undefined))).toBeNull();
  });

  it('a car that predates the field is private', () => {
    expect(hasPublicHistoryConsent({} as Vehicle)).toBe(false);
  });

  it('null and undefined vehicles are private, not a crash', () => {
    expect(hasPublicHistoryConsent(null)).toBe(false);
    expect(hasPublicHistoryConsent(undefined)).toBe(false);
    expect(history(null)).toBeNull();
  });

  it('granted:false is private', () => {
    expect(hasPublicHistoryConsent(car({ granted: false }))).toBe(false);
  });
});

describe('granted', () => {
  it('an explicit grant publishes', () => {
    const v = car({ granted: true, grantedAt: ts('2026-01-01') });
    expect(hasPublicHistoryConsent(v)).toBe(true);
    expect(history(v)).toEqual({
      since: '2021',
      visits: 3,
      photographs: 340,
      protections: [{ label: 'Full-body PPF', detail: '68% life' }],
    });
  });
});

describe('revocation is immediate', () => {
  it('a later revocation beats an earlier grant, even with granted still true', () => {
    const v = car({ granted: true, grantedAt: ts('2026-01-01'), revokedAt: ts('2026-06-01') });
    expect(hasPublicHistoryConsent(v)).toBe(false);
    expect(history(v)).toBeNull();
  });

  it('a re-grant after a revocation publishes again', () => {
    const v = car({ granted: true, revokedAt: ts('2026-06-01'), grantedAt: ts('2026-07-01') });
    expect(hasPublicHistoryConsent(v)).toBe(true);
  });

  it('a revocation with no grant recorded is still private', () => {
    expect(hasPublicHistoryConsent(car({ granted: true, revokedAt: ts('2026-06-01') }))).toBe(false);
  });
});

describe('consent is never inferred', () => {
  it('not from having visits', () => {
    expect(publicHistoryOf({
      vehicle: car(undefined), visits: VISITS, protections: [], photographs: 340, since: '2021',
    })).toBeNull();
  });

  it('not from having photographs', () => {
    expect(publicHistoryOf({
      vehicle: car(undefined), visits: VISITS, protections: [], photographs: 999, since: '2021',
    })).toBeNull();
  });

  it('not from having protections', () => {
    expect(publicHistoryOf({
      vehicle: car(undefined), visits: VISITS,
      protections: [{ label: 'PPF', detail: '68%' }], photographs: 0, since: '2021',
    })).toBeNull();
  });
});

describe('null, never a zero - a count is itself a claim', () => {
  it('no consent returns null rather than an empty shape', () => {
    const h = history(car(undefined));
    expect(h).toBeNull();
    /* A caller that forgets to check gets nothing to read, so it cannot print
       "0 visits" or "since -". */
    expect(h?.visits).toBeUndefined();
    expect(h?.photographs).toBeUndefined();
    expect(h?.since).toBeUndefined();
  });

  it('consent but no visits still returns null - there is no history to claim', () => {
    expect(publicHistoryOf({
      vehicle: car({ granted: true, grantedAt: ts('2026-01-01') }),
      visits: [], protections: [], photographs: 0, since: '2021',
    })).toBeNull();
  });

  it('consent but no start year returns null', () => {
    expect(publicHistoryOf({
      vehicle: car({ granted: true, grantedAt: ts('2026-01-01') }),
      visits: VISITS, protections: [], photographs: 5, since: undefined,
    })).toBeNull();
  });
});

describe('what a buyer may learn, and what they may not', () => {
  it('counts and worded facts only - no documents, prices or customer', () => {
    const h = history(car({ granted: true, grantedAt: ts('2026-01-01') }))!;
    const keys = Object.keys(h).sort();
    expect(keys).toEqual(['photographs', 'protections', 'since', 'visits']);
    const flat = JSON.stringify(h);
    expect(flat).not.toMatch(/₹/);
    expect(flat).not.toMatch(/invoice/i);
    expect(flat).not.toMatch(/customer|owner|phone|email/i);
  });
});
