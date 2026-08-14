/**
 * THE STUDIO'S ACTUAL CATALOGUE.
 *
 * Source: the owner's price list, 15 August 2026. Eighteen services across the
 * four disciplines the product already knows - `PPF`, `Ceramic`, `Coating`,
 * `Washing` (`lib/types.ts#Service.category`).
 *
 * ── WHY IT IS HERE AND NOT ONLY IN FIRESTORE ─────────────────────────────
 * `services` is a Firestore collection, read by the studio page, the booking
 * flow, the estimate, capacity, job creation, sealing and three admin screens.
 * Before this file it existed ONLY as seven placeholder documents somebody had
 * typed into the console - so nothing reviewed them, nothing tested them, and
 * the prices a customer is quoted had no version history.
 *
 * This is the source of truth. `scripts/seed-services.mjs` writes it to
 * Firestore; the catalogue can be read, diffed and corrected in a pull request
 * like anything else that decides what a customer pays.
 *
 * ── WHAT IS THE OWNER'S AND WHAT IS MINE ─────────────────────────────────
 * PRICE, NAME, BRAND, VALIDITY: the owner's, exactly as given, to the rupee.
 *
 * DURATION: ALL EIGHTEEN ARE THE OWNER'S, given as production minutes on
 * 15 August 2026. Nothing here is estimated any more.
 *
 * `duration` is what reserves the bay. A booking holds ONE bay for the whole of
 * it, and `expandIntervals` spreads anything longer than a working day across
 * consecutive days from its start - so LLumar Valor at 4320 minutes is seven
 * working days on one protection bay, and the other two stay open throughout.
 */
import type { Service } from '@/lib/types';

/** A catalogue entry before Firestore adds its timestamps. */
export type SeedService = Omit<Service, 'createdAt' | 'updatedAt'>;

