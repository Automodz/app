/**
 * WHAT IS ACTUALLY OWED — design screen 13.
 *
 * ── WHY THIS IS AN ENGINE AND NOT A SUBTRACTION AT THE CALL SITE ─────────
 * Three documents carry a figure for one visit: the job (what the counter
 * rang up), the booking (what was agreed), and the invoice (what was billed).
 * The audit found them unreconcilable — one invoice in the whole business,
 * carrying no `visitId`, while the album totalled sealed amounts and the visit
 * screen preferred the receipt, and the two disagreed by ₹11,990.
 *
 * A payment must not be a fourth opinion. This decides the payable figure
 * once, from a stated order of authority, and says which source it came from
 * so a customer can be told.
 *
 * ── THE ORDER, AND WHY ───────────────────────────────────────────────────
 *   1. THE INVOICE, where one exists. It is the document the customer holds
 *      and the only figure with paper behind it.
 *   2. THE JOB. The operational record, and the one that moved when a mid-visit
 *      approval was granted.
 *   3. THE BOOKING. What was agreed before the car arrived — correct until the
 *      studio touches it, and the honest answer when nothing else exists.
 *
 * Pure: no Firestore, no clock it is not given, no routes.
 */
import type { PaymentStatus } from '@/lib/types';

export interface MoneyOnRecord {
  /** In rupees, or absent when that record does not exist. */
  invoiceTotal?: number;
  jobTotal?: number;
  bookingTotal?: number;
  /** What the studio has already received against this visit. */
  received?: number;
}

export interface Settlement {
  /** What the customer owes RIGHT NOW. Never negative. */
  payable: number;
  /** The full figure, before anything received. */
  total: number;
  received: number;
  source: 'invoice' | 'job' | 'booking' | 'none';
  /** True when nothing is left to pay. */
  settled: boolean;
}

export function settlementOf(m: MoneyOnRecord): Settlement {
  const pick = (): { total: number; source: Settlement['source'] } => {
    if (typeof m.invoiceTotal === 'number') return { total: m.invoiceTotal, source: 'invoice' };
    if (typeof m.jobTotal === 'number') return { total: m.jobTotal, source: 'job' };
    if (typeof m.bookingTotal === 'number') return { total: m.bookingTotal, source: 'booking' };
    return { total: 0, source: 'none' };
  };

  const { total, source } = pick();
  const received = Math.max(0, m.received ?? 0);
  /* Never negative. An overpayment is the studio's to refund, and showing a
     customer "−₹200 to pay" would be the product inventing a credit. */
  const payable = Math.max(0, total - received);

  return {
    payable,
    total,
    received,
    source,
    /* A zero-value visit is settled — a covered membership wash owes nothing
       and must not sit for ever on a "pay" screen. */
    settled: payable === 0,
  };
}

/**
 * The customer's word for where a payment stands.
 *
 * `submitted` is deliberately not "paid". The customer has told the studio
 * they have paid; the studio has not yet seen it. Saying "paid" here would be
 * the product confirming something only a bank can confirm — and the car is
 * not released on it.
 */
export const PAYMENT_WORD: Record<PaymentStatus, string> = {
  unpaid: 'To settle',
  initiated: 'Waiting for your bank',
  submitted: 'With the studio to confirm',
  paid: 'Settled',
  failed: 'That did not go through',
  expired: 'That link has run out',
};

export const PAYMENT_LINE: Record<PaymentStatus, string> = {
  unpaid: 'Settle it here, or at the counter — whichever suits.',
  initiated: 'Finish it in your UPI app, then tell us the reference.',
  submitted: 'We are checking with the bank. Nothing more for you to do.',
  paid: 'Thank you. Nothing outstanding.',
  failed: 'Nothing was taken. Try again, or settle at the counter.',
  expired: 'Start it again and we will make a fresh link.',
};

/**
 * MAY THIS VISIT BE RATED?
 *
 * Only a finished one, only by its owner, and only once. The first is not
 * politeness: rating a visit that is still running rates a thing that has not
 * happened, and the studio would be reading it as if it had.
 */
export type RatingRefusal = 'not-sealed' | 'not-yours' | 'already-rated' | 'out-of-range';

export function canRate(args: {
  visit: { id: string; status: string; vehicleId: string } | null | undefined;
  ownsVehicle: boolean;
  alreadyRated: boolean;
  rating: number;
}): { ok: true } | { ok: false; reason: RatingRefusal } {
  if (!args.visit || args.visit.status !== 'sealed') return { ok: false, reason: 'not-sealed' };
  if (!args.ownsVehicle) return { ok: false, reason: 'not-yours' };
  if (args.alreadyRated) return { ok: false, reason: 'already-rated' };
  if (!Number.isInteger(args.rating) || args.rating < 1 || args.rating > 5) {
    return { ok: false, reason: 'out-of-range' };
  }
  return { ok: true };
}
