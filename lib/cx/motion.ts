/**
 * TEMPORARY ADAPTER (PRE-1) — re-exports the Studio motion constants for
 * Generation-A surfaces. lib/os/motion.ts is the ONE motion system; no
 * motion value may be defined here.
 *
 * TODO(P7): delete this file once the last cx surface is replaced; each of
 * P1–P6 removes its consumers.
 */
import { studioEase, tick, move, scene } from '@/lib/os/motion';

export const EASE = studioEase;

export const DUR = {
  /** taps, toggles, chips */
  fast: tick,
  /** sheets, cards, list items */
  base: move,
  /** signature moments only */
  slow: scene,
} as const;

/** standard content arrival — use with motion.* initial/animate */
export const arrive = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DUR.base, ease: EASE },
} as const;

/** staggered list arrival — spread children by this step */
export const STAGGER = 0.05;
