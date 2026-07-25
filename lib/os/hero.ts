/**
 * THE HERO IMAGE - one rule, every surface.
 *
 * The car's hero photograph is chosen the same way everywhere it appears (the
 * Glance, the Stay). This is the single place that decides it, so Home and the
 * Visit can never drift apart, and swapping the source data changes both at once.
 *
 * The priority, in order:
 *   1. the live visit's latest progress photo - the studio's own shot
 *   2. else the car's cover photo
 *   3. else nothing → the caller shows the branded fallback (see HeroMedia)
 */

/** the shape the car contributes - just its cover photo */
export interface HeroVehicleLike {
  photo?: string;
}

/** the shape a visit contributes - the newest progress photo, if any */
export interface HeroStayLike {
  /** finished ?? during ?? arrival - the newest photo of any kind (lib/os/stay) */
  latestPhoto?: string;
}

/** The hero photograph for a car, optionally in the context of a live visit. */
export function getHeroImage(
  vehicle?: HeroVehicleLike | null,
  stay?: HeroStayLike | null,
): string | undefined {
  return stay?.latestPhoto ?? vehicle?.photo ?? undefined;
}
