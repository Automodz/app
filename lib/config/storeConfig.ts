// ─── STORE MODE (kiosk) CONFIG ───────────────────────────────────────────────

/** Allowed PIN lengths for employee kiosk PINs */
export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 6;

/** Kiosk auto-relocks after this many ms of inactivity */
export const KIOSK_LOCK_TIMEOUT_MS = 5 * 60 * 1000;

/** Invoice numbering */
export const INVOICE_PREFIX = 'AMZ';

/** GST - off by default; set a rate + GSTIN to enable on invoices */
export const GST_ENABLED = false;
export const GST_RATE = 18;
export const GSTIN = '';

/** Business identity used on invoices and shares */
export const BUSINESS = {
  name: 'AutoModz',
  tagline: 'Premium Car Detailing Studio',
  address: 'Bhairavnath Rd, Bhairavnath, Maninagar, Ahmedabad, Gujarat 380028',
  phone: '9512605088',
  phoneIntl: '919512605088',
  mapsUrl: 'https://maps.app.goo.gl/S1ZBYHrYYUxezB7g9',
} as const;

/** Service bays (mirrors SLOT_CAPACITY in bookingConfig) */
export const BAYS = [1, 2, 3] as const;

/** Referral programme - both sides get a flat discount promo */
export const REFERRAL = {
  amount: 200,                 // ₹ off for referrer AND referred
  label: '₹200 off',
  validityDays: 90,
  minOrder: 0,
} as const;

/** Google review ask - plain Maps link works; a place-id review link is even better */
export const GOOGLE_REVIEW_URL = 'https://maps.app.goo.gl/S1ZBYHrYYUxezB7g9';
