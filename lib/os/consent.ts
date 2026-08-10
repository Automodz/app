/**
 * PUBLIC HISTORY CONSENT.
 *
 * Design screen 17 shows, on a listing anyone can open: "Its record with us —
 * detailed here since 2021 · full-body PPF 68% life · 11 visits, 340 photos ·
 * paint original, no respray". Every one of those is a fact about a REAL
 * CUSTOMER'S CAR, shown to strangers. It is the most sensitive thing the
 * product publishes and the only place a private record crosses into public.
 *
 * ── WHY THIS IS AN ENGINE AND NOT A CONDITION IN A SCREEN ────────────────
 * A check inside `ListingScreen` protects `ListingScreen`. It protects nothing
 * else: not the market card, not an OG image, not a sitemap, not the next
 * public surface somebody adds in a hurry. The rule has to live where the DATA
 * is shaped, so a surface cannot render what it was never given.
 *
 *      vehicle consent → publicHistoryOf() → listing projection → screen
 *
 * `publicHistoryOf` returns `null` or the permitted history. There is no third
 * answer and no partial one. A screen holding `null` cannot leak a count,
 * because it does not have a count.
 *
 * ── THE RULES, AS THE OWNER SET THEM ────────────────────────────────────
 *   Consent belongs to the VEHICLE, never the listing.
 *   Default is private. Absent means no.
 *   Never inferred — not from owning the car, completing a visit, uploading
 *   photographs, or creating a listing.
 *   Revocation is immediate.
 *   Nobody is grandfathered in.
 */
import type { Vehicle, Visit } from '@/lib/types';

/**
 * Is this car's history publishable RIGHT NOW?
 *
 * `granted` alone is not enough: a record may carry `granted: true` from an
 * earlier grant and a later `revokedAt`. The later timestamp wins, which is
 * what makes revocation immediate rather than dependent on somebody also
 * flipping the boolean.
 */
export function hasPublicHistoryConsent(
  vehicle: Pick<Vehicle, 'publicHistoryConsent'> | null | undefined,
): boolean {
  const c = vehicle?.publicHistoryConsent;
  if (!c || !c.granted) return false;
  const granted = c.grantedAt?.toMillis?.() ?? 0;
  const revoked = c.revokedAt?.toMillis?.() ?? 0;
  /* Revoked after it was granted — or revoked with no grant recorded at all. */
  if (revoked && revoked >= granted) return false;
  return true;
}

/**
 * What a listing may say about a car's life at the studio.
 *
 * Every field is a COUNT or a WORDED FACT, never a document, an invoice, a
 * price or a customer. A buyer learns that the car was looked after; they do
 * not learn what the owner paid or who they are.
 */
export interface PublicHistory {
  /** "2021" — the year the studio first saw it. */
  since: string;
  /** How many sealed visits. A count, never the visits themselves. */
  visits: number;
  /** How many photographs across those visits. */
  photographs: number;
  /** Live protections, worded — "Full-body PPF · 68% life". */
  protections: { label: string; detail: string }[];
}

/**
 * THE ONLY PLACE PUBLIC HISTORY IS PRODUCED.
 *
 * Returns `null` unless consent is currently granted. Not an empty object, not
 * zeroes — `null`, so a caller that forgets to check still renders nothing
 * rather than "0 visits", which is itself a claim about the car.
 */
export function publicHistoryOf(args: {
  vehicle: Pick<Vehicle, 'publicHistoryConsent'> | null | undefined;
  visits: Pick<Visit, 'servicedOn' | 'stages'>[];
  protections: { label: string; detail: string }[];
  photographs: number;
  /** The year the relationship started, already worded by the caller. */
  since?: string;
}): PublicHistory | null {
  if (!hasPublicHistoryConsent(args.vehicle)) return null;
  if (!args.since || args.visits.length === 0) return null;

  return {
    since: args.since,
    visits: args.visits.length,
    photographs: args.photographs,
    protections: args.protections,
  };
}

/**
 * One consent change, kept forever.
 *
 * Written to `users/{uid}/vehicles/{id}/consentLog`. The question this exists
 * to answer is "was this car's history public on the day that buyer saw it",
 * and a boolean on the vehicle cannot answer it — only a log can.
 */
export interface ConsentEvent {
  id: string;
  kind: 'publicHistory';
  action: 'granted' | 'revoked';
  /** The uid that performed it. Always the owner; the studio cannot consent. */
  byUid: string;
  at: import('firebase/firestore').Timestamp;
}
