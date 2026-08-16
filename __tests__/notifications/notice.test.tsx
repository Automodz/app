/**
 * §17.1 AND §17.3, TOGETHER.
 *
 * §17.1 - "A list of notifications is the same mistake as a list of documents.
 * It is a pile of things the customer must process, most of which they no
 * longer care about. State changes surface as state. The car is the inbox."
 *
 * §17.3 - "A notification is a doorway. It opens the exact surface it is about
 * - never the home screen, never a generic list."
 *
 * Forty-two notifications had been written and the customer application read
 * none of them: `getUserNotifications` and its two companions had been written,
 * tested and never called. A car that was ready to collect said so only in a
 * push the customer may never have seen.
 *
 * What is built here is not an inbox. It is ONE mark, on the car the fact
 * belongs to, carrying the studio's own subject line and opening the object
 * itself. The constitution is unchanged and its enforcement test still stands.
 *
 * WHICH surface owns the fact depends on the state of the object NOW, not on
 * the state it was in when the push went out. `notificationHref` resolves at
 * WRITE time and is right when it runs; by the time somebody taps, the visit it
 * addressed may have been sealed under a different id - or never sealed at all,
 * in which case there is no surface and no mark.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { Timestamp } from 'firebase/firestore';
import type { Booking, Notification, Service, User, Vehicle, Visit } from '@/lib/types';
import type { CarPicture, CustomerPicture } from '@/lib/customer/picture';
import { noticeOf, unmappableOf, toVehicle, toGarage } from '@/lib/customer/project';
import { VehicleScreen } from '@/components/screens/VehicleScreen';
import { GarageScreen } from '@/components/screens/GarageScreen';
import { photograph } from '@/components/vehicle';

const NOW = new Date('2026-07-30T12:00:00Z');
const ts = (iso: string) => Timestamp.fromDate(new Date(iso));

const vehicle: Vehicle = {
  id: 'v1', name: 'Kia Seltos', registrationNumber: 'GJ01AB8539',
  createdAt: ts('2026-01-01T10:00:00Z'),
} as Vehicle;

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: 'b1', userId: 'u1', vehicleId: 'v1', vehicleName: 'Kia Seltos',
  vehicleRegNo: 'GJ01AB8539', serviceId: 's1', serviceName: 'Glass coating',
  serviceCategory: 'Coating', scheduledDate: '2026-08-04', scheduledTime: '10:00',
  status: 'confirmed', totalAmount: 12000, createdAt: ts('2026-07-20T09:00:00Z'),
  ...over,
} as unknown as Booking);

const sealedVisit = (over: Partial<Visit> = {}): Visit => ({
  id: 'vis-1', vehicleId: 'v1', status: 'sealed', bookingId: 'b1',
  services: [{ name: 'Glass coating', price: 12000 }],
  amounts: { subtotal: 12000, discount: 0, total: 12000 },
  stages: [], termsCaptured: [],
  createdAt: ts('2026-07-20T09:00:00Z'),
  ...over,
} as unknown as Visit);

const notif = (over: Partial<Notification> = {}): Notification => ({
  id: 'n1', userId: 'u1', title: 'Ready for Pickup',
  body: 'Your Kia Seltos is ready! Come collect it at AutoModz, Maninagar.',
  type: 'booking_update', read: false, bookingId: 'b1',
  createdAt: ts('2026-07-25T09:00:00Z'),
  ...over,
} as unknown as Notification);

const car = (over: Partial<CarPicture> = {}): CarPicture => ({
  vehicle, protections: [], declarations: [], visits: [], bookings: [], jobs: [], ...over,
});

const picture = (c: CarPicture, notifications: Notification[]): CustomerPicture => ({
  user: { uid: 'u1', name: 'Meet Sheth', email: 'm@x.test', role: 'customer' } as User,
  cars: [c], subscription: null, subscriptions: [], invoices: [],
  notifications, catalogue: [] as Service[],
  addresses: [], approvals: [],
});

describe('an unread notification surfaces as state on the car it belongs to', () => {
  it('A VISIT IN FLIGHT - the doorway opens the visit', () => {
    const live = booking({ status: 'in_progress', scheduledDate: '2026-07-30' });
    const c = car({ bookings: [live] });
    const n = noticeOf(picture(c, [notif({ title: 'Quality Check' })]), c, NOW);

    expect(n).toEqual({ id: 'n1', title: 'Quality Check', href: '/history/b1' });
  });

  it('A SEALED VISIT - the doorway opens the RECORD, not the booking', () => {
    /* The notification names the booking; the record has an id of its own.
       `/history/b1` would render the no-car invitation. */
    const c = car({ bookings: [booking({ status: 'completed' })], visits: [sealedVisit()] });
    const n = noticeOf(picture(c, [notif()]), c, NOW);

    expect(n?.href).toBe('/history/vis-1');
    expect(n?.href).not.toBe('/history/b1');
  });

  it('A VISIT STILL TO COME - the doorway opens the booking itself', () => {
    /* It used to open `/studio?manage=b1`, a sheet over the Studio. A booking
       has its own address now (design screen 09), so the doorway opens the
       thing the notification is ABOUT rather than a room with a sheet on it. */
    const c = car({ bookings: [booking({ status: 'pending', scheduledDate: '2026-08-04' })] });
    const n = noticeOf(picture(c, [notif({ title: 'Booking Confirmed' })]), c, NOW);

    expect(n?.href).toBe('/booking/b1');
  });

  it('NO OWNING SURFACE, NO MARK - and no destination is invented', () => {
    /* Ten of the nineteen customer notifications in production are about a
       booking that was completed or cancelled and never sealed into a visit.
       There is nothing to open, so nothing is offered - and it is emphatically
       not sent to Home, which §17.3 forbids by name. */
    const orphan = car({ bookings: [booking({ status: 'completed' })] });
    const p = picture(orphan, [notif()]);

    expect(noticeOf(p, orphan, NOW)).toBeUndefined();
    expect(unmappableOf(p, orphan, NOW)).toBe(1);
    expect(toVehicle(orphan, p, NOW).notice).toBeUndefined();
  });

  it('a cancelled booking is the same - nothing to open', () => {
    const c = car({ bookings: [booking({ status: 'cancelled' })] });
    expect(noticeOf(picture(c, [notif({ title: 'Booking not accepted' })]), c, NOW))
      .toBeUndefined();
  });

  it('READ notifications are silent', () => {
    const c = car({ bookings: [booking({ status: 'completed' })], visits: [sealedVisit()] });
    expect(noticeOf(picture(c, [notif({ read: true })]), c, NOW)).toBeUndefined();
  });

  it('a notification about ANOTHER car never marks this one', () => {
    const c = car({ bookings: [booking({ status: 'completed' })], visits: [sealedVisit()] });
    const elsewhere = notif({ bookingId: 'someone-elses-booking' });
    expect(noticeOf(picture(c, [elsewhere]), c, NOW)).toBeUndefined();
  });

  it('the NEWEST unread one wins - there is only ever one mark', () => {
    const c = car({ bookings: [booking({ status: 'completed' })], visits: [sealedVisit()] });
    /* The loaders hand these over newest first. */
    const p = picture(c, [
      notif({ id: 'newer', title: 'Service Completed', createdAt: ts('2026-07-26T09:00:00Z') }),
      notif({ id: 'older', title: 'Quality Check', createdAt: ts('2026-07-24T09:00:00Z') }),
    ]);
    expect(noticeOf(p, c, NOW)?.id).toBe('newer');
  });

  it('the membership is the club’s business, not the car’s', () => {
    /* §17.3 sends it to `/membership`, and that room is its own surface. A
       club notice is not a fact about any one vehicle, so no car wears it. */
    const c = car({ bookings: [booking()] });
    const club = notif({ id: 'club', type: 'membership', bookingId: undefined, title: 'Washes remaining' });
    expect(noticeOf(picture(c, [club]), c, NOW)).toBeUndefined();
  });
});

