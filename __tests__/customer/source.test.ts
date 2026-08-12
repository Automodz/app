/**
 * The read orchestration. Proves every room's data actually arrives, and that
 * one failing query fails the whole read rather than half-rendering a car.
 */
import type { User } from '@/lib/types';

const getVehicles = jest.fn();
const getProtections = jest.fn();
const getDeclarations = jest.fn();
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
/* The papers the owner has sent, read beside the protections — a declaration
   waiting on the studio produces no protection and is still the whole of what
   the car has to say about its certificate. */
jest.mock('@/lib/services/declarations', () => ({ getDeclarations: (...a: unknown[]) => getDeclarations(...a) }));
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
  getDeclarations.mockResolvedValue([]);
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

it('reads EVERY collection by vehicle id — never by plate', async () => {
  await loadPicture(USER);
  expect(getProtections.mock.calls.map(c => c[0])).toEqual(['v1', 'v2']);
  expect(getDeclarations.mock.calls.map(c => c[0])).toEqual(['v1', 'v2']);
  expect(getVisitsForVehicle.mock.calls.map(c => c[0])).toEqual(['v1', 'v2']);
  expect(getBookingsForVehicle.mock.calls.map(c => c[0])).toEqual(['v1', 'v2']);
  expect(getJobsForVehicle.mock.calls.map(c => c[0])).toEqual(['v1', 'v2']);
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
  getBookingsForVehicle.mockImplementation((vehicleId: string) =>
    vehicleId === 'v2' ? Promise.reject(new Error('nope')) : Promise.resolve([]));
  await expect(loadPicture(USER)).rejects.toThrow('nope');
});
