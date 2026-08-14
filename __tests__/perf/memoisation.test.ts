/**
 * The projections are called several times per render - Home asks for a car's
 * protections and Garage asks again for every car. These assert the work happens
 * once per car per request.
 */
import { Timestamp } from 'firebase/firestore';
import type { Booking, Service, User, Vehicle } from '@/lib/types';
import type { CarPicture, CustomerPicture } from '@/lib/customer/source';
import { toHome, toGarage, toVehicle, stateOf } from '@/lib/customer/project';

const ts = (iso: string) => Timestamp.fromDate(new Date(iso));

const booking = (over: Partial<Booking> = {}) => ({
  id: 'b1', userId: 'u1', vehicleId: 'v1', vehicleRegNo: 'GJ01AB1234',
  serviceName: 'Ceramic coating', serviceCategory: 'Ceramic',
  totalAmount: 64000, scheduledDate: '2026-07-18', status: 'completed',
  createdAt: ts('2026-07-18T09:00:00Z'), ...over,
} as unknown as Booking);

const car = (id: string, bookings: Booking[]): CarPicture => ({
  vehicle: { id, name: 'Car ' + id, registrationNumber: 'GJ 01 AB 1234',
             createdAt: ts('2023-03-01T10:00:00Z') } as Vehicle,
  protections: [], declarations: [], visits: [], bookings, jobs: [],
});

const picture = (cars: CarPicture[]): CustomerPicture => ({
  user: { uid: 'u1', name: 'A', email: 'a@b.c', role: 'customer' } as User,
  cars, subscription: null, subscriptions: [], invoices: [], notifications: [], catalogue: [] as Service[], addresses: [], approvals: [],
});

it('stateOf is computed once per car, however often it is asked', () => {
  const c = car('v1', [booking()]);
  const first = stateOf(c);
  const second = stateOf(c);
  /* Identity, not just equality: a second call returned the same object, so no
     second walk of the booking list happened. */
  expect(second).toBe(first);
});

it('a car appearing in two projections is computed once', () => {
  const c = car('v1', [booking()]);
  const p = picture([c]);
  const home = toHome(p)!;
  const garage = toGarage(p);
  const vehicle = toVehicle(c, p);
  // all three agree, because all three read one memoised computation
  expect(garage.vehicles[0].state).toBe(home.state.word);
  expect(vehicle.state).toBe(home.state.word);
});

it('memoisation is keyed on the car, so two cars stay distinct', () => {
  const quiet = car('v1', [booking()]);
  const live = car('v2', [booking({ status: 'in_progress' })]);
  expect(stateOf(quiet).word).toBe('Protected');
  expect(stateOf(live).word).toBe('In care');
});

it('a fresh picture recomputes - nothing is cached across requests', () => {
  const a = car('v1', [booking()]);
  const b = car('v1', [booking({ status: 'in_progress' })]);
  /* Different CarPicture objects, so a new request never sees a stale answer. */
  expect(stateOf(a)).not.toBe(stateOf(b));
  expect(stateOf(b).word).toBe('In care');
});
