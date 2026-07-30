/**
 * GRID — AutoModz Design Language
 *
 * Source: docs/AUTOMODZ-OS.md §8.1, §8.2, §8.4, §8.5, §8.6, §21.3
 *
 * The layout has one rule (§8.1 — one column at every width) and one
 * contract (§8.5 — the stacking contract). This file holds both.
 */
import { space, INSET, MEASURE } from './spacing';

/** §8.1 — fixed. A second column is a dashboard, and this is not a dashboard. */
export const COLUMNS = 1;

export const layout = {
  columns: COLUMNS,
  /** §8.4 — the gutter every inset element sits within. */
  inset: INSET,
  /** §8.2 — the cap on reading width. */
  measure: MEASURE,
} as const;

/**
 * THE COLUMN · §8.2, §8.4, §22.2
 *
 * The gutter and the measure, as one thing to spread. Every screen that places
 * inset type needs both, and four of them had grown their own identical copy —
 * §22.2 wants one implementation of anything, and a measure that drifts between
 * rooms is a measure nobody is enforcing.
 *
 * `Section` applies the same two rules and also carries a heading slot and a
 * fixed rhythm; this is for the screens that have no headings and place their
 * air by composition.
 */
export const column = {
  paddingInline: INSET,
  maxWidth: MEASURE + INSET * 2,
  marginInline: 'auto',
  width: '100%',
} as const;

/**
 * §21.3 — "Every interactive element is at least 44×44 points, including
 * icon-only controls. Visual size may be smaller; the touch area may not."
 *
 * Given by the constitution, not derived.
 */
export const TARGET_MIN = 44;

/**
 * THE STACKING CONTRACT · §8.5
 *
 * "Fixed elements declare their height as a token. Scrolling content pads its
 *  bottom by the sum of those tokens, so nothing is ever hidden behind
 *  anything. No screen may position a fixed element by measuring another."
 *
 * That last sentence is the point: these values are published so that layout
 * is arithmetic rather than measurement. A screen that reads another element's
 * height at runtime has broken the contract even if it looks correct.
 *
 * Derivation of the navigation height:
 *   TARGET_MIN (44) + space.breath above + space.breath below = 60.
 *   The smallest height that satisfies §21.3 without the control touching the
 *   bar's edge.
 */
export const NAV_HEIGHT = TARGET_MIN + space.breath * 2; // 60

/** Distance from the navigation to the bottom edge of the screen. */
export const NAV_GAP = space.line; // 12

/**
 * The CSS expressions a surface uses to honour the contract. Safe-area insets
 * are included here rather than at each call site, since forgetting them is
 * how content ends up under a home indicator.
 */
export const stack = {
  /** Height of the persistent navigation (§6.2). */
  navHeight: NAV_HEIGHT,
  /** Its distance from the screen edge. */
  navGap: NAV_GAP,
  /** Everything fixed at the bottom, including the device's own safe area. */
  bottom: `calc(${NAV_HEIGHT}px + ${NAV_GAP}px + env(safe-area-inset-bottom, 0px))`,
  /**
   * What scrolling content must reserve below itself. One `rest` beyond the
   * fixed stack, so the last element clears the navigation instead of ending
   * flush against it.
   */
  contentFloor: `calc(${NAV_HEIGHT}px + ${NAV_GAP}px + env(safe-area-inset-bottom, 0px) + ${space.rest}px)`,
  /** The top safe area, for takeovers that own the whole screen (§13.2). */
  top: 'env(safe-area-inset-top, 0px)',
} as const;

/**
 * §11.2, §5.3 — the photograph is "the largest element on the screen".
 *
 * Expressed against the viewport so it holds that claim at every height, and
 * capped so it does not become absurd on a desktop. The no-photograph state
 * (§11.5) is deliberately shorter: it is composed to read as *awaiting*, and
 * a full-height empty frame reads as broken instead.
 *
 * ── WHY 94, AND WHY NOT 100 ──────────────────────────────────────────────
 * The first value was 62svh, and 62svh is a banner: it leaves room for a
 * paragraph and the top of a heading, so the screen reads as a page that has
 * a photograph on it rather than as the car itself. §3.1 does not say the
 * photograph is the largest element on the page. It says the photograph IS
 * the interface, and 62% of a screen is not an interface — it is a header.
 *
 * 100svh would be the literal reading, and it is wrong for one reason: with
 * the photograph exactly filling the viewport, nothing on the first screen
 * indicates there is a second one. The 6svh that remains — about 50px on a
 * phone — is a band of bare paper below the fold. That band is the entire
 * scroll affordance, and it is why this is a designed number rather than a
 * round one. §4.5: silence over noise. A strip of paper is the quietest
 * possible way to say "there is more", and it costs no element.
 *
 * The desktop cap rises with it, in the same proportion the height did.
 */
export const PHOTO_CAP = 860;

export const hero = {
  withPhoto: `min(94svh, ${PHOTO_CAP}px)`,
  awaitingPhoto: 'min(42svh, 380px)',
} as const;

/**
 * THE COLLECTION · §12.1, §12.3, §3.2
 *
 * The Garage is a vertical strip of full-bleed photographs, and these are the
 * two sizes a photograph appears at in it.
 *
 * `lead` — the screen, LESS ONE `movement` OF THE NEXT PHOTOGRAPH. That
 * subtraction is the whole idea: a collection whose first frame fills the
 * viewport exactly is indistinguishable from a single car, and §12.1 says the
 * Garage is "every car the customer owns". The glimpse of the second
 * photograph is what makes it a collection, and `movement` is the step §8.3
 * reserves for "where the eye is meant to pause" — so the pause and the
 * glimpse are the same number.
 *
 * `next` — every photograph after it. Roughly 60% of the lead: small enough
 * that two are never mistaken for the first, large enough that the CAR is
 * still the subject of its frame rather than the frame being a thumbnail of
 * one. §12.3 — "cars are equals", so this must never become a swatch. The
 * exact proportion is judgement; the floor it must clear is not.
 *
 * NEITHER SIZE IS A RANK. The dominance belongs to the first POSITION in the
 * strip, not to whatever car occupies it — the constitution is explicit that
 * "no car is primary", and nothing here or in the model stores such a flag.
 */
export const collection = {
  lead: `min(calc(100svh - ${space.movement}px), ${PHOTO_CAP}px)`,
  next: 'min(56svh, 520px)',
} as const;

/**
 * THE PLACE · §5.2, §3.1, §3.2
 *
 * The Studio's photograph, and it is deliberately SMALLER than a vehicle's.
 *
 * §3.1 fixes the dominance rule for "any VEHICLE surface", and the Studio is
 * not one — it is about "AutoModz the place". So the constraint that governs
 * this height is not dominance; it is that the Studio's first screen has three
 * questions to answer and only one of them is a photograph: where the car is,
 * who is caring for it, and what can be done here.
 *
 * Measured at the phone type scale: at 94svh the first screen answers the
 * first question and pushes the other two below the fold. At 68svh the
 * photograph, the presence and the studio's own words all read without
 * scrolling — and the studio's own words are the entire answer to "who is
 * caring for my car", because §2.2 forbids that answer being a person.
 */
export const place = {
  withPhoto: `min(68svh, ${PHOTO_CAP}px)`,
} as const;
