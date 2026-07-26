/**
 * The Term Engine - one implementation of the lifecycle shared by
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

/* ─────────────────────────────────────────────────────────────────────────
   THE GENERALISED TERM (Living States §3).

   Protection widened from coatings to everything that shields a car -
   physical, financial and legal - and state stopped always being time. A
   lifetime PPF never expires; a FASTag runs out of money, not days. Rather
   than fork the engine, the lifecycle above becomes one of three shapes.
   ───────────────────────────────────────────────────────────────────────── */

export type Term =
  /** ends on a date: insurance, PUC, ceramic, membership (the one with grace) */
  | { kind: 'dated'; expiresOn: string; grace?: boolean }
  /** cannot expire: lifetime PPF, an RC with no renewal */
  | { kind: 'perpetual' }
  /** runs out of value, not time: FASTag */
  | { kind: 'balance'; value: number; low: number };

/** What the owner needs to feel about it, in one word. */
export type Health = 'healthy' | 'attention' | 'urgent' | 'lapsed';

/**
 * The one health derivation. Dated terms defer to `termState` so there is
 * still exactly one implementation of the lifecycle; the other two shapes
 * map onto the same four words so a card never branches on term kind.
 */
export function healthOf(term: Term, now: Date = new Date()): Health {
  switch (term.kind) {
    // a promise with no end date is never anxious - it simply holds
    case 'perpetual':
      return 'healthy';

    case 'balance':
      if (term.value <= 0) return 'urgent';
      return term.value <= term.low ? 'attention' : 'healthy';

    case 'dated': {
      const state = termState(term.expiresOn, { grace: term.grace, now });
      switch (state) {
        case 'active':    return 'healthy';
        case 'waning':    return 'attention';
        case 'expiring':  return 'urgent';
        case 'grace':     return 'urgent';
        case 'lapsed':    return 'lapsed';
      }
    }
  }
}

/** True while the promise still shields the car. */
export const termHolds = (term: Term, now?: Date): boolean =>
  healthOf(term, now) !== 'lapsed';

/**
 * Days remaining, or null when the question doesn't apply. A perpetual term
 * has no countdown and a balance term has no days - asking either for a
 * number is how "98% protected" gets printed on a lifetime warranty.
 */
export function termDaysLeft(term: Term, now?: Date): number | null {
  return term.kind === 'dated' ? daysLeft(term.expiresOn, now) : null;
}

/** Sort key: the thing most in need of attention leads. */
export const HEALTH_RANK: Record<Health, number> = {
  urgent: 3, lapsed: 2, attention: 1, healthy: 0,
};
