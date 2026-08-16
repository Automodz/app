import 'server-only';
/**
 * THE CUSTOMER'S PICTURE, READ ON THE SERVER.
 *
 * THE ONLY READ. It produces the `CustomerPicture` shape that every projection
 * in `lib/customer/project.ts` and every screen consumes, and it is now the
 * only thing that produces it: the client twin it replaced - `loadPicture` and
 * `useCustomerPicture` in `lib/customer/source.ts` - has been deleted along
 * with the client `Room` that was its last caller. The shape itself lives in
 * `lib/customer/picture.ts`, which imports nothing that fetches.
 *
 * Why this exists rather than a client hook:
 *
 *   · the Firebase client SDK left the customer bundle entirely
 *   · a room's first paint is its content, not a loading bar
 *   · one request fetches once, instead of every navigation refetching
 *   · rules are no longer the read path's only guard - the query is scoped by
 *     the verified session, and the Admin SDK bypasses rules, so ownership is
 *     enforced HERE. Every query below is filtered by the uid from the session
 *     cookie. That is not defence in depth; with the Admin SDK it is the only
 *     defence, which is why it is stated once and never varied.
 */
import { cache } from 'react';
import { adminDb } from './firebaseAdmin';
import { loadCatalogue } from './catalogue';
import type {
  Approval, Booking, Declaration, Invoice, Job, Notification, Protection, SavedAddress,
  Subscription, User, Vehicle, Visit,
} from '@/lib/types';
import type { CarPicture, CustomerPicture } from '@/lib/customer/picture';


const millis = (t?: { toMillis?: () => number }) => t?.toMillis?.() ?? 0;

/**
 * Firestore refuses an `in` filter of more than thirty values, and a garage is
 * not guaranteed to be smaller than that. An empty garage yields NO chunks, so
 * the query is never sent with an empty array - which Firestore also refuses.
 */
