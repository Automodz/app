/**
 * TYPOGRAPHY — AutoModz Design Language
 *
 * Source: docs/AUTOMODZ-OS.md §9.5, §3.2, §3.5, §21.2, §21.6
 *
 * §9.5 names five roles and fixes no sizes. Everything below is derived.
 *
 * Derivation of the scale:
 *   BODY is the anchor at 17px. §21.2 says that if a focused input causes an
 *   unwanted zoom "the input is too small" — iOS zooms below 16px, so 16 is
 *   the floor and 17 is the floor plus margin.
 *
 *   The rest is a ~1.28 modular scale from that anchor:
 *     17 → 22 (title) → 28 → 36 → 46 (display range)
 *
 *   DISPLAY is fluid rather than stepped, because §8.1 keeps one column at
 *   every width: the statement should grow with the screen without a
 *   breakpoint deciding when. Its range spans the scale's top two steps.
 *
 *   DATA sits one step below body at 14px. Monospace runs wider per character
 *   at the same nominal size, so matching body's optical weight means
 *   dropping the point size.
 *
 *   WHISPER is 13px — the quietest legible line. It is still normal text under
 *   WCAG, so it is still held to 4.5:1 (see colors.ts).
 *
 * Weights are restrained (§3.5). Display is 620, not 800: a statement carries
 * because it is large and alone, not because it is heavy.
 *
 * FAMILIES are deliberately NOT named here. The constitution fixes only that
 * Data is monospaced (§9.5). The brand face is a decision this document does
 * not make, so the stacks below resolve CSS custom properties that the
 * application layer supplies, and fall back to the system face.
 */

export const fontFamily = {
  /** Display and Title. */
  display: 'var(--font-display), ui-sans-serif, system-ui, -apple-system, sans-serif',
  /** Body and Whisper. */
  text: 'var(--font-text), ui-sans-serif, system-ui, -apple-system, sans-serif',
  /** Data. Monospaced so numbers, plates and dates align and read as facts (§9.5). */
  data: 'var(--font-data), ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

export interface TypeRole {
  family: string;
  /** px, or a CSS clamp() for fluid roles */
  size: string;
  weight: number;
  lineHeight: number;
  letterSpacing: string;
  /** The element this role should render as, so §21.6's heading order holds. */
  element: 'h1' | 'h2' | 'p' | 'span';
}

export const type = {
  /**
   * The one statement per screen — the state of the car, the name of a thing.
   * §9.5: "One Display per screen." §21.6: it is the single top-level heading.
   * Fluid across the scale's top: 34px on a small phone, 52px on a wide screen.
   */
  display: {
    family: fontFamily.display,
    size: 'clamp(34px, 10vw, 52px)',
    weight: 620,
    lineHeight: 1.05,
    letterSpacing: '-0.03em',
    element: 'h1',
  },

  /** A section. */
  title: {
    family: fontFamily.display,
    size: '22px',
    weight: 560,
    lineHeight: 1.2,
    letterSpacing: '-0.01em',
    element: 'h2',
  },

  /** What is being said. The anchor of the scale. */
  body: {
    family: fontFamily.text,
    size: '17px',
    weight: 400,
    lineHeight: 1.5,
    letterSpacing: '0',
    element: 'p',
  },

  /** Numbers, plates, dates, times. Monospaced so they align (§9.5). */
  data: {
    family: fontFamily.data,
    size: '14px',
    weight: 400,
    lineHeight: 1.4,
    letterSpacing: '0',
    element: 'span',
  },

  /** Labels, captions, the quietest legible line. */
  whisper: {
    family: fontFamily.text,
    size: '13px',
    weight: 400,
    lineHeight: 1.4,
    letterSpacing: '0.02em',
    element: 'p',
  },
} as const satisfies Record<string, TypeRole>;

/* §21.2's 16px floor — "a focused input that triggers zoom is too small; the
   fix is a larger input, never a disabled gesture" — is not a token here. It
   was one, unused, for as long as it existed. The rule is now ENFORCED instead,
   against `type.body.size`, in __tests__/design/language.test.ts. */

