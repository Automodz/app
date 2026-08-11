/**
 * UPI — the payment mechanism, and the only one.
 *
 * Design screen 13: "Pay ₹43,622" over "UPI · aarav@okhdfc". There is no
 * payment gateway in this product and none is being added: the studio is paid
 * by UPI at handover, and what the application does is open the customer's own
 * UPI application with the studio's figure already in it.
 *
 * ── THE AMOUNT IS NEVER THE CUSTOMER'S ───────────────────────────────────
 * `buildUpiIntent` takes an amount and does not validate it, because it is not
 * this function's job to decide what is owed — it is the caller's, and the only
 * caller is the server, which reads the sealed visit. Nothing on the client may
 * reach this with a figure of its own. That rule is enforced at the route.
 *
 * ── AND THE LINK IS NOT A RECEIPT ────────────────────────────────────────
 * Opening a UPI intent proves nothing. The studio marks a visit settled when it
 * has SEEN the money; a customer returning from their bank application has
 * made a claim, and `lib/os/lifecycle` models that as `submitted`, which is a
 * different state from `paid` and releases nothing.
 *
 * Pure: no Firestore, no routes, no clock.
 */

/**
 * A virtual payment address — `name@bank`.
 *
 * Deliberately permissive on the handle and strict on the shape. UPI handles
 * differ between banks and a regex that tried to enumerate them would reject a
 * real address the day a bank added one; what can be checked honestly is that
 * there is exactly one `@`, that both sides are non-empty, and that the
 * characters are ones NPCI actually permits.
 */
const VPA = /^[A-Za-z0-9.\-_]{2,64}@[A-Za-z][A-Za-z0-9.\-_]{1,63}$/;

export const isVpa = (raw: string): boolean => VPA.test((raw ?? '').trim());

/** Stored lower-cased, because `Aarav@OKHDFC` and `aarav@okhdfc` are one address. */
export const normaliseVpa = (raw: string): string => (raw ?? '').trim().toLowerCase();

/**
 * "aa••••@okhdfc" — enough to recognise, not enough to reuse.
 *
 * Shown wherever the address is confirmed back to the customer. It is never
 * published and never leaves the owner's own surfaces, but a payment address
 * on a screen is a payment address in a photograph of that screen.
 */
export function maskVpa(vpa: string): string {
  const [handle = '', bank = ''] = (vpa ?? '').split('@');
  if (!handle || !bank) return '';
  const head = handle.slice(0, 2);
  return `${head}${'•'.repeat(Math.max(2, handle.length - 2))}@${bank}`;
}

export interface UpiIntent {
  /** The studio's collecting address. */
  payeeVpa: string;
  payeeName: string;
  /** In rupees. The SERVER's figure, always. */
  amount: number;
  /** What the studio will see against the credit. */
  note: string;
  /** Ties the payment back to the visit it settles. */
  reference: string;
}

/**
 * The `upi://pay` link.
 *
 * Two digits of paise, because a bank application shown `1234` and a bank
 * application shown `1234.00` have been known to interpret the first as
 * something other than rupees. `tn` and `tr` are bounded and stripped of the
 * characters that would end the query string early.
 */
export function buildUpiIntent(i: UpiIntent): string {
  const clean = (s: string, max: number) =>
    (s ?? '').replace(/[^A-Za-z0-9 .\-_]/g, '').trim().slice(0, max);

  const params = new URLSearchParams({
    pa: i.payeeVpa,
    pn: clean(i.payeeName, 40),
    am: i.amount.toFixed(2),
    cu: 'INR',
    tn: clean(i.note, 50),
    tr: clean(i.reference, 35),
  });
  return `upi://pay?${params.toString()}`;
}

/**
 * A transaction reference, as the customer reads it off their bank.
 *
 * Twelve digits is what UPI issues. Checked so a customer who types their
 * phone number or a date is told before the studio is left reconciling it.
 */
export const isUpiReference = (raw: string): boolean =>
  /^[A-Za-z0-9]{6,35}$/.test((raw ?? '').trim());
