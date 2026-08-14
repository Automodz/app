/**
 * SPACING - AutoModz Design Language
 *
 * Source: docs/AUTOMODZ-OS.md §8.2, §8.3, §8.4, §22.4
 *
 * §8.3 names six steps and says vertical space comes "from a fixed scale,
 * never from judgement". It fixes no values, so the scale below is derived.
 *
 * Derivation:
 *   The base unit is 4px - the grid at which touch interfaces align and the
 *   largest unit that divides every value here without remainder.
 *
 *   The fine steps are linear multiples, because separations inside a group
 *   need to be distinguishable but not dramatic:
 *     hair   1×   the smallest gap that still reads as a gap
 *     breath 2×   inside a tight group
 *     line   3×   between lines of related text
 *     gap    4×   between elements in a group
 *
 *   The coarse steps are multiplicative, because a section break must be
 *   unmistakably larger than an element break - §8.3 calls movement "where the
 *   eye is meant to pause", and a pause the eye can miss is not a pause:
 *     rest      3 × gap  = 48
 *     movement  2 × rest = 96
 */

/** The unit everything is a multiple of. Nothing may sit off this grid. */
export const BASE = 4;

export const space = {
  /** The smallest separation that reads as separate. */
  hair: BASE * 1, // 4
  /** Within a tight group. */
  breath: BASE * 2, // 8
  /** Between lines of related text. */
  line: BASE * 3, // 12
  /** Between elements in a group. */
  gap: BASE * 4, // 16
  /** Between groups. */
  rest: BASE * 12, // 48
  /** Between sections - where the eye is meant to pause. */
  movement: BASE * 24, // 96
} as const;

/**
 * THE GUTTER · §8.4
 *
 * "Inset to the gutter: all text, cards and surfaces, controls."
 * Derived as 6 × BASE = 24 - one and a half gaps, wide enough that text never
 * feels pinned to the edge of a phone, narrow enough that the single column
 * (§8.1) keeps its width on a 360px screen.
 */
export const INSET = BASE * 6; // 24

/**
 * THE MEASURE · §8.2
 *
 * "Reading content is capped at a comfortable line length regardless of screen
 * width." Derived from the body size in typography.ts (17px) and the average
 * glyph width of a humanist sans (~0.48em ≈ 8.2px):
 *
 *   600px ÷ 8.2px ≈ 73 characters - the upper edge of the 60–75 range at which
 *   the eye reliably finds the next line.
 *
 * Photographs and immersive surfaces are exempt (§8.2) - they go full-bleed.
 */
export const MEASURE = 600;

