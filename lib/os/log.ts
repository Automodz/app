/**
 * The concierge log (audit #6) — what the studio has already told you.
 *
 * The app has no inbox and no message store, and this does not become one:
 * every line is a projection of an object that really exists — a booking that
 * was requested and confirmed, a job the floor moved through, a membership
 * the studio verified, a protection that was applied. If an event did not
 * happen, no line is written for it.
 *
 * The voice is the studio's: the car by name, reasons given, no urgency.
 */
import type { Booking, Job, Subscription } from '@/lib/types';
import type { Protection } from '@/lib/cx/protection';
import { PROTECTION_WORD } from '@/lib/cx/protection';
import { actFromJobStatus, visitPhase } from './visit';

export interface LogEntry {
  id: string;
  /** when it happened — the ordering truth */
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

    // the studio's confirmation is real the moment the visit left `pending`
    if (phase !== 'proposed' && phase !== 'cancelled') {
      const confirmedAt = b.updatedAt?.toDate?.() ?? created;
      out.push({
        id: `${b.id}-confirmed`,
        at: confirmedAt,
        line: `The studio confirmed ${fmtLong(b.scheduledDate)} for the ${vehicleName}.`,
        target: { kind: phase === 'archived' ? 'chapter' : 'visit', bookingId: b.id },
      });
    }

    if (phase === 'cancelled') {
      out.push({
        id: `${b.id}-cancelled`,
        at: b.updatedAt?.toDate?.() ?? created,
        line: `${b.serviceName} on ${fmtLong(b.scheduledDate)} was cancelled.`,
      });
    }

    // the floor's own record — one line per act it actually moved through
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

  protections.forEach(p => {
    out.push({
      id: `protection-${p.kind}`,
      at: new Date(`${p.applied}T12:00:00`),
      line: p.until
        ? `${PROTECTION_WORD[p.kind]} applied — protected until ${p.until.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}.`
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

/** "Today" / "Yesterday" / the date — the log's only grouping. */
export function logDay(at: Date, now = new Date()): string {
  const days = Math.round((dayOf(now).getTime() - dayOf(at).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return at.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}
