/**
 * ONE ENTITY, ONE ANSWER - across every screen that names it.
 *
 * §22.5: truth is not recomputed. The audit's most expensive findings were not
 * missing features, they were two screens disagreeing about one fact - the
 * album totalling ₹11,990 more than the visits a customer could open, Home
 * saying "Cared for" over a Friday that had gone, the Garage saying "nothing
 * declared" about a membership Home was counting as protection.
 *
 * A projection test that checks one screen cannot catch that. This builds ONE
 * customer with ONE booking and asks every surface the same questions.
 */
import { Timestamp } from 'firebase/firestore';
import type {
  Approval, Booking, Job, Protection, Service, StoredBreakdown, User, Vehicle, Visit,
} from '@/lib/types';
import type { CarPicture, CustomerPicture } from '@/lib/customer/source';
import {
  toHome, toGarage, toVehicle, toStudio, toYou, toBooked, toManageBooking,
  toSettle, toApproval, toLiveVisit, findBooking, spokenHour, shortDay,
} from '@/lib/customer/project';
import { changeWindowOf } from '@/lib/os/lifecycle';
import { settlementOf } from '@/lib/os/settlement';

const ts = (iso: string) => Timestamp.fromDate(new Date(iso));

/* One car, one visit, one figure. Everything below asks about these. */
const WHEN = { date: '2026-02-12', time: '09:00' };
const TOTAL = 43622;

const vehicle: Vehicle = {
  id: 'v1', name: 'BMW M340i', registrationNumber: 'GJ01AB1234',
  createdAt: ts('2025-01-01T00:00:00Z'),
} as Vehicle;

const breakdown: StoredBreakdown = {
  subtotal: 48662,
  discount: { source: 'membership', label: 'Gold member 15% off', amount: 5040 },
  discountAmount: 5040, fees: [], feesTotal: 0,
  taxable: 43622, total: TOTAL, washCovered: false,
};

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: 'bk1', userId: 'u1', userName: 'A', userPhone: '', userEmail: '',
  vehicleId: 'v1', vehicleName: 'BMW M340i', vehicleRegNo: 'GJ01AB1234',
  serviceId: 'svc-ppf', serviceName: 'Full-body PPF', serviceCategory: 'PPF',
  serviceBasePrice: 48662, serviceDurationMinutes: 960,
  pickupDropRequired: false, pickupDropFee: 0,
  totalAmount: TOTAL, breakdown,
  scheduledDate: WHEN.date, scheduledTime: WHEN.time, endDate: '2026-02-13',
  status: 'confirmed', paymentMethod: 'cash', paymentStatus: 'pending',
  createdAt: ts('2026-01-20T09:00:00Z'), updatedAt: ts('2026-01-20T09:00:00Z'),
  ...over,
} as unknown as Booking);

const picture = (over: {
  bookings?: Booking[]; jobs?: Job[]; visits?: Visit[];
  protections?: Protection[]; approvals?: Approval[];
} = {}): CustomerPicture => ({
  user: { uid: 'u1', name: 'Aarav Shah', email: 'a@x.test', role: 'customer' } as User,
  cars: [{
    vehicle,
    protections: over.protections ?? [],
    visits: over.visits ?? [],
    bookings: over.bookings ?? [booking()],
    jobs: over.jobs ?? [],
  } as CarPicture],
  subscription: null, subscriptions: [], invoices: [], notifications: [],
  catalogue: [] as Service[], addresses: [], approvals: over.approvals ?? [],
});

/* Eleven days out, so the booking is comfortably changeable. */
const NOW = new Date('2026-02-01T06:00:00Z');
/* Inside the last day. */
const LATE = new Date('2026-02-11T18:00:00Z');

/* ── the day ─────────────────────────────────────────────────────────────── */

