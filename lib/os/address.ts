/**
 * WHERE THE STUDIO COLLECTS FROM - design screens 08 and 19.
 *
 * `bookings.pickupAddress` was declared and never populated: 0% across every
 * booking in production, read by exactly one WhatsApp template. The concierge
 * existed as two booleans and a fee, and nowhere in the product could a
 * customer say where their car actually was.
 *
 * ── WHY STRUCTURED, AND NOT A LINE OF TEXT ───────────────────────────────
 * A driver needs the parts. A single string cannot be validated, cannot be
 * re-used between visits, cannot tell a flat number from a pincode, and cannot
 * be shown as "Bodakdev · Home" on a chip. It also cannot be corrected: the
 * one thing a customer wants to do with a saved address is fix the bit that is
 * wrong.
 *
 * ── THE BOOKING TAKES A SNAPSHOT, NEVER A REFERENCE ──────────────────────
 * Editing a saved address must not rewrite where a past visit was collected
 * from. A customer who moves house and updates "Home" has not changed the
 * street the studio drove to last March. Same rule as the captured warranty
 * terms, same reason.
 *
 * Pure: validation, normalisation and wording. No Firestore, no routes.
 */

export interface AddressInput {
  label: string;
  line1: string;
  line2?: string;
  area: string;
  city: string;
  pincode: string;
  contactName?: string;
  contactPhone?: string;
  isDefault?: boolean;
}

export type AddressFault =
  | 'label-required'
  | 'line1-required'
  | 'area-required'
  | 'city-required'
  | 'pincode-invalid'
  | 'phone-invalid'
  | 'too-long';

/** Bounds, so a "line 2" cannot become an essay stored on every booking. */
const LIMITS = {
  label: 40, line1: 120, line2: 120, area: 80, city: 60, contactName: 80,
} as const;

/**
 * Indian pincodes are six digits and never start with zero. Checked because
 * this is the one field a driver types into a maps application, and a wrong
 * one sends a van to the wrong district rather than to the wrong street.
 */
const PINCODE = /^[1-9][0-9]{5}$/;

/** Ten digits, however the customer wrote them. */
export const normalisePhone = (raw: string): string => raw.replace(/\D/g, '').slice(-10);

export type AddressCheck =
  | { ok: true; value: Required<Pick<AddressInput, 'label' | 'line1' | 'area' | 'city' | 'pincode'>>
      & Pick<AddressInput, 'line2' | 'contactName' | 'contactPhone'>
      & { isDefault: boolean } }
  | { ok: false; reason: AddressFault };

/**
 * Is this a place a van can be sent to?
 *
 * Trimmed and bounded here rather than at the edge, so the same answer is
 * given whether the address arrives from the booking sheet, the settings
 * screen, or anything added later.
 */
export function checkAddress(input: AddressInput): AddressCheck {
  const t = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

  const label = t(input.label);
  const line1 = t(input.line1);
  const line2 = t(input.line2);
  const area = t(input.area);
  const city = t(input.city);
  const pincode = t(input.pincode);
  const contactName = t(input.contactName);
  const phoneRaw = t(input.contactPhone);

  if (!label) return { ok: false, reason: 'label-required' };
  if (!line1) return { ok: false, reason: 'line1-required' };
  if (!area) return { ok: false, reason: 'area-required' };
  if (!city) return { ok: false, reason: 'city-required' };
  if (!PINCODE.test(pincode)) return { ok: false, reason: 'pincode-invalid' };

  if (label.length > LIMITS.label || line1.length > LIMITS.line1
      || line2.length > LIMITS.line2 || area.length > LIMITS.area
      || city.length > LIMITS.city || contactName.length > LIMITS.contactName) {
    return { ok: false, reason: 'too-long' };
  }

  /* A contact number is optional, but a WRONG one is worse than none: the
     driver rings a stranger while a customer waits. */
  const contactPhone = phoneRaw ? normalisePhone(phoneRaw) : '';
  if (phoneRaw && contactPhone.length !== 10) return { ok: false, reason: 'phone-invalid' };

  return {
    ok: true,
    value: {
      label, line1, area, city, pincode,
      ...(line2 ? { line2 } : {}),
      ...(contactName ? { contactName } : {}),
      ...(contactPhone ? { contactPhone } : {}),
      isDefault: input.isDefault === true,
    },
  };
}

/** "Bodakdev · Home" - the chip on screen 08. */
export const shortAddress = (a: { label: string; area: string }): string =>
  `${a.area} · ${a.label}`;

/**
 * The whole address on one line, for the snapshot a booking carries and for
 * the message the studio sends its driver.
 *
 * Built from the parts rather than stored twice, so a corrected pincode
 * cannot leave a stale sentence behind it.
 */
export const fullAddress = (a: {
  line1: string; line2?: string; area: string; city: string; pincode: string;
}): string => [a.line1, a.line2, a.area, `${a.city} ${a.pincode}`]
  .filter(Boolean).join(', ');

/**
 * WHEN THE VAN LEAVES.
 *
 * Design screen 08 states a pickup time under the chosen slot ("8:40 AM" for a
 * 9:00 slot). It is DERIVED, never chosen: a customer who could pick a
 * collection time independently of their slot could ask to be collected after
 * the work was due to start.
 *
 * Twenty minutes covers the drive across Ahmedabad's inner ring at the hours
 * the studio opens. Below the studio's own opening it is clamped, because a van
 * cannot leave a locked unit.
 */
export const PICKUP_LEAD_MINUTES = 20;

export function pickupTimeFor(slot: string, openMinutes: number): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(slot ?? '');
  if (!m) return null;
  const start = Number(m[1]) * 60 + Number(m[2]);
  const leave = Math.max(openMinutes, start - PICKUP_LEAD_MINUTES);
  return `${String(Math.floor(leave / 60)).padStart(2, '0')}:${String(leave % 60).padStart(2, '0')}`;
}
