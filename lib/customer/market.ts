/**
 * THE MARKETPLACE, SHAPED FOR SCREENS.
 *
 * Source: docs/AUTOMODZ-OS-ARCHITECTURE.md §1 — "Engines decide. Projections
 * shape. Renderers draw."
 *
 * The engine (`os/market`) decides what is public and what matches; this turns
 * those decisions into sentences and addresses. Every href comes from
 * `navigation/resolve` — a projection that types `/cars/${id}` is a second copy
 * of the route table, which is the defect the palette was just rebuilt to
 * remove.
 *
 * Money is `formatCurrency` from `lib/utils` — the one money helper in the
 * product. There is no second price format here.
 */
import type { CarListing, SellRequest } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import {
  search, statusWord, isBuyable, kmWord, ownerWord, BUDGETS, FUELS,
  FUEL_WORD, TRANSMISSION_WORD, type MarketQuery,
} from '@/lib/os/market';
import { hrefForDestination } from '@/navigation/resolve';
import { COMPANY, waLink, telLink } from '@/lib/company';

/** One car in the list. */
export interface MarketCard {
  id: string;
  title: string;
  href: string;
  price: string;
  photo?: string;
  /** "Sold" / "Reserved", or absent for the ordinary case. */
  badge?: string;
  /** Whether this customer has kept it. */
  saved: boolean;
  /** The three facts that decide a shortlist: year · km · fuel. */
  line: string;
}

/** One filter control: what it says, where it goes, whether it is on. */
export interface MarketFilter {
  key: string;
  label: string;
  href: string;
  on: boolean;
}

export interface MarketModel {
  cars: MarketCard[];
  /** The filter rows, already addressed. §6.4 — each is a real URL. */
  fuels: MarketFilter[];
  budgets: MarketFilter[];
  /** What was asked, so the controls can show their own state. */
  query: MarketQuery;
  /** How many listings exist at all, regardless of the question. */
  stock: number;
  /** Whether a filter is narrowing the list — an empty result means two
   *  different things, and the screen must say the right one. */
  filtered: boolean;
  sellHref: string;
}

const cardOf = (c: CarListing, saved: Set<string>): MarketCard => ({
  id: c.id,
  title: c.title,
  href: hrefForDestination({ to: 'car', listingId: c.id }),
  price: formatCurrency(c.price),
  photo: c.photos?.[0]?.url,
  badge: statusWord(c.status),
  saved: saved.has(c.id),
  line: `${c.year} · ${kmWord(c.kmDriven)} · ${FUEL_WORD[c.fuel] ?? c.fuel}`,
});

export function toMarket(
  listings: CarListing[], query: MarketQuery, savedIds: string[] = [],
): MarketModel {
  const saved = new Set(savedIds);
  const stock = listings.filter(c => c.active === true).length;

  /* Every filter is an ADDRESS, built here rather than in the renderer — a
     screen that assembles `/cars?fuel=…` is a second copy of the route table
     (ARCHITECTURE §1), and it is also what stops the controls being links. */
  const to = (patch: Partial<MarketQuery>) =>
    hrefForDestination({ to: 'cars.filtered', ...{ ...query, ...patch } });

  const anyFuel = !query.fuel || query.fuel === 'all';

  return {
    cars: search(listings, query).map(c => cardOf(c, saved)),
    fuels: [
      { key: 'all', label: 'Any fuel', href: to({ fuel: undefined }), on: anyFuel },
      ...FUELS.map(f => ({
        key: f, label: FUEL_WORD[f], href: to({ fuel: f }), on: query.fuel === f,
      })),
    ],
    budgets: BUDGETS.map(b => ({
      key: String(b.upto),
      label: b.label,
      href: to({ upto: b.upto || undefined }),
      on: (query.upto ?? 0) === b.upto,
    })),
    query,
    stock,
    filtered: Boolean(query.query || (query.fuel && query.fuel !== 'all') || query.upto),
    sellHref: hrefForDestination({ to: 'sell' }),
  };
}

/** One fact about the car, as a label and a value. */
export interface ListingFact { label: string; value: string }

