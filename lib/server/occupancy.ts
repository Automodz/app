import type { Query, DocumentReference } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin';
import {
  bookingToOccupant, walkInJobToOccupant, RESOURCE_DEFAULTS,
  lookbackDates, spanDays, addDaysISO, DAY_OPEN_MIN,
  type Occupant, type ResourceConfig,
} from '@/lib/availability';

/**
 * Who is in the bays, loaded once and read by both the availability endpoint
 * and the Booking Service.
 *
 * It lives here because occupancy is derived from `bookings` + `jobs` +
 * `services` + `studioConfig`, and if the endpoint that OFFERS a slot and the
 * service that ACCEPTS one loaded that from two places, they would eventually
 * disagree - the customer would be shown a slot the writer then rejects, or
 * worse, accept one the reader called full.
 *
 * `reader` is whatever can `.get()` a ref or a query - a Firestore
 * `Transaction` when the caller needs occupancy inside a transaction's read
 * set, the collection handles themselves otherwise.
 */
export interface Reader {
  get(ref: DocumentReference): Promise<{ exists: boolean; data(): unknown }>;
  /* `id` is carried because a booking being MOVED must not be counted as an
     obstacle to its own move — see `excludeBookingIds` below. Every real
     Firestore snapshot has it; the type simply admitted it did not. */
  get(q: Query): Promise<{ docs: { id?: string; data(): unknown }[] }>;
}

/** The date window that can overlap `dates` once multi-day work is considered. */
export const occupancyRange = (dates: string[], durationMinutes: number) => {
  const sorted = [...dates].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = spanDays(DAY_OPEN_MIN, durationMinutes);
  return {
    sorted,
    rangeStart: lookbackDates(first).slice(-1)[0] ?? first,
    rangeEnd: addDaysISO(last, span),
  };
};

/**
 * `excludeBookingIds` — reservations that must NOT count against the query.
 *
 * A booking being rescheduled occupies the bay it is about to leave. Counting
 * it would make a two-day job unable to move by one day, and would refuse a
 * move to an adjacent hour on the grounds that the booking itself is in the
 * way. The exclusion is by ID, never by field matching: two identical-looking
 * bookings on one day are two real reservations, and only one of them is the
 * one moving.
 */
export const loadOccupancy = async (
  reader: Reader,
  rangeStart: string,
  rangeEnd: string,
  opts: { excludeBookingIds?: readonly string[] } = {},
): Promise<{ occupants: Occupant[]; cfg: ResourceConfig }> => {
  const db = adminDb!;
  const [bookingsSnap, jobsSnap, servicesSnap, cfgSnap] = await Promise.all([
    reader.get(db.collection('bookings')
      .where('scheduledDate', '>=', rangeStart)
      .where('scheduledDate', '<=', rangeEnd)),
    reader.get(db.collection('jobs')
      .where('date', '>=', rangeStart)
      .where('date', '<=', rangeEnd)),
    reader.get(db.collection('services') as unknown as Query),
    reader.get(db.collection('studioConfig').doc('resources')),
  ]);

  const cfg: ResourceConfig = {
    ...RESOURCE_DEFAULTS,
    ...(cfgSnap.exists ? (cfgSnap.data() as object) : {}),
  } as ResourceConfig;

  // duration lookup: exact service name first, then the category's longest
  const byName = new Map<string, number>();
  const byCategory = new Map<string, number>();
  servicesSnap.docs.forEach(d => {
    const s = d.data() as { name?: string; category?: string; duration?: number };
    if (s.name && s.duration) byName.set(s.name, s.duration);
    if (s.category && s.duration) {
      byCategory.set(s.category, Math.max(byCategory.get(s.category) ?? 0, s.duration));
    }
  });
  const durationOf = (cat: string, serviceName?: string) =>
    (serviceName && byName.get(serviceName)) || byCategory.get(cat) || 60;

  const excluded = new Set(opts.excludeBookingIds ?? []);
  const occupants: Occupant[] = [];
  bookingsSnap.docs.forEach(d => {
    if (d.id && excluded.has(d.id)) return;
    const o = bookingToOccupant(d.data() as Parameters<typeof bookingToOccupant>[0], durationOf);
    if (o) occupants.push(o);
  });
  jobsSnap.docs.forEach(d => {
    const o = walkInJobToOccupant(d.data() as Parameters<typeof walkInJobToOccupant>[0], durationOf);
    if (o) occupants.push(o);
  });

  return { occupants, cfg };
};