describe('every screen names the same day for one booking', () => {
  const p = picture();

  it('the Studio, the confirmation and the manage screen agree', () => {
    const booked = toBooked(p, 'bk1', NOW)!;
    const manage = toManageBooking(p, 'bk1', [], NOW)!;
    const studio = toStudio(p, NOW);

    /* The booking spans two days, and every surface that mentions it says so
       or says nothing - none of them may claim one. */
    expect(booked.when).toContain(shortDay('2026-02-12'));
    expect(manage.when).toBe(booked.when);
    expect(studio.manageable[0].when).toBe(booked.when);
  });

  it('and Home says it ONCE, in its own state rather than twice', () => {
    /* The hero already names the visit, so the NEXT VISIT block is suppressed
       - "both true, and both said once". This is the rule that stopped Home
       announcing a booking directly under a sentence about the same booking. */
    const home = toHome(p, NOW)!;
    expect(home.state.line).toContain('12 February 2026');
    expect(home.next).toBeUndefined();
  });

  it('and every surface points at the same booking', () => {
    /* The ADDRESSES differ by intent - Home's one action is "Manage the
       visit", the Studio's row is a doorway to the booking - and that is the
       point of two screens. What may never differ is WHICH booking. */
    const home = toHome(p, NOW)!;
    const studio = toStudio(p, NOW);
    const idIn = (href: string) => href.match(/\/booking\/([^/?&]+)/)?.[1];

    expect(idIn(home.nextAction.href)).toBe('bk1');
    expect(idIn(studio.manageable[0].href)).toBe('bk1');
    expect(idIn(toManageBooking(p, 'bk1', [], NOW)!.backHref)).toBe('bk1');
    expect(idIn(toBooked(p, 'bk1', NOW)!.manageHref)).toBe('bk1');
  });

  it('the hour is spoken the same way wherever it appears', () => {
    expect(spokenHour(WHEN.time)).toBe('9 am');
    expect(toBooked(picture({
      bookings: [booking({ endDate: WHEN.date, serviceDurationMinutes: 90 })],
    }), 'bk1', NOW)!.when).toContain('9 am');
  });
});

/* ── the standing ────────────────────────────────────────────────────────── */

describe('every screen agrees about where the booking stands', () => {
  it.each([
    ['pending', 'Awaiting the studio'],
    ['confirmed', 'Confirmed'],
    ['in_progress', 'In the studio'],
    ['completed', 'Finished'],
    ['cancelled', 'Cancelled'],
    ['expired', 'Not taken up'],
  ] as const)('%s reads as "%s" everywhere', (status, word) => {
    const p = picture({ bookings: [booking({ status })] });
    expect(toBooked(p, 'bk1', NOW)!.standing).toBe(word);
    expect(toManageBooking(p, 'bk1', [], NOW)!.standing).toBe(word);
    /* The Studio lists only what is still ahead, so it agrees by omission for
       anything that has resolved. */
    const row = toStudio(p, NOW).manageable[0];
    if (row) expect(row.standing).toBe(word);
  });

  it('what may be done is the machine’s answer, not each screen’s', () => {
    /* The confirmation and the manage screen ask the SAME question and must
       never differ: one offering "Manage booking" while the other refuses is
       the customer being sent to a dead end. */
    for (const now of [NOW, LATE]) {
      const p = picture();
      const window = changeWindowOf(booking(), now);
      const booked = toBooked(p, 'bk1', now)!;
      const manage = toManageBooking(p, 'bk1', [], now)!;
      expect(manage.moveable).toBe(window.allowed);
      expect(Boolean(booked.lockedBecause)).toBe(!window.allowed);
    }
  });
});

/* ── the money ───────────────────────────────────────────────────────────── */

