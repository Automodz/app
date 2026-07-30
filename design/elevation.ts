/**
 * ELEVATION — AutoModz Design Language
 *
 * Source: docs/AUTOMODZ-OS.md §9.3, §3.4, §3.6, §10.2
 *
 * §9.3 names seven bands and states the rule that makes them work:
 *
 *   "An element's shadow and its stacking order come from the same band.
 *    They can never disagree."
 *
 * So a band is not a z-index and a shadow that happen to be used together —
 * it is one object holding both. Nothing may take a z-index from here and a
 * shadow from elsewhere, which is the mechanism by which a card ends up
 * visually above something it sits behind.
 *
 * Derivation of the stacking values:
 *   Bands step by 10, leaving nine unused values between any two. That gap is
 *   deliberate: it lets an implementation nudge one element relative to its
 *   neighbour without inventing a new band or colliding with the next one.
 *
 * Derivation of the shadows (§3.4 — "light is the only ornament"):
 *   Each shadow is two layers, because one is not how light works. A tight
 *   contact shadow describes where the material meets its ground; a wide
 *   ambient shadow describes the room. Both are pure black at low alpha, since
 *   §3.3 permits no colour that does not carry meaning.
 *
 *   Blur roughly doubles per band and offset tracks it, so the sense of height
 *   grows continuously rather than in steps the eye can count.
 *
 * §10.2 — all bands share ONE surface fill (colors.surface). Height is
 * expressed by light alone, never by a lighter material.
 */

export interface Band {
  /** Stacking order. */
  z: number;
  /** Two-layer shadow: contact, then ambient. `none` at ground level. */
  shadow: string;
}

export const elevation = {
  /** The page. Nothing is lifted, so nothing casts. */
  base: {
    z: 0,
    shadow: 'none',
  },

  /** A card lifted off the page. */
  raised: {
    z: 10,
    shadow: '0 1px 2px rgba(0,0,0,0.28), 0 4px 12px rgba(0,0,0,0.22)',
  },

  /** A persistent control — the one primary action (§6.3). */
  float: {
    z: 20,
    shadow: '0 2px 4px rgba(0,0,0,0.32), 0 8px 24px rgba(0,0,0,0.28)',
  },

  /** Primary navigation. Always present, always in the same place (§6.2). */
  nav: {
    z: 30,
    shadow: '0 -1px 2px rgba(0,0,0,0.24), 0 -8px 32px rgba(0,0,0,0.32)',
  },

  /** A drawer over the room. */
  sheet: {
    z: 40,
    shadow: '0 -2px 8px rgba(0,0,0,0.36), 0 -16px 48px rgba(0,0,0,0.44)',
  },

  /** A full-screen moment — a live visit, a photograph opened (§8.6). */
  takeover: {
    z: 50,
    shadow: '0 4px 16px rgba(0,0,0,0.44), 0 24px 64px rgba(0,0,0,0.52)',
  },

  /** Something that must be seen. Nothing may sit above this. */
  alert: {
    z: 60,
    shadow: '0 4px 16px rgba(0,0,0,0.48), 0 24px 64px rgba(0,0,0,0.56)',
  },
} as const satisfies Record<string, Band>;

export type Elevation = keyof typeof elevation;