export const CATALOGUE: readonly SeedService[] = [
  /* ── PAINT PROTECTION FILM ─────────────────────────────────────────────
     Six films across two brands. Validity is the film's warranty, which is the
     whole basis of the choice, so it is the `warranty` field and the customer
     sees it beside the price.

     DURATION: the owner's production minutes. These are NOT all equal - Valor
     is 4320 and Gloss 2880 - so the film chosen changes how long the bay is
     held, which is exactly what the scheduler needs to know. */
  {
    id: 'ppf-llumar-gloss', category: 'PPF', brand: 'LLumar', name: 'LLumar Gloss',
    description: 'Self-healing gloss film, cut to the car. Chips hit the film, not the paint.',
    price: 145000, duration: 2880, warranty: '5 years',
    popular: false, active: true, order: 11,
  },
  {
    id: 'ppf-llumar-platinum', category: 'PPF', brand: 'LLumar', name: 'LLumar Platinum',
    description: 'The ten-year film - thicker, with a longer-lasting top coat.',
    price: 205000, duration: 3600, warranty: '10 years',
    popular: true, active: true, order: 12,
  },
  {
    id: 'ppf-llumar-valor', category: 'PPF', brand: 'LLumar', name: 'LLumar Valor',
    description: 'LLumar’s longest warranty, for a car that is being kept.',
    price: 220000, duration: 4320, warranty: '12 years',
    popular: false, active: true, order: 13,
  },
  {
    id: 'ppf-garware-plus', category: 'PPF', brand: 'Garware', name: 'Garware Plus',
    description: 'Full-body protection at the entry to the range.',
    price: 85000, duration: 2880, warranty: '5 years',
    popular: false, active: true, order: 14,
  },
  {
    id: 'ppf-garware-premium', category: 'PPF', brand: 'Garware', name: 'Garware Premium',
    description: 'Eight years of cover, with a clearer finish than Plus.',
    price: 105000, duration: 2880, warranty: '8 years',
    popular: false, active: true, order: 15,
  },
  {
    id: 'ppf-garware-platinum', category: 'PPF', brand: 'Garware', name: 'Garware Platinum',
    description: 'Garware’s lifetime film - the longest cover the studio fits.',
    price: 145000, duration: 3600, warranty: 'Lifetime',
    popular: false, active: true, order: 16,
  },

  /* ── CERAMIC COATING ───────────────────────────────────────────────────
     One brand, three chemistries, rising in price.
     DURATION: the owner's production minutes, rising with the chemistry -
     Prolong 480, Graphene Matrix 720, Borophene 840. */
  {
    id: 'ceramic-kovalent-prolong', category: 'Ceramic', brand: 'Kovalent', name: 'Kovalent Prolong',
    description: 'Paint corrected by hand, then a ceramic coat cured in the booth.',
    price: 10000, duration: 480, warranty: null,
    popular: true, active: true, order: 21,
  },
  {
    id: 'ceramic-kovalent-graphene', category: 'Ceramic', brand: 'Kovalent', name: 'Kovalent Graphene Matrix',
    description: 'A graphene-matrix coat - slicker, and it sheds heat better than glass ceramic.',
    price: 12000, duration: 720, warranty: null,
    popular: false, active: true, order: 22,
  },
  {
    id: 'ceramic-kovalent-borophene', category: 'Ceramic', brand: 'Kovalent', name: 'Kovalent Borophene',
    description: 'The hardest coat Kovalent makes, laid over a full correction.',
    price: 14000, duration: 840, warranty: null,
    popular: false, active: true, order: 23,
  },

  /* ── COATING ───────────────────────────────────────────────────────────
     The shorter sealants and the top-up.
     DURATION: the owner's production minutes. */
  {
    id: 'coating-teflon', category: 'Coating', brand: null, name: 'Teflon Coating',
    description: 'A sealant over the paint - quick, and renewed each season.',
    price: 5000, duration: 240, warranty: null,
    popular: false, active: true, order: 31,
  },
  {
    id: 'coating-glass', category: 'Coating', brand: null, name: 'Glass Coating',
    description: 'Windscreen and windows sealed — rain beads and leaves.',
    price: 1200, duration: 120, warranty: null,
    popular: false, active: true, order: 32,
  },
  {
    id: 'coating-maintenance', category: 'Coating', brand: null, name: 'Maintenance Coat',
    description: 'The coat decontaminated and topped, so its years run their course.',
    price: 4500, duration: 180, warranty: null,
    popular: false, active: true, order: 33,
  },

  /* ── WASHING ───────────────────────────────────────────────────────────
     The wash bay, which runs alongside protection rather than competing for it
     (`categoryToResource` puts Washing on its own resource).
     DURATION: the owner's production minutes. Headlight buffing is priced per
     light but reserves a 60-minute minimum, because a bay cannot be held for
     less than it takes to receive and return the car. */
  {
    id: 'wash-regular', category: 'Washing', brand: null, name: 'Regular wash',
    description: 'The everyday wash - foam, rinse, dry.',
    price: 500, duration: 60, warranty: null,
    popular: true, active: true, order: 41,
  },
  {
    id: 'wash-premium', category: 'Washing', brand: null, name: 'Premium wash',
    description: 'The regular wash, with the wheels, arches and glass taken further.',
    price: 1000, duration: 90, warranty: null,
    popular: false, active: true, order: 42,
  },
  {
    id: 'wash-detail-spa', category: 'Washing', brand: null, name: 'Detail SPA',
    description: 'A full exterior detail - decontaminated, polished and dressed.',
    price: 2500, duration: 180, warranty: null,
    popular: false, active: true, order: 43,
  },
  {
    id: 'wash-dry-clean', category: 'Washing', brand: null, name: 'Dry Clean',
    description: 'Interior dry clean - every surface lifted, leather fed, glass finished last.',
    price: 4000, duration: 300, warranty: null,
    popular: false, active: true, order: 44,
  },
  {
    id: 'wash-roof-cleaning', category: 'Washing', brand: null, name: 'Roof Cleaning',
    description: 'The roof lining brought back, without soaking it.',
    price: 800, duration: 60, warranty: null,
    popular: false, active: true, order: 45,
  },
  {
    id: 'wash-headlight-buffing', category: 'Washing', brand: null, name: 'Headlight buffing',
    description: 'Yellowed lenses cut back and sealed. Priced per light.',
    price: 400, duration: 60, warranty: null,
    popular: false, active: true, order: 46,
  },
] as const;

/**
 * The seven documents the catalogue replaces.
 *
 * They are PLACEHOLDERS - "Paint protection film — full body", "Maintenance
 * wash" - typed in before the real price list existed. They are listed by id so
 * the seed can retire them EXPLICITLY rather than by guessing at what is not in
 * the new set, and so a reader can see exactly what is going away.
 *
 * They are DEACTIVATED, never deleted: a booking, a job or a sealed visit may
 * point at one of these ids, and deleting the service a record refers to would
 * rewrite history the studio has already been paid for. `active: false` takes
 * them out of the catalogue and leaves every reference intact.
 */
export const RETIRED_SERVICE_IDS: readonly string[] = [
  'svc-ppf-full', 'svc-ppf-front', 'svc-ceramic', 'svc-ceramic-maint',
  'svc-glass', 'svc-interior', 'svc-wash',
];

/** Longest first, so a category's slowest job is what capacity reserves. */
export const longestDurationIn = (category: Service['category']): number =>
  CATALOGUE.filter(s => s.category === category)
    .reduce((max, s) => Math.max(max, s.duration), 0);