describe('every screen names the same figure for one visit', () => {
  it('the confirmation and the settle screen agree with the record', () => {
    const p = picture({ bookings: [booking({ status: 'completed' })] });
    const booked = toBooked(p, 'bk1', NOW)!;
    const settle = toSettle({
      picture: p, bookingId: 'bk1', visit: null,
      money: { total: TOTAL, received: 0, payable: TOTAL },
      upiAvailable: true,
    })!;

    expect(booked.rows.find(r => r.label === 'Estimate')?.value).toBe('₹43,622');
    expect(settle.total).toBe('₹43,622');
    expect(settle.payable).toBe('₹43,622');
  });

  it('the working behind the total is the stored breakdown, not a re-derivation', () => {
    const p = picture({ bookings: [booking({ status: 'completed' })] });
    const settle = toSettle({
      picture: p, bookingId: 'bk1', visit: null,
      money: { total: TOTAL, received: 0, payable: TOTAL },
      upiAvailable: true,
    })!;
    const sum = breakdown.subtotal - breakdown.discountAmount + breakdown.feesTotal;
    expect(sum).toBe(TOTAL);
    expect(settle.lines[0].value).toBe('₹48,662');
    expect(settle.lines[1].value).toBe('−₹5,040');
  });

  it('an approval moves the figure on every surface at once', () => {
    /* The approval carries `after`, the job and the booking are updated in the
       same commit, and the settle screen reads the result. What is asserted
       here is that the DELTA a customer is shown equals the difference between
       the two totals they are shown. */
    const before: StoredBreakdown = { ...breakdown };
    const after: StoredBreakdown = {
      ...breakdown, subtotal: 54662, discountAmount: 5040, taxable: 49622, total: 49622,
    };
    const approval = {
      id: 'ap1', jobId: 'job1', bookingId: 'bk1', customerId: 'u1',
      vehicleId: 'v1', vehicleName: 'BMW M340i',
      reason: 'We found something under the film',
      photos: [], proposed: { label: 'Extra stage', price: 6000, minutes: 120 },
      priceDelta: after.total - before.total, timeDeltaMinutes: 120,
      before, after, status: 'requested',
      requestedAt: ts('2026-02-12T06:00:00Z'),
    } as unknown as Approval;

    const m = toApproval(approval, new Date('2026-02-12T08:00:00Z'));
    expect(m.currentTotal).toBe('₹43,622');
    expect(m.newTotal).toBe('₹49,622');
    expect(m.priceDelta).toBe('+₹6,000');
  });

  it('a settled visit says settled on the screen AND in the engine', () => {
    const s = settlementOf({ jobTotal: TOTAL, received: TOTAL });
    expect(s.settled).toBe(true);
    const m = toSettle({
      picture: picture({ bookings: [booking({ status: 'completed' })] }),
      bookingId: 'bk1', visit: null,
      money: { total: TOTAL, received: TOTAL, payable: 0 },
      upiAvailable: true,
    })!;
    expect(m.payable).toBeUndefined();
    expect(m.paymentWord).toBe('Settled');
  });
});

/* ── the car ─────────────────────────────────────────────────────────────── */

describe('every screen names the same car', () => {
  const p = picture();

  it('Home, the Garage, the car’s room and the confirmation', () => {
    expect(toHome(p, NOW)!.vehicle.name).toBe('BMW M340i');
    expect(toGarage(p, NOW).vehicles[0].name).toBe('BMW M340i');
    expect(toVehicle(p.cars[0], p, NOW).name).toBe('BMW M340i');
    expect(toBooked(p, 'bk1', NOW)!.rows[0].detail).toContain('BMW M340i');
    expect(toManageBooking(p, 'bk1', [], NOW)!.vehicleName).toBe('BMW M340i');
  });

  it('and the person’s room counts it without describing it', () => {
    /* §5.2 - the car's DETAILS are barred from the PERSON's room. Its rows
       count cars and never describe one.

       `consentCars` is the exception and it is not a loophole: consent belongs
       to a car, and asking "may we publish this car's record" cannot be done
       without naming which car. That list is panel data, opened deliberately,
       not something the room states about a car. */
    const you = toYou(p, NOW);
    expect(you.garage.line).toBe('One car lives here.');

    const rooms = { ...you, consentCars: undefined };
    expect(JSON.stringify(rooms)).not.toContain('BMW M340i');
    expect(JSON.stringify(rooms)).not.toContain('GJ01AB1234');
    expect(you.consentCars?.[0].name).toBe('BMW M340i');
  });
});

