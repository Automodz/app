/**
 * THE STATE MACHINES - every legal transition in the product, in one place.
 *
 * Source: docs/DESIGN-PARITY-AUDIT.md §PHASE 4, §PHASE 9
 *
 * ── WHY ONE FILE ─────────────────────────────────────────────────────────
 * Before this, "what may follow what" was spread across three places that did
 * not agree: `firestore.rules` allowed a customer to move a booking from
 * `pending` or `confirmed`, `cancelBookingAuthoritative` carried its own
 * `CANCELLABLE` array, and `ManageVisit` decided for itself whether to show the
 * controls. Three copies of one rule is three chances to disagree, and the UI
 * copy is the one a fetch walks straight past.
 *
 * Every machine here is a pure table plus a guard. The server calls the guard;
 * the projection calls the same guard to decide what to OFFER, so a control is
 * never shown for an act the server will refuse (§10.5 - nothing is inert).
 *
 * ── THE BOOKING MODEL IS NOT REPLACED ────────────────────────────────────
 * A second booking-status vocabulary would be the very drift this file exists
 * to end, so `BookingStatus` in lib/types.ts stays authoritative and is
 * EXTENDED by exactly one value - `expired` - which the audit found missing
 * (three bookings sat `pending` 13–17 days past their date with no terminal
 * state to age into).
 *
 * The conceptual lifecycle named in the brief maps onto the objects that
 * already own each fact, rather than onto one flattened enum:
 *
 *   draft / quoted        → `estimates`  (lib/os/scope.ts) - before a booking
 *                                          exists there is nothing to book
 *   scheduled             → booking `pending`   (asked for, studio not yet in)
 *   confirmed             → booking `confirmed`
 *   in_progress           → booking `in_progress` / job `in_progress`
 *   awaiting_approval     → `approvals` (this file) - a condition ON a visit,
 *                                          not a state the booking replaces
 *   ready                 → booking `ready_for_delivery`
 *   payment_pending/paid  → `payments` (this file) - money is its own axis, so
 *                                          a paid-but-not-collected car and a
 *                                          collected-but-unpaid one are both
 *                                          representable, and both happen
 *   completed / cancelled → booking `completed` / `cancelled`
 *
 * Three axes, three machines, no state that can only be reached by lying.
 */
import type { BookingStatus, JobStatus, MembershipStatus, VisitStatus } from '@/lib/types';

/* ── WHO IS ASKING ───────────────────────────────────────────────────────── */

/**
 * Every transition is attributed. `system` is the scheduled job that ages a
 * stale record out - it is named rather than being allowed to borrow the
 * studio's authority, so an automated expiry can never be mistaken in an audit
 * for a person having decided something.
 */
export type Actor = 'customer' | 'studio' | 'system';

export interface TransitionVerdict {
  ok: boolean;
  /** Machine-readable, and the same string the API returns. */
  reason?: string;
}

const YES: TransitionVerdict = { ok: true };
const no = (reason: string): TransitionVerdict => ({ ok: false, reason });

/* ── BOOKING ─────────────────────────────────────────────────────────────── */

/**
 * The terminal state a stale request ages into.
 *
 * NOT `cancelled`. A cancellation is somebody's decision and returns the
 * membership wash and the promo that the booking spent; an expiry is the
 * absence of a decision. Collapsing them would credit a wash back for a slot
 * the studio held and nobody attended, and would tell the customer their
 * booking "was cancelled" when in truth it was never answered.
 */
export const BOOKING_EXPIRED = 'expired' as const;

/**
 * The booking vocabulary, named once so callers read intent rather than a bare
 * type alias. Identical to `BookingStatus` - deliberately, because a second
 * vocabulary is the drift this file exists to end.
 */
export type BookingState = BookingStatus;

export const BOOKING_TERMINAL: readonly BookingState[] = [
  'completed', 'cancelled', BOOKING_EXPIRED,
];

/**
 * What may follow what. Read as: from → the states it may become.
 *
 * The operational middle (`vehicle_received` → `in_progress` → `quality_check`
 * → `ready_for_delivery`) mirrors the kiosk's own job ladder, because the
 * booking is the commercial twin of the job and the two may not disagree about
 * where the car is.
 */
