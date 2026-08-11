/**
 * `/studio` THREW FOR EVERY SIGNED-IN CUSTOMER.
 *
 * Reported: the Studio room renders the error boundary — "Something went wrong
 * at our end." Anonymously it is fine (it shows the sign-in wall), so the
 * failure needs real data to appear.
 *
 * HYPOTHESIS UNDER TEST: `toStudio` forwards three values STRAIGHT from
 * Firestore — `picture.catalogue`, the vehicles, and the subscription — into a
 * model consumed by `StudioScreen`, which is `'use client'`. Those documents
 * carry `Timestamp` CLASS INSTANCES (`Service.createdAt`, `Vehicle.createdAt`,
 * `Subscription.createdAt/updatedAt/paidAt`), and React Server Components
 * refuse to serialise a class instance across the boundary:
 *
 *   "Only plain objects, and a few built-ins, can be passed to Client
 *    Components from Server Components. Classes or null prototypes are not
 *    supported."
 *
 * Every other projection converts to strings before handing anything to a
 * renderer. `toStudio` is the one that forwards documents whole, because the
 * booking flow wants the Service objects.
 */
import { Timestamp } from 'firebase/firestore';
import type { Service, Subscription, User, Vehicle } from '@/lib/types';
import type { CarPicture, CustomerPicture } from '@/lib/customer/source';
import { toStudio } from '@/lib/customer/project';

const ts = (iso: string) => Timestamp.fromDate(new Date(iso));

/**
 * The rule React actually applies when encoding props for a Client Component:
 * primitives, plain objects and arrays cross; class instances do not.
 */
const nonSerialisable = (value: unknown, path = '$'): string[] => {
  if (value === null || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap((v, i) => nonSerialisable(v, `${path}[${i}]`));
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    return [`${path} is a ${value.constructor?.name ?? 'class'} instance`];
  }
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([k, v]) => nonSerialisable(v, `${path}.${k}`));
};

const picture = (): CustomerPicture => ({
  user: { uid: 'u1', name: 'Nikhil', email: 'n@e.com', role: 'customer' } as User,
  cars: [{
    vehicle: { id: 'v1', name: 'BMW M4', registrationNumber: 'GJ01AB1234',
      createdAt: ts('2026-01-01T00:00:00Z') } as Vehicle,
    protections: [], visits: [], jobs: [],
    bookings: [],
  } as CarPicture],
  subscription: {
    id: 's1', userId: 'u1', userName: 'N', userEmail: 'n@e.com', userPhone: '9',
    plan: 'Gold', status: 'active', startDate: '2026-07-10', endDate: '2026-08-09',
    washesTotal: 8, washesUsed: 2, paymentMethod: 'upi',
    createdAt: ts('2026-07-10T00:00:00Z'), updatedAt: ts('2026-07-10T00:00:00Z'),
  } as Subscription,
  subscriptions: [],
  invoices: [], notifications: [], addresses: [], approvals: [],
  catalogue: [{
    id: 'svc1', name: 'Ceramic coating', category: 'Ceramic', price: 64000,
    createdAt: ts('2026-01-01T00:00:00Z'),
  } as Service],
});

describe('the Studio model can cross to a client component', () => {
  it('carries nothing React will refuse to serialise', () => {
    /* THE REPRODUCTION. Every offender is named with its path, so the failure
       output is the diagnosis. */
    expect(nonSerialisable(toStudio(picture()))).toEqual([]);
  });

  it('the detector itself works — a Timestamp is caught', () => {
    /* Guards against the assertion above passing because the walk is broken. */
    expect(nonSerialisable({ a: ts('2026-01-01T00:00:00Z') }))
      .toEqual(['$.a is a Timestamp instance']);
    expect(nonSerialisable({ a: 1, b: 'x', c: [{ d: null }] })).toEqual([]);
  });

  it('the screen it feeds really is a client component', () => {
    /* If this ever stops being true the constraint disappears with it. */
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { readFileSync } = require('fs') as typeof import('fs');
    expect(readFileSync('components/screens/StudioScreen.tsx', 'utf8'))
      .toMatch(/^'use client';/);
  });
});
