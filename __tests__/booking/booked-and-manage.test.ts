/**
 * SCREENS 09 AND 10, AGAINST THEIR OWN DATA.
 *
 * The confirmation and the manage screen are the two surfaces where a customer
 * finds out what the studio actually holds. Every value on them is asserted
 * here against a real booking, because "the page renders" has never been the
 * standard: a confirmation that states the wrong day, or offers a change the
 * server will refuse, is worse than no confirmation at all.
 */
import { Timestamp } from 'firebase/firestore';
import type { Booking, Service, User, Vehicle } from '@/lib/types';
import type { CarPicture, CustomerPicture } from '@/lib/customer/source';
import { toBooked, toManageBooking, findBooking, bayWords, spokenHour } from '@/lib/customer/project';
import { toICS, eventForBooking, icsStamp } from '@/lib/os/calendar';
import { scheduledEpochMs } from '@/lib/os/lifecycle';

const ts = (iso: string) => Timestamp.fromDate(new Date(iso));

/* The slot: 12 February 2026, 09:00 studio time = 03:30Z. */
const NOW_FAR = new Date('2026-02-01T06:00:00Z');   // 11 days out - changeable
const NOW_NEAR = new Date('2026-02-11T18:00:00Z');  // inside the last day

const vehicle: Vehicle = {
  id: 'v1', name: 'BMW M340i', registrationNumber: 'GJ01AB1234',
  createdAt: ts('2025-01-01T00:00:00Z'),
} as Vehicle;

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: 'bk1', userId: 'u1', userName: 'A', userPhone: '', userEmail: '',
  vehicleId: 'v1', vehicleName: 'BMW M340i', vehicleRegNo: 'GJ01AB1234',
  serviceId: 'svc-ppf', serviceName: 'Full-body PPF', serviceCategory: 'PPF',
  serviceBasePrice: 132000, serviceDurationMinutes: 960,
  pickupDropRequired: false, pickupDropFee: 0,
  totalAmount: 132000,
  scheduledDate: '2026-02-12', scheduledTime: '09:00',
  endDate: '2026-02-13',
  status: 'confirmed', paymentMethod: 'cash', paymentStatus: 'pending',
  createdAt: ts('2026-01-20T09:00:00Z'), updatedAt: ts('2026-01-20T09:00:00Z'),
  ...over,
} as unknown as Booking);

const picture = (bookings: Booking[]): CustomerPicture => ({
  user: { uid: 'u1', name: 'A', email: 'a@x.test', role: 'customer' } as User,
  cars: [{ vehicle, protections: [], declarations: [], visits: [], bookings, jobs: [] } as CarPicture],
  subscription: null, subscriptions: [], invoices: [], notifications: [],
  catalogue: [] as Service[],
  addresses: [], approvals: [],
});

/* ── finding it at all ───────────────────────────────────────────────────── */

describe('a booking is found only inside its owner’s picture', () => {
  it('the customer’s own booking is found', () => {
    expect(findBooking(picture([booking()]), 'bk1')?.booking.id).toBe('bk1');
  });

  it('an id that is not in the picture is not found, and nothing is invented', () => {
    /* THE PICTURE IS THE SCOPE. It was built by querying `bookings` where
       `userId` equals the verified session's uid, so another customer's
       booking is not present to be found - there is no ownership check here
       to forget, and no way to reach one by guessing an id. */
    expect(findBooking(picture([booking()]), 'someone-elses')).toBeNull();
    expect(toBooked(picture([booking()]), 'someone-elses')).toBeNull();
    expect(toManageBooking(picture([booking()]), 'someone-elses')).toBeNull();
  });
});

/* ── screen 09 ───────────────────────────────────────────────────────────── */