export const BOOKING_TRANSITIONS: Record<BookingState, readonly BookingState[]> = {
  pending:            ['confirmed', 'cancelled', BOOKING_EXPIRED],
  confirmed:          ['vehicle_received', 'in_progress', 'cancelled', BOOKING_EXPIRED],
  vehicle_received:   ['in_progress', 'cancelled'],
  in_progress:        ['quality_check', 'ready_for_delivery', 'cancelled'],
  quality_check:      ['in_progress', 'ready_for_delivery', 'cancelled'],
  ready_for_delivery: ['completed', 'cancelled'],
  completed:          [],
  cancelled:          [],
  [BOOKING_EXPIRED]:  [],
};

/**
 * Who may cause each transition.
 *
 * A customer may only ever WITHDRAW. Every advance - accepting the request,
 * receiving the car, calling it ready, closing it - belongs to the studio,
 * because each one asserts something about the physical world that only
 * somebody standing in the studio can know.
 */
const BOOKING_ACTORS: Record<BookingState, readonly Actor[]> = {
  pending:            ['studio'],
  confirmed:          ['studio'],
  vehicle_received:   ['studio'],
  in_progress:        ['studio'],
  quality_check:      ['studio'],
  ready_for_delivery: ['studio'],
  completed:          ['studio'],
  cancelled:          ['customer', 'studio'],
  [BOOKING_EXPIRED]:  ['system'],
};

/** Statuses a customer may still withdraw from themselves. */
export const CUSTOMER_CANCELLABLE: readonly BookingState[] = ['pending', 'confirmed'];

export function bookingTransition(
  from: BookingState, to: BookingState, actor: Actor,
): TransitionVerdict {
  /* TERMINAL IS CHECKED FIRST, and the order is not cosmetic: a second
     cancel of a cancelled booking must be told `already-cancelled`, which is
     the fact, rather than `no-change`, which reads as "nothing happened" and
     leaves a caller unable to distinguish a replay from a mistake. */
  if (BOOKING_TERMINAL.includes(from)) return no(`already-${from}`);
  if (from === to) return no('no-change');
  if (!BOOKING_TRANSITIONS[from]?.includes(to)) return no('illegal-transition');
  if (!BOOKING_ACTORS[to].includes(actor)) return no('not-yours-to-make');
  /* The studio may refuse work already under way; a customer may not withdraw
     a car that is on a bay. Stated here rather than only in the actor table
     because the SAME target state (`cancelled`) is legal for both actors and
     they are bounded differently. */
  if (to === 'cancelled' && actor === 'customer' && !CUSTOMER_CANCELLABLE.includes(from)) {
    return no('too-late');
  }
  return YES;
}

/* ── THE 24-HOUR RULE ────────────────────────────────────────────────────── */

/**
 * The studio keeps studio time. Ahmedabad is UTC+05:30 and does not observe
 * daylight saving, so this is a constant rather than a lookup.
 *
 * IT MATTERS THAT THIS IS EXPLICIT. `scheduledDate` and `scheduledTime` are
 * wall-clock strings written by someone standing in the studio. Parsing them
 * with `new Date('2026-08-12T09:00:00')` reads them in the SERVER's zone -
 * UTC on Vercel - which would place a 09:00 appointment five and a half hours
 * early and hand a customer a free change five and a half hours after the rule
 * should have closed.
 */
export const STUDIO_UTC_OFFSET_MIN = 330;

/** Milliseconds since the epoch for a studio-local date and time. */
export function scheduledEpochMs(date: string, time?: string): number | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? '');
  if (!d) return null;
  const t = /^(\d{1,2}):(\d{2})$/.exec(time ?? '');
  /* A booking with no hour is a real record - the walk-in flow writes one - and
     the studio opens at 09:00, so that is when the day's obligation starts. */
  const hours = t ? Number(t[1]) : 9;
  const minutes = t ? Number(t[2]) : 0;
  if (hours > 23 || minutes > 59) return null;
  return Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), hours, minutes)
    - STUDIO_UTC_OFFSET_MIN * 60_000;
}

/** "FREE until 24 hours before" - design screen 10. */
export const CHANGE_WINDOW_HOURS = 24;
const CHANGE_WINDOW_MS = CHANGE_WINDOW_HOURS * 60 * 60 * 1000;