export interface ListingModel {
  id: string;
  title: string;
  price: string;
  photos: { url: string; alt: string }[];
  facts: ListingFact[];
  description?: string;
  badge?: string;
  /** Can it still be bought? Drives whether the studio is offered at all. */
  buyable: boolean;
  saved: boolean;
  /** What a listing that cannot be bought says instead of an inquiry form. */
  closedLine?: string;
  studio: { name: string; address: string; call: string; message: string };
  /** Other stock, so a sold car is a doorway rather than a dead end. */
  alsoHere: MarketCard[];
  backHref: string;
}

export function toListing(
  c: CarListing, all: CarListing[] = [], savedIds: string[] = [],
): ListingModel {
  const saved = new Set(savedIds);
  const buyable = isBuyable(c);

  return {
    id: c.id,
    title: c.title,
    price: formatCurrency(c.price),
    photos: (c.photos ?? []).map((p, i) => ({
      url: p.url,
      /* §21.6 — a real accessible name. "image 1" tells a blind customer
         nothing about the car they are being offered. */
      alt: `${c.title}, photograph ${i + 1} of ${c.photos.length}`,
    })),
    facts: [
      { label: 'Year', value: String(c.year) },
      { label: 'Driven', value: kmWord(c.kmDriven) },
      { label: 'Fuel', value: FUEL_WORD[c.fuel] ?? c.fuel },
      { label: 'Gearbox', value: TRANSMISSION_WORD[c.transmission] ?? c.transmission },
      /* The COUNT of previous keepers — not `os/ownership`, which is about how
         a customer's own car is cared for. Same word, unrelated meaning. */
      { label: 'Owners', value: ownerWord(c.ownership) },
      ...(c.color ? [{ label: 'Colour', value: c.color }] : []),
    ],
    /* §15.7 — an empty description is absent, never an empty heading. The
       registration number is deliberately NOT projected: it is admin-only on
       the type, and publishing it hands a stranger the car's identity. */
    description: c.description?.trim() || undefined,
    badge: statusWord(c.status),
    buyable,
    saved: saved.has(c.id),
    closedLine: buyable ? undefined
      : c.status === 'sold'
        ? 'This one has gone. There may be another like it.'
        : 'This one is being held for someone. Ask us what else is in.',
    studio: {
      name: COMPANY.name,
      address: COMPANY.address,
      call: telLink(),
      message: waLink(`Hi ${COMPANY.name}! I'm interested in the ${c.title}.`),
    },
    alsoHere: search(all.filter(o => o.id !== c.id), {})
      .filter(isBuyable)
      .slice(0, 4)
      .map(o => cardOf(o, saved)),
    backHref: hrefForDestination({ to: 'cars' }),
  };
}

/** What the customer has already offered the studio. */
export interface SellOffer {
  id: string;
  car: string;
  when: string;
  /** "Received" / "We've been in touch" / "Closed" — never the stored word. */
  state: string;
  photos: number;
}

export interface SellModel {
  offers: SellOffer[];
  /** Their own cars, so the form can be filled from the garage rather than typed. */
  garage: { id: string; name: string }[];
  carsHref: string;
}

/**
 * A lead's status, said the way the customer would say it.
 *
 * §21.8 — `new` and `contacted` are the studio's words for its own queue. To
 * the person waiting, the meaningful distinction is whether anyone has picked
 * it up yet.
 */
const OFFER_STATE: Record<string, string> = {
  new: 'Received',
  contacted: 'We’ve been in touch',
  closed: 'Closed',
};

export function toSell(
  requests: SellRequest[],
  garage: { id: string; name: string }[] = [],
): SellModel {
  return {
    offers: requests.map(r => ({
      id: r.id,
      car: `${r.year} ${r.make} ${r.model}`.trim(),
      when: typeof r.createdAt === 'string'
        ? new Date(r.createdAt).toLocaleDateString('en-IN',
          { day: 'numeric', month: 'long', year: 'numeric' })
        : '',
      state: OFFER_STATE[r.status] ?? 'Received',
      photos: r.photos?.length ?? 0,
    })),
    garage,
    carsHref: hrefForDestination({ to: 'cars' }),
  };
}
