/**
 * WHAT A PAGE VIEW COSTS, AND THE ONE THING THE CROSS-REQUEST CACHE MAY HOLD.
 *
 * The project exhausted its daily Firestore read quota and every customer room
 * began answering "We could not reach your garage." The cause was structural
 * rather than any one query: `loadCustomerPicture` fanned five reads out per
 * VEHICLE, and three collections that belong to nobody - the price list, most
 * of all - were re-read in full on every page view of every room, because
 * React's `cache` dedupes inside one request and nothing spans two.
 *
 * These are the two properties that keep it fixed: the read does not grow with
 * the garage (asserted next door, against the query log), and the only thing
 * cached ACROSS requests is data that belongs to no customer.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

const codeOf = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const SERVER = walk('lib/server').concat(walk('app/api'));

describe('the cross-request cache holds only what belongs to nobody', () => {
  /**
   * `unstable_cache` is shared across requests AND across users. A query
   * scoped by a uid put behind it would serve one customer's garage to the
   * next one - which is not a performance bug, it is a data breach.
   *
   * `lib/server/catalogue` reads one collection, filtered by nothing, owned by
   * no one. It is the only module allowed through that door, and this is the
   * door.
   */
  const CACHED = ['lib/server/catalogue.ts'];

  it('only the price list uses it', () => {
    const users = SERVER.filter(f => /unstable_cache/.test(codeOf(f)));
    expect(users).toEqual(CACHED);
  });

  it('and what it caches is scoped by nothing', () => {
    const src = codeOf('lib/server/catalogue.ts');
    /* No `where`, so no filter, so nothing to leak between customers. */
    expect(src).not.toMatch(/\.where\(/);
    expect(src).not.toMatch(/\buid\b|customerId|userId/);
    expect(src).toMatch(/collection\('services'\)/);
  });

  it('and it revalidates, so a price edit reaches the shop floor', () => {
    /* A cache with no window is a price list that never changes again. */
    const src = codeOf('lib/server/catalogue.ts');
    expect(src).toMatch(/revalidate: CATALOGUE_TTL/);
    expect(Number(/CATALOGUE_TTL = (\d+)/.exec(src)?.[1])).toBeLessThanOrEqual(900);
  });
});

describe('nothing re-reads the price list per request any more', () => {
  /**
   * It was read in full by `loadCustomerPicture` (every room), by
   * `loadPriceFloor` (every visitor to the landing page) and by
   * `loadOccupancy` (Home, the Studio, Manage and every change in the booking
   * sheet) - four copies of eighteen documents, none of which differs by
   * customer.
   *
   * The one exception is deliberate and is asserted here so it stays one: the
   * booking WRITER reads inside a Firestore transaction, where a read has to
   * go through the transaction's own reader to be part of its read set.
   */
  const READS_SERVICES = SERVER
    .filter(f => /collection\('services'\)/.test(codeOf(f)));

  /**
   * WHO IS STILL ALLOWED TO READ IT LIVE, AND WHY EACH ONE IS.
   *
   * The cache is for DISPLAY. A path that decides money or a warranty may not
   * take a five-minute-old price:
   *
   *   estimateService  quotes a figure the customer then agrees to
   *   sealVisit        snapshots the warranty terms as sold, for ever
   *   bookingService   the writer, and its read is inside a transaction
   *   retention        a background sweep, off the request path entirely
   *   occupancy        only when a transaction requires it (asserted below)
   *
   * Anything else reading `services` directly is a page paying for eighteen
   * documents it could have had from the cache, which is how the quota went.
   */
  const LIVE_BY_DESIGN = [
    'lib/server/bookingService.ts',
    'lib/server/catalogue.ts',
    'lib/server/estimateService.ts',
    'lib/server/occupancy.ts',
    'lib/server/retention.ts',
    'lib/server/sealVisit.ts',
  ];

  it('and only the paths that decide money or a warranty read it live', () => {
    expect(READS_SERVICES.sort()).toEqual(LIVE_BY_DESIGN);
  });

  it('and occupancy only reads it when a transaction requires it', () => {
    const src = codeOf('lib/server/occupancy.ts');
    /* The read-only callers hand the catalogue in; the read is the fallback. */
    expect(src).toMatch(/opts\.catalogue\s*\?\s*null/);
  });

  it('every read-only caller hands it in', () => {
    for (const f of ['lib/server/openings.ts', 'app/api/availability/route.ts']) {
      expect({ f, passes: /catalogue: await loadCatalogue\(\)/.test(codeOf(f)) })
        .toEqual({ f, passes: true });
    }
  });
});
