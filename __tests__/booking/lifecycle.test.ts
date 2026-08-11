/**
 * THE STATE MACHINES, AND THE 24-HOUR RULE.
 *
 * These are the rules that decide whether a bay is held, whether a customer
 * may still change their mind, and whether the studio can answer on their
 * behalf. Every one of them was previously spread across a rules file, a
 * service and a renderer, and the renderer's copy is the one a fetch walks
 * past. They live in `lib/os/lifecycle` now, and this is the file that fails
 * when one of them moves.
 */
import {
  BOOKING_TRANSITIONS, BOOKING_TERMINAL, BOOKING_EXPIRED, CUSTOMER_CANCELLABLE,
  bookingTransition, changeWindowOf, scheduledEpochMs, isStaleRequest,
  CHANGE_WINDOW_HOURS, STUDIO_UTC_OFFSET_MIN,
  approvalTransition, approvalHasExpired, APPROVAL_VALID_HOURS,
  paymentTransition, visitTransition, jobTransition, BOOKING_FOR_JOB,
} from '@/lib/os/lifecycle';
import type { BookingStatus, JobStatus } from '@/lib/types';

/* ── studio time ─────────────────────────────────────────────────────────── */

describe('the studio keeps studio time', () => {
  it('a 09:00 slot in Ahmedabad is 03:30 UTC, not 09:00 UTC', () => {
    /* The bug this exists to stop: parsing a wall-clock string in the SERVER's
       zone. On Vercel that is UTC, which would place every appointment five and
       a half hours early and hand out a free change long after the rule closed. */
    expect(scheduledEpochMs('2026-02-12', '09:00'))
      .toBe(Date.parse('2026-02-12T03:30:00Z'));
  });

  it('the offset is stated as a constant, because Ahmedabad has no DST', () => {
    expect(STUDIO_UTC_OFFSET_MIN).toBe(330);
  });

  it('a booking with no hour is treated as the studio opening, not as midnight', () => {
    /* The walk-in flow writes bookings with no time. Midnight would give the
       customer nine extra hours of free changes on their last day. */
    expect(scheduledEpochMs('2026-02-12'))
      .toBe(Date.parse('2026-02-12T03:30:00Z'));
  });

  it('rubbish is refused rather than guessed at', () => {
    expect(scheduledEpochMs('')).toBeNull();
    expect(scheduledEpochMs('12/02/2026', '09:00')).toBeNull();
    expect(scheduledEpochMs('2026-02-12', '99:99')).toBeNull();
  });
});

/* ── the 24-hour rule ────────────────────────────────────────────────────── */

const at = (iso: string) => new Date(iso);
const pending = (over: Partial<{ status: BookingStatus; scheduledDate: string; scheduledTime: string }> = {}) => ({
  status: 'confirmed' as BookingStatus,
  scheduledDate: '2026-02-12',
  scheduledTime: '09:00',
  ...over,
});

describe('free until 24 hours before — design screen 10', () => {
  /* The slot is 2026-02-12 09:00 IST = 2026-02-12T03:30Z.
     The window therefore closes at 2026-02-11T03:30Z. */

  it('more than 24 hours out succeeds', () => {
    const v = changeWindowOf(pending(), at('2026-02-11T03:29:59Z'));
    expect(v.allowed).toBe(true);
  });

  it('EXACTLY 24 hours is refused — the boundary falls on the bay’s side', () => {
    /* Allowing it at exactly 24 hours puts the studio one millisecond of clock
       skew away from having to honour a change it has already prepared for. */
    const v = changeWindowOf(pending(), at('2026-02-11T03:30:00Z'));
    expect(v).toMatchObject({ allowed: false, reason: 'inside-window' });
  });

  it('under 24 hours is refused', () => {
    const v = changeWindowOf(pending(), at('2026-02-11T20:00:00Z'));
    expect(v).toMatchObject({ allowed: false, reason: 'inside-window' });
  });

  it('the window is 24 hours and says so', () => {
    expect(CHANGE_WINDOW_HOURS).toBe(24);
  });

  it('a cancelled booking cannot be moved', () => {
    const v = changeWindowOf(pending({ status: 'cancelled' }), at('2026-02-01T00:00:00Z'));
    expect(v).toMatchObject({ allowed: false, reason: 'already-cancelled' });
  });

  it('an expired booking cannot be moved', () => {
    const v = changeWindowOf(pending({ status: 'expired' }), at('2026-02-01T00:00:00Z'));
    expect(v).toMatchObject({ allowed: false, reason: 'already-expired' });
  });

  it('a completed booking cannot be moved', () => {
    const v = changeWindowOf(pending({ status: 'completed' }), at('2026-02-01T00:00:00Z'));
    expect(v).toMatchObject({ allowed: false, reason: 'already-completed' });
  });

  it('work already under way cannot be moved, however far off the date reads', () => {
    for (const status of ['vehicle_received', 'in_progress', 'quality_check', 'ready_for_delivery'] as const) {
      expect(changeWindowOf(pending({ status }), at('2026-01-01T00:00:00Z')))
        .toMatchObject({ allowed: false, reason: 'work-started' });
    }
  });

  it('a booking with no workable date is refused rather than assumed', () => {
    const v = changeWindowOf(pending({ scheduledDate: 'soon' }), at('2026-01-01T00:00:00Z'));
    expect(v).toMatchObject({ allowed: false, reason: 'unschedulable' });
  });
});

