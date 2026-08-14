/**
 * COMPANY - the single source for business identity: name, contact,
 * address, hours, review link. No phone number, address or maps URL may
 * appear inline in a component; import from here.
 *
 * Working hours derive from the availability engine so the booking system
 * and the marketing copy can never disagree.
 */
import { DAY_OPEN_MIN, DAY_CLOSE_MIN } from './availability';

const hm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export const COMPANY = {
  name: 'AutoModz',
  tagline: 'Premium Car Detailing Studio',
  city: 'Ahmedabad',
  address: 'Bhairavnath Rd, Maninagar, Ahmedabad, Gujarat 380028',
  /** local display number */
  phone: '9512605088',
  /** E.164 without '+', for wa.me / tel deep links */
  phoneIntl: '919512605088',
  mapsUrl: 'https://maps.app.goo.gl/S1ZBYHrYYUxezB7g9',
  googleReviewUrl: 'https://maps.app.goo.gl/S1ZBYHrYYUxezB7g9',
  hours: { open: hm(DAY_OPEN_MIN), close: hm(DAY_CLOSE_MIN) },
} as const;

/**
 * The studio's canonical origin - one place, so metadata, sitemap, robots and
 * share cards can never disagree about where the site lives. Override with
 * `NEXT_PUBLIC_SITE_URL` the day a custom domain lands; Vercel preview builds
 * fall back to their own deployment URL so previews link to themselves.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_ENV === 'production'
    ? 'https://automodz.vercel.app'
    : process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`)
  ?? 'https://automodz.vercel.app'
).replace(/\/$/, '');

/** WhatsApp deep link to the studio, with an optional prefilled message. */
export const waLink = (message?: string) =>
  `https://wa.me/${COMPANY.phoneIntl}${message ? `?text=${encodeURIComponent(message)}` : ''}`;

export const telLink = () => `tel:+${COMPANY.phoneIntl}`;
