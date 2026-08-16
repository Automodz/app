/**
 * WHAT THE STUDIO WARRANTS, AND THE CARD THAT PROVES IT.
 *
 * The owner, on being shown a car's ledger: "Where is this insurance on cars,
 * warranty on i20, fastag on kia, registration on kia, interior protection
 * bmw, where is all this coming from? We never give interior warranty,
 * warranty is only from the brands with the ceramic or ppf."
 *
 * The data was `scripts/seed-demo.mjs` writing demo rows into a real account.
 * The DEFECT was that the product could not tell the two apart: a car's room
 * drew one "Warranty" tile from the furthest dated term across every
 * protection it held, so an insurance policy was presented as something
 * AutoModz stands behind.
 *
 * These are the rules that came out of it.
 */
import { Timestamp } from 'firebase/firestore';
import type { Protection, ProtectionKind, Service } from '@/lib/types';
import {
  WARRANTED_KINDS, isBrandWarranted, warrantyBrands, warrantyCardOf, warrantyReference,
} from '@/lib/os/warranty';
import { CATALOGUE } from '@/lib/catalogue/services';

const ts = (iso: string) => Timestamp.fromDate(new Date(iso));

const prot = (over: Partial<Protection> = {}): Protection => ({
  id: 'p-1', vehicleId: 'v1', kind: 'ppf', provider: 'LLumar',
  coverage: 'Full body', since: '2025-08-14',
  term: { kind: 'dated', expiresOn: '2035-08-14' },
  termsSource: 'captured',
  createdAt: ts('2025-08-14T10:00:00Z'), updatedAt: ts('2025-08-14T10:00:00Z'),
  ...over,
});

describe('a warranty is a brand’s promise on a film or a coat, and nothing else', () => {
  it('is exactly PPF and ceramic', () => {
    expect([...WARRANTED_KINDS].sort()).toEqual(['ceramic', 'ppf']);
  });

  it.each<[ProtectionKind]>([
    ['insurance'], ['fastag'], ['rc'], ['puc'], ['interior'], ['warranty'], ['glass'],
  ])('%s is not one - the studio cannot be claimed against for it', kind => {
    expect(isBrandWarranted(kind)).toBe(false);
    expect(warrantyCardOf(prot({ kind }))).toBeNull();
  });

  it('and the near-miss is refused on purpose', () => {
    /* `PROTECTION_CLASS === 'physical'` would have been the tempting rule and
       it takes in `glass` and `interior` too - the interior row is exactly the
       one the owner said the studio has never warranted. */
    expect(isBrandWarranted('interior')).toBe(false);
    expect(isBrandWarranted('glass')).toBe(false);
  });
});

describe('the brands come from the price list, never from a list in the code', () => {
  it('names the brands the price list actually holds', () => {
    /**
     * THREE, NOT FOUR - AND THAT IS A FINDING, NOT A FAILURE.
     *
     * The owner named four: "currently we have kovalent, 3M, lumar, Garware".
     * `lib/catalogue/services` holds LLumar and Garware films and Kovalent
     * coatings, and no 3M product at all. So the studio fits a brand its own
     * price list has never listed - which means no 3M service can be booked,
     * quoted, sold or warranted through the product, and no 3M card can exist
     * until the products are added with their real names, prices, warranties
     * and durations. Those are the studio's commercial facts and nothing here
     * may invent them.
     *
     * This asserts the catalogue as it IS, so the day 3M is added the test
     * fails and says so out loud rather than quietly passing on a list that
     * was written from memory.
     */
    expect(warrantyBrands(CATALOGUE as unknown as Service[]))
      .toEqual(['LLumar', 'Garware', 'Kovalent']);
  });

  it('and a brand added to PPF or ceramic tomorrow arrives with no code change', () => {
    /* THE WHOLE POINT OF READING THE CATALOGUE. The owner asked that adding a
       brand to a PPF or ceramic service build its card automatically; a hard
       -coded array here would be the second place the studio's brands live. */
    const withNew = [
      ...(CATALOGUE as unknown as Service[]),
      { id: 's-new', name: 'XPEL Ultimate', category: 'PPF', brand: 'XPEL', price: 1, duration: 1, active: true },
    ] as Service[];
    expect(warrantyBrands(withNew)).toContain('XPEL');
  });

  it('an inactive service’s brand is not one the studio fits', () => {
    const retired = [
      { id: 's-old', name: 'Old film', category: 'PPF', brand: 'Retired', price: 1, duration: 1, active: false },
    ] as unknown as Service[];
    expect(warrantyBrands(retired)).toEqual([]);
  });
});

describe('the card itself', () => {
  it('carries the brand, what it covers and a reference a claims desk can quote', () => {
    const card = warrantyCardOf(prot())!;
    expect(card.brand).toBe('LLumar');
    expect(card.covers).toBe('Full body');
    expect(card.reference).toBe(warrantyReference('p-1'));
    expect(card.reference).toMatch(/^[A-Z0-9]+$/);
  });

  it('reads the brand out of either shape the record is written in', () => {
    /* A sealed visit writes `provider` = the brand; a hand-written row has
       been seen carrying the whole product name. Both are one brand. */
    expect(warrantyCardOf(prot({ provider: 'Kovalent' }))?.brand).toBe('Kovalent');
    expect(warrantyCardOf(prot({ provider: 'Kovalent Prolong' }))?.brand).toBe('Kovalent');
  });

  it('does not repeat the brand inside what it covers', () => {
    /* `captureTerms` writes `coverage` = the whole service name, so without
       stripping it the card reads "LLumar · LLumar Platinum". */
    const card = warrantyCardOf(prot({ coverage: 'LLumar Platinum' }))!;
    expect(card.covers).toBe('Platinum');
  });

  it('refuses to issue a card with no brand on it', () => {
    /* A warranty document with a blank where the brand goes is a piece of
       paper no claims desk will accept. Saying the record is incomplete is
       the honest outcome. */
    expect(warrantyCardOf(prot({ provider: undefined }))).toBeNull();
    expect(warrantyCardOf(prot({ provider: '   ' }))).toBeNull();
  });

  it('and the reference is the protection’s own identity, not a new one', () => {
    /* One promise, one document, one reference. A stored field would be a
       second identifier for one fact, and the day they disagree neither can
       be trusted. */
    expect(warrantyReference(prot().id)).toBe(warrantyReference(prot().id));
    expect(warrantyReference('p-1')).not.toBe(warrantyReference('p-2'));
  });

  it('and it never reads as a fragment of the id it came from', () => {
    /**
     * THE SLICED VERSION SHIPPED FOR AN HOUR AND LOOKED LIKE THIS.
     *
     * "the last eight characters" is right for a Firestore id - twenty random
     * characters - and absurd for the ids this product mints itself: a
     * reconstructed promise is `${vehicleId}_${kind}`, so the reference read
     * "1CERAMIC", and a seeded row read "0TI20PPF" on the card. A reference
     * that looks like a fragment of something else invites somebody to try to
     * read meaning into it.
     */
    for (const id of ['v1_ceramic', 'prot-i20-ppf', 'prot-seltos-ppf']) {
      const ref = warrantyReference(id);
      expect(ref).toMatch(/^[0-9A-Z]{7}$/);
      expect(ref).not.toMatch(/CERAMIC|PPF/);
    }
  });
});
