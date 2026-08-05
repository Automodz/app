import 'server-only';
/**
 * THE CUSTOMER'S PICTURE, READ ON THE SERVER.
 *
 * The Admin SDK twin of `lib/customer/source.ts#loadPicture`. It returns the
 * SAME `CustomerPicture` shape, which is the whole point: every projection in
 * `lib/customer/project.ts` and every screen works unchanged, and nothing about
 * the presentation layer moved.
 *
 * Why this exists rather than the client hook:
 *
 *   · the Firebase client SDK left the customer bundle entirely
 *   · a room's first paint is its content, not a loading bar
 *   · one request fetches once, instead of every navigation refetching
 *   · rules are no longer the read path's only guard — the query is scoped by
 *     the verified session, and the Admin SDK bypasses rules, so ownership is
 *     enforced HERE. Every query below is filtered by the uid from the session
 *     cookie. That is not defence in depth; with the Admin SDK it is the only
 *     defence, which is why it is stated once and never varied.
 */
import { cache } from 'react';
import { adminDb } from './firebaseAdmin';
import type {
  Booking, Invoice, Job, Protection, Service, Subscription, User, Vehicle, Visit,
} from '@/lib/types';
import type { CarPicture, CustomerPicture } from '@/lib/customer/source';

const normReg = (reg: string) => reg.replace(/\s+/g, '').toUpperCase();

/** Admin `Timestamp` is structurally the client's; the projections read both. */
const rows = <T>(snap: { docs: { id: string; data: () => unknown }[] }): T[] =>
  snap.docs.map(d => ({ id: d.id, ...(d.data() as object) }) as T);

export class NotConfiguredError extends Error {}

/**
 * Everything the rooms need, for one verified customer.
 *
 * `uid` MUST come from a verified session cookie. Passing anything else hands a
 * caller somebody else's garage, because the Admin SDK is not subject to rules.
 */
/**
 * Wrapped in React's `cache`, so if two components in one render tree ask for the
 * picture the queries run once. Per-request by construction, which is exactly
 * right for data belonging to one customer and never shareable with another.
 *
 * `cache` is an RSC-only export: it is absent outside a server render (a unit
 * test, for instance), so the wrapper degrades to the plain function rather than
 * making the module unimportable.
 */
export const loadCustomerPicture: typeof _loadCustomerPicture =
  typeof cache === 'function' ? cache(_loadCustomerPicture) : _loadCustomerPicture;

async function _loadCustomerPicture(session: {
  uid: string; email?: string; name?: string;
}): Promise<CustomerPicture> {
  if (!adminDb) throw new NotConfiguredError('Firebase Admin is not configured.');
  const db = adminDb;
  const { uid } = session;

  const [profileSnap, vehicleSnap, subSnap, serviceSnap, invoiceSnap] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.collection(`users/${uid}/vehicles`).get(),
    db.collection('subscriptions').where('userId', '==', uid).get(),
    db.collection('services').get(),
    /* A CHAPTER'S PAPERS. Without this, `toVisit` hardcoded `documents: []`
       and no past visit could ever show its invoice or receipt. Read here so
       History stays one server read, and scoped to this customer — the rules
       would refuse anything wider anyway. */
    db.collection('invoices').where('customerId', '==', uid).get(),
  ]);

  const subscriptions = rows<Subscription>(subSnap).sort(
    (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0),
  );

  const profile = profileSnap.data() as Partial<User> | undefined;
  const user: User = {
    uid,
    name: profile?.name ?? session.name ?? '',
    email: profile?.email ?? session.email ?? '',
    phone: profile?.phone,
    role: profile?.role ?? 'customer',
  } as User;

  const vehicles = rows<Vehicle>(vehicleSnap);

  /* A handful of cars, so a handful of parallel queries. Every one is scoped by
     the session's uid or by a vehicle id read from under that uid. */
  const cars: CarPicture[] = await Promise.all(vehicles.map(async vehicle => {
    const reg = normReg(vehicle.registrationNumber ?? '');
    const [prot, vis, bk, jb] = await Promise.all([
      db.collection('protections').where('vehicleId', '==', vehicle.id).get(),
      db.collection('visits').where('vehicleId', '==', vehicle.id).get(),
      db.collection('bookings')
        .where('userId', '==', uid).where('vehicleRegNo', '==', reg).get(),
      db.collection('jobs')
        .where('customerId', '==', uid).where('vehicleRegNo', '==', reg).get(),
    ]);

    const byNewest = <T extends { createdAt?: { toMillis?: () => number } }>(a: T, b: T) =>
      (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);

    return {
      vehicle,
      protections: rows<Protection>(prot),
      visits: rows<Visit>(vis).sort(byNewest),
      bookings: rows<Booking>(bk).sort(byNewest),
      jobs: rows<Job>(jb).sort(byNewest),
    };
  }));

  return {
    user,
    cars,
    /* The newest is the one in force; the rest are the record. Both come from
       the SAME read — the query already returned every subscription and the
       older ones were being thrown away, so the history costs nothing. */
    subscription: subscriptions[0] ?? null,
    subscriptions,
    catalogue: rows<Service>(serviceSnap),
    invoices: rows<Invoice>(invoiceSnap),
  };
}
