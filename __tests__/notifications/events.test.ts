/**
 * WHAT THE STUDIO TELLS A CUSTOMER — and what quiet mode does with it.
 *
 * §17.1 removed the notification list on purpose and nothing here brings it
 * back. An event is a FACT, written down so the surface that owns it can show
 * it as state and so delivery has something to be derived from.
 *
 * The two properties that matter are that one fact produces one record however
 * many times the code runs, and that quiet mode suppresses the PHONE and never
 * the record — a quiet mode that dropped events would erase a customer's own
 * history of what happened to their car.
 */
import { readFileSync } from 'fs';
import {
  eventId, wordsFor, deliverable, BREAKS_QUIET, CATEGORY_OF,
  type StudioEventType, type StudioEventInput,
} from '@/lib/os/events';
import { eventHref } from '@/navigation/resolve';

const EVERY: StudioEventType[] = [
  'booking_confirmed', 'booking_rescheduled', 'booking_cancelled', 'booking_expired',
  'approval_requested', 'approval_approved', 'approval_declined',
  'vehicle_ready', 'payment_required', 'payment_settled', 'visit_completed',
];

const input = (over: Partial<StudioEventInput> = {}): StudioEventInput => ({
  type: 'booking_confirmed',
  customerId: 'u1',
  source: { kind: 'booking', id: 'bk1' },
  vehicleId: 'v1',
  subject: 'BMW M340i',
  ...over,
});

/* ── identity ────────────────────────────────────────────────────────────── */

describe('one fact, one record', () => {
  it('the id is derived from the fact, so writing it twice writes one document', () => {
    expect(eventId(input())).toBe('booking_confirmed_booking_bk1');
    expect(eventId(input())).toBe(eventId(input()));
  });

  it('different facts about one booking do not collide', () => {
    expect(eventId(input({ type: 'booking_confirmed' })))
      .not.toBe(eventId(input({ type: 'booking_cancelled' })));
  });

  it('a repeatable fact carries a discriminator, or the second would be lost', () => {
    /* A booking moved twice is two events. Without this the second collapses
       onto the first and the customer is never told about it. */
    const first = eventId(input({ type: 'booking_rescheduled' }), '2026-02-19-09:00');
    const second = eventId(input({ type: 'booking_rescheduled' }), '2026-02-26-09:00');
    expect(first).not.toBe(second);
    expect(first).toBe(eventId(input({ type: 'booking_rescheduled' }), '2026-02-19-09:00'));
  });

  it('the discriminator cannot break a document id', () => {
    expect(eventId(input(), 'a/b c#d')).toBe('booking_confirmed_booking_bk1_abcd');
  });
});

/* ── quiet mode ──────────────────────────────────────────────────────────── */

