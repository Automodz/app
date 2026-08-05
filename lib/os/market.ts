/**
 * THE MARKET ENGINE — what a listing is, and which ones answer a question.
 *
 * Source: docs/AUTOMODZ-OS-ARCHITECTURE.md §1
 *
 * Pure, like every engine here: no React, no routes, no Firestore. It decides
 * two things and nothing else — whether a listing may be shown at all, and
 * which of them match what somebody asked for.
 *
 * A NOTE ON THE WORD "OWNERSHIP". `CarListing.ownership` is a COUNT — first
 * owner, second owner — and has nothing to do with `lib/os/ownership`, which
 * resolves how a customer's own car is being cared for. Two different things
 * that share an English word; they must never be wired to each other.
 */
import type { CarListing, CarListingStatus, CarFuel, CarTransmission } from '@/lib/types';

/** What a customer may filter by. Every field optional — absent means "any". */
export interface MarketQuery {
  /** Free text over make, model and title. */
  query?: string;
  /** A fuel, or `all`. */
  fuel?: string;
  /** An upper bound in rupees. 0 / undefined means no ceiling. */
  upto?: number;
}

/**
 * May this listing be shown to a customer at all?
 *
 * `active` is the studio's switch — a withdrawn car must disappear from the
 * list AND from its own address, or an old link keeps selling a car that is no
 * longer for sale. Sold and reserved cars stay visible while active, because
 * "sold" is information a buyer wants (it shows the studio moves stock) and
 * hiding it silently would make a shared link 404 the day it sells.
 */
export const isPublic = (c: CarListing): boolean => c.active === true;

/** Cars a customer can actually buy right now. */
export const isBuyable = (c: CarListing): boolean =>
  isPublic(c) && c.status === 'available';

/**
 * The word shown over a listing's photograph.
 *
 * `available` returns undefined — the ordinary case wears no badge, because a
 * badge on everything is a badge on nothing (§15.7, absence is silence).
 */
export const statusWord = (s: CarListingStatus): string | undefined =>
  s === 'sold' ? 'Sold' : s === 'reserved' ? 'Reserved' : undefined;

/**
 * Does this listing answer the question?
 *
 * Matching is case-insensitive and spans make, model and title, because a
 * customer types "creta" and the title reads "2021 Hyundai Creta SX".
 */
export const matches = (c: CarListing, q: MarketQuery): boolean => {
  if (q.fuel && q.fuel !== 'all' && c.fuel !== q.fuel) return false;
  if (q.upto && q.upto > 0 && c.price > q.upto) return false;
  const text = q.query?.trim().toLowerCase();
  if (!text) return true;
  return `${c.make} ${c.model} ${c.title}`.toLowerCase().includes(text);
};

/**
 * The order stock is shown in.
 *
 * Featured first, then what can still be bought, then newest. A sold car
 * sinking below an available one is the whole point: the list should lead with
 * what the customer can act on.
 */
export const rank = (a: CarListing, b: CarListing): number => {
  const buyable = Number(isBuyable(b)) - Number(isBuyable(a));
  if (buyable) return buyable;
  const featured = Number(b.featured) - Number(a.featured);
  if (featured) return featured;
  return b.year - a.year;
};

/** Everything shown, in order, for one question. */
export const search = (listings: CarListing[], q: MarketQuery): CarListing[] =>
  listings.filter(c => isPublic(c) && matches(c, q)).sort(rank);

/**
 * The price ceilings offered as one-tap filters.
 *
 * Fixed rather than derived from stock: a bracket that moves whenever a car
 * sells makes a shared `?upto=` link mean something different tomorrow.
 */
export const BUDGETS: readonly { label: string; upto: number }[] = [
  { label: 'Any price', upto: 0 },
  { label: 'Under ₹5L', upto: 500_000 },
  { label: 'Under ₹10L', upto: 1_000_000 },
  { label: 'Under ₹20L', upto: 2_000_000 },
];

/**
 * The fuels offered as one-tap filters, taken from the stored union rather than
 * typed out — a filter for a fuel no listing can hold is a control that can
 * only ever return nothing.
 */
export const FUELS: readonly CarFuel[] = ['petrol', 'diesel', 'cng', 'electric'];

/**
 * How a stored value is said out loud. The documents hold `cng`; a customer
 * reads "CNG", and nobody writes "Petrol" in lower case on a price board.
 */
export const FUEL_WORD: Record<CarFuel, string> = {
  petrol: 'Petrol', diesel: 'Diesel', cng: 'CNG', electric: 'Electric',
};

export const TRANSMISSION_WORD: Record<CarTransmission, string> = {
  manual: 'Manual', automatic: 'Automatic',
};

/** "1st owner", "2nd owner" — the count on the listing, never a care state. */
export const ownerWord = (n: number): string => {
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suffix} owner`;
};

/** "42,000 km", in the grouping an Indian customer reads. */
export const kmWord = (km: number): string =>
  `${new Intl.NumberFormat('en-IN').format(km)} km`;
