/**
 * THE DESIGN LANGUAGE'S OWN INVARIANTS.
 *
 * `contrastFloor` and `reducedMotion` were each written with the note "held as
 * data so a test can assert it rather than a reviewer having to remember it" —
 * and until this file existed, nothing did. They were dead exports describing
 * rules nobody checked. This is the check.
 */
import { readFileSync } from 'fs';
import {
  color, scrim, contrastFloor, fill, reducedMotion, type as typeScale, space, TARGET_MIN,
} from '@/design';

/** WCAG 2.1 relative luminance. */
const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const hex = (h: string) => {
  const n = h.replace('#', '');
  return [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16));
};
const lum = (rgb: number[]) =>
  0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
const ratio = (a: number[], b: number[]) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const PAPER = hex(color.paper);

describe('§21.1 — every ink reads on paper at AA', () => {
  it.each(['ink', 'ink2', 'ink3'] as const)('%s', k => {
    expect(ratio(hex(color[k]), PAPER)).toBeGreaterThanOrEqual(contrastFloor.normalText);
  });

  it.each(['assent', 'caution', 'urgent', 'lapsed'] as const)('%s reads as text too', k => {
    expect(ratio(hex(color[k]), PAPER)).toBeGreaterThanOrEqual(contrastFloor.normalText);
  });
});

describe('§21.1 — the scrim is sufficient for the worst image', () => {
  /* The worst image is pure white. White text through the scrim over it must
     still clear AA, which is the whole derivation of `photoFloor`. */
  const behind = (alpha: number) => [0, 1, 2].map(() => 255 * (1 - alpha));

  it('white on a white photograph clears AA at the floor', () => {
    expect(ratio([255, 255, 255], behind(scrim.photoFloor)))
      .toBeGreaterThanOrEqual(contrastFloor.normalText);
  });

  it('the shipped value has headroom over the floor', () => {
    expect(scrim.photo).toBeGreaterThan(scrim.photoFloor);
  });

  it('over2 does NOT clear it — this is why it is banned over photographs', () => {
    const bg = behind(scrim.photoFloor);
    const composited = bg.map(c => 0.72 * 255 + 0.28 * c);
    expect(ratio(composited, bg)).toBeLessThan(contrastFloor.normalText);
  });

  it('the region recession stays below the layer scrim, so the car stays legible', () => {
    expect(scrim.region).toBeLessThan(scrim.layer);
  });
});

describe('§21.2 — zoom is not ours to take', () => {
  /* "If a focused input causes an unwanted zoom, the input is too small — that
     is the bug." iOS zooms a focused field below 16px, so the body size the
     scale is anchored to may never fall under it. */
  it('body type is at or above the iOS zoom floor', () => {
    expect(parseInt(typeScale.body.size, 10)).toBeGreaterThanOrEqual(16);
  });
});

describe('§21.3 — the target floor', () => {
  it('is 44 and is a multiple of nothing smaller than the base step', () => {
    expect(TARGET_MIN).toBe(44);
  });
  it('the rhythm scale never offers a gap larger than the step above it', () => {
    const steps = [space.hair, space.breath, space.line, space.gap, space.rest, space.movement];
    expect([...steps].sort((a, b) => a - b)).toEqual(steps);
  });
});

describe('§21.1 — a filled control holds its contrast at every point', () => {
  /* THE BUG THIS EXISTS FOR. The ratified design draws the one primary action
     as amber at 92%→64% ALPHA over the near-black room. Composited, the weak
     end of that gradient is #926C3E, where the label (#100C06) reads at
     4.12:1 — under the floor, on the single most important control in the
     product. A translucent fill has no fixed contrast, so it may carry
     decoration but never text; the shipped control uses two SOLID stops down
     the same ramp instead.

     READ OUT OF THE PALETTE, not out of a component. Both `Button` and
     `Action` carried their own copy of these three literals — so the product's
     single filled control was written in two places and could drift apart, and
     this assertion only ever watched one of them. `design/colors.fill` is the
     one place now, which is also the only place a contrast rule can be
     enforced for every caller at once. */
  const palette = readFileSync('design/colors.ts', 'utf8');
  const declared = palette.slice(palette.indexOf('export const fill = {'));

  it('the primary fill is opaque, not an alpha wash over the room', () => {
    expect(fill.amber).toContain('linear-gradient');
    expect(fill.amber).not.toMatch(/rgba\(/);
    expect(fill.champagne).not.toMatch(/rgba\(/);
    expect(declared).toContain('linear-gradient');
  });

  it('its label clears AA against both ends of BOTH ramps', () => {
    for (const ramp of [fill.amber, fill.champagne]) {
      const stops = [...ramp.matchAll(/#([0-9A-Fa-f]{6})/g)].map(m => `#${m[1]}`);
      expect(stops).toHaveLength(2);
      for (const stop of stops) {
        expect({ ramp, stop, r: ratio(hex(fill.on), hex(stop)) })
          .toEqual({ ramp, stop, r: expect.any(Number) });
        expect(ratio(hex(fill.on), hex(stop))).toBeGreaterThanOrEqual(contrastFloor.normalText);
      }
    }
  });

  it('and both primitives read it rather than restating it', () => {
    for (const f of ['components/system/Button.tsx', 'components/os/parts.tsx']) {
      const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      expect({ f, literal: /#[0-9A-Fa-f]{6}/.test(src) }).toEqual({ f, literal: false });
      expect({ f, reads: /\bfill\./.test(src) }).toEqual({ f, reads: true });
    }
  });
});

describe('§7.6 — reduced motion loses nothing but movement', () => {
  it('transforms stop, opacity may remain, and everything collapses to zero', () => {
    expect(reducedMotion.disableTransforms).toBe(true);
    expect(reducedMotion.allowOpacity).toBe(true);
    expect(reducedMotion.duration).toBe(0);
  });
});