/* ── the booking machine ─────────────────────────────────────────────────── */

describe('the booking machine', () => {
  it('a customer may only ever withdraw; every advance is the studio’s', () => {
    expect(bookingTransition('pending', 'cancelled', 'customer').ok).toBe(true);
    expect(bookingTransition('confirmed', 'cancelled', 'customer').ok).toBe(true);
    expect(bookingTransition('pending', 'confirmed', 'customer'))
      .toMatchObject({ ok: false, reason: 'not-yours-to-make' });
    expect(bookingTransition('confirmed', 'completed', 'customer').ok).toBe(false);
  });

  it('a customer cannot withdraw a car that is on a bay; the studio can', () => {
    expect(bookingTransition('in_progress', 'cancelled', 'customer'))
      .toMatchObject({ ok: false, reason: 'too-late' });
    expect(bookingTransition('in_progress', 'cancelled', 'studio').ok).toBe(true);
  });

  it('the customer-cancellable set is stated once', () => {
    expect([...CUSTOMER_CANCELLABLE]).toEqual(['pending', 'confirmed']);
  });

  it('every terminal state is final for everybody', () => {
    for (const from of BOOKING_TERMINAL) {
      expect(BOOKING_TRANSITIONS[from]).toEqual([]);
      for (const actor of ['customer', 'studio', 'system'] as const) {
        expect(bookingTransition(from, 'confirmed', actor).ok).toBe(false);
      }
    }
  });

  it('expiry is the clock’s alone — neither party may declare it', () => {
    expect(bookingTransition('pending', BOOKING_EXPIRED, 'system').ok).toBe(true);
    expect(bookingTransition('pending', BOOKING_EXPIRED, 'customer').ok).toBe(false);
    expect(bookingTransition('pending', BOOKING_EXPIRED, 'studio').ok).toBe(false);
  });

  it('an expiry is not a cancellation, and the two are separate states', () => {
    expect(BOOKING_EXPIRED).toBe('expired');
    expect(BOOKING_TERMINAL).toContain('cancelled');
    expect(BOOKING_TERMINAL).toContain('expired');
  });

  it('a booking cannot skip the bay — no jump from confirmed to completed', () => {
    expect(bookingTransition('confirmed', 'completed', 'studio'))
      .toMatchObject({ ok: false, reason: 'illegal-transition' });
  });

  it('asking for the state it is already in is refused, not silently accepted', () => {
    expect(bookingTransition('confirmed', 'confirmed', 'studio'))
      .toMatchObject({ ok: false, reason: 'no-change' });
  });
});

describe('a request whose day has gone', () => {
  it('is stale a day after the slot, not a day after it was made', () => {
    /* A request for a date three weeks out is not stale on its third day. */
    const b = pending({ status: 'pending' });
    expect(isStaleRequest(b, at('2026-02-11T00:00:00Z'))).toBe(false);
    expect(isStaleRequest(b, at('2026-02-12T12:00:00Z'))).toBe(false);
    expect(isStaleRequest(b, at('2026-02-14T00:00:00Z'))).toBe(true);
  });

  it('never applies to a booking that has already resolved', () => {
    for (const status of ['completed', 'cancelled', 'expired'] as const) {
      expect(isStaleRequest(pending({ status }), at('2026-03-01T00:00:00Z'))).toBe(false);
    }
  });
});

/* ── approvals ───────────────────────────────────────────────────────────── */

