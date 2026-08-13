/**
 * THE AUTOMODZ DESIGN LANGUAGE
 *
 * Source of truth: docs/AUTOMODZ-OS.md
 *
 * Every token in this directory traces to a numbered section of the
 * constitution, and each file records the derivation for the values the
 * constitution names but does not fix. Three numbers are given outright —
 * the four motion durations (§7.3), the 44pt target (§21.3) and WCAG AA
 * (§21.1). Everything else is derived from a stated rule and, where it is a
 * colour, verified by measurement rather than chosen by eye.
 *
 * §22.4 is the rule this directory exists to make enforceable:
 *
 *   "No raw colour, no raw spacing value, no raw font size, no invented
 *    duration, no hand-picked stacking order. If the needed value does not
 *    exist, add it to the system deliberately."
 *
 * So: nothing outside this directory may contain a literal design value. If a
 * screen needs something that is not here, the correct move is to add it here
 * — with its derivation — not to inline it there.
 *
 * WHAT THIS DIRECTORY IS NOT
 * It is tokens only. No components, no styled elements, no React. The
 * constitution's component rules (§10) govern what is built with these
 * values; they do not live here.
 */

export { color, scrim, ground, contrastFloor, fill, HAIRLINE } from './colors';
export type { StateTone } from './colors';

export { type, fontFamily } from './typography';
export type { TypeRole } from './typography';

export { space, BASE, INSET, MEASURE } from './spacing';

export { radius } from './radius';
export type { Radius } from './radius';

export { elevation } from './elevation';
export type { Elevation } from './elevation';

export {
  duration, easing, curve, spring, hero as heroMotion, loop, reducedMotion,
} from './motion';
export type { Duration } from './motion';

export {
  layout, column, stack, hero as heroSize, collection as photoSize, place as placeSize,
  TARGET_MIN, NAV_GAP,
} from './grid';

export { breakpoint, imageSizes } from './breakpoints';

export {
  iconSize, iconPadding, STROKE, ICON_TARGET,
} from './icons';
export type { IconSize } from './icons';

/* The room the application stands in, and the one glass material over it. */
export { ambient, glass } from './ambient';
export type { AmbientLight } from './ambient';

export { DOT, dotted } from './words';
