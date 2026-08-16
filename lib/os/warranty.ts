/**
 * WHAT THE STUDIO ACTUALLY WARRANTS - and the card that proves it.
 *
 * ── THE DISTINCTION THIS FILE EXISTS TO MAKE ─────────────────────────────
 * A car's `protections` collection holds ten kinds, and the product had been
 * treating all of them as one thing. They are two things, and the owner said
 * the difference plainly: "warranty is only from the brands with the ceramic
 * or ppf".
 *
 *   WARRANTED   ppf, ceramic. A brand - LLumar, Garware and Kovalent today -
 *               stands behind the film or the coat, for a stated term, and will
 *               honour a claim against it. The studio is the installer of
 *               record.
 *
 *   HELD        insurance, the pollution certificate, the registration, a
 *               FASTag, a manufacturer's warranty, and anything else the owner
 *               brought with them. The studio RECORDS these; it warrants none
 *               of them and cannot be claimed against for any of them.
 *
 * Conflating the two produced exactly the claim the owner objected to: the
 * car's room drew a "Warranty" tile from the furthest dated term across EVERY
 * protection, so an insurance policy running to next March was presented under
 * the word "warranty" as something AutoModz stands behind - and a seeded
 * `interior` row was presented as an interior warranty the studio has never
 * offered. See `__tests__/customer/warranty`.
 *
 * ── THE BRANDS ARE THE CATALOGUE'S, NEVER A LIST HERE ────────────────────
 * `warrantyBrands` reads the distinct `brand` off the active PPF and Ceramic
 * services. Today that is LLumar, Garware and Kovalent; the day the studio adds
 * another to the price list, the card is built for it with no code change,
 * which is what the owner asked for. A hard-coded array here would be the
 * second place the studio's brands live, and the two would drift the first time
 * one was edited (§22.2).
 *
 * THE OWNER NAMED A FOURTH - 3M - AND THE PRICE LIST HAS NO 3M PRODUCT.
 * That is a gap in the catalogue rather than in this file: a brand with no
 * service behind it cannot be booked, quoted, sold or warranted, so it has
 * nothing to build a card from. Adding the products - with their real names,
 * prices, warranties and durations, which are the studio's to state - is all
 * that is needed; nothing here changes. See `__tests__/customer/warranty`.
 *
 * Pure - no React, no Firestore, no addresses.
 */
import type { Protection, ProtectionKind, Service } from '@/lib/types';

/**
 * THE KINDS A BRAND STANDS BEHIND.
 *
 * Not `PROTECTION_CLASS === 'physical'`, which is the near-miss: that also
 * takes in `glass` and `interior`. A glass coat and an interior treatment are
 * work the studio does; they are not a registered warranty a brand honours a
 * claim against, and the owner is explicit that the second list is these two
 * and no others.
 */
export const WARRANTED_KINDS: readonly ProtectionKind[] = ['ppf', 'ceramic'];

/** Whether a brand - not the studio, and not the owner - stands behind this. */
export const isBrandWarranted = (kind: ProtectionKind): boolean =>
  WARRANTED_KINDS.includes(kind);

/** The catalogue categories those kinds are sold under. */
const WARRANTED_CATEGORIES = ['PPF', 'Ceramic'];

/**
 * Every brand the studio currently fits a warranted product from, in the order
 * the price list introduces them. Read off the catalogue, so a new brand needs
 * no edit here.
 */
export function warrantyBrands(catalogue: readonly Service[]): string[] {
  return [...new Set(
    catalogue
      .filter(s => s.active !== false && WARRANTED_CATEGORIES.includes(s.category))
      .map(s => s.brand)
      .filter((b): b is string => Boolean(b && b.trim())),
  )];
}