describe('quiet mode — "only approvals and handover reach you"', () => {
  it('everything reaches a customer who has not asked for quiet', () => {
    for (const t of EVERY) expect(deliverable(t, false)).toBe(true);
    for (const t of EVERY) expect(deliverable(t, undefined)).toBe(true);
  });

  it('the three that break through are the three you LOSE by not hearing', () => {
    /* An unanswered approval holds a car on a bay; an unheard handover leaves
       a finished car in the studio overnight; an unpaid handover is the same
       car, not released. Everything else is news that keeps. */
    expect([...BREAKS_QUIET].sort())
      .toEqual(['approval_requested', 'payment_required', 'vehicle_ready']);
    for (const t of BREAKS_QUIET) expect(deliverable(t, true)).toBe(true);
  });

  it('and the rest are held', () => {
    for (const t of EVERY.filter(t => !BREAKS_QUIET.includes(t))) {
      expect(deliverable(t, true)).toBe(false);
    }
  });

  it('QUIET MODE SUPPRESSES DELIVERY, NEVER THE RECORD', () => {
    /* A quiet mode that dropped the event would erase the customer's own
       history of what happened to their car, and turning it off would leave a
       gap they could never recover. */
    const server = readFileSync('lib/server/events.ts', 'utf8');
    const write = server.slice(server.indexOf('runTransaction'), server.indexOf('── DELIVERY'));
    expect(write).toMatch(/t\.set\(ref/);
    expect(write).not.toMatch(/deliverable|quiet/);
    /* The suppression is annotated on the record rather than hidden. */
    expect(server).toMatch(/heldByQuietMode: true/);
  });

  it('an unreadable profile fails OPEN, because a held handover costs more', () => {
    const server = readFileSync('lib/server/events.ts', 'utf8');
    expect(server).toMatch(/catch \{\s*quiet = false;/);
  });

  it('the engine decides it, so no caller can forget to honour it', () => {
    const server = readFileSync('lib/server/events.ts', 'utf8');
    expect(server).toMatch(/deliverable\(input\.type, quiet\)/);
    /* Read inside, never passed in — a parameter is a thing a caller omits. */
    expect(server).toMatch(/quietMode === true/);
  });
});

/* ── the words ───────────────────────────────────────────────────────────── */

describe('the words are the studio’s, and unsigned', () => {
  it('every event has a title and a body', () => {
    for (const t of EVERY) {
      const w = wordsFor(input({ type: t }));
      expect(w.title.length).toBeGreaterThan(0);
      expect(w.body.length).toBeGreaterThan(0);
    }
  });

  it('NO FIGURE IN ANY OF THEM — a lock screen is read by the room', () => {
    for (const t of EVERY) {
      const w = wordsFor(input({ type: t, detail: '12 February at 9:00' }));
      expect(`${w.title} ${w.body}`).not.toMatch(/₹/);
    }
  });

  it('no individual is ever named', () => {
    for (const t of EVERY) {
      const w = wordsFor(input({ type: t }));
      expect(`${w.title} ${w.body}`).not.toMatch(/Rahul|technician|by [A-Z]/);
    }
  });

  it('a car with no name still produces a sentence, never a blank', () => {
    const w = wordsFor(input({ subject: '  ' }));
    expect(w.body).toContain('your car');
  });

  it('every event has a coarse category the older readers understand', () => {
    for (const t of EVERY) expect(CATEGORY_OF[t]).toBeTruthy();
  });
});

/* ── addressing ──────────────────────────────────────────────────────────── */

describe('a notification is a doorway, and opens what it is about', () => {
  it('a booking event opens the BOOKING, not a visit that does not exist', () => {
    /* Every booking notification used to open `/history/<bookingId>`, which
       renders a visit — and a confirmed booking has none, so "the bay is
       yours" opened the no-car invitation. */
    for (const t of ['booking_confirmed', 'booking_rescheduled', 'booking_cancelled', 'booking_expired']) {
      expect(eventHref(t, { kind: 'booking', id: 'bk1' })).toBe('/booking/bk1');
    }
  });

  it('an approval opens the request itself', () => {
    expect(eventHref('approval_requested', { kind: 'approval', id: 'ap1' }))
      .toBe('/approval/ap1');
  });

  it('money to settle opens the place it is settled', () => {
    expect(eventHref('payment_required', { kind: 'booking', id: 'bk1' }))
      .toBe('/history/bk1/settle');
  });

  it('the handover and the record open the visit', () => {
    expect(eventHref('vehicle_ready', { kind: 'booking', id: 'bk1' })).toBe('/history/bk1');
    expect(eventHref('visit_completed', { kind: 'visit', id: 'vis1' })).toBe('/history/vis1');
  });

  it('§17.3 — never Home, for any event', () => {
    for (const t of EVERY) {
      expect(eventHref(t, { kind: 'booking', id: 'bk1' })).not.toBe('/');
    }
  });
});

/* ── it is not an inbox ──────────────────────────────────────────────────── */

describe('§17.1 — the car is the inbox', () => {
  it('one collection, not two — the record a customer already had', () => {
    /* A parallel `events` collection would mean two records of one fact, two
       rules blocks and two readers; the day they disagree the car says one
       thing and the phone says another. */
    const server = readFileSync('lib/server/events.ts', 'utf8');
    expect(server).toMatch(/collection\('notifications'\)/);
    expect(server).not.toMatch(/collection\('events'\)/);
  });

  it('the stage pings that used to fire from the browser are gone', () => {
    /* They bypassed quiet mode entirely and nothing de-duplicated them. */
    const bookings = readFileSync('lib/services/bookings.ts', 'utf8');
    expect(bookings).not.toMatch(/Vehicle Received|Service In Progress|Quality Check/);
    expect(bookings).toMatch(/\/api\/notify\/stage/);
  });

  it('the studio still cannot write a customer notification from a browser', () => {
    const rules = readFileSync('firestore.rules', 'utf8');
    const block = rules.slice(rules.indexOf('match /notifications/'));
    expect(block.slice(0, 700)).toMatch(/allow create, delete: if request\.auth != null && isAdmin\(\)/);
  });
});
