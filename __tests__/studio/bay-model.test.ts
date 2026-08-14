/**
 * THE BAY MODEL: FIVE BAYS, ONE PER BOOKING, NOBODY OVERWRITES THE STUDIO.
 *
 * The engine used to COUNT: a per-30-minute tally per group, refused once the
 * tally hit capacity. Sound arithmetic, but it could not say WHICH bay a car
 * was going in - so nothing was assigned, no bay could be taken out of service
 * by name, and an admin override could put two cars in one bay with no record.
 *
 * These are the cases the owner listed, each asserted against the pure engine
 * (`assignBay`) or the pure state machine (`bookingTransition`). The Firestore
 * transaction that uses them is exercised by `booking/workflow`; what is worth
 * pinning here is the decision itself.
 */
import {
  assignBay, baysOf, baysFor, computeAvailability, resourceCapacity,
  expandIntervals, RESOURCE_DEFAULTS, DAY_OPEN_MIN,
  type Occupant, type ResourceConfig,
} from '@/lib/availability';
import { bookingTransition } from '@/lib/os/lifecycle';

const FLOOR: ResourceConfig = RESOURCE_DEFAULTS;
const DATE = '2026-09-07';
const AT_9 = DAY_OPEN_MIN;

const held = (
  durationMin: number,
  bayId?: string,
  resource: 'protection' | 'wash' = 'protection',
  date = DATE,
  startMin = AT_9,
): Occupant => ({ resource, date, startMin, durationMin, bayId } as Occupant);

const place = (category: string, durationMin: number, occupants: Occupant[], cfg = FLOOR) =>
  assignBay(category, DATE, AT_9, durationMin, occupants, cfg);

/* ── ASSIGNMENT ──────────────────────────────────────────────────────────── */

describe('a booking reserves one named bay', () => {
  it('the floor is five bays: three protection, two wash', () => {
    expect(baysOf(FLOOR).map(b => b.id))
      .toEqual(['protection-1', 'protection-2', 'protection-3', 'wash-1', 'wash-2']);
  });

  it('assignment is deterministic - the lowest free bay, every time', () => {
    expect(place('Ceramic', 480, [])?.id).toBe('protection-1');
    expect(place('Ceramic', 480, [held(480, 'protection-1')])?.id).toBe('protection-2');
    expect(place('Ceramic', 480, [held(480, 'protection-1'), held(480, 'protection-2')])?.id)
      .toBe('protection-3');
  });

  it('the fourth car finds nothing - two customers cannot take the last bay', () => {
    const full = [held(480, 'protection-1'), held(480, 'protection-2'), held(480, 'protection-3')];
    expect(place('Ceramic', 480, full)).toBeNull();
    /* And the display agrees, because it asks the same function. */
    const { fullSlots } = computeAvailability([DATE], 'Ceramic', 480, full, FLOOR);
    expect(fullSlots[DATE]).toContain('09:00');
  });

  it('washing never consumes a protection bay, however busy protection is', () => {
    const protectionFull = [
      held(2880, 'protection-1'), held(2880, 'protection-2'), held(2880, 'protection-3'),
    ];
    expect(place('Washing', 60, protectionFull)?.group).toBe('wash');
    expect(place('Washing', 60, protectionFull)?.id).toBe('wash-1');
  });

  it('and protection never consumes a wash bay', () => {
    const washFull = [held(60, 'wash-1', 'wash'), held(60, 'wash-2', 'wash')];
    expect(place('Ceramic', 480, washFull)?.group).toBe('protection');
    expect(baysFor('Washing', FLOOR).every(b => b.group === 'wash')).toBe(true);
  });

  it('two compatible disciplines compete for the SAME three bays', () => {
    /* Detailing and ceramic are one pool - a full protection floor refuses
       both, which a per-category capacity would not have caught. */
    const full = [held(480, 'protection-1'), held(240, 'protection-2'), held(180, 'protection-3')];
    expect(place('Ceramic', 480, full)).toBeNull();
    expect(place('Coating', 240, full)).toBeNull();
    expect(place('PPF', 2880, full)).toBeNull();
  });
});

/* ── OVERLAP, ACROSS DAYS AND OVERNIGHT ──────────────────────────────────── */