describe('what the customer actually sees', () => {
  const rendering = photograph({ url: 'https://x.test/car.jpg', aspect: 1, regions: [] });

  const withNotice = () => {
    const c = car({ bookings: [booking({ status: 'completed' })], visits: [sealedVisit()] });
    return { c, p: picture(c, [notif()]) };
  };

  it('the car carries the studio’s subject line, and it opens the object', () => {
    const { c, p } = withNotice();
    const html = renderToStaticMarkup(
      <VehicleScreen model={toVehicle(c, p, NOW)} rendering={rendering} />,
    );
    expect(html).toContain('Ready for Pickup');
    expect(html).toContain('/history/vis-1');
  });

  it('THE BODY IS NEVER RENDERED - a mark is not a message', () => {
    const { c, p } = withNotice();
    const html = renderToStaticMarkup(
      <VehicleScreen model={toVehicle(c, p, NOW)} rendering={rendering} />,
    );
    expect(html).not.toContain('Come collect it at AutoModz');
  });

  it('ONE MARK, NEVER A FEED - §17.1', () => {
    const c = car({ bookings: [booking({ status: 'completed' })], visits: [sealedVisit()] });
    const p = picture(c, [
      notif({ id: 'a', title: 'Ready for Pickup' }),
      notif({ id: 'b', title: 'Service Completed' }),
      notif({ id: 'c', title: 'Quality Check' }),
    ]);
    const html = renderToStaticMarkup(
      <VehicleScreen model={toVehicle(c, p, NOW)} rendering={rendering} />,
    );
    expect(html).toContain('Ready for Pickup');
    expect(html).not.toContain('Service Completed');
    expect(html).not.toContain('Quality Check');
  });

  it('the collection is where it is discovered, as a mark and not a count', () => {
    const { c, p } = withNotice();
    const model = toGarage(p, NOW);
    expect(model.vehicles[0].news).toBe(true);

    const html = renderToStaticMarkup(<GarageScreen model={model} />);
    expect(html).toContain('Something new');
    /* Not a number, and not the studio's words. The car's own room has those. */
    expect(html).not.toContain('Ready for Pickup');
  });

  it('nothing unread, nothing drawn - §18.1', () => {
    const c = car({ bookings: [booking({ status: 'completed' })], visits: [sealedVisit()] });
    const p = picture(c, []);
    expect(toGarage(p, NOW).vehicles[0].news).toBe(false);
    const html = renderToStaticMarkup(
      <VehicleScreen model={toVehicle(c, p, NOW)} rendering={rendering} />,
    );
    expect(html).not.toContain('Something new');
  });
});
