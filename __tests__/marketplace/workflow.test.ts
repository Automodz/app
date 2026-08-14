/**
 * THE MARKETPLACE - §5.2, §15.7, §18.1, §20, §21 · ARCHITECTURE §1.
 *
 * WHAT WAS ACTUALLY WRONG, and it was not "the pages were missing":
 *
 *   THE STUDIO WAS NEVER TOLD. `createCarLead` wrote a document and stopped.
 *   The single highest-value message this product can carry - someone asking
 *   to buy a car - landed in a collection nobody watched. Identical to the
 *   defect that made new bookings invisible.
 *
 *   ANYONE COULD WRITE A LEAD. `carLeads` allowed unauthenticated create so
 *   the public form could work: an open write endpoint wired to the studio's
 *   WhatsApp. Every write now goes through the Admin SDK behind a route.
 *
 *   THE WHOLE CUSTOMER HALF WAS ORPHANED. Nine exported functions, zero
 *   callers. The studio could list a car and read enquiries; no customer could
 *   see a listing, ask about one, keep one, or offer their own.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import type { CarListing, SellRequest } from '@/lib/types';
import {
  isPublic, isBuyable, matches, rank, search, statusWord,
  ownerWord, kmWord, FUELS, FUEL_WORD, BUDGETS,
} from '@/lib/os/market';
import { toMarket, toListing, toSell } from '@/lib/customer/market';
import { hrefForDestination } from '@/navigation/resolve';

const codeOf = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

const listing = (over: Partial<CarListing> = {}): CarListing => ({
  id: 'c1', title: '2021 Hyundai Creta SX', make: 'Hyundai', model: 'Creta',
  year: 2021, price: 1_450_000, kmDriven: 42_000, fuel: 'petrol',
  transmission: 'automatic', ownership: 1, color: 'White',
  description: 'Single owner, full history.', photos: [{ url: 'u1', path: 'p1' }],
  status: 'available', featured: false, active: true,
  createdAt: '2026-01-01' as never, updatedAt: '2026-01-01' as never,
  ...over,
});

describe('what may be shown at all', () => {
  it('an inactive listing is invisible, whatever its status', () => {
    /* `active` is the studio's switch. A withdrawn car must vanish from the
       list AND from its own address, or an old link keeps selling it. */
    expect(isPublic(listing({ active: false }))).toBe(false);
    expect(isPublic(listing({ active: false, status: 'available' }))).toBe(false);
    expect(search([listing({ active: false })], {})).toEqual([]);
  });

  it('a sold car stays visible while it is active', () => {
    /* Hiding it the day it sells 404s every link anyone shared. */
    const sold = listing({ status: 'sold' });
    expect(isPublic(sold)).toBe(true);
    expect(isBuyable(sold)).toBe(false);
    expect(search([sold], {})).toHaveLength(1);
  });

  it('only an available car can be bought', () => {
    expect(isBuyable(listing())).toBe(true);
    expect(isBuyable(listing({ status: 'reserved' }))).toBe(false);
  });

  it('the ordinary case wears no badge', () => {
    /* §15.7 - a badge on everything is a badge on nothing. */
    expect(statusWord('available')).toBeUndefined();
    expect(statusWord('sold')).toBe('Sold');
    expect(statusWord('reserved')).toBe('Reserved');
  });
});

