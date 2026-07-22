/**
 * MEDIA - the single source for every image in the app.
 *
 * Rule: NO image URL or /public path lives inside a component. Components
 * import MEDIA.<section>.<name>; swapping a photo means editing ONE line
 * here (or replacing the file in /public with the same name) - zero
 * component edits.
 *
 * Photography is currently curated design-time placeholders (Unsplash,
 * host whitelisted in next.config.js) chosen per service. Swap each line
 * for real AutoModz shoots (e.g. '/images/services/ppf.webp') as they are
 * produced - the shape stays the same.
 *
 * User-generated media (job photos, gallery uploads, car listings) lives
 * in Firebase Storage and flows through lib/services/storage.ts - it is
 * data, not app chrome, and never belongs here.
 */
const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export const MEDIA = {
  hero: {
    /** LC1 homepage photo hero - freshly detailed paintwork close-up */
    homepage: u('photo-1617531653332-bd46c24f2068', 1800),
    /** bright silver supercar; reads on light + dark */
    studio: u('photo-1544829099-b9a0c07fad1a', 2200),
    alt: u('photo-1618843479313-40f8afb4b4d8', 2200),
  },

  services: {
    ppf: u('photo-1618843479313-40f8afb4b4d8', 1800),      // grey AMG GT R, studio-lit bodywork
    ceramic: u('photo-1580273916550-e323be2ae537', 1800),  // glossy coated luxury car
    coating: u('photo-1601362840469-51e4d8d58785', 1800),  // buffing / polishing pad
    washing: u('photo-1520340356584-f9917d1eea6f', 1800),  // foam wash
    detailing: u('photo-1600661653561-629509216228', 1800),// hand polishing a panel
    interior: u('photo-1503736334956-4c8f8e92946d', 1800), // interior detail
  },

  surfaces: {
    studio: u('photo-1618843479313-40f8afb4b4d8', 2000),   // luxury car in studio
    garage: u('photo-1493238792000-8113da705763', 2000),   // clean studio garage
    membership: u('photo-1492144534655-ae79c964c9d7', 1800),
  },

  beforeAfter: {
    /** placeholder pair until real before/after shoots exist - same frame twice */
    ceramic: {
      before: u('photo-1580273916550-e323be2ae537', 1800),
      after: u('photo-1580273916550-e323be2ae537', 1800),
    },
  },

  fallbacks: {
    car: u('photo-1494976388531-d1058494cdd8', 1400),
    vehicle: u('photo-1583121274602-3e2820c69888', 1400),
  },

  branding: {
    logo: '/logo.png',
    wordmarkInk: '/wordmark-ink.png',
    wordmarkWhite: '/wordmark-white.png',
  },
} as const;

/** The one category → photograph mapping. Customer surfaces must use this
 *  instead of indexing MEDIA.services locally (PRE-1 consolidation). */
export const serviceMedia = (category?: string, fallback: keyof typeof MEDIA.services = 'washing'): string =>
  (MEDIA.services as Record<string, string>)[(category ?? '').toLowerCase()] ?? MEDIA.services[fallback];
