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
    /**
     * THE STUDIO ITSELF, which is the point.
     *
     * This was a stock red BMW on Unsplash — a good photograph of somebody
     * else's car in somebody else's showroom, at the one address that is
     * supposed to say what AutoModz is. It is now the studio's own floor: the
     * wordmark on the mezzanine, the LLumar, XPEL, Garware and Kovalent walls,
     * and a car that was actually finished here.
     *
     * It is a PHONE-SHAPED photograph (719x1599) in a 4:3 frame, so the crop
     * is art-directed at the call site rather than left to centre — see
     * `LandingScreen`, which pulls it down onto the car.
     */
    homepage: '/hero/studio.jpg',
    /** bright silver supercar; reads on light + dark */
    studio: u('photo-1544829099-b9a0c07fad1a', 2200),
    alt: u('photo-1618843479313-40f8afb4b4d8', 2200),
  },

  /**
   * THE FOUR DISCIPLINES, PHOTOGRAPHED HERE.
   *
   * Resampled to 1800px and re-encoded on the way in: the masters are 2752px
   * PNGs at ~7.7MB each, which is 31MB of repository and deployment for four
   * cards that are never drawn wider than half a laptop. `next/image` still
   * re-encodes per request; this is only about what the deploy carries.
   */
  services: {
    ppf: '/services/ppf.jpg',
    ceramic: '/services/ceramic.jpg',
    /** The "Detailing & Polish" card — `coating` is that discipline's key. */
    coating: '/services/detailing.jpg',
    washing: '/services/washing.jpg',
    /** The same discipline as `coating`, so it is the same photograph. */
    detailing: '/services/detailing.jpg',
    interior: u('photo-1503736334956-4c8f8e92946d', 1800), // interior detail
  },

  video: {
    /** The studio's own commercial. Looped, muted, on the landing (§7.4). */
    commercial: '/video/commercial.mp4',
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
