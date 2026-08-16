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
/**
 * THE HERO, IMPORTED RATHER THAN NAMED.
 *
 * A string path tells `next/image` nothing about the picture, so a frame using
 * one has to be told the aspect ratio by hand - and a hand-written ratio is
 * wrong the moment the file is recropped, which is exactly what happened here.
 * A static import makes Next read the real width and height off the file at
 * BUILD time, so the frame is always the photograph's own shape and swapping
 * the file is the whole of the change.
 *
 * It stays in this module because §MEDIA's rule is that no component names an
 * image; importing one inside a screen would be the same violation as writing
 * its path there.
 */
export { default as heroPhoto } from '../public/hero/studio.jpg';

const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export const MEDIA = {
  hero: {
    /**
     * THE STUDIO ITSELF, which is the point.
     *
     * This was a stock red BMW on Unsplash - a good photograph of somebody
     * else's car in somebody else's showroom, at the one address that is
     * supposed to say what AutoModz is. It is now the studio's own floor: the
     * wordmark on the mezzanine, the LLumar, XPEL, Garware and Kovalent walls,
     * and a car that was actually finished here.
     *
     * Its SHAPE is deliberately not written down anywhere. It has been recropped
     * once already, and every place that repeated its dimensions had to be found
     * and corrected by hand when it was - so the frame reads the shape off the
     * file instead. `heroPhoto` below is how.
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
    /** The "Detailing & Polish" card - `coating` is that discipline's key. */
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

/* `serviceMedia` STOOD HERE - the one category → photograph mapping, so that
   customer surfaces did not index `MEDIA.services` locally.

   Nothing indexes it now, locally or otherwise. The four service photographs
   each have a person in them with their face to the camera, and §2.2 forbids a
   customer surface naming an individual - a face names one louder than text
   does - so the Studio's disciplines are DRAWN rather than photographed (see
   `components/studio/ServiceChooser`). `MEDIA.services` is still read by the
   landing page, which is marketing and governed differently; the helper that
   existed only to serve the rooms is not. */