describe('the approval machine — the studio cannot answer for the customer', () => {
  it('only the customer may approve or decline', () => {
    expect(approvalTransition('requested', 'approved', 'customer').ok).toBe(true);
    expect(approvalTransition('requested', 'declined', 'customer').ok).toBe(true);
    expect(approvalTransition('requested', 'approved', 'studio'))
      .toMatchObject({ ok: false, reason: 'not-yours-to-make' });
    expect(approvalTransition('requested', 'approved', 'system').ok).toBe(false);
  });

  it('the studio may withdraw its own request, and only that', () => {
    expect(approvalTransition('requested', 'cancelled', 'studio').ok).toBe(true);
    expect(approvalTransition('requested', 'declined', 'studio').ok).toBe(false);
  });

  it('a resolved request cannot be resolved again — no double approval', () => {
    for (const from of ['approved', 'declined', 'expired', 'cancelled'] as const) {
      expect(approvalTransition(from, 'approved', 'customer'))
        .toMatchObject({ ok: false, reason: `already-${from}` });
    }
  });

  it('approving after declining is refused', () => {
    expect(approvalTransition('declined', 'approved', 'customer').ok).toBe(false);
  });

  it('a request retires itself so a car is not held on an unanswered question', () => {
    const requestedAtMs = Date.parse('2026-02-12T04:00:00Z');
    const within = requestedAtMs + (APPROVAL_VALID_HOURS - 1) * 3600_000;
    const beyond = requestedAtMs + (APPROVAL_VALID_HOURS + 1) * 3600_000;
    expect(approvalHasExpired({ status: 'requested', requestedAtMs }, within)).toBe(false);
    expect(approvalHasExpired({ status: 'requested', requestedAtMs }, beyond)).toBe(true);
    /* One already answered never expires — the answer stands. */
    expect(approvalHasExpired({ status: 'approved', requestedAtMs }, beyond)).toBe(false);
  });
});

/* ── payment ─────────────────────────────────────────────────────────────── */

describe('the payment machine — a customer may never write `paid`', () => {
  it('the customer may start a payment and claim to have made it', () => {
    expect(paymentTransition('unpaid', 'initiated', 'customer').ok).toBe(true);
    expect(paymentTransition('initiated', 'submitted', 'customer').ok).toBe(true);
  });

  it('only the studio settles, because only the studio sees the money', () => {
    expect(paymentTransition('submitted', 'paid', 'customer'))
      .toMatchObject({ ok: false, reason: 'not-yours-to-make' });
    expect(paymentTransition('submitted', 'paid', 'studio').ok).toBe(true);
  });

  it('paid is terminal — a settled invoice is a record, not an opinion', () => {
    for (const to of ['unpaid', 'initiated', 'submitted', 'failed', 'expired'] as const) {
      expect(paymentTransition('paid', to, 'studio'))
        .toMatchObject({ ok: false, reason: 'already-paid' });
    }
  });

  it('a failed or expired attempt may be started again', () => {
    expect(paymentTransition('failed', 'initiated', 'customer').ok).toBe(true);
    expect(paymentTransition('expired', 'initiated', 'customer').ok).toBe(true);
  });
});

/* ── the visit and its job ───────────────────────────────────────────────── */

describe('the anchor is permanent once sealed', () => {
  it('nothing follows a seal', () => {
    for (const to of ['requested', 'agreed', 'open', 'cancelled'] as const) {
      expect(visitTransition('sealed', to, 'studio'))
        .toMatchObject({ ok: false, reason: 'already-sealed' });
    }
  });

  it('a customer cannot open or seal a visit', () => {
    expect(visitTransition('agreed', 'open', 'customer').ok).toBe(false);
    expect(visitTransition('open', 'sealed', 'customer').ok).toBe(false);
  });
});

describe('the job ladder is the studio’s alone', () => {
  it('no customer moves a job', () => {
    expect(jobTransition('checked_in', 'in_progress', 'customer'))
      .toMatchObject({ ok: false, reason: 'not-yours-to-make' });
  });

  it('a job cannot jump from arrival to done', () => {
    expect(jobTransition('checked_in', 'completed', 'studio').ok).toBe(false);
  });

  it('quality check may send work back, because sometimes it must', () => {
    expect(jobTransition('quality_check', 'in_progress', 'studio').ok).toBe(true);
  });

  it('every job state has a booking state, so the two records cannot disagree', () => {
    const every: JobStatus[] = [
      'checked_in', 'in_progress', 'quality_check',
      'ready_for_delivery', 'completed', 'cancelled',
    ];
    for (const s of every) expect(BOOKING_FOR_JOB[s]).toBeTruthy();
  });
});
