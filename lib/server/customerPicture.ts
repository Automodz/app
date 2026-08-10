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
  Booking, Invoice, Job, Notification, Protection, Service, Subscription, User, Vehicle, Visit,
} from '@/lib/types';
import type { CarPicture, CustomerPicture } from '@/lib/customer/source';


const millis = (t?: { toMillis?: () => number }) => t?.toMillis?.() ?? 0;

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

  const [profileSnap, vehicleSnap, subSnap, serviceSnap, invoiceSnap, notifSnap] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.collection(`users/${uid}/vehicles`).get(),
    db.collection('subscriptions').where('userId', '==', uid).get(),
    db.collection('services').get(),
    /* A CHAPTER'S PAPERS. Without this, `toVisit` hardcoded `documents: []`
       and no past visit could ever show its invoice or receipt. Read here so
       History stays one server read, and scoped to this customer — the rules
       would refuse anything wider anyway. */
    db.collection('invoices').where('customerId', '==', uid).get(),
    /* WHAT THE STUDIO HAS SENT THEM — scoped by the session uid like every
       other query here. Read to resolve an unread record to the surface that
       owns it (§17.3), never to draw a list (§17.1). No `orderBy`, so no
       composite index; sorted below. */
    db.collection('notifications').where('userId', '==', uid).limit(30).get(),
  ]);

  const subscriptions = rows<Subscription>(subSnap).sort(
    (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0),
  );

  const profile = profileSnap.data() as Partial<User> | undefined;
  /**
   * THE PROFILE IS CARRIED, NOT RE-TYPED.
   *
   * This listed five fields by hand and `as User` silenced the compiler about
   * every one it did not list — so `welcomedAt` never reached the projection.
   * `shouldWelcome` therefore fell through to "has no car", and every customer
   * without a car in their garage was greeted by the first-arrival flow ON
   * EVERY SINGLE SIGN-IN, for ever, no matter how many times they finished it.
   * The flag was being written correctly the whole time; nothing ever read it.
   *
   * Spreading the document first and overriding only what needs a fallback
   * means a field added to `User` arrives here without anybody remembering to
   * add it — which is the failure this had.
   */
  const user: User = {
    ...(profile ?? {}),
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
    /**
     * EVERY EDGE IS AN ID. THE PLATE JOINS NOTHING.
     *
     * Bookings and jobs were attached to a car by `vehicleRegNo`, and that
     * query — not the stored data — produced the corruption in production: a
     * booking labelled "Honda City" carrying the BMW's plate appeared in the
     * BMW's room, while its own `vehicleId` named the i20 all along. Three
     * bookings were mis-parented by a string comparison.
     *
     * A registration is a display snapshot. It is edited, mistyped, reissued
     * and transferred between cars; it has never been an identity. §P1.6 — it
     * may never establish ownership, and §P1.7 — a record with no `vehicleId`
     * is a record whose vehicle is UNKNOWN. There is deliberately no fallback:
     * finding "another vehicle with this plate" is precisely the bug.
     *
     * A job with no `vehicleId` therefore attaches to no car until the value
     * is backfilled from its booking, which is the authoritative parent.
     */
    const [prot, vis, bk, jb] = await Promise.all([
      db.collection('protections').where('vehicleId', '==', vehicle.id).get(),
      db.collection('visits').where('vehicleId', '==', vehicle.id).get(),
      db.collection('bookings')
        .where('userId', '==', uid).where('vehicleId', '==', vehicle.id).get(),
      db.collection('jobs')
        .where('customerId', '==', uid).where('vehicleId', '==', vehicle.id).get(),
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
    /* Newest first — which one is "the latest news" depends on it. */
    notifications: rows<Notification>(notifSnap)
      .sort((a, b) => millis(b.createdAt) - millis(a.createdAt)),
  };
}
