/**
 * CX motion tokens — the ONE motion language of the customer app.
 * Nothing bounces, spins or overshoots. Motion exists because information
 * changed, focus changed, or the user acted.
 *
 * arrival    fade + 8px rise   (content entering)
 * departure  fade + 4px fall   (content leaving)
 * state      colour cross-fade + a single pulse (live data changing)
 */
export const EASE = [0.22, 1, 0.36, 1] as const;

export const DUR = {
  /** taps, toggles, chips */
  fast: 0.15,
  /** sheets, cards, list items */
  base: 0.35,
  /** signature moments only (ticket stamp, reveal) */
  slow: 0.7,
} as const;

/** standard content arrival — use with motion.* initial/animate */
export const arrive = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DUR.base, ease: EASE },
} as const;

/** standard departure */
export const depart = {
  exit: { opacity: 0, y: 4, transition: { duration: DUR.fast, ease: EASE } },
} as const;

/** staggered list arrival — spread children by this step */
export const STAGGER = 0.05;
