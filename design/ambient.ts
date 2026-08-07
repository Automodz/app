/**
 * THE AMBIENT FIELD — the room the application stands in.
 *
 * A DELIBERATE AMENDMENT to §3.3 and §3.4. The constitution says "colour is
 * information, never decoration" and "depth comes from light and shadow, not
 * from decorative gradients". The owner has directed a magenta ambient
 * environment, and this is how it is reconciled rather than simply ignored:
 *
 *   THE FIELD IS LIGHT, NOT A SURFACE. It is the far wall of the room — the
 *   thing glass has to have something to refract. Apple's glass sits on a
 *   wallpaper; the wallpaper is not glass. So this is modelled as coloured
 *   LIGHT falling on paper, which keeps §3.4's "light is the only ornament"
 *   literally true, and it never becomes a card, a panel, or a border.
 *
 *   IT NEVER CARRIES MEANING. §3.3's real purpose is that a customer can trust
 *   colour when they see it — that amber means attention and red means urgent.
 *   The field is the same magenta in every state the product can be in, so it
 *   can never be mistaken for information. `assent`/`caution`/`urgent` keep
 *   their jobs untouched.
 *
 *   IT STAYS UNDER THE CONTENT. Ink, photographs and state colour all sit on
 *   the near side of the glass. The field is only ever seen THROUGH something.
 *
 * §3.6 — "glass never sits on glass" — is why the field is not itself
 * translucent. One glass layer, over a lit ground. Stack a second and it reads
 * as a rendering mistake, because it is one.
 */

/** One light on the far wall. */
export interface AmbientLight {
  hue: string;
  /** Placement, in percent of the viewport. */
  x: number;
  y: number;
  /** Radius, in vmax, so the composition holds at any size. */
  size: number;
  opacity: number;
}

/**
 * The three lights.
 *
 * Three, not one, because a single radial reads as a spotlight — a flat disc
 * with an obvious centre. Three overlapping at different sizes and offsets
 * never resolves into a shape the eye can name, which is what makes it read as
 * atmosphere rather than as a graphic.
 *
 * Positions are in percentages of the viewport so the composition holds from
 * 320px to a desktop without art direction at each size.
 */
export const ambient = {
  /** The dominant magenta. Largest, weakest, sets the overall cast. */
  key: {
    hue: '#C4318A',
    x: 18,
    y: 12,
    size: 92,
    opacity: 0.30,
  },
  /** A warmer secondary, low and to the right — keeps the field from reading flat. */
  warm: {
    hue: '#E0459B',
    x: 86,
    y: 70,
    size: 68,
    opacity: 0.20,
  },
  /**
   * A cool violet counterweight. Without it the field is one hue and reads as
   * a tint over the whole screen rather than as light in a space.
   */
  cool: {
    hue: '#6C2BD9',
    x: 62,
    y: 108,
    size: 78,
    opacity: 0.22,
  },

  /**
   * How far the field drifts, as a percentage of the viewport.
   *
   * Small on purpose. §7.4 permits ambient motion on the photograph alone and
   * calls for "an occasional slow" movement; anything the eye can follow stops
   * being atmosphere and becomes an animation playing at the customer.
   */
  drift: 6,

  /** Seconds for one full cycle. Long enough that it is never seen to loop. */
  period: 32,

  /**
   * How far the field leans toward a pointer or a tilt, in percent.
   *
   * This is the "reacts" half. It is parallax against input, not a follow — the
   * light shifts as though the surface caught it, which is why it must be far
   * smaller than the pointer's own movement.
   */
  react: 2.5,
} as const;

/**
 * THE GLASS.
 *
 * One material, at one strength (§10.2 — "not a card and a panel and a tile —
 * one"). A card is this. A sheet is this. Nothing gets a second, glassier
 * variant, because two translucencies in one view is the stacking §3.6 forbids
 * even when they are not literally nested.
 *
 * `saturate` above 1 is what makes a backdrop filter read as glass rather than
 * as frosted plastic: real glass carries the colour behind it forward slightly
 * as it blurs.
 */
export const glass = {
  blur: 24,
  saturate: 1.6,
  /** The fill over the blur. Barely there — the blur does the work. */
  fill: 'rgba(255, 255, 255, 0.055)',
  /** Lit from above, as §3.4 requires: the top edge catches, the rest does not. */
  sheen: 'rgba(255, 255, 255, 0.14)',
  /** The hairline. Clarifies the boundary; never creates the lift. */
  edge: 'rgba(255, 255, 255, 0.10)',
} as const;
