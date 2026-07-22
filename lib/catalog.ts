/**
 * SERVICES - the marketing catalog: the four disciplines as the customer
 * sees them (image, copy, warranty, duration, fallback starting price).
 *
 * Pricing truth stays in Firestore (Studio Settings → Services); surfaces
 * that can read it live (homepage does) override `from` with the real
 * minimum per category. This catalog is presentation + fallback, so a
 * price change in Settings never needs a code change.
 *
 * (Named catalog.ts because lib/services/ is the Firestore service layer.)
 */
import { MEDIA } from './media';

export type ServiceCategory = 'PPF' | 'Ceramic' | 'Coating' | 'Washing';

export const SERVICES: Record<ServiceCategory, {
  cat: ServiceCategory;
  name: string;
  /** one-line showcase copy */
  line: string;
  /** sharper second line used on cards */
  detail: string;
  /** fallback starting price (₹) when live prices haven't loaded */
  from: number;
  warranty?: string;
  /** typical duration in minutes, for display only */
  durationMin: number;
  img: string;
  /** which physical bay this discipline occupies */
  bookingCategory: 'protection' | 'wash';
}> = {
  PPF: {
    cat: 'PPF', name: 'Paint Protection Film',
    line: 'Invisible self-healing armour, wrapped edge to edge.',
    detail: 'Self-healing film. Chips hit the film, not your paint.',
    from: 145000, warranty: 'Up to 12 yr', durationMin: 480,
    img: MEDIA.services.ppf, bookingCategory: 'protection',
  },
  Ceramic: {
    cat: 'Ceramic', name: 'Ceramic Coating',
    line: '9H nano-ceramic gloss that lasts for years.',
    detail: '9H gloss. Water rolls off, dirt gives up.',
    from: 10000, warranty: 'Up to 5 yr', durationMin: 300,
    img: MEDIA.services.ceramic, bookingCategory: 'protection',
  },
  Coating: {
    cat: 'Coating', name: 'Detailing & Polish',
    line: 'Paint correction and teflon that restore the depth.',
    detail: 'Swirls out, day-one depth back.',
    from: 1200, warranty: '6 months', durationMin: 240,
    img: MEDIA.services.coating, bookingCategory: 'protection',
  },
  Washing: {
    cat: 'Washing', name: 'Wash & Care',
    line: 'pH-neutral foam and steam. Zero swirls, ever.',
    detail: 'pH-neutral foam and steam. Zero swirls.',
    from: 500, durationMin: 60,
    img: MEDIA.services.washing, bookingCategory: 'wash',
  },
};

/** showcase order used by homepage + customer dashboard */
export const SERVICE_ORDER: ServiceCategory[] = ['PPF', 'Ceramic', 'Coating', 'Washing'];
