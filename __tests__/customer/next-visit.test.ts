/**
 * THE NEXT VISIT — one answer, or none.
 *
 * Two functions used to answer this question and they answered it differently.
 * `agreedOf` took the SOONEST open booking and fed the Home hero, the ownership
 * state machine and the timeline. A private `liveBooking` in `project.ts` took
 * the FIRST open booking in `createdAt` order and fed Home's NEXT VISIT block,
 * the Vehicle room and the Studio. On a car holding two open bookings they
 * named different ones, and Home said
 *
 *     Requested
 *     Teflon Coating, 24 July 2026 at 11:00.        ← the hero, from `agreedOf`
 *     ...
 *     NEXT VISIT
 *     Kovalent Prolong · 28 July 2026 · 15:00       ← the section, from `liveBooking`
 *
 * on one screen, about one car. Both sentences were true about different
 * bookings; neither answered the question the customer was asking.
 *
 * And NEITHER LOOKED AT THE DATE, so a request the studio never actioned stayed
 * the car's next visit for ever. Three of them were live in production eleven
 * days after the day they named, each still offering "Move it".
 *
 * These assertions are the contract: every room reads `nextVisitOf`, a visit
 * whose day has gone is not one that is coming, and the answer does not depend
 * on the order Firestore returned the documents in.
 */
import { Timestamp } from 'firebase/firestore';
import type { Booking, Service, User, Vehicle } from '@/lib/types';
import type { CarPicture, CustomerPicture } from '@/lib/customer/source';
import { toHome, toVehicle, toStudio, stateOf } from '@/lib/customer/project';
import { nextVisitOf, upcomingOf, isUpcoming, liveOf } from '@/lib/customer/ownership';

const NOW = new Date('2026-07-30T12:00:00Z');
const ts = (iso: string) => Timestamp.fromDate(new Date(iso));

const vehicle = (over: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v1', name: 'BMW M4', registrationNumber: 'GJ01AB1234',
  createdAt: ts('2023-03-01T10:00:00Z'), ...over,
});

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: 'b1', userId: 'u1', vehicleId: 'v1', vehicleName: 'BMW M4',
  vehicleRegNo: 'GJ01AB1234', serviceId: 's1', serviceName: 'Ceramic coating',
  serviceCategory: 'Ceramic', servicePrice: 64000, scheduledDate: '2026-08-04',
  scheduledTime: '10:00', status: 'confirmed', totalAmount: 64000,
  createdAt: ts('2026-07-20T09:00:00Z'),
  ...over,
} as Booking);

const car = (bookings: Booking[] = [], over: Partial<CarPicture> = {}): CarPicture => ({
  vehicle: vehicle(), protections: [], declarations: [], visits: [], bookings, jobs: [], ...over,
});

const picture = (cars: CarPicture[]): CustomerPicture => ({
  user: { uid: 'u1', name: 'Nikhil Patel', email: 'n@example.com', role: 'customer' } as User,
  cars, subscription: null, subscriptions: [], invoices: [], notifications: [], catalogue: [] as Service[], addresses: [], approvals: [],
});

/** What each room calls the next visit, by id. `undefined` when it names none. */
const asked = (cars: CarPicture[]) => {
  const p = picture(cars);
  const home = toHome(p, NOW);
  const vehicleRoom = toVehicle(cars[0], p, NOW);
  const studio = toStudio(p, NOW);
  /* A booking's own address is `/booking/<id>` (design screen 09). It was
     `/studio?manage=<id>` — a sheet over another room — until the two screens
     the design draws for a booking were built. */
  const idIn = (href?: string) => href?.match(/\/booking\/([^/?&]+)/)?.[1];
  return {
    engine: nextVisitOf(cars[0], NOW)?.id,
    /* The hero's own sentence, which is where the contradiction showed. */
    heroLine: home?.state.line,
    homeSection: idIn(home?.next?.href),
    homeSectionWhen: home?.next?.when,
    vehicle: idIn(vehicleRoom.next?.manageHref),
    vehicleWhen: vehicleRoom.next?.when,
    studioFirst: studio.manageable[0]?.id,
    studioAll: studio.manageable.map(v => v.id),
  };
};

