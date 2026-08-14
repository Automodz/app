/**
 * The Stay's model (Constitution Art. 6 · P3).
 *
 * `lib/cx/care.ts` carried a progress fraction and an ETA because the old
 * tracker drew a bar. The Stay draws no bar: it says which act the car is in,
 * what the studio actually wrote about it, who has it, and - only when it is
 * genuinely known - roughly when it will be done. Everything here is derived
 * from the real booking + job; nothing is estimated into a percentage and
 * nothing is invented when the studio has been quiet.
 */
import type { Booking, Job } from '@/lib/types';
import { workingIntervals } from '@/lib/availability';
import {
  ACT_ORDER, ACT_LINE, ACT_TITLE, actFromJobStatus, actIndex, careAct, visitPhase,
  type CareAct,
} from './visit';

export type ActState = 'done' | 'current' | 'coming';

export interface StayAct {
  act: CareAct;
  title: string;
  state: ActState;
  /** when the studio recorded this act, if it recorded one */
  at: Date | null;
}

export interface StayModel {
  /** the act the car is in right now */
  act: CareAct;
  acts: StayAct[];
  /** the visit is over - it belongs to the Chapter, not the Stay */
  archived: boolean;
  cancelled: boolean;
  /** the studio's own words for this act when it left a note, else the act line */
  narration: string;
  /** true when the sentence is the studio's, not the app's */
  narrationIsStudio: boolean;
  arrivedAt: Date | null;
  /** the evidence chain, as far as it exists */
  arrivalPhoto?: string;
  craftPhoto?: string;
  finishedPhoto?: string;
  /** the newest photo of any kind - what the stage shows */
  latestPhoto?: string;
  /** one honest line about time, or nothing at all */
  timing: string | null;
  amount: number;
  paid: boolean;
}

export const fmtClock = (d: Date) =>
  d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

/** "Tuesday" - named only when the finish falls on a later day than arrival. */
const fmtDay = (d: Date) => d.toLocaleDateString('en-IN', { weekday: 'long' });

/** The act the visit is in, preferring the job (the floor's own record). */
function currentAct(booking: Booking, job: Job | null): CareAct {
  const fromJob = job ? actFromJobStatus(job.status) : null;
  return fromJob ?? careAct(booking.status) ?? 'received';
}

export function deriveStay(booking: Booking, job: Job | null, now = new Date()): StayModel {
  const phase = visitPhase(booking.status);
  const archived = phase === 'archived' || job?.status === 'completed';
  const cancelled = phase === 'cancelled' || job?.status === 'cancelled';
  const act = archived ? 'ready' : currentAct(booking, job);
  const here = actIndex(act);

  const history = job?.statusHistory ?? [];
  const entryFor = (a: CareAct) => history.find(h => actFromJobStatus(h.status) === a) ?? null;

  const acts: StayAct[] = ACT_ORDER.map((a, i) => {
    const entry = entryFor(a);
    return {
      act: a,
      title: ACT_TITLE[a],
      // an act with a recorded time is done even when the floor skipped past it
      state: i < here || (i === here && archived) ? 'done' : i === here ? 'current' : 'coming',
      at: entry ? entry.at.toDate() : null,
    };
  });

  // the studio's note on the current act is the truest sentence available
  const note = entryFor(act)?.note?.trim();
  const narration = note || ACT_LINE[act];

  /* Assignments are deliberately NOT read here. The floor records who worked
     the car - the studio needs it for payroll and accountability - but the
     actor law (Constitution Art. 8) forbids naming an individual on any
     customer surface: AutoModz is the craftsman. `job.assignments` stays
     intact in the model and simply never crosses this boundary. */

  const arrival = entryFor('received');
  const arrivedAt = arrival ? arrival.at.toDate() : null;

  const photos = job?.photos ?? [];
  const last = (kind: 'before' | 'during' | 'after') =>
    [...photos].reverse().find(p => p.kind === kind)?.url;
  const arrivalPhoto = last('before');
  const craftPhoto = last('during');
  const finishedPhoto = last('after');
  const latestPhoto = finishedPhoto ?? craftPhoto ?? arrivalPhoto;

  return {
    act, acts, archived, cancelled,
    narration, narrationIsStudio: !!note,
    arrivedAt,
    arrivalPhoto, craftPhoto, finishedPhoto, latestPhoto,
    timing: timingLine({ booking, arrivedAt, act, archived, cancelled, now }),
    amount: booking.totalAmount ?? 0,
    paid: job?.paymentStatus === 'collected' || booking.paymentStatus === 'verified',
  };
}

/**
 * The planned finish, in real studio time.
 *
 * The studio works 09:00-19:00 and does not run overnight, so wall-clock
 * arithmetic lies: an 8h ceramic taken in at 18:49 is not finished at 02:49.
 * `workingIntervals` (lib/availability) is the one implementation of "spread
 * this duration across HOURS SOMEBODY IS WORKING". Note it is NOT the function
 * that reserves the bay: a bay is held overnight because the car is in it, and
 * work is not done overnight because nobody is there. Two questions.
 */
function plannedFinish(arrivedAt: Date, durationMin: number): Date {
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const startMin = arrivedAt.getHours() * 60 + arrivedAt.getMinutes();
  const parts = workingIntervals({ date: iso(arrivedAt), startMin, durationMin });
  const last = parts[parts.length - 1];
  if (!last) return new Date(arrivedAt.getTime() + durationMin * 60000);
  const end = new Date(`${last.date}T00:00:00`);
  end.setMinutes(last.endMin);
  return end;
}

/**
 * One line about time - or silence. A planned finish is only offered while the
 * car is in care and the studio has actually taken it in; once it runs past
 * that plan the app says so plainly rather than counting anything down.
 */
function timingLine(a: {
  booking: Booking; arrivedAt: Date | null; act: CareAct;
  archived: boolean; cancelled: boolean; now: Date;
}): string | null {
  if (a.archived || a.cancelled || a.act === 'ready') return null;
  if (!a.arrivedAt) return null;
  const durationMin = a.booking.serviceDurationMinutes;
  if (!durationMin) return null;
  const planned = plannedFinish(a.arrivedAt, durationMin);
  if (a.now > planned) return 'Running longer than planned - the work sets the pace.';
  // a finish on another day names the day; today's needs only the clock
  const sameDay = planned.toDateString() === a.arrivedAt.toDateString();
  return sameDay
    ? `Planned finish around ${fmtClock(planned)}.`
    : `Planned finish ${fmtDay(planned)} around ${fmtClock(planned)}.`;
}
