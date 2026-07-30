/**
 * TONE — the one place a tone name becomes a colour.
 *
 * Source: docs/AUTOMODZ-OS.md §9.1, §9.2, §22.2
 *
 * §9.1 names the ink families; §9.2 names the four states and says they are
 * "the only saturated colours in the product". Both are held here so that
 * every component resolves a tone the same way — §22.2, one implementation of
 * anything. A component that maps its own tone names will eventually disagree
 * with its neighbour about what "urgent" looks like.
 */
import { color } from '@/design';
import type { StateTone } from '@/design';

/** Text on paper or on a surface. §9.1 */
export type InkTone = 'ink' | 'ink2' | 'ink3';

/** Text on a photograph. §9.1 — the scrim carries the contrast. */
export type OverTone = 'over' | 'over2';

/** Every tone any component may render. */
export type Tone = InkTone | OverTone | StateTone;

const TONE: Record<Tone, string> = {
  ink: color.ink,
  ink2: color.ink2,
  ink3: color.ink3,
  over: color.over,
  over2: color.over2,
  assent: color.assent,
  caution: color.caution,
  urgent: color.urgent,
  lapsed: color.lapsed,
};

export const toneColor = (tone: Tone): string => TONE[tone];