export type ChangeRefusal =
  | 'not-found'
  | 'already-cancelled'
  | 'already-expired'
  | 'already-completed'
  | 'work-started'
  | 'inside-window'
  | 'unschedulable';

export type ChangeVerdict =
  | { allowed: true; msUntil: number }
  | { allowed: false; reason: ChangeRefusal; msUntil: number | null };

/**
 * May this booking still be moved, free, right now?
 *
 * THE BOUNDARY IS STRICT. A change is free while there is MORE than 24 hours
 * left; at exactly 24:00:00 the window has closed. The alternative - allowing
 * it at exactly 24 hours - puts the studio one millisecond of clock skew away
 * from having to honour a change it has already begun preparing for. A rule
 * about a bay being held has to fall on the side of the bay.
 *
 * `now` is injected so the decision is testable and never clock-dependent, and
 * the SERVER passes its own clock. A browser's `Date.now()` never reaches here.
 */
export function changeWindowOf(
  booking: { status: BookingState; scheduledDate: string; scheduledTime?: string },
  now: Date | number = new Date(),
): ChangeVerdict {
  const at = scheduledEpochMs(booking.scheduledDate, booking.scheduledTime);
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const msUntil = at === null ? null : at - nowMs;

  if (booking.status === 'cancelled') return { allowed: false, reason: 'already-cancelled', msUntil };
  if (booking.status === BOOKING_EXPIRED) return { allowed: false, reason: 'already-expired', msUntil };
  if (booking.status === 'completed') return { allowed: false, reason: 'already-completed', msUntil };
  if (!CUSTOMER_CANCELLABLE.includes(booking.status)) {
    return { allowed: false, reason: 'work-started', msUntil };
  }
  if (at === null) return { allowed: false, reason: 'unschedulable', msUntil: null };
  if (msUntil! <= CHANGE_WINDOW_MS) return { allowed: false, reason: 'inside-window', msUntil };
  return { allowed: true, msUntil: msUntil! };
}

/**
 * How long a request may go unanswered before it ages out.
 *
 * Measured from the SLOT, not from when it was made: a request for a date three
 * weeks out is not stale on its third day. It is stale once the day it asked
 * for has gone.
 */
export const STALE_AFTER_DAYS = 1;

