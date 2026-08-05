import { ownershipState, DORMANT_DAYS, type OwnershipInput } from '@/lib/os/ownership';
import { liveProtection, type LiveProtection } from '@/lib/os/protection';
import type { ClubModel } from '@/lib/os/club';

import type { Booking } from '@/lib/types';

const NOW = new Date('2026-07-20T10:00:00');
const iso = (d: number) => {
  const t = new Date(NOW);
  t.setDate(t.getDate() + d);
  return t.toISOString().slice(0, 10);
};

const booking = (status: string, date = iso(0)) =>
  ({ id: `b-${status}-${date}`, status, scheduledDate: date } as unknown as Booking);

const club = (over: Partial<ClubModel> = {}): ClubModel => ({
  state: 'none', plan: null, since: null,
  washesLeft: 0, washesUsed: 0, washesTotal: 0,
  renewsOn: null, context: null, awaitingPayment: false, invited: false,
  ...over,
});

/* Built through `liveProtection` so `health` comes from the real term engine.
   The old fixture set `term: 'active' | 'waning' | 'expiring'` directly — a
   health WORD on a field that now holds a Term OBJECT. Tests take a days-left
   number instead and let the engine decide the health. */
const protection = (daysLeft = 400): LiveProtection =>
  liveProtection({
    id: `p-${daysLeft}`, vehicleId: 'v1', kind: 'ceramic',
    term: { kind: 'dated', expiresOn: iso(daysLeft) },
    termsSource: 'captured',
    createdAt: null as never, updatedAt: null as never,
  }, NOW);

/** Days that land each health band, per lib/os/term (WANING_DAYS = 30). */
const HEALTHY = 400, ATTENTION = 20, URGENT = 3, LAPSED = -5;

const base: OwnershipInput = {
  vehicleCount: 1, live: null, agreed: null, declined: null,
  completed: [], protections: [], club: club(), now: NOW,
};

const stateOf = (over: Partial<OwnershipInput>) =>
  ownershipState({ ...base, ...over }).state;

describe('ownership state engine', () => {
  it('an empty garage is the new state', () => {
    expect(stateOf({ vehicleCount: 0 })).toBe('new');
  });

  it('a car in our hands outranks everything else', () => {
    expect(stateOf({
      live: booking('in_progress'),
      agreed: booking('confirmed', iso(3)),
      club: club({ state: 'lapsed' }),
      protections: [protection(URGENT)],
    })).toBe('in_studio');
  });

  it('a finished car is its own state', () => {
    expect(stateOf({ live: booking('ready_for_delivery') })).toBe('ready');
  });

  it('a refused visit outranks a booking', () => {
    expect(stateOf({ declined: booking('cancelled'), agreed: booking('confirmed', iso(3)) }))
      .toBe('declined');
  });

  it('an agreed visit leads when nothing is in flight', () => {
    expect(stateOf({ agreed: booking('confirmed', iso(3)) })).toBe('booked');
    expect(stateOf({ agreed: booking('pending', iso(3)) })).toBe('booked');
  });

  it('a lapsed club outranks an expiring warranty', () => {
    expect(stateOf({
      club: club({ state: 'lapsed' }),
      protections: [protection(URGENT)],
      completed: [booking('completed', iso(-10))],
    })).toBe('membership_attention');
  });

  it('an expiring warranty outranks a steady car', () => {
    expect(stateOf({
      protections: [protection(ATTENTION)],
      completed: [booking('completed', iso(-10))],
    })).toBe('warranty_expiring');
  });

  it('silence past the dormant threshold is its own state', () => {
    expect(stateOf({ completed: [booking('completed', iso(-DORMANT_DAYS - 1))] })).toBe('dormant');
    expect(stateOf({ completed: [booking('completed', iso(-DORMANT_DAYS + 5))] })).toBe('settled');
  });

  it('separates a protected car from a bare one', () => {
    expect(stateOf({
      completed: [booking('completed', iso(-10))],
      protections: [protection(HEALTHY)],
    })).toBe('protected');
    expect(stateOf({ completed: [booking('completed', iso(-10))] })).toBe('settled');
  });

  it('a car with no story yet is unvisited', () => {
    expect(stateOf({})).toBe('unvisited');
  });
});

describe('module order', () => {
  it('always returns every module exactly once', () => {
    const cases: Partial<OwnershipInput>[] = [
      { vehicleCount: 0 },
      { live: booking('in_progress') },
      { live: booking('ready_for_delivery') },
      { agreed: booking('confirmed', iso(2)) },
      { club: club({ state: 'lapsed' }), completed: [booking('completed', iso(-5))] },
      { protections: [protection(URGENT)], completed: [booking('completed', iso(-5))] },
      { completed: [booking('completed', iso(-DORMANT_DAYS - 1))] },
      { completed: [booking('completed', iso(-5))], protections: [protection(HEALTHY)] },
    ];
    for (const c of cases) {
      const { order } = ownershipState({ ...base, ...c });
      expect([...order].sort()).toEqual(
        ['activity', 'documents', 'ownership', 'protection', 'status', 'studio'],
      );
    }
  });

  it('reorganises the page per state - no two of these lead alike', () => {
    const lead = (over: Partial<OwnershipInput>) => ownershipState({ ...base, ...over }).order[0];
    expect(lead({ live: booking('in_progress') })).toBe('status');
    expect(lead({ club: club({ state: 'lapsed' }), completed: [booking('completed', iso(-5))] }))
      .toBe('ownership');
    expect(lead({ protections: [protection(URGENT)], completed: [booking('completed', iso(-5))] }))
      .toBe('protection');
  });
});