describe('finding a car', () => {
  const stock = [
    listing({ id: 'a', make: 'Hyundai', model: 'Creta', price: 1_450_000, fuel: 'petrol' }),
    listing({ id: 'b', make: 'Maruti', model: 'Swift', price: 480_000, fuel: 'diesel',
      title: '2019 Maruti Swift VXI' }),
    listing({ id: 'c', make: 'Tata', model: 'Nexon', price: 1_100_000, fuel: 'electric',
      title: '2022 Tata Nexon EV' }),
  ];

  it('matches on make, model and title alike', () => {
    expect(search(stock, { query: 'creta' }).map(c => c.id)).toEqual(['a']);
    expect(search(stock, { query: 'maruti' }).map(c => c.id)).toEqual(['b']);
    expect(search(stock, { query: 'EV' }).map(c => c.id)).toEqual(['c']);
  });

  it('ignores case, because nobody types a model in capitals', () => {
    expect(search(stock, { query: 'SWIFT' }).map(c => c.id)).toEqual(['b']);
  });

  it('a price ceiling is inclusive of the ceiling', () => {
    expect(matches(listing({ price: 500_000 }), { upto: 500_000 })).toBe(true);
    expect(matches(listing({ price: 500_001 }), { upto: 500_000 })).toBe(false);
  });

  it('a ceiling of zero is no ceiling, not a ceiling of nothing', () => {
    /* `?upto=0` is how "Any price" is expressed; treating it as a real bound
       would make that button return an empty showroom. */
    expect(search(stock, { upto: 0 })).toHaveLength(3);
  });

  it('`all` is the absence of a fuel filter, not a fuel', () => {
    expect(search(stock, { fuel: 'all' })).toHaveLength(3);
    expect(search(stock, { fuel: 'diesel' }).map(c => c.id)).toEqual(['b']);
  });

  it('combines every filter rather than letting the last one win', () => {
    expect(search(stock, { query: 'a', fuel: 'petrol', upto: 2_000_000 })
      .map(c => c.id)).toEqual(['a']);
    expect(search(stock, { fuel: 'petrol', upto: 500_000 })).toEqual([]);
  });

  it('every fuel offered as a filter is one a listing can actually hold', () => {
    /* A filter for a fuel outside the stored union is a control that can only
       ever return nothing. */
    for (const f of FUELS) {
      expect(FUEL_WORD[f]).toBeTruthy();
      expect(matches(listing({ fuel: f }), { fuel: f })).toBe(true);
    }
  });

  it('leads with what can be bought, then what is featured', () => {
    const ordered = [
      listing({ id: 'sold', status: 'sold', featured: true, year: 2024 }),
      listing({ id: 'plain', year: 2020 }),
      listing({ id: 'star', featured: true, year: 2021 }),
    ].sort(rank);
    expect(ordered[0].id).toBe('star');
    expect(ordered[2].id).toBe('sold');
  });
});