export function isStaleRequest(
  booking: { status: BookingState; scheduledDate: string; scheduledTime?: string },
  now: Date | number = new Date(),
): boolean {
  if (booking.status !== 'pending' && booking.status !== 'confirmed') return false;
  const at = scheduledEpochMs(booking.scheduledDate, booking.scheduledTime);
  if (at === null) return false;
  const nowMs = typeof now === 'number' ? now : now.getTime();
  return nowMs - at > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

/* ── APPROVAL (design screen 12) ─────────────────────────────────────────── */

export type ApprovalStatus = 'requested' | 'approved' | 'declined' | 'expired' | 'cancelled';

export const APPROVAL_TERMINAL: readonly ApprovalStatus[] = [
  'approved', 'declined', 'expired', 'cancelled',
];

export const APPROVAL_TRANSITIONS: Record<ApprovalStatus, readonly ApprovalStatus[]> = {
  requested: ['approved', 'declined', 'expired', 'cancelled'],
  approved:  [],
  declined:  [],
  expired:   [],
  cancelled: [],
};

/**
 * THE WHOLE POINT OF THIS TABLE: the studio cannot answer for the customer.
 *
 * A request for more money and more time is binding, so only the person paying
 * may say yes or no. The studio may WITHDRAW its own request (`cancelled`) -
 * the film turned out to be fine after all - and the clock may retire one
 * nobody answered, but neither may produce an approval.
 */
const APPROVAL_ACTORS: Record<ApprovalStatus, readonly Actor[]> = {
  requested: ['studio'],
  approved:  ['customer'],
  declined:  ['customer'],
  expired:   ['system'],
  cancelled: ['studio'],
};

export function approvalTransition(
  from: ApprovalStatus, to: ApprovalStatus, actor: Actor,
): TransitionVerdict {
  /* Terminal first - a second approval must be refused as `already-approved`,
     which is what makes a double tap distinguishable from a replay. */
  if (APPROVAL_TERMINAL.includes(from)) return no(`already-${from}`);
  if (from === to) return no('no-change');
  if (!APPROVAL_TRANSITIONS[from]?.includes(to)) return no('illegal-transition');
  if (!APPROVAL_ACTORS[to].includes(actor)) return no('not-yours-to-make');
  return YES;
}

/**
 * How long a request stands before it retires itself.
 *
 * A car on a bay cannot wait indefinitely for an answer, and an approval that
 * never expires is one the studio may act on days later when the customer has
 * long forgotten agreeing. Same working day, and the studio closes at 19:00.
 */
export const APPROVAL_VALID_HOURS = 8;

export function approvalHasExpired(
  approval: { status: ApprovalStatus; requestedAtMs: number },
  now: Date | number = new Date(),
): boolean {
  if (approval.status !== 'requested') return false;
  const nowMs = typeof now === 'number' ? now : now.getTime();
  return nowMs - approval.requestedAtMs > APPROVAL_VALID_HOURS * 60 * 60 * 1000;
}

/* ── MEMBERSHIP (the Club) ───────────────────────────────────────────────── */

/**
 * A CUSTOMER MAY NEVER WRITE `active`.
 *
 * It is the third of the three writes in this file that a browser must never
 * reach - `paid` releases a car, `verified` grants a protection, and `active`
 * grants a standing entitlement: free washes and a discount on every visit,
 * against money the studio may never have received.
 *
 * `firestore.rules` used to let a customer CREATE their own subscription so
 * long as it said `status: 'pending'`. Rules can check that word. They cannot
 * check that `plan` is a real plan, that `endDate` is thirty days away rather
 * than in 2099, that `washesTotal` is what the plan grants rather than 999, or
 * that the customer does not already hold one. Every one of those was a field
 * the browser wrote, and the studio's activation screen then honoured them -
 * so the honest description of the old flow is that a customer could write
 * their own membership terms and ask the studio to rubber-stamp them.
 *
 * The whole document is server-derived now (`lib/server/membershipService.ts`)
 * and this table is what may follow what.
 */
export type MembershipState = MembershipStatus;

export const MEMBERSHIP_TERMINAL: readonly MembershipState[] = [
  'expired', 'cancelled', 'rejected',
];

/**
 * Note what does NOT lead back to `active`.
 *
 * An expired membership is not revived - rejoining creates a NEW subscription,
 * so the cycle that ended keeps its own dates, its own `paidAt` and its own
 * `amountPaid` for ever. That is the same reason a renewed pollution
 * certificate gets its own record: revenue and entitlement are history, and
 * history that can be edited is not history.
 */
export const MEMBERSHIP_TRANSITIONS: Record<MembershipState, readonly MembershipState[]> = {
  pending:   ['active', 'rejected', 'cancelled'],
  active:    ['expired', 'cancelled'],
  expired:   [],
  cancelled: [],
  rejected:  [],
};

/**
 * `cancelled` is the customer's - leaving is theirs to decide - and also the
 * studio's, because an upgrade supersedes the membership it replaces and that
 * is the studio's act of activating the new one.
 */
const MEMBERSHIP_ACTORS: Record<MembershipState, readonly Actor[]> = {
  pending:   ['customer', 'studio'],
  active:    ['studio'],
  rejected:  ['studio'],
  expired:   ['system', 'studio'],
  cancelled: ['customer', 'studio'],
};

export function membershipTransition(
  from: MembershipState, to: MembershipState, actor: Actor,
): TransitionVerdict {
  /* Terminal first, so re-activating a cancelled membership is refused as the
     fact - `already-cancelled` - rather than as a shape error. */
  if (MEMBERSHIP_TERMINAL.includes(from)) return no(`already-${from}`);
  if (from === to) return no('no-change');
  if (!MEMBERSHIP_TRANSITIONS[from]?.includes(to)) return no('illegal-transition');
  if (!MEMBERSHIP_ACTORS[to].includes(actor)) return no('not-yours-to-make');
  return YES;
}

/* ── DECLARATION (a paper the owner holds) ───────────────────────────────── */

/**
 * THE CUSTOMER MAY NEVER WRITE `verified`.
 *
 * It is the protection machine's twin of `paid`: the single write that turns
 * something a customer typed into something the product asserts on its own
 * surfaces. `declareProtection()` had no such boundary - the browser wrote the
 * Protection directly and `firestore.rules` could only check that it said
 * `declared`, which is a claim about provenance, not about truth. A customer
 * could have given themselves a pollution certificate valid until 2099.
 *
 * So the two halves are separated and the separation lives here: the customer
 * SUBMITS, the studio DECIDES, and nothing else is legal.
 */
export type DeclarationState =
  | 'submitted' | 'verified' | 'rejected' | 'superseded' | 'withdrawn';

export const DECLARATION_TERMINAL: readonly DeclarationState[] = [
  'rejected', 'superseded', 'withdrawn',
];

/**
 * What may follow what.
 *
 * `verified` is NOT terminal, and that is the whole shape of a renewal: a
 * verified certificate is superseded by the next one the studio verifies,
 * rather than being edited into it. The old record keeps its own dates for
 * ever, so "what was this car certified for in March" stays answerable.
 *
 * Nothing leads back to `submitted`. A refused declaration is not re-opened
 * and argued about - the customer sends the certificate again, which is a new
 * record of a new act.
 */
export const DECLARATION_TRANSITIONS: Record<DeclarationState, readonly DeclarationState[]> = {
  submitted:  ['verified', 'rejected', 'withdrawn'],
  verified:   ['superseded'],
  rejected:   [],
  superseded: [],
  withdrawn:  [],
};

/**
 * Who may cause each transition.
 *
 * The customer may only ever WITHDRAW their own submission - the same shape as
 * a booking, where every advance belongs to the studio because every advance
 * asserts something about the physical world. Only somebody holding the
 * certificate can say it is real.
 *
 * `superseded` is the studio's too, because it is a consequence of the studio
 * verifying the next one rather than an act of its own.
 */
const DECLARATION_ACTORS: Record<DeclarationState, readonly Actor[]> = {
  submitted:  ['customer'],
  verified:   ['studio'],
  rejected:   ['studio'],
  superseded: ['studio'],
  withdrawn:  ['customer'],
};

export function declarationTransition(
  from: DeclarationState, to: DeclarationState, actor: Actor,
): TransitionVerdict {
  /* Terminal first, so a second decision on a refused declaration is
     `already-rejected` - the fact - rather than `illegal-transition`, which
     tells a caller nothing about why. */
  if (DECLARATION_TERMINAL.includes(from)) return no(`already-${from}`);
  /* `verified → verified` lands here: a double tap on the studio's own control
     must not write a second protection for one certificate. */
  if (from === to) return no('no-change');
  if (!DECLARATION_TRANSITIONS[from]?.includes(to)) return no('illegal-transition');
  if (!DECLARATION_ACTORS[to].includes(actor)) return no('not-yours-to-make');
  return YES;
}

/* ── PAYMENT (design screen 13) ──────────────────────────────────────────── */

/**
 * Money is its own axis.
 *
 * `initiated` - the customer asked for a UPI intent; the studio has generated
 *               one against ITS OWN figure.
 * `submitted` - the customer says they have paid and has given a reference.
 *               This is a CLAIM, and the product treats it as one: nothing is
 *               settled and the car is not released by it.
 * `paid`      - the studio has seen the money. Only the studio may write it.
 */
export type PaymentStatus =
  | 'unpaid' | 'initiated' | 'submitted' | 'paid' | 'failed' | 'expired';

export const PAYMENT_TERMINAL: readonly PaymentStatus[] = ['paid'];

export const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  unpaid:    ['initiated', 'paid'],
  initiated: ['submitted', 'paid', 'failed', 'expired'],
  submitted: ['paid', 'failed', 'expired'],
  /* Terminal. A settled invoice is a record, and a record that can be
     un-settled is not one. A refund is its own event, not a state change. */
  paid:      [],
  failed:    ['initiated', 'paid'],
  expired:   ['initiated', 'paid'],
};

