/**
 * ROUTE CONFIGURATION
 *
 * Source: docs/AUTOMODZ-OS.md §5.1, §5.2, §5.4, §6.2, §6.3, §12.2, §15.2
 *         design "AutoModz App.dc.html" — the dock, drawn on all twelve screens
 *
 * ── THE DOCK IS FIVE, AND §6.3 IS SUPERSEDED ────────────────────────────
 * This table used to hold four slots plus a distinct Studio control, because
 * §6.3 read "arranging a visit … earns a permanent, distinct control — NOT A
 * SLOT AMONG EQUALS." The ratified design draws the dock twelve times and it
 * is five equal slots every time: Now · Car · Studio · Garage · You.
 *
 * The clause is honoured rather than dropped. What §6.3 protects is that
 * arranging a visit is never buried — and a permanent slot of its own, lit in
 * amber when you are standing in it, is the strongest form of that promise.
 * What it argued against was a floating-action button, which this is not.
 *
 * Two consequences, both from the design rather than from taste:
 *
 * 1. THE CLUB IS A SLOT, AND THE CAR IS NOT. An earlier cut of the design gave
 *    the car its own slot; the ratified one gives that place to the Club and
 *    reaches a car through the Garage. Both readings of §12.2 were defensible,
 *    and this is the one that settles it: a dock slot for "the car" must
 *    answer "which car" in the navigation, and choosing between cars is the
 *    collection's question. The Club, by contrast, is singular — a customer
 *    has one relationship with the studio — so it costs the dock nothing.
 *
 * 2. HISTORY IS NOT A SLOT. Screen 1h puts the record directly under the
 *    collection, on one scroll. A tab for it was a tab for a list that is
 *    already visible where it belongs, and the fifth slot was needed for the
 *    Studio.
 *
 * ── EVERY ROUTE STILL MAPS TO EXACTLY ONE NAVIGATION ELEMENT ──
 * `activates` is what keeps §6.2 true — "always shows where the customer is" —
 * even in the rooms that have no slot of their own. Standing in History lights
 * the Garage, because the record is part of the collection (§5.1).
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

/** The five rooms that are slots, in dock order. */
export const HOME = '/';
export const STUDIO = '/studio';
export const GARAGE = '/garage';
export const MEMBERSHIP = '/membership';
export const PROFILE = '/you';

/** Rooms reached by going deeper, never by tabbing. */
export const HISTORY = '/history';
export const VEHICLE = '/vehicle';

/**
 * THE MARKETPLACE. Public, unlike every other address above it — `/cars` is
 * readable signed out, because a listing nobody can open is a listing nobody
 * buys. Not rooms: they carry no navigation bar and hold no customer state,
 * so they are absent from `rooms` deliberately.
 */
export const WELCOME = '/welcome';
export const CARS = '/cars';
export const SELL = '/dashboard/sell-car';

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
    /* §12.2 — the car is walked toward from the collection. It held a slot
       briefly and the ratified design took it back: the Garage IS the way to
       a car, and a dock slot for "the car" has to answer "which one" in the
       navigation, which is the collection's question to ask. Standing in a
       car therefore lights the Garage. */
    activates: GARAGE,
  },
  [HISTORY]: {
    path: HISTORY,
    name: 'History',
    concept: 'car',
    chrome: 'nav',
    // Screen 1h — the record sits under the collection. Standing in it lights
    // the Garage, because you have not left the collection.
    activates: GARAGE,
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
    /* The customer's word (§21.8). "Membership" is the contract; "Club" is
       what they belong to, and it is what the design puts on the slot. */
    name: 'Club',
    concept: 'studio',
    chrome: 'nav',
    activates: MEMBERSHIP,
  },
  [PROFILE]: {
    path: PROFILE,
    name: 'You',
    concept: 'person',
    chrome: 'nav',
    activates: PROFILE,
  },
};

/** §6.2 — the dock, in order. Five, as the design draws it on every screen. */
export const slots: readonly string[] = [HOME, STUDIO, GARAGE, MEMBERSHIP, PROFILE];

/**
 * §6.3 — arranging a visit is the most frequent deliberate act, so it keeps a
 * permanent control. That control is now the Studio slot itself rather than a
 * separate mark beside the dock; this record is what other code still reads to
 * ask "where does arranging live", and the answer has not changed.
 *
 * §21.6 — the accessible name; §21.8 — the customer's word. It names a PLACE,
 * not an act: tapping it is arrival, not creation, and §5.2 puts "arranging a
 * visit" inside the Studio. A label of "Add" or "New" would describe a
 * transaction, and §2.1 is that the car is the subject, never the transaction.
 */
export const primaryAction = {
  path: STUDIO,
  label: 'Studio',
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
