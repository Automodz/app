/**
 * THE RENDERER BOUNDARY
 *
 * Source: docs/AUTOMODZ-OS.md §11.2, §11.3, §11.4, §11.5, §21.6
 *
 * §11.3 is the reason this file exists, and the constitution calls it "the
 * single most important architectural line in the customer application":
 *
 *   "The photograph is HOW a vehicle is presented today, not WHAT a vehicle
 *    presentation is. The surface asks for 'the hero for this vehicle' and
 *    receives one. A future in which that becomes photogrammetry, a model, or
 *    something worn on the face must not require redesigning the product
 *    around it."
 *
 * So this is a contract, not an implementation. Everything below is types and
 * one small pure function. There is no React here and no `next/image`; the
 * word "photograph" appears only in prose.
 *
 * ── WHAT THE BOUNDARY HAS TO CARRY ───────────────────────────────────────
 * A vehicle screen needs three things from a rendering and must not know how
 * any of them are produced:
 *
 *   1  something that draws the vehicle and fills its frame
 *   2  WHERE THE REGIONS ARE — §11.4's paint, glass, wheels, interior
 *   3  a description, for anyone who cannot see it (§21.6)
 *
 * (2) is what makes this a real boundary rather than a decorative one. A
 * photograph knows where its wheels are because a human marked them once. A
 * photogrammetric model would derive them from geometry. An AR presentation
 * would project them onto the actual car in front of the customer. All three
 * answer the same question — "where, in your frame, is the interior?" — and
 * the screen is written against the question, never against an answer.
 *
 * Positions are FRACTIONS OF THE FRAME, not pixels, for the same reason: a
 * fraction survives a change of medium, a resolution, an aspect ratio and a
 * viewport. Pixels would leak one renderer's idea of size into the screen.
 */

/**
 * §11.4 names the regions and this list is closed to them: "the paint, the
 * glass, the wheels, the interior". They are parts of a car, not categories
 * of product, which is why there is no `insurance` or `membership` here —
 * those protect the whole vehicle and belong to the surfaces that show it
 * whole (§14).
 */
export type RegionId = 'paint' | 'glass' | 'wheels' | 'interior';

/** §21.8 — the customer's word for each region, never an internal one. */
export const REGION_NAME: Record<RegionId, string> = {
  paint: 'The paint',
  glass: 'The glass',
  wheels: 'The wheels',
  interior: 'The interior',
};

/**
 * Where a region sits, in the rendering's OWN space.
 *
 * `x` and `y` are fractions from 0 to 1 of whatever that space is — for a
 * photograph, of the photograph itself, not of the frame it is cropped into.
 * A fraction survives a change of medium, a resolution and an aspect ratio
 * where a pixel would leak one renderer's idea of size outward.
 *
 * THESE ARE NOT FOR THE SCREEN TO POSITION WITH. They are here so the
 * boundary can enumerate and order the regions (see `inReadingOrder`), and so
 * a rendering can place the screen's `mark` for each one. Translating them
 * into drawn coordinates is the rendering's job, because cropping, projection
 * and perspective are all things only it knows about.
 */
export interface RenderedRegion {
  id: RegionId;
  x: number;
  y: number;
}

/**
 * What a rendering is told about the moment it is being drawn in.
 *
 * Deliberately thin. It carries intent — "the customer is asking about the
 * wheels" — and never presentation. A renderer may respond to `focus` however
 * its medium allows: a photograph dims around the region, a model could
 * rotate toward it, an AR presentation could outline the real wheel. None of
 * that is the screen's business.
 */
export interface RenderingProps {
  /** Which region the customer is asking about, if any. §11.4 */
  focus: RegionId | null;
  /** Whether this rendering is worth blocking the first paint for. */
  priority?: boolean;
  /**
   * WHAT THE SCREEN WANTS PUT AT EACH REGION, PLACED BY THE RENDERING.
   *
   * §10.3 — composition over configuration. The screen supplies the mark; it
   * never supplies a coordinate, and it never reads one. This is not a
   * nicety: a photograph drawn to COVER its frame is cropped, so a region at
   * 0.30 of the image can sit at 0.15 of the frame — measured, on a phone,
   * with the placeholder photograph. Any screen positioning marks by fraction
   * of the frame would scatter them off the car the moment the aspect ratio
   * moved, and would do it silently.
   *
   * Only the rendering knows where its own space is, so only the rendering
   * can place anything in it. A photograph places into cover space, a model
   * would place in three dimensions, an AR presentation would anchor to the
   * real wheel. The screen's mark is the same in all three cases.
   */
  mark?: (region: RenderedRegion) => React.ReactNode;
}

/**
 * A rendering of one vehicle. §11.3 — this is what "the hero for this
 * vehicle" resolves to.
 */
export interface VehicleRendering {
  /**
   * Draws the vehicle, filling its frame absolutely. It owns everything
   * inside the frame and nothing outside it.
   */
  Surface: (props: RenderingProps) => React.ReactElement;
  /**
   * §11.4 — where the regions are. Empty when the medium cannot locate them,
   * which is not a failure: it means the car cannot be asked about itself yet,
   * and the screen must stay whole without the interaction.
   */
  regions: readonly RenderedRegion[];
  /**
   * §11.5 — false when there is nothing of this car to show yet. The screen
   * composes an awaiting state rather than rendering an empty frame; it is the
   * RENDERER that knows whether it has anything, so it says so here.
   */
  present: boolean;
}

/**
 * Order the regions the way a person moves around a car rather than the way
 * an object happens to list its keys — top to bottom, then left to right.
 *
 * This is the boundary's job, not the screen's: it fixes keyboard and
 * screen-reader order (§21.5, "operable by keyboard, in a logical order")
 * against the geometry the renderer reported, so a renderer that returns its
 * regions in any order still produces a sane traversal.
 */
export const inReadingOrder = (
  regions: readonly RenderedRegion[],
): readonly RenderedRegion[] =>
  [...regions].sort((a, b) => (a.y - b.y) || (a.x - b.x));