/**
 * A CUSTOMER MAY NEVER WRITE `paid`.
 *
 * It is the single most valuable write in the product: it releases a car. The
 * studio settles against money it has actually seen, which is why `paid` is
 * studio-only here and why `/api/payment/settle` refuses a non-staff caller
 * before it looks at anything else.
 */
const PAYMENT_ACTORS: Record<PaymentStatus, readonly Actor[]> = {
  unpaid:    ['studio'],
  initiated: ['customer', 'studio'],
  submitted: ['customer'],
  paid:      ['studio'],
  failed:    ['customer', 'studio'],
  expired:   ['system', 'studio'],
};

export function paymentTransition(
  from: PaymentStatus, to: PaymentStatus, actor: Actor,
): TransitionVerdict {
  /* Terminal first, so a duplicate settlement is `already-paid` and the caller
     can treat it as the idempotent success it is. */
  if (PAYMENT_TERMINAL.includes(from)) return no('already-paid');
  if (from === to) return no('no-change');
  if (!PAYMENT_TRANSITIONS[from]?.includes(to)) return no('illegal-transition');
  if (!PAYMENT_ACTORS[to].includes(actor)) return no('not-yours-to-make');
  return YES;
}

/** A UPI intent goes stale; the amount behind it may not stay right for ever. */
export const PAYMENT_INTENT_VALID_MINUTES = 30;

