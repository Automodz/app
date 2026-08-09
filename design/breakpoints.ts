/**
 * BREAKPOINTS — AutoModz Design Language
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ THE CONSTITUTION IS SILENT ON BREAKPOINTS.                           │
 * │                                                                      │
 * │ §8.1 fixes one column at every width, so there is no layout that     │
 * │ needs to change shape — a phone and a desktop show the same single    │
 * │ column, capped by §8.2's measure. Nothing here is derived from a      │
 * │ numbered rule, because no numbered rule exists to derive it from.     │
 * │                                                                      │
 * │ These widths therefore do only one job: telling the image pipeline    │
 * │ how wide a full-bleed photograph can ever be asked to be. They are    │
 * │ device-class conventions, recorded so no component invents its own.   │
 * └──────────────────────────────────────────────────────────────────────┘
 */
export const breakpoint = {
  /** The narrowest phone still supported. */
  compact: 320,
  /** A tablet in portrait. */
  tablet: 768,
  /** Past this, a photograph is never asked for anything wider. */
  wide: 1280,
} as const;

/**
 * `sizes` hints for responsive images (§8.2 — photographs are exempt from the
 * measure and go full-bleed, so they are always viewport-wide until the
 * viewport exceeds the widest breakpoint).
 */
export const imageSizes = {
  /** A full-bleed photograph — the hero (§11.2). */
  fullBleed: `(max-width: ${breakpoint.wide}px) 100vw, ${breakpoint.wide}px`,
  /** An image inside the measure — a card, a media tile. */
  inMeasure: `(max-width: ${breakpoint.tablet}px) 100vw, 600px`,
  /**
   * Half the measure — one of a pair of panes side by side, which the design
   * uses on Home and on the Car. Without this the pair asked for a full-width
   * image each and downloaded twice the pixels either one could show.
   */
  half: `(max-width: ${breakpoint.tablet}px) 50vw, 300px`,
} as const;
