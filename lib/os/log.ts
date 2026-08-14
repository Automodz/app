/**
 * The concierge log (audit #6) - what the studio has already told you.
 *
 * The app has no inbox and no message store, and this does not become one:
 * every line is a projection of an object that really exists - a booking that
 * was requested and confirmed, a job the floor moved through, a membership
 * the studio verified, a protection that was applied. If an event did not
 * happen, no line is written for it.
 *
 * The voice is the studio's: the car by name, reasons given, no urgency.
 */
import type { Booking, Job, Subscription } from '@/lib/types';
/* Repointed off the retired `lib/cx/protection` (§22.2 - one implementation).
   That module carried its own three-kind vocabulary and its own `Protection`
   shape; the stored model has ten kinds and one term engine. */
import type { LiveProtection as Protection } from './protection';
import { PROTECTION_TITLE as PROTECTION_WORD } from '@/lib/types';
import { actFromJobStatus, visitPhase } from './visit';

export interface LogEntry {
  id: string;
  /** when it happened - the ordering truth */
  at: Date;
  line: string;
  /** where reading it takes you, when it has a surface of its own */
  target?: { kind: 'visit' | 'chapter'; bookingId: string };
}

const fmtLong = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
const dayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** The studio's line for each act the floor actually recorded. */
const ACT_LOG: Record<string, (car: string) => string> = {
  received: car => `The ${car} arrived at the studio.`,
  in_care: car => `Work began on the ${car}.`,
  final_checks: car => `The ${car} went through its final checks.`,
  ready: car => `The ${car} was ready for collection.`,
};

export function conciergeLog(args: {
  visits: Booking[];
  jobByBooking: Map<string, Job>;
  membership: Subscription | null;
  protections: Protection[];
  vehicleName: string;
  now?: Date;
}): LogEntry[] {
  const { visits, jobByBooking, membership, protections, vehicleName, now = new Date() } = args;
  const out: LogEntry[] = [];

  visits.forEach(b => {
    const phase = visitPhase(b.status);
    const created = b.createdAt?.toDate?.() ?? new Date(`${b.scheduledDate}T09:00:00`);

    out.push({
      id: `${b.id}-requested`,
      at: created,
      line: `You asked for ${b.serviceName} on ${fmtLong(b.scheduledDate)}.`,
      target: { kind: phase === 'archived' ? 'chapter' : 'visit', bookingId: b.id },
    });

    /**
     * THE CONFIRMATION IS NOT WRITTEN DOWN, SO IT IS NOT SAID.
     *
     * There was a line here - "The studio confirmed {date} for the {car}." -
     * dated from `b.updatedAt`. That is when the document was last WRITTEN, not
     * when the studio confirmed anything, and the log presents its `at` to the
     * customer as the day the thing happened. Nine of the eleven bookings in
     * production have been edited since they were created, so for nine of them
     * the date beside that sentence was simply the date of the last edit: Home
     * read "The studio confirmed 23 July 2026 for the Kia Seltos." stamped
     * 8 August 2026 - a confirmation appearing to arrive a fortnight after the
     * visit it confirmed.
     *
     * MISSING FROM THE SCHEMA: `Booking.confirmedAt`, written once when a
     * booking leaves `pending`, in the shape `cancelledAt` already has. Nothing
     * records it, so there is no honest date for this event and no date is
     * invented for it. The line returns when the field does.
     *
     * Every other entry in this log is anchored to a real event: the request to
     * `createdAt`, each act of the floor to its own `statusHistory[].at`, the
     * filing to `completedAt`, the cancellation to `cancelledAt`.
     */

    if (phase === 'cancelled') {
      const line = b.noShow
        ? `The ${b.serviceName} on ${fmtLong(b.scheduledDate)} was missed.`
        : b.rejectionReason
        ? `The studio couldn’t take ${b.serviceName} on ${fmtLong(b.scheduledDate)}${b.rejectionReason ? ` - ${b.rejectionReason}` : ''}`
        : `${b.serviceName} on ${fmtLong(b.scheduledDate)} was cancelled.`;
      /* `cancelledAt` ONLY. It is the true event and every cancelled booking
         in production carries one; falling through to `updatedAt` would date
         the cancellation from whenever the record was last touched. A
         cancellation nobody timestamped cannot be placed in a chronology, so
         it is left out of one rather than given a plausible day. */
      const at = b.cancelledAt?.toDate?.();
      if (at) out.push({ id: `${b.id}-cancelled`, at, line });
    }

    // the floor's own record - one line per act it actually moved through
    const job = jobByBooking.get(b.id);
    (job?.statusHistory ?? []).forEach((h, i) => {
      const act = actFromJobStatus(h.status);
      const write = act ? ACT_LOG[act] : null;
      if (!write) return;
      out.push({
        id: `${b.id}-act-${i}`,
        at: h.at.toDate(),
        line: write(vehicleName),
        target: { kind: phase === 'archived' ? 'chapter' : 'visit', bookingId: b.id },
      });
    });

    if (phase === 'archived') {
      const done = job?.completedAt?.toDate() ?? new Date(`${b.scheduledDate}T18:00:00`);
      out.push({
        id: `${b.id}-filed`,
        at: done,
        line: `${b.serviceName} was finished and filed to the ${vehicleName}’s story.`,
        target: { kind: 'chapter', bookingId: b.id },
      });
    }
  });

  protections.filter(p => p.since).forEach(p => {
    out.push({
      id: `protection-${p.kind}`,
      at: new Date(`${p.since ?? ''}T12:00:00`),
      line: p.term.kind === 'dated'
        ? `${PROTECTION_WORD[p.kind]} applied - protected until ${new Date(`${p.term.expiresOn}T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}.`
        : `${PROTECTION_WORD[p.kind]} applied to the ${vehicleName}.`,
    });
  });

  if (membership && membership.status !== 'cancelled') {
    out.push({
      id: `club-${membership.id}`,
      at: new Date(`${membership.startDate}T12:00:00`),
      line: membership.status === 'pending'
        ? `You asked to join the Club on ${membership.plan}.`
        : `The studio confirmed your Club membership on ${membership.plan}.`,
    });
  }

  /* newest first; when two lines share a moment (a record that never carried
     its own timestamps), the order they were written in is kept, so a
     confirmation can never read as though it came before the request */
  return out
    .filter(e => e.at.getTime() <= now.getTime())
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.at.getTime() - a.e.at.getTime() || b.i - a.i)
    .map(({ e }) => e);
}

/** "Today" / "Yesterday" / the date - the log's only grouping. */
export function logDay(at: Date, now = new Date()): string {
  const days = Math.round((dayOf(now).getTime() - dayOf(at).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return at.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}
