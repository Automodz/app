/**
 * ROUTE CONFIGURATION
 *
 * Source: docs/AUTOMODZ-OS.md §5.1, §5.2, §5.4, §6.2, §6.3, §12.2, §15.2
 *
 * All seven rooms are configured here. Only four of them are slots in the
 * navigation, and that is a decision the constitution makes, not a compromise:
 *
 * §6.3 — "Arranging a visit is the single most frequent deliberate act. It
 * earns a permanent, distinct control — NOT A SLOT AMONG EQUALS." §5.2 places
 * arranging inside Studio, so Studio is reached by the primary action rather
 * than by a tab. Giving it both would be two controls for one room.
 *
 * §12.2 — "With a single vehicle, the Garage does not exist as a meaningful
 * place — the customer goes straight to their car." A car is therefore
 * something you walk toward from the Garage, not something you tab to. Putting
 * Vehicle in the bar would mean choosing *which* car in the navigation, which
 * is the collection's job.
 *
 * §15.2 — "A membership is a protection. It appears alongside everything else
 * protecting the car." It is reached from the thing it protects.
 *
 * Seven equal slots would also be a dashboard, and §5.1's own model is three
 * concepts rather than seven peers.
 *
 * ── EVERY ROUTE STILL MAPS TO EXACTLY ONE NAVIGATION ELEMENT ──
 * `activates` is what keeps §6.2 true — "always shows where the customer is" —
 * even in the two rooms that have no slot of their own. Standing in a Vehicle
 * lights the Garage, because you are still inside THE CAR (§5.1).
 */

/** §5.1 — the three concepts. The rooms may evolve; these may not. */
export type Concept = 'car' | 'studio' | 'person';

/**
 * §6.2 — navigation "disappears for exactly one reason: a full-screen takeover
 * that demands the whole surface." §13.2 says the same of a live visit.
 */
export type Chrome = 'nav' | 'takeover';

export interface Room {
  /** §6.4 — every surface is addressable. */
  path: string;
  /** The customer's word for this room (§5.2). */
  name: string;
  /** §5.1 */
  concept: Concept;
  /** Whether the navigation shows here. §6.2 */
  chrome: Chrome;
  /**
   * Which navigation element lights up when the customer is here.
   * A room without a slot of its own borrows the one for its concept.
   */
  activates: string;
}

/** The four rooms that are slots, in bar order. */
export const HOME = '/';
export const GARAGE = '/garage';
export const HISTORY = '/history';
export const PROFILE = '/you';

/** The room the primary action leads to. §6.3 */
export const STUDIO = '/studio';

/** Rooms reached by going deeper, never by tabbing. */
export const VEHICLE = '/vehicle';
export const MEMBERSHIP = '/membership';

export const rooms: Record<string, Room> = {
  [HOME]: {
    path: HOME,
    name: 'Now',
    concept: 'car',
    chrome: 'nav',
    activates: HOME,
  },
  [GARAGE]: {
    path: GARAGE,
    name: 'Garage',
    concept: 'car',
    chrome: 'nav',
    activates: GARAGE,
  },
  [VEHICLE]: {
    path: VEHICLE,
    name: 'The car',
    concept: 'car',
    chrome: 'nav',
    // §12.2 — a car is walked toward from the collection; standing in one
    // still lights the Garage, because you have not left THE CAR.
    activates: GARAGE,
  },
  [HISTORY]: {
    path: HISTORY,
    name: 'History',
    concept: 'car',
    chrome: 'nav',
    activates: HISTORY,
  },
  [STUDIO]: {
    path: STUDIO,
    name: 'Studio',
    concept: 'studio',
    chrome: 'nav',
    activates: STUDIO,
  },
  [MEMBERSHIP]: {
    path: MEMBERSHIP,
    name: 'Membership',
    concept: 'studio',
    chrome: 'nav',
    // §15.2 — a membership belongs to the relationship with the studio.
    activates: STUDIO,
  },
  [PROFILE]: {
    path: PROFILE,
    name: 'You',
    concept: 'person',
    chrome: 'nav',
    activates: PROFILE,
  },
};

/** §6.2 — the bar, in order. Four, not seven. */
export const slots: readonly string[] = [HOME, GARAGE, HISTORY, PROFILE];

/**
 * §6.3 — the one permanent, distinct control. It is not in `slots` because it
 * is not a slot among equals.
 */
export const primaryAction = {
  path: STUDIO,
  /**
   * §21.6 — the accessible name; §21.8 — the customer's word.
   *
   * It names a PLACE, not an act. The control is the studio's own mark and
   * tapping it is arrival, not creation — and §5.2 puts "arranging a visit"
   * inside the Studio, so entering the studio is how a visit gets arranged.
   * A label of "Add" or "New" would describe a transaction, and §2.1 is that
   * the car is the subject, never the transaction.
   */
  label: 'The studio',
} as const;

/**
 * Resolve a pathname to the room it belongs to. Longest match wins, so a
 * deeper address still resolves to its room.
 */
export const roomFor = (pathname: string): Room | undefined => {
  if (rooms[pathname]) return rooms[pathname];
  const match = Object.keys(rooms)
    .filter(p => p !== HOME && pathname.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];
  return match ? rooms[match] : undefined;
};

/** §6.2 — is the navigation shown at this address? */
export const chromeFor = (pathname: string): Chrome =>
  roomFor(pathname)?.chrome ?? 'nav';

/** Which navigation element is lit at this address. */
export const activeSlotFor = (pathname: string): string | undefined =>
  roomFor(pathname)?.activates;
