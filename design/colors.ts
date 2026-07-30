/**
 * COLOURS — AutoModz Design Language
 *
 * Source: docs/AUTOMODZ-OS.md §3.3, §3.4, §9.1, §9.2, §21.1
 *
 * The constitution names seven ink/paper families and four state colours. It
 * fixes no hex values, so every value below is DERIVED from a stated rule and
 * VERIFIED against WCAG 2.1. No colour here was chosen by eye.
 *
 * Derivation of the ground (§9.1, §3.4):
 *   The application is dark because "a car photographed against black reads as
 *   a car in a studio". But §3.4 requires depth to come from light and shadow,
 *   and pure #000000 has no room below it for a shadow to exist. The ground is
 *   therefore a near-black with a slight cool cast: relative luminance 0.0033,
 *   non-zero, so shadow is renderable.
 *
 * Verified contrast against paper (§21.1 requires WCAG AA — 4.5:1 for normal
 * text). Measured, not estimated:
 *   ink      18.04:1      assent   8.75:1
 *   ink2     10.09:1      caution 10.12:1
 *   ink3      6.05:1      urgent   6.16:1
 *   surface   1.11:1      lapsed   6.05:1   (surface is a step, not text)
 *
 * Note that ink3 passes AA at 6.05:1. §9.1 forbids it for body text on
 * grounds of HIERARCHY, not legibility — a whisper is still read, so it is
 * still held to the same contrast bar as everything else.
 */

/** The four semantic states. §9.2 — "these are the only saturated colours". */
export type StateTone = 'assent' | 'caution' | 'urgent' | 'lapsed';

export const color = {
  /* ── Ink and paper · §9.1 ────────────────────────────────────────────── */

  /** The ground everything sits on. Non-zero luminance so shadow can exist (§3.4). */
  paper: '#0A0B0D',

  /**
   * The ONE raised material (§10.2 — "not a card and a panel and a tile — one").
   * A single fill at the smallest step that reads as lifted off paper (1.105:1).
   * Higher bands do not get a lighter fill; they get a deeper shadow, because
   * §3.4 says a surface is raised by light, not by a different colour.
   */
  surface: '#15181B',

  /**
   * The hairline separating a material from its ground. §9.1 names it; §3.4
   * constrains it — an edge clarifies a boundary, it never creates the lift.
   * Kept at the threshold of visibility for that reason.
   */
  edge: 'rgba(255, 255, 255, 0.08)',

  /** Primary text — the thing being said. 18.04:1 on paper. */
  ink: '#F4F5F6',
  /** Secondary — supporting, "still fully legible" (§9.1). 10.09:1 on paper. */
  ink2: '#B6BABF',
  /** Tertiary — labels and whispers only, never body text (§9.1). 6.05:1. */
  ink3: '#8A8F96',

  /* ── Text over photographs · §9.1, §21.1 ─────────────────────────────── */

  /** Primary text on an image. Pure white; the scrim does the contrast work. */
  over: '#FFFFFF',
  /** Secondary text on an image. */
  over2: 'rgba(255, 255, 255, 0.72)',

  /* ── Meaningful colour · §9.2 ────────────────────────────────────────── */

  /** Fine, active, protected. */
  assent: '#5FBF8F',
  /** Attention soon. */
  caution: '#E3B341',
  /** Attention now. */
  urgent: '#E06C75',
  /** No longer in force. Deliberately neutral — a lapsed thing is not an alarm. */
  lapsed: '#8A8F96',
} as const;

/**
 * SCRIMS · §21.1
 *
 * "Text over photographs must carry a scrim sufficient for the WORST image,
 * not the best one." The worst image is pure white. Solving for white text
 * reaching 4.5:1 over a white photograph gives a minimum black overlay of
 * α 0.55 (4.74:1). Below that, a bright photograph makes the text unreadable.
 *
 *   α 0.50 → 3.95:1  fails
 *   α 0.55 → 4.74:1  the computed floor
 *   α 0.60 → 5.74:1  shipped, with headroom
 *
 * THIS FLOOR IS FOR `over` ONLY, AND THAT IS A CONSTRAINT ON WHAT MAY BE
 * WRITTEN OVER A PHOTOGRAPH. It was solved for pure white and clears AA by a
 * hair. `over2` is 72% white, so on a bright image it composites toward the
 * very background it must contrast with — the two converge, and the pair
 * measures 3.33:1. No floor satisfies both: `over2` needs α 0.66, by which
 * point the photograph beneath is gone. Over a photograph, quiet therefore
 * means smaller type, never fainter ink. `over2` is for grounds that are
 * known — a surface, a sheet — not for one that can be any image at all.
 */
export const scrim = {
  /** Minimum permitted overlay behind text on any photograph. Never go below. */
  photoFloor: 0.55,
  /** Shipped value — the floor plus headroom for compression artefacts. */
  photo: 0.6,
  /** Behind a sheet or takeover, to hold focus on the layer above (§9.3). */
  layer: 0.6,
  /**
   * §11.4 — when the car answers a question about one of its regions, the
   * rest of the photograph recedes so the region reads as the one being
   * asked about.
   *
   * Bounded on both sides, and both bounds were tested rather than reasoned.
   *
   * It must be BELOW `layer` (0.6): that value exists to put a photograph
   * behind something else, and at 0.6 the car is effectively gone. This is
   * attention moving WITHIN one subject, not a layer covering it — the car has
   * to stay legible throughout, because the customer is standing in front of
   * it.
   *
   * It must be well ABOVE the half of `layer` this started at. Rendered, 0.3
   * read as "the photograph got slightly darker" rather than as an answer:
   * the recession is the only feedback confirming which part of the car is
   * being talked about, and feedback nobody notices is not feedback. 0.5 is
   * where the untouched region reads unmistakably as the subject while every
   * panel outside it is still clearly a panel.
   */
  region: 0.5,
} as const;

/**
 * Every state colour must also read as text on paper. Held here as data so a
 * test can assert it rather than a reviewer having to remember it.
 */
export const contrastFloor = {
  /** WCAG AA, normal text. §21.1 */
  normalText: 4.5,
  /** WCAG AA, large text (≥24px, or ≥19px bold) and UI component boundaries. */
  largeText: 3,
} as const;

/**
 * The width of the edge. §9.1 calls it "the hairline", and a hairline is the
 * thinnest line a display can draw — so this is 1 by definition rather than by
 * choice. It is a token so that §22.4 holds without exception: no component
 * needs to write a border width literal.
 */
export const HAIRLINE = 1;

/**
 * §11.5 — the composed absence. "It is never a grey box, never a placeholder
 * silhouette, never a large empty field with a small plate floating in it."
 *
 * A field lit from slightly above centre: enough structure that it reads as a
 * composition rather than as a failed image load, quiet enough that it never
 * competes with the type laid over it. `surface` to `paper` is the only
 * lightness step the palette has, so this is the whole of what is available.
 */
export const ground = {
  awaiting: `radial-gradient(120% 80% at 50% 30%, ${color.surface} 0%, ${color.paper} 70%)`,
} as const;


