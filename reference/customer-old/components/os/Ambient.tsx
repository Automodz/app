'use client';
/**
 * THE ENVIRONMENT - AutoModz OS's one living backdrop.
 *
 * A single fixed, cinematic layer that lives at the shell and never re-mounts as
 * routes change, so moving between rooms (Home, Garage, the Stay, Profile) feels
 * like walking through one lit space rather than opening separate pages. Deep
 * graphite, two soft ambient light pools, and a seating vignette - a studio with
 * the lights low, not a flat dark background. It renders nothing interactive and
 * sits behind all content; the drift is dropped entirely under reduced motion.
 */
export default function Ambient() {
  return (
    <div aria-hidden className="st-ambient">
      {/* the two ambient pools - a cool key from high, a warmer graphite fill
          from below; barely there, so glass reads as glass and text stays legible */}
      <div className="st-ambient-key" />
      <div className="st-ambient-fill" />
      {/* the seating vignette - draws the eye in and grounds the environment */}
      <div className="st-ambient-vignette" />
    </div>
  );
}
