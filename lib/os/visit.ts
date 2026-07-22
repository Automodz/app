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
