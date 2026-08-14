/**
 * MOTION - AutoModz Design Language
 *
 * Source: docs/AUTOMODZ-OS.md §7.1–§7.6, §11.2
 *
 * This is the one area where the constitution fixes numbers. §7.3 gives all
 * four durations outright; they are transcribed, not derived.
 *
 * §7.1 is the law and it constrains implementation, not just values:
 *
 *   "Motion decorates content. It never gates it. Animate a wrapper, never the
 *    payload. Content that fades in from zero opacity is content that can fail
 *    to arrive."
 *
 * §7.2 permits exactly two curves and explains why substituting one for the
 * other fails: "finger-driven motion on an ease curve feels dead; system
 * motion on a spring feels cheap."
 */

/**
 * §7.3 - given by the constitution. "Nothing may invent a duration. If a
 * motion does not fit one of these, question the motion."
 */
export const duration = {
  /** Acknowledgement - a press, a toggle. */
  tick: 120,
  /** An element changing place or state. */
  move: 280,
  /** A room becoming another room. */
  scene: 480,
  /** A photograph carrying between two surfaces (§7.5). */
  morph: 620,
} as const;

/**
 * §7.2 - two curves, and only two.
 *
 * EASE is for anything the system initiates. Derived to read as "considered,
 * deliberate, unhurried": a strong early decay that settles without bounce, so
 * the element arrives as though it were placed rather than thrown.
 *
 * SPRING is for anything a finger drives. Expressed in physical terms because
 * a spring following a finger has to be described by its physics, not by a
 * fixed duration - the gesture decides how long it takes. Tuned to be
 * responsive with no perceptible oscillation: the object has weight, but it
 * does not wobble when released.
 */
export const easing = {
  /** System-initiated: entrances, transitions, reveals. */
  ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
  /** Leaving the screen - slightly faster in, so exits do not linger. */
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
} as const;

/**
 * THE SAME TWO CURVES, AS CONTROL POINTS.
 *
 * §7.2 gives two curves and §22.2 wants one implementation of anything - but
 * CSS wants a `cubic-bezier(…)` string and animation libraries want the four
 * numbers, so a single representation cannot serve both. These are the same
 * curves, written the other way, so that a component reaching for the ease in
 * JavaScript is not quietly inventing a third one by typing the digits out.
 */
export const curve = {
  ease: [0.22, 1, 0.36, 1],
  exit: [0.4, 0, 1, 1],
} as const;

export const spring = {
  /** Finger-driven: drags, sheets, dismissals. */
  stiffness: 420,
  damping: 38,
  mass: 1,
} as const;

/**
 * §7.4 - the photograph is the ONE element permitted ambient motion, and only
 * these four. The constitution describes each qualitatively; the magnitudes
 * below are derived from those adjectives.
 *
 *   "a gentle scale settle on entrance"  → 6% over one scene. Enough to read
 *                                          as arrival, too little to notice
 *                                          as an animation.
 *   "parallax against scroll"            → the photograph moves at 82% of
 *                                          scroll speed; a slower rate reads
 *                                          as lag rather than depth.
 *   "a slight response to device tilt"   → 8px maximum. Past roughly 10px the
 *                                          image reads as loose in its frame.
 *   "an occasional slow light sweep"     → once every 24s. "Occasional" has to
 *                                          be long enough that a customer
 *                                          never sees two in one glance.
 *
 * Every one of these is suppressed under reduced motion (§7.6).
 */
export const hero = {
  /** Entrance settle: starts at this scale, resolves to 1. */
  settleFrom: 1.06,
  settleDuration: duration.scene,
  /** Parallax rate against scroll. 1 = locked to the page, 0 = fixed. */
  parallaxRate: 0.82,
  /** Maximum translation from device tilt, in px. */
  tiltMax: 8,
  /** Seconds between light sweeps. */
  sweepPeriod: 24,
  /** Duration of one sweep, in ms. */
  sweepDuration: 2400,
} as const;

/**
 * §7.4 - the only two things in the product permitted to loop, because both
 * are genuine state rather than decoration: an indicator that a visit is
 * currently live, and a loading state.
 *
 * Both are slow. A fast pulse reads as an alarm, and neither of these is one.
 */
export const loop = {
  /** The "this visit is happening now" indicator. */
  livePeriod: 2600,
  /** The breath shown while the application establishes itself (§19.2). */
  breathPeriod: 2000,
} as const;

/**
 * §7.6 - "transforms and parallax stop. Opacity transitions may remain. The
 * interface must lose nothing but movement."
 *
 * Held as data so the rule is checkable rather than remembered.
 */
export const reducedMotion = {
  /** Transforms, parallax, tilt, sweep, settle - all off. */
  disableTransforms: true,
  /** Opacity may remain. */
  allowOpacity: true,
  /** Duration to collapse every transition to when motion is reduced. */
  duration: 0,
} as const;

export type Duration = keyof typeof duration;
