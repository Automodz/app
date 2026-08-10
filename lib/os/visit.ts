import type { Booking, BookingStatus, JobStatus } from '@/lib/types';

/**
 * The visit's five customer-facing acts (Constitution Art. 6) and the hard
 * translation boundary: ops vocabulary never renders under the customer tree.
 */
export type CareAct = 'received' | 'looked_over' | 'in_care' | 'final_checks' | 'ready';

export type VisitPhase =
  | 'proposed'
  | 'agreed'
  | 'live'      // one of the five acts - see careAct()
  | 'archived'
  | 'cancelled';

const LIVE: BookingStatus[] = [
  'vehicle_received', 'in_progress', 'quality_check', 'ready_for_delivery',
];

export function visitPhase(status: BookingStatus): VisitPhase {
  if (status === 'pending') return 'proposed';
  if (status === 'confirmed') return 'agreed';
  if (LIVE.includes(status)) return 'live';
  if (status === 'completed') return 'archived';
  return 'cancelled';
}

/** Ops status → customer act. Only meaningful while visitPhase() === 'live'. */
export function careAct(status: BookingStatus): CareAct | null {
  switch (status) {
    case 'vehicle_received':    return 'received';
    case 'in_progress':         return 'in_care';
    case 'quality_check':       return 'final_checks';
    case 'ready_for_delivery':  return 'ready';
    default:                    return null;
  }
}

export const ACT_ORDER: CareAct[] = ['received', 'looked_over', 'in_care', 'final_checks', 'ready'];

/** Act titles - Display copy (product design C1). */
export const ACT_TITLE: Record<CareAct, string> = {
  received:     'Received',
  looked_over:  'Looked over',
  in_care:      'In care',
  final_checks: 'Final checks',
  ready:        'Ready',
};

export function actIndex(act: CareAct): number {
  return ACT_ORDER.indexOf(act);
}

export function isLive(b: Pick<Booking, 'status'>): boolean {
  return visitPhase(b.status) === 'live';
}

/** Act narration - the one sentence per act (voice law, Art. 8/13). */
export const ACT_LINE: Record<CareAct, string> = {
  received:     'Your vehicle has arrived safely.',
  looked_over:  'A careful look before any work begins.',
  in_care:      'Our team is caring for your vehicle.',
  final_checks: 'Final checks before it comes home.',
  ready:        'Ready for collection.',
};

/** Phase copy for visits outside the five acts. */
export const PHASE_TITLE: Record<Exclude<VisitPhase, 'live'>, string> = {
  proposed:  'Requested',
  agreed:    'Reserved',
  archived:  'Home',
  cancelled: 'Cancelled',
};

export const PHASE_LINE: Record<Exclude<VisitPhase, 'live'>, string> = {
  proposed:  'The studio is confirming your visit.',
  agreed:    'A bay is reserved. See you soon.',
  archived:  'Delivered. Thank you for trusting us.',
  cancelled: 'This visit was cancelled.',
};

/** Ops JOB status → customer act. Jobs use `checked_in` where bookings use
 *  `vehicle_received`; this keeps the boundary airtight for both records. */
export function actFromJobStatus(status: JobStatus): CareAct | null {
  switch (status) {
    case 'checked_in':          return 'received';
    case 'in_progress':         return 'in_care';
    case 'quality_check':       return 'final_checks';
    case 'ready_for_delivery':  return 'ready';
    default:                    return null;
  }
}

/* ── WHEN THE WORK HAPPENED ─────────────────────────────────────────────── */

/**
 * THE CANONICAL EVENT DATE OF A SEALED VISIT.
 *
 * Every customer surface dated a visit with `longDate(isoOf(visit.createdAt))`
 * — the moment the DOCUMENT was written. When the backfill sealed two historic
 * jobs on 2026-08-10, the Garage record dated work done on 16 and 22 July as
 * "10 August 2026". The customer's own history was rewritten by an operation
 * they never saw.
 *
 * This is the same defect class as dating a warranty from `updatedAt`: a fact
 * about the record presented as a fact about the car. One definition now, used
 * by every screen, so the answer cannot differ between them.
 *
 * ── THE ORDER, AND WHY STAGES OUTRANK THE BOOKED DAY ────────────────────
 * 1. `servicedOn` — snapshotted at seal. The authoritative answer for anything
 *    sealed from now on; the same value the protection's `since` is taken from,
 *    so a visit and the promise it created can never disagree about their day.
 * 2. THE LAST STAGE TIMESTAMP — when the work was recorded as finishing. This
 *    outranks the booked day deliberately: `requestedFor` is an INTENTION and
 *    the studio does not always work on the day booked. Production proves it —
 *    the Kia was booked for 20 July and completed on the 16th, the BMW booked
 *    for the 27th and completed on the 22nd. Dating either by the booking would
 *    contradict its own protection's `since`.
 * 3. `requestedFor.date` — the booked day, when no stage was ever recorded.
 * 4. `createdAt` — the last resort, and the only case where the record's own
 *    date is allowed to stand in for the car's.
 *
 * Returns an ISO date (YYYY-MM-DD).
 */
export function visitDateOf(visit: {
  servicedOn?: string;
  stages?: { at?: { toDate?: () => Date } }[];
  requestedFor?: { date: string };
  createdAt?: { toDate?: () => Date };
}): string {
  if (visit.servicedOn) return visit.servicedOn;

  const iso = (t?: { toDate?: () => Date }) => {
    const d = t?.toDate?.();
    return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null;
  };

  /* The LAST stage — a visit ends when its final act does. Sorted rather than
     assumed, because `stages` is append-ordered by the writer, not by time. */
  const stamps = (visit.stages ?? []).map(s => iso(s.at)).filter((d): d is string => !!d).sort();
  if (stamps.length) return stamps[stamps.length - 1];

  if (visit.requestedFor?.date) return visit.requestedFor.date;
  return iso(visit.createdAt) ?? '';
}
