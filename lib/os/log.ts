/**
 * The concierge log - what has actually happened to the car.
 *
 * The app has no inbox and no message store, and this does not become one:
 * every line is a projection of an object that really exists. If an event did
 * not happen, no line is written for it.
 *
 * ── IT WAS A PROCESS TRACE, AND IT IS A RECORD NOW ───────────────────────
 * The owner: "The recently section has long writing and records every steps
 * and gets in two line, it should be more human language and only important
 * information shall be tracked and displayed that actually helps customers."
 *
 * One ceramic coating used to produce SEVEN lines:
 *
 *     You asked for Ceramic coating on 18 July 2026.
 *     The Kia Seltos arrived at the studio.
 *     Work began on the Kia Seltos.
 *     The Kia Seltos went through its final checks.
 *     The Kia Seltos was ready for collection.
 *     Ceramic coating was finished and filed to the Kia Seltos's story.
 *     Ceramic coating applied - protected until August 2029.
 *
 * Six of those are the floor's own choreography, written in the studio's
 * internal order, wrapping to two lines each on a phone. A customer scrolling
 * past does not need to know that a car passed through final checks in July;
 * they need to know what changed about their car and when.
 *
 * So the log answers one question - WHAT CHANGED - and each answer is short
 * enough to be a line rather than a paragraph:
 *
 *     Ceramic coating went on          18 July 2026
 *     Joined the Club on Gold           2 July 2026
 *     Slot missed                      14 June 2026
 *
 * WHAT WAS DROPPED, AND WHY IT IS NOT LOST. The request, the four acts and
 * the filing all belong to ONE visit, and a visit has a surface of its own
 * with its photographs, its stages and its account - which every line here
 * still opens. The steps were never deleted from the record; they stopped
 * being repeated on the customer's home screen.
 *
 * The voice is the studio's: the car by name, reasons given, no urgency.
 */
import type { Booking, Job, Subscription } from '@/lib/types';
/* Repointed off the retired `lib/cx/protection` (§22.2 - one implementation).
   That module carried its own three-kind vocabulary and its own `Protection`
   shape; the stored model has ten kinds and one term engine. */
import type { LiveProtection as Protection } from './protection';
import { PROTECTION_TITLE as PROTECTION_WORD } from '@/lib/types';
import { visitPhase } from './visit';

export interface LogEntry {
  id: string;
  /** when it happened - the ordering truth */
  at: Date;
  line: string;
  /** where reading it takes you, when it has a surface of its own */
  target?: { kind: 'visit' | 'chapter'; bookingId: string };
}

/* `fmtLong` STOOD HERE. Every line that spelled a date INSIDE its own
   sentence is gone - the log draws the date beside each entry, so writing it
   twice was what made these wrap. */
const dayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function conciergeLog(args: {
  visits: Booking[];
  jobByBooking: Map<string, Job>;
  membership: Subscription | null;
  protections: Protection[];
  now?: Date;
}): LogEntry[] {
  /* `vehicleName` STOOD IN THIS SIGNATURE. Every line that named the car -
     "Work began on the Kia Seltos." - was one of the floor's steps, and those
     are gone. The room these lines appear in is already about one car, so
     naming it in each line was the car saying its own name six times. */
  const { visits, jobByBooking, membership, protections, now = new Date() } = args;
  const out: LogEntry[] = [];

  visits.forEach(b => {
    const phase = visitPhase(b.status);

    /**
     * A VISIT IS ONE THING THAT HAPPENED, not seven.
     *
     * The request, each act the floor moved through and the filing were all
     * written here as their own lines - see the note at the top of the file.
     * What a customer wants back from a finished visit is that it happened and
     * what it was; the visit's own surface holds everything else and every
     * line below still opens it.
     *
     * A visit that left a PROTECTION on the car is not written here at all:
     * the protection says the same thing and says what it left behind, which
     * is the more useful half. Matched on the day the work was done, which is
     * how both writers set `since` (`captureTerms` and `protectionsFromVisit`
     * both use the day of the visit).
     */
    if (phase === 'archived') {
      const left = protections.some(p => p.since === b.scheduledDate);
      const done = jobByBooking.get(b.id)?.completedAt?.toDate()
        ?? new Date(`${b.scheduledDate}T18:00:00`);
      if (!left) {
        out.push({
          id: `${b.id}-done`,
          at: done,
          line: b.serviceName,
          target: { kind: 'chapter', bookingId: b.id },
        });
      }
    }

    /**
     * AND SOMETHING THAT WENT WRONG IS ALWAYS WORTH A LINE.
     *
     * This is the one kind of entry a customer may need to act on, so it keeps
     * its reason - a refusal without one is the studio declining and not
     * saying why.
     */
    if (phase === 'cancelled') {
      const line = b.noShow
        ? 'Slot missed'
        : b.rejectionReason
          ? `Visit not taken - ${b.rejectionReason}`
          : 'Visit cancelled';
      /* `cancelledAt` ONLY. It is the true event and every cancelled booking
         in production carries one; falling through to `updatedAt` would date
         the cancellation from whenever the record was last touched. A
         cancellation nobody timestamped cannot be placed in a chronology, so
         it is left out of one rather than given a plausible day. */
      const at = b.cancelledAt?.toDate?.();
      if (at) out.push({ id: `${b.id}-cancelled`, at, line });
    }
  });

  /**
   * WHAT WENT ON THE CAR - the most useful line in the log, and now the
   * shortest. It read "Ceramic coating applied - protected until August 2029."
   * and wrapped; the term is stated in full under the ring, on the car's own
   * ledger and on the warranty card, so repeating it here bought a second line
   * of type for a fact already said three times (§4.4).
   *
   * The BRAND is what this line adds that none of those do at a glance, so it
   * is the part that is kept.
   */
  protections.filter(p => p.since).forEach(p => {
    /* NAMED, NOT NARRATED. "Ceramic coating went on" still wrapped once the
       brand was in front of it and the date beside it - and every other entry
       in this record is the name of a thing that happened, with its date. So
       is this one. */
    const what = PROTECTION_WORD[p.kind].toLowerCase();
    out.push({
      id: `protection-${p.kind}`,
      at: new Date(`${p.since ?? ''}T12:00:00`),
      line: p.provider ? `${p.provider} ${what}` : PROTECTION_WORD[p.kind],
      target: p.visitId ? { kind: 'chapter', bookingId: p.visitId } : undefined,
    });
  });

  if (membership && membership.status !== 'cancelled') {
    out.push({
      id: `club-${membership.id}`,
      at: new Date(`${membership.startDate}T12:00:00`),
      /* "The studio confirmed your Club membership on Platinum." was a
         sentence about a confirmation; what happened is that they joined. */
      line: membership.status === 'pending'
        ? `Asked to join the Club on ${membership.plan}`
        : `Joined the Club on ${membership.plan}`,
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
