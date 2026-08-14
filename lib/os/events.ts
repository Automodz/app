/**
 * WHAT THE STUDIO TELLS A CUSTOMER, AS EVENTS.
 *
 * Source: docs/AUTOMODZ-OS.md §17.1, §17.3 · design screen 19 ("Quiet mode -
 * only approvals and handover reach you")
 *
 * ── THIS IS NOT AN INBOX ─────────────────────────────────────────────────
 * §17.1 removed the notification list on purpose, and nothing here brings it
 * back. An event is a FACT that happened to a car, written down so that:
 *
 *   · the surface that owns that fact can show it as state (`noticeOf`), and
 *   · delivery - push, WhatsApp - has something to be derived from.
 *
 * A customer never reads this collection as a list. They read their car.
 *
 * ── IDENTITY IS DERIVED, WHICH IS WHAT MAKES IT IDEMPOTENT ───────────────
 * An event's id is `type + source`, so "this booking was confirmed" is ONE
 * document however many times the confirming code runs - a retried serverless
 * invocation, a double-tapped admin control, a replayed webhook. Nothing
 * de-duplicates afterwards because nothing can duplicate in the first place.
 *
 * ── QUIET MODE SUPPRESSES DELIVERY, NEVER THE RECORD ─────────────────────
 * The event is always written. What quiet mode decides is whether the phone
 * lights up. A quiet mode that dropped the event would erase the customer's
 * own history of what happened to their car, and would mean turning it off
 * left them with a gap they could never recover.
 */

export type StudioEventType =
  | 'booking_confirmed'
  | 'booking_rescheduled'
  | 'booking_cancelled'
  | 'booking_expired'
  | 'approval_requested'
  | 'approval_approved'
  | 'approval_declined'
  | 'vehicle_ready'
  | 'payment_required'
  | 'payment_settled'
  | 'visit_completed';

/** What an event is ABOUT. The surface that owns this object shows it. */
export type EventSourceKind = 'booking' | 'visit' | 'approval' | 'payment' | 'job';

export interface EventSource {
  kind: EventSourceKind;
  id: string;
}

export interface StudioEventInput {
  type: StudioEventType;
  /** The customer it is for. An event with no owner is not writable. */
  customerId: string;
  source: EventSource;
  /** The car it concerns, when it concerns one. */
  vehicleId?: string;
  /** Values the wording needs. Never a technician, never a price on a lock screen. */
  subject?: string;
  detail?: string;
}

/**
 * THE DOCUMENT ID, DERIVED.
 *
 * `booking_confirmed_abc123`. Two things follow from this and both matter:
 * writing it twice produces one document, and a reader can ask "has this
 * already been announced" without a query.
 *
 * A booking can be rescheduled more than once, so that one type carries a
 * discriminator - otherwise the second move would silently collapse onto the
 * first and the customer would never be told about it.
 */
export function eventId(e: StudioEventInput, discriminator?: string): string {
  const base = `${e.type}_${e.source.kind}_${e.source.id}`;
  return discriminator ? `${base}_${discriminator.replace(/[^A-Za-z0-9_-]/g, '')}` : base;
}

/**
 * WHAT BREAKS THROUGH QUIET MODE - design screen 19, verbatim: "Only approvals
 * and handover reach you."
 *
 * Both are moments where SILENCE COSTS THE CUSTOMER something. An unanswered
 * approval holds a car on a bay; an unheard handover leaves a finished car in
 * the studio overnight; an unpaid handover is the same car, not released. That
 * is the whole test - not importance, but whether the customer loses by not
 * hearing it.
 *
 * Everything else - a confirmation, a completion, a settled payment - is news
 * the customer can find when they next look, so quiet mode holds it.
 */
export const BREAKS_QUIET: readonly StudioEventType[] = [
  'approval_requested',
  'vehicle_ready',
  'payment_required',
];

/** May this event be pushed to the customer's device right now? */
export const deliverable = (type: StudioEventType, quietMode: boolean | undefined): boolean =>
  !quietMode || BREAKS_QUIET.includes(type);

/**
 * The coarse category the existing `notifications` documents carry.
 *
 * Kept so that every reader written before events existed - the service
 * worker, `notificationHref`, the admin surfaces - keeps working unchanged.
 * The precise `event` field sits alongside it; this is the bucket, not the
 * meaning.
 */
export const CATEGORY_OF: Record<StudioEventType, 'booking_update' | 'reminder' | 'membership'> = {
  booking_confirmed:   'booking_update',
  booking_rescheduled: 'booking_update',
  booking_cancelled:   'booking_update',
  booking_expired:     'booking_update',
  approval_requested:  'booking_update',
  approval_approved:   'booking_update',
  approval_declined:   'booking_update',
  vehicle_ready:       'booking_update',
  payment_required:    'booking_update',
  payment_settled:     'booking_update',
  visit_completed:     'booking_update',
};

/**
 * THE WORDS.
 *
 * In the studio's voice and never signed - §2.2 forbids naming an individual
 * on a customer surface, and a notification is the surface most likely to be
 * read on a lock screen by whoever is holding the phone. For the same reason
 * no figure appears in a title: a price on a lock screen is a price shown to
 * the room.
 */
export function wordsFor(e: StudioEventInput): { title: string; body: string } {
  const subject = e.subject?.trim() || 'your car';
  const detail = e.detail?.trim();

  switch (e.type) {
    case 'booking_confirmed':
      return {
        title: 'The bay is yours',
        body: detail ? `${subject} - ${detail}.` : `${subject} is confirmed.`,
      };
    case 'booking_rescheduled':
      return {
        title: 'Your visit has moved',
        body: detail ? `${subject} - now ${detail}.` : `${subject} has a new time.`,
      };
    case 'booking_cancelled':
      return {
        title: 'Visit cancelled',
        body: detail ? `${subject} - ${detail}.` : `${subject} is no longer booked.`,
      };
    case 'booking_expired':
      return {
        title: 'That day passed',
        body: `We did not confirm ${subject} in time. Arrange another and we will.`,
      };
    case 'approval_requested':
      return {
        title: 'We found something',
        body: detail ? `${subject} - ${detail}. It needs your word before we go on.`
          : `${subject} needs your word before we go on.`,
      };
    case 'approval_approved':
      return { title: 'Approved', body: `We are going ahead with ${subject}.` };
    case 'approval_declined':
      return { title: 'Left as planned', body: `${subject} continues as booked.` };
    case 'vehicle_ready':
      return {
        title: 'Ready for you',
        body: detail ? `${subject} is finished - ${detail}.` : `${subject} is finished.`,
      };
    case 'payment_required':
      return { title: 'Ready to settle', body: `${subject} is done and waiting for you.` };
    case 'payment_settled':
      return { title: 'Settled', body: `Thank you - ${subject} is paid in full.` };
    case 'visit_completed':
      return { title: 'Back with you', body: `${subject} is home. Its record is updated.` };
  }
}