describe('the next visit', () => {
  it('ONE FUTURE BOOKING — every room names it, and the same way', () => {
    const b = booking({ id: 'soon', scheduledDate: '2026-08-04', scheduledTime: '10:00' });
    const a = asked([car([b])]);

    expect(a.engine).toBe('soon');
    expect(a.vehicle).toBe('soon');
    expect(a.studioFirst).toBe('soon');
    /* The hero says it, so the section does not say it again — the same rule
       `heroOwnsTheProposal` applies to a recommendation. */
    expect(a.heroLine).toContain('4 August 2026');
    expect(a.homeSection).toBeUndefined();
    expect(a.vehicleWhen).toBe('4 August 2026 at 10:00');
  });

  it('MULTIPLE FUTURE BOOKINGS — the soonest wins, and nothing disagrees', () => {
    /* Declared newest-created first, which is the order `liveBooking` read and
       the reason it answered "Kovalent Prolong": the later visit was created
       last. The soonest is the answer regardless of when it was asked for. */
    const later = booking({
      id: 'later', scheduledDate: '2026-08-12', serviceName: 'Kovalent Prolong',
      createdAt: ts('2026-07-25T09:00:00Z'),
    });
    const sooner = booking({
      id: 'sooner', scheduledDate: '2026-08-04', serviceName: 'Teflon Coating',
      createdAt: ts('2026-07-21T09:00:00Z'),
    });
    const a = asked([car([later, sooner])]);

    expect(a.engine).toBe('sooner');
    expect(a.vehicle).toBe('sooner');
    expect(a.studioFirst).toBe('sooner');
    expect(a.heroLine).toContain('Teflon Coating');
    expect(a.heroLine).not.toContain('Kovalent Prolong');
    /* Both are still the customer's visits — the Studio lists every one, in
       the order they will happen. */
    expect(a.studioAll).toEqual(['sooner', 'later']);
  });

  it('PAST BOOKINGS ONLY — there is no next visit, and no room invents one', () => {
    const gone = booking({ id: 'gone', scheduledDate: '2026-07-18' });
    const alsoGone = booking({ id: 'also', status: 'pending', scheduledDate: '2026-07-02' });
    const a = asked([car([gone, alsoGone])]);

    expect(a.engine).toBeUndefined();
    expect(a.homeSection).toBeUndefined();
    expect(a.vehicle).toBeUndefined();
    expect(a.studioAll).toEqual([]);
    /* And the car is not described as booked in. */
    expect(stateOf(car([gone, alsoGone]), NOW).word).not.toBe('Reserved');

    /* NOR ANYWHERE ELSE ON THE SCREEN. `os/truth` derived its own next visit
       from the raw list, and Home only ever hid that because a booked car
       suppressed the sentence. Retiring the booking unsuppressed it, and Home
       read "Cared for" over "Friday 11:00 - we're ready for it." about a
       Friday that had gone. */
    const home = toHome(picture([car([gone, alsoGone])]), NOW);
    expect(home?.truth ?? '').not.toContain('ready for it');
  });

  it('PAST AND FUTURE — the past one is never the answer', () => {
    const gone = booking({ id: 'gone', scheduledDate: '2026-07-18', serviceName: 'Regular Wash' });
    const ahead = booking({ id: 'ahead', scheduledDate: '2026-08-20', serviceName: 'Glass coating' });
    const a = asked([car([gone, ahead])]);

    expect(a.engine).toBe('ahead');
    expect(a.vehicle).toBe('ahead');
    expect(a.studioAll).toEqual(['ahead']);
    expect(a.heroLine).toContain('Glass coating');
    expect(a.heroLine).not.toContain('Regular Wash');
  });

  it('TODAY still counts — a visit does not retire at its own start time', () => {
    /* §14.4's spirit: the DAY is the unit a customer books in. A 09:00 wash is
       still today's visit at 09:05, and expiring it mid-morning would be the
       product being pedantic at the customer's expense. */
    const today = booking({ id: 'today', scheduledDate: '2026-07-30', scheduledTime: '09:00' });
    expect(isUpcoming(today, NOW)).toBe(true);
    expect(nextVisitOf(car([today]), NOW)?.id).toBe('today');
  });

  it('A CANCELLED BOOKING is not a visit that is coming', () => {
    const off = booking({ id: 'off', status: 'cancelled', scheduledDate: '2026-08-04' });
    const a = asked([car([off])]);

    expect(a.engine).toBeUndefined();
    expect(a.homeSection).toBeUndefined();
    expect(a.vehicle).toBeUndefined();
    expect(a.studioAll).toEqual([]);
  });

  it('A LIVE VISIT is a separate fact, and does not become "next"', () => {
    /* The car is here. That is the state at the top of the screen; it is not
       something that is coming, and the room points at the work rather than
       at a sheet for changing a booking already under way. */
    const here = booking({ id: 'here', status: 'in_progress', scheduledDate: '2026-07-30' });
    const c = car([here]);
    const p = picture([c]);

    expect(liveOf(c)?.id).toBe('here');
    expect(nextVisitOf(c, NOW)).toBeNull();

    const room = toVehicle(c, p, NOW);
    expect(room.next).toBeUndefined();
    expect(room.followHref).toContain('here');
    expect(toStudio(p, NOW).manageable).toEqual([]);
    expect(toStudio(p, NOW).presence).toBe('Your car is here');
  });

  it('A LIVE VISIT AND A FUTURE ONE are both true, and both said once', () => {
    const here = booking({ id: 'here', status: 'in_progress', scheduledDate: '2026-07-30' });
    const ahead = booking({ id: 'ahead', scheduledDate: '2026-08-20' });
    const c = car([here, ahead]);
    const home = toHome(picture([c]), NOW);

    /* The hero is about the car being here, so it does not own the booking —
       and the section carries it, because nothing else on the screen does. */
    expect(home?.live).toBeDefined();
    expect(home?.next?.href).toContain('/booking/ahead');
    expect(toVehicle(c, picture([c]), NOW).followHref).toContain('here');
  });

  it('NO BOOKING AT ALL — silence, not an empty frame', () => {
    const a = asked([car([])]);
    expect(a.engine).toBeUndefined();
    expect(a.homeSection).toBeUndefined();
    expect(a.vehicle).toBeUndefined();
    expect(a.studioAll).toEqual([]);
  });

  it('the answer does not depend on the order the documents arrived in', () => {
    const one = booking({ id: 'aaa', scheduledDate: '2026-08-04', scheduledTime: '09:00' });
    const two = booking({ id: 'bbb', scheduledDate: '2026-08-04', scheduledTime: '09:00' });
    /* Same day, same hour: the tie is broken by id, so both orderings agree. */
    expect(nextVisitOf(car([one, two]), NOW)?.id).toBe('aaa');
    expect(nextVisitOf(car([two, one]), NOW)?.id).toBe('aaa');
    expect(upcomingOf(car([two, one]), NOW).map(b => b.id)).toEqual(['aaa', 'bbb']);
  });

  it('the Studio orders every car’s visits by when they happen, not by car', () => {
    /* It walked the garage and concatenated, so the list read 27 July, 28
       July, 24 July under a heading that says these are your visits. */
    const first = car([booking({ id: 'first', scheduledDate: '2026-08-02' })]);
    const second = car(
      [booking({ id: 'second', scheduledDate: '2026-08-01' })],
      { vehicle: vehicle({ id: 'v2', name: 'Defender', registrationNumber: 'GJ01CD1243' }) },
    );
    expect(toStudio(picture([first, second]), NOW).manageable.map(v => v.id))
      .toEqual(['second', 'first']);
  });

  it('a visit that has not started is reached where it can be changed', () => {
    /* Home's section pointed at `/history/{bookingId}`. A booking has no
       record until it is sealed, so that address told a customer with a full
       garage "Your car's place is ready. Add your car." The Studio's sheet is
       the one surface a pending visit has, and the Vehicle room already used
       it — one booking, one destination. */
    const here = booking({ id: 'here', status: 'in_progress', scheduledDate: '2026-07-30' });
    const ahead = booking({ id: 'ahead', scheduledDate: '2026-08-20' });
    const c = car([here, ahead]);
    const home = toHome(picture([c]), NOW);
    const room = toVehicle(c, picture([c]), NOW);

    expect(home?.next?.href).toBe('/booking/ahead');
    expect(room.next?.manageHref).toBe('/booking/ahead');
    expect(home?.next?.href).not.toMatch(/^\/history\//);
  });
});
