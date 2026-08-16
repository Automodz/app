import 'server-only';
/**
 * THE PRICE LIST, READ ONCE FOR EVERYBODY.
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────
 * `services` is the one collection in the product that is IDENTICAL for every
 * customer and changes about as often as the studio changes its prices - and
 * it was being read in full, per customer, on every page view of every room.
 * `loadCustomerPicture` asks for it because three projections need it
 * (`protectionsOf`'s reconstruction, the Studio's disciplines, the booking
 * sheet's menu), so the Garage, the Club, the You page and the record were all
 * paying for eighteen documents they never render.
 *
 * React's `cache` deduplicates within ONE request and nothing spans two, so
 * every navigation paid again. Multiplied across a session that is most of the
 * read budget, and the project exhausted its daily Firestore quota - at which
 * point every customer room answered "We could not reach your garage."
 *
 * `unstable_cache` is the right tool and the only one: it caches ACROSS
 * requests and across customers, which is safe here precisely because the
 * price list belongs to nobody. Nothing owned by a customer may ever be put
 * behind it - see the guard note below.
 *
 * ── WHY THE WINDOW IS FIVE MINUTES ───────────────────────────────────────
 * A price edited in the studio's settings has to reach the customer, and the
 * catalogue is authoritative for the NEXT quote rather than the last one
 * (`lib/os/scope`) - so staleness costs a customer nothing already agreed.
 * Five minutes is short enough that an admin editing a price sees it on the
 * shop floor within a coffee, and long enough that a customer walking four
 * rooms pays for the collection once rather than four times.
 */
import { unstable_cache } from 'next/cache';
import { adminDb } from './firebaseAdmin';
import type { Service } from '@/lib/types';

/** Seconds. See the note above for why this number and not a longer one. */
export const CATALOGUE_TTL = 300;

const read = async (): Promise<Service[]> => {
  if (!adminDb) return [];
  const snap = await adminDb.collection('services').get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as object) }) as Service);
};

/**
 * Every active and inactive service, as stored.
 *
 * NOTHING CUSTOMER-OWNED MAY JOIN IT. `unstable_cache` is shared across
 * requests AND across users; a query scoped by a uid put behind it would serve
 * one customer's garage to the next one. This module reads exactly one
 * collection, it is filtered by nothing, and it is the only thing in
 * `lib/server` allowed through that door.
 */
export const loadCatalogue = unstable_cache(read, ['catalogue'], {
  revalidate: CATALOGUE_TTL,
  tags: ['catalogue'],
});