describe('no two bookings overlap on one bay', () => {
  it('a two-day film holds its bay on the second day, when nothing starts', () => {
    const ppf = [held(2880, 'protection-1')];
    expect(expandIntervals({ date: DATE, startMin: AT_9, durationMin: 2880 })
      .map(i => i.date)).toEqual([DATE, '2026-09-08']);
    /* Day two: that bay is gone, the other two are not. */
    const nextDay = assignBay('Ceramic', '2026-09-08', AT_9, 480, ppf, FLOOR);
    expect(nextDay?.id).toBe('protection-2');
  });

  it('three films across two days leave the floor closed on both', () => {
    const all = ['protection-1', 'protection-2', 'protection-3'].map(b => held(2880, b));
    expect(assignBay('Ceramic', DATE, AT_9, 480, all, FLOOR)).toBeNull();
    expect(assignBay('Ceramic', '2026-09-08', AT_9, 480, all, FLOOR)).toBeNull();
    expect(assignBay('Ceramic', '2026-09-09', AT_9, 480, all, FLOOR)?.id).toBe('protection-1');
  });

  it('a bay taken out of service is gone by name, and its work must move', () => {
    const down = { ...FLOOR, disabledBays: ['protection-1'] };
    expect(baysOf(down).map(b => b.id)).not.toContain('protection-1');
    expect(resourceCapacity('protection', down)).toBe(2);
    /* A booking still holding the disabled bay is a visible collision, not a
       silent one: the floor is two bays and two occupants fill it. */
    expect(place('Ceramic', 480, [held(480, 'protection-2'), held(480, 'protection-3')], down))
      .toBeNull();
  });

  it('a legacy booking with no bay still consumes one', () => {
    /* Every record taken under the counting model has no `bayId`. Rejecting
       them would empty the diary; ignoring them would double-book. */
    const legacy = [held(480, undefined), held(480, undefined)];
    expect(place('Ceramic', 480, legacy)?.id).toBe('protection-3');
    expect(place('Ceramic', 480, [...legacy, held(480, undefined)])).toBeNull();
  });

  it('a cancelled booking is simply absent, so its bay is free again', () => {
    /* `loadOccupancy` only ever reads live bookings - a cancelled, rejected or
       expired one never becomes an occupant, which is how the bay is released. */
    const live = [held(480, 'protection-1')];
    expect(place('Ceramic', 480, live)?.id).toBe('protection-2');
    expect(place('Ceramic', 480, [])?.id).toBe('protection-1');
  });
});

/* ── AUTHORITY ───────────────────────────────────────────────────────────── */

describe('studio and admin outrank the customer', () => {
  it('a customer may withdraw a request, and nothing else', () => {
    expect(bookingTransition('pending', 'cancelled', 'customer').ok).toBe(true);
    for (const to of ['confirmed', 'vehicle_received', 'in_progress', 'completed'] as const) {
      expect({ to, ok: bookingTransition('pending', to, 'customer').ok })
        .toEqual({ to, ok: false });
    }
  });

  it('the studio may take every step the customer may not', () => {
    expect(bookingTransition('pending', 'confirmed', 'studio').ok).toBe(true);
    expect(bookingTransition('confirmed', 'vehicle_received', 'studio').ok).toBe(true);
    expect(bookingTransition('in_progress', 'cancelled', 'studio').ok).toBe(true);
  });

  it('a customer cannot withdraw a car that is already on a bay', () => {
    expect(bookingTransition('in_progress', 'cancelled', 'customer').ok).toBe(false);
  });

  it('a settled booking is settled for everyone, including the studio', () => {
    for (const from of ['completed', 'cancelled'] as const) {
      expect({ from, ok: bookingTransition(from, 'confirmed', 'studio').ok })
        .toEqual({ from, ok: false });
    }
  });
});

/* ── THE SERVER IS THE ONLY AUTHORITY ────────────────────────────────────── */

describe('nothing the client says about capacity is trusted', () => {
  const src = require('fs').readFileSync('lib/server/bookingService.ts', 'utf8');

  it('the bay is chosen inside the transaction, never sent by the caller', () => {
    expect(src).toMatch(/const bay = await assertSlotOpen\(/);
    expect(src).toMatch(/bayId: bay\.id/);
    /* The intent a client may state carries no bay, no duration and no price. */
    expect(src).not.toMatch(/intent\.bayId/);
    expect(src).not.toMatch(/intent\.durationMinutes/);
  });

  it('a service with no duration is refused, not given sixty minutes', () => {
    expect(src).toMatch(/service-has-no-duration/);
  });

  it('a customer write carrying an old version is refused', () => {
    expect(src).toMatch(/stale-write/);
    expect(src).toMatch(/opts\.expectedVersion !== booking\.version/);
  });

  it('a customer may not re-time what the studio has decided', () => {
    expect(src).toMatch(/studio-decided/);
    expect(src).toMatch(/booking\.lastDecidedBy === 'studio'/);
  });

  it('every mutation moves the version and records the authority', () => {
    expect((src.match(/version: \(booking\.version \?\? 0\) \+ 1/g) ?? []).length)
      .toBeGreaterThanOrEqual(2);
    expect((src.match(/lastDecidedBy: opts\.byStaff \? 'studio' : 'customer'/g) ?? []).length)
      .toBeGreaterThanOrEqual(2);
  });

  it('a move re-assigns the bay rather than keeping the old one', () => {
    expect(src).toMatch(/const movedBay = await assertSlotOpen\(/);
    expect(src).toMatch(/bayId: movedBay\.id/);
  });

  it('a repeat submission lands on the same booking, not a second one', () => {
    /* Double tap, and the network retry behind it. */
    expect(src).toMatch(/idempotencyKey/);
    expect(src).toMatch(/bad-idempotency-key/);
  });
});
