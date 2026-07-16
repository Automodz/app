/**
 * Curated automotive photography (design-time placeholders), chosen to be
 * RELEVANT to each section/service and to read cleanly on the light "studio
 * white" theme. Swap for real AutoModz shoots before launch. Host is already
 * whitelisted in next.config.js (images.unsplash.com).
 */
const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export const STOCK = {
  // Cinematic hero — bright silver supercar, works on light + dark
  hero: u('photo-1544829099-b9a0c07fad1a', 2200),
  heroAlt: u('photo-1618843479313-40f8afb4b4d8', 2200),

  // Service categories — luxury cars, each depicting that specific service
  ppf: u('photo-1618843479313-40f8afb4b4d8', 1800),      // grey AMG GT R, studio-lit bodywork
  ceramic: u('photo-1580273916550-e323be2ae537', 1800),  // glossy coated luxury car
  coating: u('photo-1601362840469-51e4d8d58785', 1800),  // buffing / polishing pad
  washing: u('photo-1520340356584-f9917d1eea6f', 1800),  // foam wash
  detailing: u('photo-1600661653561-629509216228', 1800),// hand polishing a panel

  // Studio / app surfaces
  studio: u('photo-1618843479313-40f8afb4b4d8', 2000),  // luxury car in studio
  garage: u('photo-1493238792000-8113da705763', 2000),  // clean studio garage
  interior: u('photo-1503736334956-4c8f8e92946d', 1800),// interior detail
  membership: u('photo-1492144534655-ae79c964c9d7', 1800),

  // Cars marketplace fallbacks
  carFallback: u('photo-1494976388531-d1058494cdd8', 1400),
  vehicleFallback: u('photo-1583121274602-3e2820c69888', 1400),
} as const;

/** The four disciplines, in showcase order — used by homepage + dashboard. */
export const SERVICE_SHOWCASE = [
  { cat: 'PPF',     name: 'Paint Protection Film', line: 'Invisible self-healing armour, wrapped edge to edge.', from: 145000, img: STOCK.ppf },
  { cat: 'Ceramic', name: 'Ceramic Coating',       line: '9H nano-ceramic gloss that lasts for years.',        from: 10000,  img: STOCK.ceramic },
  { cat: 'Coating', name: 'Detailing & Polish',    line: 'Paint correction and teflon that restore the depth.', from: 1200,   img: STOCK.coating },
  { cat: 'Washing', name: 'Wash & Care',           line: 'pH-neutral foam and steam. Zero swirls, ever.',       from: 500,    img: STOCK.washing },
] as const;

export type StockKey = keyof typeof STOCK;
