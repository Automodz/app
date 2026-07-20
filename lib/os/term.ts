/**
 * The Term Engine — one implementation of the lifecycle shared by
 * Protection and Membership (Constitution, Amendment record §4).
 *
 *   active → waning(30d) → expiring(7d) → grace(7d, membership only) → lapsed
 */
export type TermState = 'active' | 'waning' | 'expiring' | 'grace' | 'lapsed';

export const WANING_DAYS = 30;
export const EXPIRING_DAYS = 7;
export const GRACE_DAYS = 7;

const DAY_MS = 86_400_000;

/** Whole days from `now` until end-of-day `expiresOn` (ISO date). Negative = past. */
export function daysLeft(expiresOn: string, now: Date = new Date()): number {
  const end = new Date(`${expiresOn}T23:59:59`).getTime();
  return Math.ceil((end - now.getTime()) / DAY_MS);
}

export function termState(
  expiresOn: string,
  opts: { grace?: boolean; now?: Date } = {},
): TermState {
  const d = daysLeft(expiresOn, opts.now);
  if (d > WANING_DAYS) return 'active';
  if (d > EXPIRING_DAYS) return 'waning';
  if (d > 0) return 'expiring';
  if (opts.grace && d > -GRACE_DAYS) return 'grace';
  return 'lapsed';
}

/** True while the promise still holds (benefits usable, protection live). */
export function termAlive(state: TermState): boolean {
  return state !== 'lapsed';
}