/* ── VISIT (the anchor) ──────────────────────────────────────────────────── */

/**
 * The anchor's own ladder. `sealed` is terminal by constitution (§16.2): after
 * `sealedAt` nothing that references the visit may be rewritten, which is what
 * makes a warranty a promise rather than a current opinion.
 */
export const VISIT_TRANSITIONS: Record<VisitStatus, readonly VisitStatus[]> = {
  requested: ['agreed', 'cancelled'],
  agreed:    ['open', 'cancelled'],
  open:      ['sealed', 'cancelled'],
  sealed:    [],
  cancelled: [],
};

const VISIT_ACTORS: Record<VisitStatus, readonly Actor[]> = {
  requested: ['customer', 'studio'],
  agreed:    ['studio'],
  open:      ['studio'],
  sealed:    ['studio', 'system'],
  cancelled: ['customer', 'studio'],
};

export function visitTransition(
  from: VisitStatus, to: VisitStatus, actor: Actor,
): TransitionVerdict {
  if (from === 'sealed') return no('already-sealed');
  if (from === to) return no('no-change');
  if (!VISIT_TRANSITIONS[from]?.includes(to)) return no('illegal-transition');
  if (!VISIT_ACTORS[to].includes(actor)) return no('not-yours-to-make');
  return YES;
}

/* ── JOB (the operational twin) ──────────────────────────────────────────── */

export const JOB_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  checked_in:         ['in_progress', 'cancelled'],
  in_progress:        ['quality_check', 'ready_for_delivery', 'cancelled'],
  quality_check:      ['in_progress', 'ready_for_delivery', 'cancelled'],
  ready_for_delivery: ['completed', 'quality_check', 'cancelled'],
  completed:          [],
  cancelled:          [],
};

export function jobTransition(
  from: JobStatus, to: JobStatus, actor: Actor,
): TransitionVerdict {
  if (from === 'completed' || from === 'cancelled') return no(`already-${from}`);
  if (from === to) return no('no-change');
  if (!JOB_TRANSITIONS[from]?.includes(to)) return no('illegal-transition');
  /* The bay is the studio's. Nothing a customer does moves a job. */
  if (actor !== 'studio') return no('not-yours-to-make');
  return YES;
}

/**
 * The one place the two ladders are joined.
 *
 * A booking and its job are a permanent 1:1 (lib/types.ts), so a job reaching a
 * state and its booking claiming another is a contradiction on the customer's
 * own screen - Home saying "in the studio" while the Studio room offers to
 * cancel it. Anything that advances a job advances its booking through this.
 */
export const BOOKING_FOR_JOB: Record<JobStatus, BookingState | null> = {
  checked_in:         'vehicle_received',
  in_progress:        'in_progress',
  quality_check:      'quality_check',
  ready_for_delivery: 'ready_for_delivery',
  completed:          'completed',
  cancelled:          'cancelled',
};

/* ── LISTING ─────────────────────────────────────────────────────────────── */

export const LISTING_TRANSITIONS: Record<string, readonly string[]> = {
  available: ['reserved', 'sold'],
  reserved:  ['available', 'sold'],
  sold:      ['available'],
};

export function listingTransition(from: string, to: string, actor: Actor): TransitionVerdict {
  if (from === to) return no('no-change');
  if (!LISTING_TRANSITIONS[from]?.includes(to)) return no('illegal-transition');
  if (actor !== 'studio') return no('not-yours-to-make');
  return YES;
}