const IN_LIMIT = 30;
const chunked = (ids: string[]): string[][] => {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_LIMIT) out.push(ids.slice(i, i + IN_LIMIT));
  return out;
};

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

  const [
    profileSnap, vehicleSnap, subSnap, catalogue, invoiceSnap, notifSnap,
    addressSnap, approvalSnap,
  ] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.collection(`users/${uid}/vehicles`).get(),
    db.collection('subscriptions').where('userId', '==', uid).get(),
    /* THE PRICE LIST IS NOBODY'S, SO IT IS READ ONCE FOR EVERYBODY.
       It is the same eighteen documents for every customer and it changes when
       the studio changes its prices - and it was being re-read in full on
       every page view of every room, including the rooms that never render it.
       `lib/server/catalogue` caches it across requests; nothing owned by a
       customer may ever go behind that cache, and nothing does. */
    loadCatalogue(),
    /* A CHAPTER'S PAPERS. Without this, `toVisit` hardcoded `documents: []`
       and no past visit could ever show its invoice or receipt. Read here so
       History stays one server read, and scoped to this customer - the rules
       would refuse anything wider anyway. */
    db.collection('invoices').where('customerId', '==', uid).get(),
    /* WHAT THE STUDIO HAS SENT THEM - scoped by the session uid like every
       other query here. Read to resolve an unread record to the surface that
       owns it (§17.3), never to draw a list (§17.1). No `orderBy`, so no
       composite index; sorted below. */
    db.collection('notifications').where('userId', '==', uid).limit(30).get(),
    /* WHERE THE STUDIO MAY COLLECT FROM. Read here so the booking sheet and
       the settings list are the same list - two fetches would eventually
       disagree about which address is the default, and the default is what the
       sheet pre-selects. */
    db.collection(`users/${uid}/addresses`).get(),
    /* WHAT THE STUDIO IS ASKING. Scoped by the session uid like every other
       query here, and read with the picture so a car on a bay wears the
       question - a push the customer missed is a car held for a day. */
    db.collection('approvals').where('customerId', '==', uid).limit(20).get(),
  ]);

  const subscriptions = rows<Subscription>(subSnap).sort(
    (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0),
  );

  const profile = profileSnap.data() as Partial<User> | undefined;
  /**
   * THE PROFILE IS CARRIED, NOT RE-TYPED.
   *
   * This listed five fields by hand and `as User` silenced the compiler about
   * every one it did not list - so `welcomedAt` never reached the projection.
   * `shouldWelcome` therefore fell through to "has no car", and every customer
   * without a car in their garage was greeted by the first-arrival flow ON
   * EVERY SINGLE SIGN-IN, for ever, no matter how many times they finished it.
   * The flag was being written correctly the whole time; nothing ever read it.
   *
   * Spreading the document first and overriding only what needs a fallback
   * means a field added to `User` arrives here without anybody remembering to
   * add it - which is the failure this had.
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

  /**
   * ── THE READ COST, AND WHY IT IS NO LONGER PER CAR ──────────────────────
   *
   * This fanned out FIVE queries per vehicle - protections, declarations,
   * visits, bookings and jobs, each filtered by one `vehicleId`. With four
   * cars that is twenty queries on top of the eight above, on EVERY page view
   * of EVERY room, because `cache` dedupes within one request and nothing
   * spans two. The project exhausted its daily Firestore read quota and every
   * customer room began answering "We could not reach your garage."
   *
   * Two of the five never needed the car at all: `bookings` carries `userId`
   * and `jobs` carries `customerId`, so ONE query each returns every car's,
   * and the per-car filter was asking the database to do work the grouping
   * below does for free.
   *
   * The other three are keyed only by `vehicleId`, so they are asked once with
   * `in` over this customer's own ids. Firestore caps `in` at thirty values;
   * `chunked` respects that, which means a garage of thirty-one cars costs six
   * queries rather than a hundred and fifty-five.
   *
   * 8 + 5N becomes 8 + 5. Every query is still scoped by the verified session
   * - by `uid` directly, or by ids read from under it - which is the ownership
   * guarantee this file exists to make, and it is unchanged.
   */
  const ids = vehicles.map(v => v.id);

  const [protSnaps, declSnaps, visitSnaps, bookingSnap, jobSnap] = await Promise.all([
    Promise.all(chunked(ids).map(part =>
      db.collection('protections').where('vehicleId', 'in', part).get())),
    /* THE PAPERS THE OWNER HAS SENT. Keyed by the car exactly as the
       protections are, so a declaration waiting on the studio reaches the
       car's own room without a second read anywhere. One `in` filter, so no
       composite index. */
    Promise.all(chunked(ids).map(part =>
      db.collection('declarations').where('vehicleId', 'in', part).get())),
    Promise.all(chunked(ids).map(part =>
      db.collection('visits').where('vehicleId', 'in', part).get())),
    db.collection('bookings').where('userId', '==', uid).get(),
    db.collection('jobs').where('customerId', '==', uid).get(),
  ]);

  /**
   * EVERY EDGE IS AN ID. THE PLATE JOINS NOTHING.
   *
   * Bookings and jobs were attached to a car by `vehicleRegNo`, and that query
   * - not the stored data - produced the corruption in production: a booking
   * labelled "Honda City" carrying the BMW's plate appeared in the BMW's room,
   * while its own `vehicleId` named the i20 all along. Three bookings were
   * mis-parented by a string comparison.
   *
   * A registration is a display snapshot. It is edited, mistyped, reissued and
   * transferred between cars; it has never been an identity. §P1.6 - it may
   * never establish ownership, and §P1.7 - a record with no `vehicleId` is a
   * record whose vehicle is UNKNOWN. There is deliberately no fallback:
   * finding "another vehicle with this plate" is precisely the bug.
   *
   * A job with no `vehicleId` therefore attaches to no car until the value is
   * backfilled from its booking, which is the authoritative parent.
   */
  const byVehicle = <T extends { vehicleId?: string }>(list: T[]): Map<string, T[]> => {
    const grouped = new Map<string, T[]>();
    for (const record of list) {
      if (!record.vehicleId) continue;
      const held = grouped.get(record.vehicleId);
      if (held) held.push(record);
      else grouped.set(record.vehicleId, [record]);
    }
    return grouped;
  };

  const protections = byVehicle(protSnaps.flatMap(rows<Protection>));
  const declarations = byVehicle(declSnaps.flatMap(rows<Declaration>));
  const visits = byVehicle(visitSnaps.flatMap(rows<Visit>));
  const bookings = byVehicle(rows<Booking>(bookingSnap));
  const jobs = byVehicle(rows<Job>(jobSnap));

  const byNewest = <T extends { createdAt?: { toMillis?: () => number } }>(a: T, b: T) =>
    (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);

  const cars: CarPicture[] = vehicles.map(vehicle => ({
    vehicle,
    protections: protections.get(vehicle.id) ?? [],
    declarations: declarations.get(vehicle.id) ?? [],
    visits: (visits.get(vehicle.id) ?? []).sort(byNewest),
    bookings: (bookings.get(vehicle.id) ?? []).sort(byNewest),
    jobs: (jobs.get(vehicle.id) ?? []).sort(byNewest),
  }));

  return {
    user,
    cars,
    /* The newest is the one in force; the rest are the record. Both come from
       the SAME read - the query already returned every subscription and the
       older ones were being thrown away, so the history costs nothing. */
    subscription: subscriptions[0] ?? null,
    subscriptions,
    catalogue,
    invoices: rows<Invoice>(invoiceSnap),
    /* Newest first - which one is "the latest news" depends on it. */
    notifications: rows<Notification>(notifSnap)
      .sort((a, b) => millis(b.createdAt) - millis(a.createdAt)),
    /* Default first, then alphabetically - the same order the address service
       returns, so the chip a customer tapped last time is where they left it. */
    addresses: rows<SavedAddress>(addressSnap).sort((a, b) =>
      Number(b.isDefault) - Number(a.isDefault)
      || String(a.label).localeCompare(String(b.label))),
    approvals: rows<Approval>(approvalSnap)
      .sort((a, b) => millis(b.requestedAt) - millis(a.requestedAt)),
  };
}
