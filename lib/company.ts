/**
 * COMPANY — the single source for business identity: name, contact,
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
  address: 'Bhairavnath Rd, Bhairavnath, Maninagar, Ahmedabad, Gujarat 380028',
  /** local display number */
  phone: '9512605088',
  /** E.164 without '+', for wa.me / tel deep links */
  phoneIntl: '919512605088',
  mapsUrl: 'https://maps.app.goo.gl/S1ZBYHrYYUxezB7g9',
  googleReviewUrl: 'https://maps.app.goo.gl/S1ZBYHrYYUxezB7g9',
  hours: { open: hm(DAY_OPEN_MIN), close: hm(DAY_CLOSE_MIN) },
} as const;

/** WhatsApp deep link to the studio, with an optional prefilled message. */
export const waLink = (message?: string) =>
  `https://wa.me/${COMPANY.phoneIntl}${message ? `?text=${encodeURIComponent(message)}` : ''}`;

export const telLink = () => `tel:+${COMPANY.phoneIntl}`;