describe('screen 09 - the bay is yours', () => {
  it('states the work, the days, the return and the estimate - from the record', () => {
    const m = toBooked(picture([booking()]), 'bk1', NOW_FAR)!;

    expect(m.standing).toBe('Confirmed');
    expect(m.headline).toBe('The bay is yours.');
    expect(m.awaiting).toBe(false);

    const rows = Object.fromEntries(m.rows.map(r => [r.label, r.value]));
    expect(rows.Work).toBe('Full-body PPF');
    expect(rows['In the bay']).toBe('2 days');
    expect(rows.Estimate).toBe('₹1,32,000');
  });

  it('a two-day job says two days, and never one', () => {
    /* The most consequential thing this screen could get wrong: a customer
       plans one morning without a car and loses two. */
    const m = toBooked(picture([booking()]), 'bk1', NOW_FAR)!;
    expect(m.when).toBe('Thu 12 Feb – Fri 13 Feb');
  });

  it('a same-day job names the day and the hour instead of a range', () => {
    const wash = booking({
      serviceName: 'Signature wash', serviceCategory: 'Washing',
      serviceDurationMinutes: 90, endDate: '2026-02-12', totalAmount: 1200,
    });
    const m = toBooked(picture([wash]), 'bk1', NOW_FAR)!;
    expect(m.when).toBe('Thursday 12 February at 9 am');
    expect(m.rows.find(r => r.label === 'In the bay')?.value).toBe('2 hours');
  });

  it('a REQUEST is not a promise, and gets no calendar entry', () => {
    /* Putting an unaccepted request in an owner's calendar would be the
       product asserting something the studio has not. */
    const m = toBooked(picture([booking({ status: 'pending' })]), 'bk1', NOW_FAR)!;
    expect(m.awaiting).toBe(true);
    expect(m.headline).toBe('We have your request.');
    expect(m.calendarHref).toBeUndefined();
  });

  it('a confirmed booking gets a real calendar file, addressed by the resolver', () => {
    const m = toBooked(picture([booking()]), 'bk1', NOW_FAR)!;
    expect(m.calendarHref).toBe('/api/booking/bk1/calendar');
  });

  it('a cancelled or expired booking is stated as such and offers no calendar', () => {
    for (const status of ['cancelled', 'expired'] as const) {
      const m = toBooked(picture([booking({ status })]), 'bk1', NOW_FAR)!;
      expect(m.calendarHref).toBeUndefined();
      expect(m.lockedBecause).toBeTruthy();
    }
  });

  it('and it does NOT breathe - the studio is holding nothing', () => {
    /* The pulse is the product's whole vocabulary for "this is happening now".
       A cancelled visit that pulses contradicts its own headline. */
    for (const status of ['cancelled', 'expired', 'completed'] as const) {
      expect(toBooked(picture([booking({ status })]), 'bk1', NOW_FAR)!.holds).toBe(false);
    }
    expect(toBooked(picture([booking()]), 'bk1', NOW_FAR)!.holds).toBe(true);
    expect(toBooked(picture([booking({ status: 'in_progress' })]), 'bk1', NOW_FAR)!.holds).toBe(true);
  });

  it('the collection sentence follows the legs actually booked', () => {
    const plain = toBooked(picture([booking()]), 'bk1', NOW_FAR)!;
    expect(plain.collection).toMatch(/Bring it to the studio/);

    const both = toBooked(picture([booking({
      pickupRequired: true, dropRequired: true, pickupAddress: 'Bodakdev · Home',
    })]), 'bk1', NOW_FAR)!;
    expect(both.collection).toMatch(/collect it and bring it back/);
    expect(both.collection).toContain('Bodakdev · Home');
  });

  it('inside the last day it explains why it can no longer be changed', () => {
    const m = toBooked(picture([booking()]), 'bk1', NOW_NEAR)!;
    expect(m.lockedBecause).toMatch(/less than a day away/);
  });

  it('a membership wash says it is covered rather than quoting a discount', () => {
    const m = toBooked(picture([booking({
      usedMembershipWash: true, totalAmount: 0, serviceCategory: 'Washing',
    })]), 'bk1', NOW_FAR)!;
    expect(m.rows.find(r => r.label === 'Estimate')?.detail)
      .toBe('Covered by your membership');
  });
});

/* ── screen 10 ───────────────────────────────────────────────────────────── */

describe('screen 10 - what may actually be done', () => {
  it('offers the move while there is more than a day left, and says until when', () => {
    const m = toManageBooking(picture([booking()]), 'bk1', [], NOW_FAR)!;
    expect(m.moveable).toBe(true);
    expect(m.moveBlockedBecause).toBeUndefined();
    /* The window closes 24 hours before 12 Feb 09:00 studio time. */
    expect(m.freeUntil).toBe('Free to change until 11 February 2026, 9 am.');
  });

  it('refuses the move inside the last day, and says why in the studio’s words', () => {
    const m = toManageBooking(picture([booking()]), 'bk1', [], NOW_NEAR)!;
    expect(m.moveable).toBe(false);
    expect(m.moveBlockedBecause).toMatch(/less than a day away/);
    expect(m.freeUntil).toBeUndefined();
  });

  it('a booking may still be WITHDRAWN inside the window it may not be MOVED in', () => {
    /* Two rules, two answers. One control for both would either strand a
       customer with a visit they cannot cancel, or hand back a bay the studio
       has already prepared for. */
    const m = toManageBooking(picture([booking()]), 'bk1', [], NOW_NEAR)!;
    expect(m.moveable).toBe(false);
    expect(m.cancellable).toBe(true);
  });

  it('work already under way can be neither moved nor cancelled here', () => {
    const m = toManageBooking(
      picture([booking({ status: 'in_progress' })]), 'bk1', [], NOW_FAR,
    )!;
    expect(m.moveable).toBe(false);
    expect(m.cancellable).toBe(false);
    expect(m.cancelBlockedBecause).toMatch(/started on this one/);
  });

  it('a cancelled booking cannot be moved or cancelled again', () => {
    const m = toManageBooking(
      picture([booking({ status: 'cancelled' })]), 'bk1', [], NOW_FAR,
    )!;
    expect(m.moveable).toBe(false);
    expect(m.cancellable).toBe(false);
  });

  it('a completed booking cannot be moved', () => {
    const m = toManageBooking(
      picture([booking({ status: 'completed' })]), 'bk1', [], NOW_FAR,
    )!;
    expect(m.moveable).toBe(false);
    expect(m.moveBlockedBecause).toMatch(/finished/);
  });

  it('the openings it offers are the ones it was given, worded', () => {
    const m = toManageBooking(picture([booking()]), 'bk1', [
      { date: '2026-02-19', time: '09:00' },
    ], NOW_FAR)!;
    expect(m.openings).toEqual([{ date: '2026-02-19', time: '09:00', label: 'Thu 19 Feb' }]);
  });

  it('no openings is a real answer, not an empty control', () => {
    const m = toManageBooking(picture([booking()]), 'bk1', [], NOW_FAR)!;
    expect(m.openings).toEqual([]);
  });

  it('every address it carries is built by the resolver', () => {
    const m = toManageBooking(picture([booking()]), 'bk1', [], NOW_FAR)!;
    expect(m.backHref).toBe('/booking/bk1');
    expect(m.homeHref).toBe('/');
  });
});

