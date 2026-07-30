/**
 * THE STUDIO MARK
 *
 * Source: docs/AUTOMODZ-OS.md §2.2, §3.1, §3.3, §3.4, §3.5
 * Design language: design/icons.ts (stroked, no container, inherits ink)
 *
 * ── WHAT IT IS ───────────────────────────────────────────────────────────
 *
 *            ╱▔▔▔▔▔▔▔╲
 *          ╱    ╱▔      ╲        a plane, seen at an angle
 *        ╱   ╱▔           ╲      with light crossing it
 *         ╲▁▁▁▁▁▁▁▁▁▁▁▁▁╱
 *
 * A panel and a highlight. Two strokes, locked into one form.
 *
 * A detailing studio does not sell a car, a building or a tool. It sells a
 * SURFACE — and the only thing that proves a surface has been finished
 * properly is the way light crosses it. Hold a panel at an angle to the light
 * and you learn everything: the crown of it, the depth of the paint, whether
 * the work was done. That inspection is the craft, and it is what this draws.
 *
 * §3.4 — "Light is the only ornament." Here it is not ornament at all; it is
 * the subject. §2.2 — "AutoModz is the craftsman", so the mark is the WORK,
 * never the workshop and never the worker.
 *
 * The plane is tilted rather than square-on. Axis-aligned, it would be a
 * rectangle — a container, a piece of interface furniture. Tilted, it is a
 * thing being held up and turned toward a light, which is the gesture the
 * whole product is about.
 *
 * ── WHY THE HIGHLIGHT DOES NOT REACH THE CORNERS ─────────────────────────
 * Tested at 20px against variants where it did: touching the vertices makes
 * the stroke read as a FOLD or a brace dividing the panel in two. Held clear,
 * it floats on the surface, which is what a highlight does. The inset is the
 * difference between a crease and a gleam.
 *
 * ── LEGIBILITY ───────────────────────────────────────────────────────────
 * Rendered and inspected at 20, 24, 40 and 170px before being chosen. Two
 * strokes, one enclosed counter, nothing thinner than the icon stroke, every
 * terminal well inside the box. §3.5 — a third stroke was tried and removed.
 *
 * ── COLLISIONS RULED OUT BY INSPECTION, NOT BY ARGUMENT ──────────────────
 * An earlier version of this mark was two arcs mirrored across an undrawn
 * plane — light and its reflection. On paper it was the better idea. Rendered,
 * it was unmistakably an EYE, and no amount of reasoning about "the arcs never
 * meet at points" survived actually looking at it. Later attempts landed on a
 * smile, a wifi glyph, an arrow and a swoosh. The rule that emerged: two
 * floating horizontal strokes always fall into an existing icon family, and
 * only a single coherent form escapes. Every candidate here was rendered and
 * looked at before this one was kept.
 */
import type { CSSProperties } from 'react';
import { STROKE, iconSize } from '@/design';
import type { IconSize } from '@/design';

export interface StudioMarkProps {
  /** Defaults to the navigation size. Verified legible down to 20px. */
  size?: IconSize | number;
  className?: string;
  style?: CSSProperties;
}

export function StudioMark({ size = 'nav', className, style }: StudioMarkProps) {
  const px = typeof size === 'number' ? size : iconSize[size];

  return (
    <svg
      className={className}
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      /* §3.3 — it takes the ink of whatever it sits in; it is never coloured. */
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      /* The name lives on the control (§21.6); the mark itself is silent. */
      aria-hidden
      focusable="false"
      style={{ display: 'block', ...style }}
    >
      {/* the panel, turned to the light */}
      <path d="M9 4.5 L20.5 8 L15 19.5 L3.5 16 Z" />
      {/* the light crossing it — held clear of the corners so it reads as a
          highlight rather than a fold */}
      <path d="M7.2 13.9 L16.8 8.6" />
    </svg>
  );
}
