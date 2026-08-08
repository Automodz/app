/**
 * The read orchestration. Proves every room's data actually arrives, and that
 * one failing query fails the whole read rather than half-rendering a car.
 */
import type { User } from '@/lib/types';

const getVehicles = jest.fn();
const getProtections = jest.fn();
const getVisitsForVehicle = jest.fn();
const getBookingsForVehicle = jest.fn();
const getJobsForVehicle = jest.fn();
const getUserSubscription = jest.fn();
const getServices = jest.fn();
const getUserNotifications = jest.fn();

jest.mock('@/lib/services/vehicles', () => ({
  getVehicles: (...a: unknown[]) => getVehicles(...a),
  getBookingsForVehicle: (...a: unknown[]) => getBookingsForVehicle(...a),
  getJobsForVehicle: (...a: unknown[]) => getJobsForVehicle(...a),
}));
jest.mock('@/lib/services/protections', () => ({ getProtections: (...a: unknown[]) => getProtections(...a) }));
jest.mock('@/lib/services/visits', () => ({
  getVisitsForVehicle: (...a: unknown[]) => getVisitsForVehicle(...a),
  visitFromPair: jest.fn(),
}));
jest.mock('@/lib/services/subscriptions', () => ({ getUserSubscription: (...a: unknown[]) => getUserSubscription(...a) }));
jest.mock('@/lib/services/services', () => ({ getServices: (...a: unknown[]) => getServices(...a) }));
/* §17.1 — read so an UNREAD record can be resolved to the surface that owns
   it. No list is drawn from it; see `noticeOf`. */
jest.mock('@/lib/services/notifications', () => ({ getUserNotifications: (...a: unknown[]) => getUserNotifications(...a) }));
jest.mock('@/lib/store', () => ({ useAppStore: () => null }));

import { loadPicture } from '@/lib/customer/source';

const USER = { uid: 'u1', name: 'A', email: 'a@b.c', role: 'customer' } as User;

beforeEach(() => {
  jest.clearAllMocks();
  getVehicles.mockResolvedValue([
    { id: 'v1', name: 'Car One', registrationNumber: 'GJ 01 AA 1111' },
    { id: 'v2', name: 'Car Two', registrationNumber: 'GJ 01 BB 2222' },
  ]);
  getProtections.mockResolvedValue([]);
  getVisitsForVehicle.mockResolvedValue([]);
  getBookingsForVehicle.mockResolvedValue([]);
  getJobsForVehicle.mockResolvedValue([]);
  getUserSubscription.mockResolvedValue(null);
  getServices.mockResolvedValue([]);
  getUserNotifications.mockResolvedValue([]);
});

it('loads one picture covering every car', async () => {
  const p = await loadPicture(USER);
  expect(p.user).toBe(USER);
  expect(p.cars.map(c => c.vehicle.id)).toEqual(['v1', 'v2']);
  expect(getVehicles).toHaveBeenCalledWith('u1');
  expect(getUserSubscription).toHaveBeenCalledWith('u1');
  /* Scoped to the owner, like every other read here. */
  expect(getUserNotifications).toHaveBeenCalledWith('u1');
});

it('reads protections and visits by vehicle id, and jobs and bookings by plate', async () => {
  await loadPicture(USER);
  expect(getProtections.mock.calls.map(c => c[0])).toEqual(['v1', 'v2']);
  expect(getVisitsForVehicle.mock.calls.map(c => c[0])).toEqual(['v1', 'v2']);
  expect(getBookingsForVehicle.mock.calls.map(c => c[0])).toEqual(['GJ 01 AA 1111', 'GJ 01 BB 2222']);
  expect(getJobsForVehicle.mock.calls.map(c => c[0])).toEqual(['GJ 01 AA 1111', 'GJ 01 BB 2222']);
});

it('does one query per car per collection — no N+1 walk', async () => {
  await loadPicture(USER);
  expect(getVehicles).toHaveBeenCalledTimes(1);
  expect(getServices).toHaveBeenCalledTimes(1);
  expect(getProtections).toHaveBeenCalledTimes(2);
});

it('a customer with no cars is a valid picture, not a failure', async () => {
  getVehicles.mockResolvedValue([]);
  const p = await loadPicture(USER);
  expect(p.cars).toEqual([]);
});

it('rejects when a read is refused, so the room shows its recoverable state', async () => {
  getProtections.mockRejectedValue(new Error('Missing or insufficient permissions.'));
  await expect(loadPicture(USER)).rejects.toThrow(/permissions/);
});

it('rejects rather than rendering half a garage when one car fails', async () => {
  getBookingsForVehicle.mockImplementation((reg: string) =>
    reg.includes('BB') ? Promise.reject(new Error('nope')) : Promise.resolve([]));
  await expect(loadPicture(USER)).rejects.toThrow('nope');
});
