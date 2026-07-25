/**
 * Studio motion constants - the only motion values allowed in the customer product.
 * One curve, three durations. (Design system §5)
 */
export const studioEase = [0.22, 1, 0.36, 1] as const;

export const tick = 0.12;
export const move = 0.28;
export const scene = 0.48;

/** Standard element entrance: 8px rise + fade, once. */
export const rise = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: move, ease: studioEase },
} as const;

export const crossfade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: move, ease: studioEase },
} as const;

/** Shared tactile press - one scale, one duration, everywhere it's tapped. */
export const press = {
  whileTap: { scale: 0.98 },
  transition: { duration: tick, ease: studioEase },
} as const;

/**
 * The settle - a hero image that eases from 1.04 to rest as it fades up. The
 * one entrance for evidence (the Stay's photograph). Under reduced motion the
 * transform is dropped entirely, since framer holds an `initial` transform in
 * place; opacity is left to the surface's own fade.
 */
export const breath = (reduced: boolean | null) =>
  reduced
    ? {}
    : {
        initial: { scale: 1.04 },
        animate: { scale: 1 },
        transition: { duration: scene, ease: studioEase },
      };