/* ── the live visit ──────────────────────────────────────────────────────── */

describe('a car on a bay reads the same everywhere', () => {
  const live = booking({ status: 'in_progress', scheduledDate: '2026-02-01' });
  const job: Job = {
    id: 'job1', bookingId: 'bk1', vehicleId: 'v1', customerId: 'u1',
    source: 'booking', status: 'in_progress', serviceItems: [],
    statusHistory: [], assignments: [], assignedIds: [],
    subtotal: TOTAL, totalAmount: TOTAL, paymentStatus: 'pending',
    date: '2026-02-01', customerName: 'A', customerPhone: '',
    vehicleName: 'BMW M340i', vehicleRegNo: 'GJ01AB1234',
    createdByEmployeeId: 'e1', createdByEmployeeName: 'Studio',
    createdAt: ts('2026-02-01T04:00:00Z'), updatedAt: ts('2026-02-01T04:00:00Z'),
  } as unknown as Job;

  const p = picture({ bookings: [live], jobs: [job] });
  const at = new Date('2026-02-01T08:00:00Z');

  it('Home, the Studio and the visit all say it is here', () => {
    expect(toStudio(p, at).presence).toBe('Your car is here');
    expect(toHome(p, at)!.live).toBeDefined();
    expect(toLiveVisit(p, p.cars[0], 'bk1', at)).not.toBeNull();
  });

  it('and NOTHING offers to arrange a next visit over the top of it', () => {
    /* A car that is booked in does not need to be told to book in - the audit
       found exactly this contradiction on Home. */
    expect(toHome(p, at)!.next).toBeUndefined();
    expect(toHome(p, at)!.nextOpening).toBeUndefined();
  });

  it('a question the studio is waiting on appears on the visit', () => {
    const approval = {
      id: 'ap1', jobId: 'job1', bookingId: 'bk1', customerId: 'u1',
      vehicleId: 'v1', vehicleName: 'BMW M340i',
      reason: 'We found something under the film', photos: [],
      proposed: { label: 'Extra stage', price: 6000, minutes: 120 },
      priceDelta: 6000, timeDeltaMinutes: 120,
      before: breakdown, after: breakdown, status: 'requested',
      requestedAt: ts('2026-02-01T07:00:00Z'),
    } as unknown as Approval;

    const withQuestion = picture({ bookings: [live], jobs: [job], approvals: [approval] });
    const visit = toLiveVisit(withQuestion, withQuestion.cars[0], 'bk1', at);
    expect(visit?.approval?.href).toBe('/approval/ap1');
    expect(visit?.approval?.line).toBe('We found something under the film');
  });
});

/* ── nothing booked ──────────────────────────────────────────────────────── */

describe('a customer with nothing booked is told when the studio is free', () => {
  const empty = picture({ bookings: [] });

  it('and only then', () => {
    const opening = { date: '2026-02-05', time: '09:00' };
    expect(toHome(empty, NOW, undefined, opening)!.nextOpening?.line)
      .toBe('Next opening · Thu 5 Feb, 9 am');
    /* With a visit already booked, the studio's free days are not the news. */
    expect(toHome(picture(), NOW, undefined, opening)!.nextOpening).toBeUndefined();
  });

  it('and never invents one when the studio cannot be reached', () => {
    expect(toHome(empty, NOW, undefined, null)!.nextOpening).toBeUndefined();
    expect(toHome(empty, NOW)!.nextOpening).toBeUndefined();
  });

  it('the Studio offers nothing to manage, rather than a stale row', () => {
    expect(toStudio(empty, NOW).manageable).toEqual([]);
    expect(findBooking(empty, 'bk1')).toBeNull();
  });
});
