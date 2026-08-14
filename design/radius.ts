/**
 * RADIUS - AutoModz Design Language
 *
 * Source: docs/AUTOMODZ-OS.md §9.4, §8.6, §22.4
 *
 * §9.4 names five radii and fixes no values. Rather than invent a second
 * numeric system, each radius is taken from the spacing scale - so a corner
 * and the space beside it are always in proportion, and there is one set of
 * numbers in the product rather than two.
 *
 * The progression tracks §8.6's hierarchy of containers: the larger the thing,
 * the softer its corner, so scale reads as scale.
 *
 *   chip   = space.line     (12)  small pills and tags
 *   card   = space.gap      (16)  cards and panels
 *   pane   = space.gap + 4  (20)  the glass pane (see below)
 *   sheet  = INSET          (24)  drawers and modals
 *   stage  = space.gap × 2  (32)  immersive full-bleed surfaces
 *   pill   = fully round
 */
import { space, BASE, INSET } from './spacing';

export const radius = {
  /** Small pills and tags. */
  chip: space.line, // 12
  /** Cards and panels - the one raised material (§10.2). */
  card: space.gap, // 16
  /**
   * THE GLASS PANE.
   *
   * A step the scale did not have, and the design uses it more than any other
   * corner. `card` (16) is drawn for an opaque card sitting on paper; glass is
   * lit along its top edge, and at 16 that lit edge turns the corner too
   * sharply to read as a bevel - the surface looks cut out rather than moulded.
   * One BASE step softer is where the highlight reads as light wrapping an
   * edge. Still on the scale: `space.gap + BASE`.
   */
  pane: space.gap + BASE, // 20
  /** Drawers and modals. Matches the gutter, so a sheet's corner echoes the page. */
  sheet: INSET, // 24
  /** Immersive full-bleed surfaces - the photograph's frame. */
  stage: space.gap * 2, // 32
  /** Fully round. */
  pill: 9999,
} as const;

export type Radius = keyof typeof radius;
