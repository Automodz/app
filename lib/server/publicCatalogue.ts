import 'server-only';
/**
 * THE PUBLIC PRICE FLOOR.
 *
 * The landing shows "FROM ₹x" under each of the four disciplines, where x is
 * the cheapest ACTIVE service in that category. The old page read that on the
 * client with `getServices()`, which meant the marketing page - the one address
 * every visitor arrives at - carried the whole Firebase client SDK.
 *
 * Same numbers, same silent-failure rule, read on the server instead. If the
 * read fails or Admin is not configured, the caller falls back to the static
 * `from` values in `lib/catalog.ts`, exactly as the client version did.
 */
import { loadCatalogue } from './catalogue';

/**
 * Category → the lowest active price in it. Empty when nothing can be read.
 *
 * THROUGH THE SHARED CATALOGUE, because this is the read on the public
 * landing page - the one address every visitor arrives at, signed in or not -
 * and it was fetching the whole `services` collection per hit. The price list
 * belongs to nobody, so one cached read serves every visitor rather than one
 * read serving each; see `lib/server/catalogue`.
 */
export async function loadPriceFloor(): Promise<Record<string, number>> {
  try {
    const min: Record<string, number> = {};
    for (const s of await loadCatalogue()) {
      if (s.active === false) continue;
      if (typeof s.price !== 'number' || !s.category) continue;
      if (min[s.category] === undefined || s.price < min[s.category]) {
        min[s.category] = s.price;
      }
    }
    return min;
  } catch {
    /* A landing page never shows the customer our infrastructure. The static
       catalogue prices are correct enough to publish. */
    return {};
  }
}