/* ── the calendar file ───────────────────────────────────────────────────── */

describe('add to calendar is generated from the booking', () => {
  const start = scheduledEpochMs('2026-02-12', '09:00')!;

  const ics = (over: Parameters<typeof eventForBooking>[0] extends infer T ? Partial<T> : never = {}) =>
    toICS(eventForBooking({
      id: 'bk1', serviceName: 'Full-body PPF', vehicleName: 'BMW M340i',
      startMs: start, durationMinutes: 960, address: 'Maninagar, Ahmedabad',
      stampMs: Date.parse('2026-01-20T09:00:00Z'),
      ...over,
    }));

  it('carries the booking’s own hour, in UTC, from studio time', () => {
    expect(ics()).toContain('DTSTART:20260212T033000Z');
  });

  it('ends when the work ends - a two-day job is not an hour', () => {
    /* 960 minutes after 03:30Z on the 12th is 19:30Z on the 12th. A fixed
       length here would be the template this function exists to avoid. */
    expect(ics()).toContain('DTEND:20260212T193000Z');
    expect(ics({ durationMinutes: 90 })).toContain('DTEND:20260212T050000Z');
  });

  it('the UID is stable, so re-adding UPDATES the event instead of duplicating it', () => {
    expect(ics()).toContain('UID:booking-bk1@automodz');
    expect(ics({ startMs: start + 86_400_000 })).toContain('UID:booking-bk1@automodz');
  });

  it('a move raises SEQUENCE, which is what supersedes the old time', () => {
    expect(ics({ sequence: 0 })).toContain('SEQUENCE:0');
    expect(ics({ sequence: 2 })).toContain('SEQUENCE:2');
  });

  it('a cancelled booking exports as a cancellation, so the event disappears', () => {
    const out = ics({ cancelled: true });
    expect(out).toContain('METHOD:CANCEL');
    expect(out).toContain('STATUS:CANCELLED');
  });

  it('nothing private travels in a file that gets forwarded and synced', () => {
    /* §22.1 - a calendar file is read on shared screens and stored on third
       party servers. No price, no phone number, no invoice. */
    const out = ics();
    expect(out).not.toMatch(/₹|\b\d{5,}\b/);
    expect(out).not.toMatch(/9512605088|invoice/i);
  });

  it('it is a valid document - CRLF, folded lines, escaped separators', () => {
    const out = ics({ serviceName: 'PPF; front, rear' });
    expect(out.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(out.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(out).toContain('SUMMARY:PPF\\; front\\, rear - BMW M340i');
    for (const line of out.split('\r\n')) expect(line.length).toBeLessThanOrEqual(75);
  });

  it('the stamp is a pure function of the instant it is given', () => {
    expect(icsStamp(Date.parse('2026-02-12T03:30:00Z'))).toBe('20260212T033000Z');
  });
});

/* ── the small words ─────────────────────────────────────────────────────── */

describe('the wording helpers say what a person would say', () => {
  it('an hour is spoken, never printed', () => {
    expect(spokenHour('09:00')).toBe('9 am');
    expect(spokenHour('12:00')).toBe('12 pm');
    expect(spokenHour('00:30')).toBe('12:30 am');
    expect(spokenHour('18:40')).toBe('6:40 pm');
  });

  it('an hour we do not have is nothing, never a guess', () => {
    expect(spokenHour(undefined)).toBeNull();
    expect(spokenHour('soon')).toBeNull();
  });

  it('the bay is counted in days above a working day and hours below it', () => {
    expect(bayWords(90)).toBe('2 hours');
    expect(bayWords(600)).toBe('1 day');
    expect(bayWords(960)).toBe('2 days');
    expect(bayWords(0)).toBe('To be confirmed');
  });
});