/**
 * THE CARD'S REFERENCE, AND WHY IT IS DERIVED RATHER THAN STORED.
 *
 * A brand's claims desk needs one string that identifies this installation.
 * The protection document already IS that identity - one row per promise, for
 * ever - so the reference is derived from its id. A new stored field would be
 * a second identifier for one fact, and the day the two disagree neither is
 * trustworthy (the same argument the booking reference makes).
 *
 * HASHED, NOT SLICED. The obvious version - the last eight characters of the
 * id - is right for a Firestore id, which is twenty random characters, and
 * absurd for the ids this product also mints: a reconstructed promise is
 * `${vehicleId}_${kind}`, so the last eight of it read "1CERAMIC", and a
 * seeded row read "0TI20PPF". A reference that looks like a fragment of
 * something else invites somebody to try to interpret it.
 *
 * FNV-1a, base 36, eight characters. Deterministic - the same protection has
 * the same reference for ever, which is the whole requirement - and it cannot
 * accidentally spell part of the record it came from.
 */
export function warrantyReference(protectionId: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < protectionId.length; i += 1) {
    h ^= protectionId.charCodeAt(i);
    /* >>> 0 keeps it an unsigned 32-bit value; JavaScript's bitwise operators
       work on signed integers and the sign flip would make the hash depend on
       where in the string it happened to overflow. */
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).toUpperCase().padStart(7, '0').slice(-7);
}

export interface WarrantyCard {
  /** The protection this card is for. */
  id: string;
  /** "LLumar", "Kovalent" - whoever honours the claim. */
  brand: string;
  /** "Paint protection film" / "Ceramic coating". */
  kind: ProtectionKind;
  /**
   * WHAT IS COVERED, IN THE RECORD'S OWN WORDS - and deliberately one field.
   *
   * The two writers that create a protection fill `plan` and `coverage`
   * differently: a sealed visit writes `plan` = the catalogue's warranty
   * string ("10 Year") and `coverage` = the service name ("LLumar Platinum"),
   * while a hand-written record writes `plan` = a grade ("Gloss") and
   * `coverage` = the extent ("Full body"). Splitting them into "grade" and
   * "coverage" on the card would mean guessing which writer made the row, and
   * printing "10 Year" under the heading "Grade" on somebody's warranty
   * document is worse than printing one honest line. Both shapes give a true
   * answer to "what does this cover", so that is the question the card asks.
   */
  covers?: string;
  /** The day it went on, ISO. Absent on a record that never captured one. */
  since?: string;
  /** The claim reference. */
  reference: string;
}

/**
 * The card for one protection, or nothing at all.
 *
 * Returns null for anything the studio does not warrant, and for a warranted
 * kind whose record does not name a brand: a warranty card with no brand on it
 * is a piece of paper that no claims desk will accept, and issuing one would be
 * worse than saying the record is incomplete.
 */
export function warrantyCardOf(p: Protection): WarrantyCard | null {
  if (!isBrandWarranted(p.kind)) return null;
  const brand = brandOf(p);
  if (!brand) return null;
  return {
    id: p.id,
    brand,
    kind: p.kind,
    covers: coversOf(p, brand),
    since: p.since,
    reference: warrantyReference(p.id),
  };
}

/**
 * WHOSE PRODUCT IT IS, out of a field that has been written two ways.
 *
 * `provider` is "Kovalent" on one seeded row and "Kovalent Prolong" on a
 * captured one, because `captureTerms` writes the whole service name. The
 * brand is the first word either way, and `plan` carries the grade when the
 * writer separated them.
 */
const brandOf = (p: Protection): string | undefined =>
  p.provider?.trim().split(/\s+/)[0] || undefined;

/**
 * The extent, with the brand taken off the front - a captured row's `coverage`
 * is the whole service name, so without this the card reads "LLumar · LLumar
 * Platinum".
 */
function coversOf(p: Protection, brand: string): string | undefined {
  const said = (p.coverage ?? p.plan ?? '').trim();
  if (!said) return undefined;
  const withoutBrand = said.replace(new RegExp(`^${brand}\\s+`, 'i'), '').trim();
  return withoutBrand || said;
}