describe('what the screens are handed', () => {
  it('every address comes from the resolver', () => {
    const m = toMarket([listing()], {});
    expect(m.cars[0].href).toBe('/cars/c1');
    expect(m.sellHref).toBe('/dashboard/sell-car');
    expect(toListing(listing()).backHref).toBe('/cars');
  });

  it('the projection writes no route of its own', () => {
    const src = codeOf('lib/customer/market.ts');
    expect([...src.matchAll(/['"`]\/[a-z][^'"`]*['"`]/g)].map(m => m[0])).toEqual([]);
  });

  it('money is formatted by the one money helper, never a second one', () => {
    const src = codeOf('lib/customer/market.ts');
    expect(src).toMatch(/formatCurrency/);
    expect(src).not.toMatch(/Intl\.NumberFormat\([^)]*currency/);
    expect(toMarket([listing()], {}).cars[0].price).toBe('₹14,50,000');
  });

  it('an empty showroom and an empty result are different facts', () => {
    /* §18.1 - one is the studio's news, the other is the customer's own
       filter, and only the second offers a way back out. */
    expect(toMarket([], {}).stock).toBe(0);
    expect(toMarket([], {}).filtered).toBe(false);
    const noMatch = toMarket([listing()], { query: 'ferrari' });
    expect(noMatch.cars).toEqual([]);
    expect(noMatch.stock).toBe(1);
    expect(noMatch.filtered).toBe(true);
  });

  it('the registration number is never published', () => {
    /* Admin-only on the type. Publishing it hands a stranger the car's
       identity, and no buyer needs it before they arrive. */
    const m = toListing(listing({ regNo: 'GJ01AB1234' }));
    expect(JSON.stringify(m)).not.toContain('GJ01AB1234');
  });

  it('an absent description is absent, not an empty heading', () => {
    expect(toListing(listing({ description: '   ' })).description).toBeUndefined();
    expect(toListing(listing()).description).toBe('Single owner, full history.');
  });

  it('every photograph carries a description a person could use', () => {
    /* §21.6 - "image 1" tells a blind customer nothing about the car they are
       being offered. */
    const m = toListing(listing({ photos: [{ url: 'a', path: 'x' }, { url: 'b', path: 'y' }] }));
    expect(m.photos[0].alt).toBe('2021 Hyundai Creta SX, photograph 1 of 2');
  });

  it('a car that cannot be bought says so and is not a dead end', () => {
    const sold = toListing(listing({ status: 'sold' }), [listing({ id: 'other' })]);
    expect(sold.buyable).toBe(false);
    expect(sold.closedLine).toMatch(/gone/);
    expect(sold.alsoHere.length).toBeGreaterThan(0);
  });

  it('"also here" never offers the car being looked at, nor an unbuyable one', () => {
    const all = [listing({ id: 'c1' }), listing({ id: 'c2' }),
      listing({ id: 'c3', status: 'sold' })];
    expect(toListing(listing({ id: 'c1' }), all).alsoHere.map(c => c.id)).toEqual(['c2']);
  });

  it('the saved state travels with the card', () => {
    expect(toMarket([listing()], {}, ['c1']).cars[0].saved).toBe(true);
    expect(toMarket([listing()], {}, []).cars[0].saved).toBe(false);
  });

  it('the owner COUNT is never confused with the care state', () => {
    /* `CarListing.ownership` is "1st owner"; `os/ownership` is how a customer's
       own car is being looked after. Same word, unrelated meanings. */
    expect(ownerWord(1)).toBe('1st owner');
    expect(ownerWord(2)).toBe('2nd owner');
    expect(ownerWord(3)).toBe('3rd owner');
    expect(ownerWord(4)).toBe('4th owner');
    expect(codeOf('lib/os/market.ts')).not.toMatch(/from '@\/lib\/os\/ownership'/);
    expect(codeOf('lib/customer/market.ts')).not.toMatch(/os\/ownership/);
  });

  it('distance reads the way an Indian customer reads it', () => {
    expect(kmWord(42000)).toBe('42,000 km');
  });

  it('the budget brackets are fixed, so a shared link keeps its meaning', () => {
    expect(BUDGETS[0].upto).toBe(0);
    expect(BUDGETS.every(b => typeof b.upto === 'number')).toBe(true);
  });
});

describe('what the customer has already offered', () => {
  const req = (over: Partial<SellRequest> = {}): SellRequest => ({
    id: 's1', userId: 'u1', name: 'Nikhil', phone: '9000000000',
    make: 'Honda', model: 'City', year: 2018, kmDriven: 60000,
    photos: [], status: 'new',
    createdAt: '2026-07-01T00:00:00.000Z' as never,
    updatedAt: '2026-07-01T00:00:00.000Z' as never,
    ...over,
  });

  it('is shown back to them, because the old form forgot immediately', () => {
    const m = toSell([req()]);
    expect(m.offers).toHaveLength(1);
    expect(m.offers[0].car).toBe('2018 Honda City');
  });

  it('speaks the customer’s word for the status, not the studio’s queue word', () => {
    /* §21.8 - `new` and `contacted` are the studio's words for its own list. */
    expect(toSell([req({ status: 'new' })]).offers[0].state).toBe('Received');
    expect(toSell([req({ status: 'contacted' })]).offers[0].state)
      .toBe('We’ve been in touch');
    expect(toSell([req({ status: 'closed' })]).offers[0].state).toBe('Closed');
  });

  it('offers the garage so a known car need not be typed out', () => {
    expect(toSell([], [{ id: 'v1', name: 'BMW M4' }]).garage).toHaveLength(1);
  });
});

describe('SECURITY - the client may no longer write any of this', () => {
  const rules = readFileSync('firestore.rules', 'utf8');
  const slice = (name: string) => {
    const i = rules.indexOf(`match /${name}/`);
    return rules.slice(i, rules.indexOf('match /', i + 10));
  };

  it('a lead cannot be created from a browser', () => {
    /* It could, unauthenticated, with a shape check as the only guard - an
       open write endpoint wired to the studio's notifications. */
    expect(slice('carLeads')).toMatch(/allow create: if false;/);
  });

  it('an offer cannot be created from a browser', () => {
    expect(slice('sellRequests')).toMatch(/allow create: if false;/);
  });

  it('a saved car is written only by the server', () => {
    expect(rules).toMatch(/match \/savedCars\/\{listingId\} \{[\s\S]{0,200}allow write: if false;/);
  });

  it('an admin can still read what it must work', () => {
    expect(slice('carLeads')).toMatch(/allow read, update, delete: if request\.auth != null && isAdmin\(\)/);
  });

  it('only active listings are readable', () => {
    expect(slice('carListings')).toMatch(/allow read: if resource\.data\.active == true/);
  });
});

describe('SECURITY - the routes that now own those writes', () => {
  const lead = codeOf('app/api/cars/lead/route.ts');
  const sell = codeOf('app/api/cars/sell/route.ts');
  const save = codeOf('app/api/cars/save/route.ts');
  const service = codeOf('lib/server/marketService.ts');

  it('an enquiry is deliberately open to signed-out callers', () => {
    /* Requiring an account before someone may ask about a car is a sale
       thrown away. Open, but not unguarded - the write is server-side. */
    expect(lead).not.toMatch(/return NextResponse\.json\(\{ error: 'Unauthorized' \}/);
  });

  it('an enquiry NEVER takes a uid from the body', () => {
    expect(lead).toMatch(/verifyIdToken/);
    expect(lead).not.toMatch(/body\.userId/);
  });

  it('offering a car and saving one both require a proven identity', () => {
    for (const r of [sell, save]) {
      expect(r).toMatch(/error: 'Unauthorized'.*401|401/);
      expect(r).toMatch(/verifyIdToken/);
    }
    expect(sell).not.toMatch(/body\.userId/);
  });

  it('the listing is READ, never trusted from the caller', () => {
    /* A lead cannot claim to be about a car it is not, or name its own title. */
    expect(service).toMatch(/const listing = await loadListing\(intent\.listingId\)/);
    expect(service).toMatch(/listingTitle: listing\.title/);
  });

  it('a lead about a withdrawn or sold car is refused', () => {
    expect(service).toMatch(/if \(!listing\) throw new MarketError\('listing-unavailable'\)/);
    expect(service).toMatch(/listing\.status !== 'available'/);
  });

  it('a lead cannot be filed with its own status', () => {
    expect(service).toMatch(/status: 'new'/);
  });

  it('photographs are accepted only under the uploader’s own path', () => {
    /* The signed-upload route binds every path to the caller's uid; this
       refuses a body that names someone else's. */
    expect(service).toMatch(/startsWith\(`sellRequests\/\$\{uid\}\/`\)/);
  });

  it('a phone number that cannot be called back is refused', () => {
    expect(service).toMatch(/digits\.length >= 10/);
  });
});

describe('THE STUDIO IS TOLD - the defect that made bookings invisible', () => {
  const service = codeOf('lib/server/marketService.ts');

  it('both channels fire for an enquiry', () => {
    expect(service).toMatch(/notifyAdmins\('car_lead'/);
    expect(service).toMatch(/wa_car_lead_/);
  });

  it('both channels fire for an offered car', () => {
    expect(service).toMatch(/notifyAdmins\('sell_request'/);
    expect(service).toMatch(/wa_sell_request_/);
  });

  it('each is deduped on its own id, so a retry cannot notify twice', () => {
    expect(service).toMatch(/dedupeKey: lead\.id/);
    expect(service).toMatch(/dedupeKey: offer\.id/);
  });

  it('the two channels are guarded separately', () => {
    /* A WhatsApp outage must not make the in-app notice look sent. */
    expect(service).toMatch(/notificationLog'\)\.doc\(`wa_car_lead_/);
  });

  it('a notification failure never loses the lead', () => {
    /* The document is written before anyone is told, and every notify is
       wrapped - an enquiry that reached Firestore is not thrown away because
       Meta was down. */
    const writeAt = service.indexOf('collection(\'carLeads\').add');
    const notifyAt = service.indexOf('await announceLead');
    expect(writeAt).toBeLessThan(notifyAt);
    expect(service).toMatch(/catch \(e\) \{\s*await reportError/);
  });

  it('there is ONE WhatsApp-to-studio implementation in lib/', () => {
    /* Read RAW: `codeOf` strips `//…` to the end of the line, which eats the
       `https://graph.facebook.com/…` URL this is looking for. */
    const senders = walk('lib').filter(f => {
      const raw = readFileSync(f, 'utf8');
      return raw.includes('graph.facebook.com') && raw.includes('messaging_product');
    });
    expect(senders).toEqual(['lib/server/notify.ts']);
  });
});

describe('ONE SOURCE OF TRUTH', () => {
  const sources = [...walk('lib'), ...walk('app'), ...walk('components'), ...walk('navigation')]
    .filter(f => !f.includes('node_modules'));

  it('only one module reads carListings', () => {
    const readers = sources.filter(f =>
      /collection\('carListings'\)|collection\(db, 'carListings'\)/.test(codeOf(f)));
    expect(readers.sort()).toEqual([
      /* The admin operation that says WHICH car a listing is (design 17). It
         writes `vehicleId`/`vehicleOwnerId` and nothing a customer reads, and
         it is server-side because the pair has to be PROVEN against the
         owner's garage before it becomes a link that could publish somebody
         else's record. */
      'app/api/cars/link/route.ts',
      'lib/server/marketplace.ts',
      'lib/services/cars.ts',   // the studio's own writes, from admin
    ]);
  });

  it('the sitemap advertises exactly what the showroom shows', () => {
    /* It ran its own `where('active','==',true)` query, so it could advertise
       a car the showroom would not show. */
    expect(codeOf('app/sitemap.ts')).toMatch(/loadListings/);
    expect(codeOf('app/sitemap.ts')).not.toMatch(/carListings/);
  });

  it('the customer-facing client readers are gone, not merely unused', () => {
    const cars = codeOf('lib/services/cars.ts');
    for (const dead of [
      'getCarListing', 'getActiveCarListings', 'createCarLead',
      'createSellRequest', 'getUserSellRequests', 'saveCar', 'unsaveCar',
      'getSavedCarIds',
    ]) {
      expect(cars).not.toContain(`export const ${dead}`);
    }
  });

  it('nothing in the product still calls them', () => {
    for (const dead of ['createCarLead', 'saveCar', 'getSavedCarIds', 'createSellRequest']) {
      const callers = sources.filter(f => new RegExp(`\\b${dead}\\(`).test(codeOf(f)));
      expect(callers).toEqual([]);
    }
  });

  it('the marketplace uses the one media uploader', () => {
    const form = codeOf('components/market/SellForm.tsx');
    /* Loaded lazily so the uploader never enters the first bundle - the import
       is dynamic, hence the looser match. */
    expect(form).toMatch(/import\('@\/lib\/services\/storage'\)/);
    expect(form).toMatch(/uploadImage\(/);
    /* And it does NOT sign or upload for itself. */
    expect(form).not.toMatch(/api\/media\/sign/);
    expect(form).not.toMatch(/cloudinary/);
  });

  it('there is one offline note, not one per screen', () => {
    const notes = [...walk('components')].filter(f =>
      /You.re offline\. This is the last we knew/.test(readFileSync(f, 'utf8')));
    expect(notes).toEqual(['components/system/OfflineNote.tsx']);
  });
});

describe('the surfaces exist and behave like the rest of the product', () => {
  it('all three routes are there', () => {
    expect(codeOf('app/cars/page.tsx')).toMatch(/export default async function CarsPage/);
    expect(codeOf('app/cars/[id]/page.tsx')).toMatch(/export default async function CarPage/);
    expect(codeOf('app/dashboard/sell-car/page.tsx'))
      .toMatch(/export default function SellCarPage/);
  });

  it('none of them may be prerendered or shared between customers', () => {
    for (const r of ['app/cars/page.tsx', 'app/cars/[id]/page.tsx',
      'app/dashboard/sell-car/page.tsx']) {
      expect(codeOf(r)).toMatch(/export const dynamic = 'force-dynamic'/);
    }
  });

  it('the public half renders without a session; the sell half does not', () => {
    expect(codeOf('app/cars/page.tsx')).not.toMatch(/ServerRoom/);
    expect(codeOf('app/dashboard/sell-car/page.tsx')).toMatch(/ServerRoom/);
  });

  it('a withdrawn listing 404s rather than rendering', () => {
    expect(codeOf('app/cars/[id]/page.tsx')).toMatch(/if \(!car\) notFound\(\)/);
  });

  it('a listing is shareable - the link is worth pasting', () => {
    const src = codeOf('app/cars/[id]/page.tsx');
    expect(src).toMatch(/export async function generateMetadata/);
    expect(src).toMatch(/openGraph/);
    expect(src).toMatch(/canonical/);
  });

  it('a withdrawn car leaks nothing to whoever holds an old id', () => {
    const src = codeOf('app/cars/[id]/page.tsx');
    expect(src).toMatch(/if \(!car\) \{[\s\S]{0,120}title: 'Car for sale'/);
  });

  it('loading is a state, and it is the breath rather than a spinner', () => {
    const src = codeOf('app/cars/loading.tsx');
    expect(src).toMatch(/<Loading caption=/);
    expect(src).not.toMatch(/spinner|Spinner/);
  });

  it('every filter is a real address, so a shortlist can be sent to someone', () => {
    expect(hrefForDestination({ to: 'cars.filtered', query: 'creta' })).toBe('/cars?q=creta');
    expect(hrefForDestination({ to: 'cars.filtered', fuel: 'diesel', upto: 500000 }))
      .toBe('/cars?fuel=diesel&upto=500000');
    /* Empty filters are omitted, so the plain list has ONE canonical URL. */
    expect(hrefForDestination({ to: 'cars.filtered', fuel: 'all' })).toBe('/cars');
    expect(hrefForDestination({ to: 'cars.filtered' })).toBe('/cars');
  });

  it('asking about a car is addressable, like every other expansion (§6.4)', () => {
    expect(codeOf('components/screens/ListingScreen.tsx'))
      .toMatch(/params\.get\('ask'\)/);
  });

  it('the renderer draws only - no engine, no addresses of its own', () => {
    /* Caught by the architecture test the first time: `MarketScreen` imported
       `lib/os/market` for the filter lists and assembled `/cars?fuel=…`
       itself. Both belong to the projection (ARCHITECTURE §1). */
    const src = codeOf('components/screens/MarketScreen.tsx');
    expect(src).not.toMatch(/from ['"]@\/lib\/os\//);
    const model = toMarket([listing()], { fuel: 'diesel' });
    expect(model.fuels.find(f => f.key === 'diesel')?.on).toBe(true);
    expect(model.fuels.find(f => f.key === 'all')?.href).toBe('/cars');
    expect(model.budgets.find(b => b.key === '500000')?.href)
      .toBe('/cars?fuel=diesel&upto=500000');
  });

  it('a filter keeps the other filters rather than dropping them', () => {
    const m = toMarket([listing()], { query: 'creta', upto: 500000 });
    expect(m.fuels.find(f => f.key === 'petrol')?.href)
      .toBe('/cars?q=creta&fuel=petrol&upto=500000');
  });

  it('the filter controls announce which one is on', () => {
    /* §21.6 - the pressed state must be in the accessibility tree, not only
       in the colour. */
    expect(codeOf('components/screens/MarketScreen.tsx')).toMatch(/aria-current=/);
  });

  it('the search field is a form, so Enter submits it', () => {
    const src = codeOf('components/screens/MarketScreen.tsx');
    expect(src).toMatch(/<form action="\/cars" method="get" role="search"/);
    /* And the other filters travel with it rather than being dropped. */
    expect(src).toMatch(/<input type="hidden" name="fuel"/);
  });

  it('the signed-in half is kept out of search results', () => {
    expect(codeOf('app/robots.ts')).toMatch(/'\/dashboard'/);
    /* …while the showroom stays crawlable. */
    const robots = codeOf('app/robots.ts');
    const list = robots.slice(robots.indexOf('disallow: ['),
      robots.indexOf('],', robots.indexOf('disallow: [')));
    expect(list).not.toMatch(/'\/cars'/);
  });

  it('every marketplace surface says something when the network goes', () => {
    for (const s of ['MarketScreen', 'ListingScreen', 'SellCarScreen']) {
      expect(codeOf(`components/screens/${s}.tsx`)).toMatch(/<OfflineNote/);
    }
  });
});
