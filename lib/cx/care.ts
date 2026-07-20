/**
 * Live Care model — everything the tracker shows, derived from data that
 * already exists (booking + job.statusHistory + assignments + timestamps).
 * Nothing invented: no fake milestones, no fake ETA. When confidence is
 * low we say so honestly.
 */
import type { Booking, Job, JobStatus, JobStatusEntry } from '@/lib/types';

/* ── concierge voice, per stage ─────────────────────────────────────────── */

/** Status tones — one colour language for every customer surface. */
export type Tone = 'waiting' | 'live' | 'good' | 'done' | 'stopped';

export const TONE_COLOR: Record<Tone, string> = {
  waiting: 'var(--info)',
  live: 'var(--success)',
  good: 'var(--success)',
  done: 'var(--steel)',
  stopped: 'var(--danger)',
};

export type CareStage = {
  /** short label for the hero + Live Activity */
  label: string;
  /** the one sentence under it */
  line: string;
  /** baseline progress fraction for this stage */
  base: number;
  tone: Tone;
};

export const JOB_STAGE: Record<JobStatus, CareStage> = {
  checked_in:         { label: 'Arrived',          line: 'Your vehicle has arrived safely.',            base: 0.15, tone: 'live' },
  in_progress:        { label: 'In care',          line: 'Our team is caring for your vehicle.',        base: 0.45, tone: 'live' },
  quality_check:      { label: 'Final inspection', line: 'Final inspection underway.',                  base: 0.82, tone: 'live' },
  ready_for_delivery: { label: 'Ready',            line: 'Your vehicle is ready to come home.',         base: 0.97, tone: 'good' },
  completed:          { label: 'Home',             line: 'Delivered. Thank you for trusting us.',       base: 1,    tone: 'done' },
  cancelled:          { label: 'Cancelled',        line: 'This visit was cancelled.',                   base: 0,    tone: 'stopped' },
};

/** Booking statuses before a job exists (and after, for terminal states). */
export const BOOKING_STAGE: Record<Booking['status'], CareStage> = {
  pending:            { label: 'Requested',  line: 'The studio is confirming your slot.',          base: 0.03, tone: 'waiting' },
  confirmed:          { label: 'Reserved',   line: 'A bay is reserved. See you soon.',              base: 0.08, tone: 'waiting' },
  vehicle_received:   JOB_STAGE.checked_in,
  in_progress:        JOB_STAGE.in_progress,
  quality_check:      JOB_STAGE.quality_check,
  ready_for_delivery: JOB_STAGE.ready_for_delivery,
  completed:          JOB_STAGE.completed,
  cancelled:          JOB_STAGE.cancelled,
};

/** Concierge line for a timeline event (statusHistory entry). */
export const eventLine = (status: JobStatus): string => JOB_STAGE[status].line;

/* ── derived live state ─────────────────────────────────────────────────── */

export type CareState = {
  stage: CareStage;
  /** 0..1 — blends stage baseline with real elapsed/duration */
  progress: number;
  /** active lead (or first active) assignee name, from job.assignments */
  technician: string | null;
  /** when care actually began (first statusHistory entry), if it has */
  startedAt: Date | null;
  /** minutes since startedAt (null before start) */
  elapsedMin: number | null;
  /** derived finish estimate */
  eta: Date | null;
  /** honest confidence — 'live' when derived from real start + duration,
   *  'planned' when only the booking slot exists, 'overrun' when past ETA */
  etaConfidence: 'live' | 'planned' | 'overrun' | null;
  live: boolean;
};

const ACTIVE: Booking['status'][] = ['vehicle_received', 'in_progress', 'quality_check', 'ready_for_delivery'];

export function deriveCare(booking: Booking, job: Job | null, now = new Date()): CareState {
  const stage = job ? JOB_STAGE[job.status] : BOOKING_STAGE[booking.status];
  const durationMin = booking.serviceDurationMinutes ?? 60;

  const firstEntry: JobStatusEntry | undefined = job?.statusHistory?.[0];
  const startedAt = firstEntry ? firstEntry.at.toDate() : null;

  const scheduled = new Date(`${booking.scheduledDate}T${booking.scheduledTime || '09:00'}:00`);
  const anchor = startedAt ?? scheduled;
  const eta = new Date(anchor.getTime() + durationMin * 60000);

  const elapsedMin = startedAt ? Math.max(0, Math.round((now.getTime() - startedAt.getTime()) / 60000)) : null;

  const done = booking.status === 'completed' || job?.status === 'completed';
  const ready = job?.status === 'ready_for_delivery' || booking.status === 'ready_for_delivery';
  const cancelled = booking.status === 'cancelled' || job?.status === 'cancelled';

  let etaConfidence: CareState['etaConfidence'] = null;
  if (!done && !ready && !cancelled) {
    if (startedAt) etaConfidence = now > eta ? 'overrun' : 'live';
    else etaConfidence = 'planned';
  }

  // Progress: stage baseline, nudged forward by real elapsed time within the
  // stage's span — never past the next stage, never backwards.
  let progress = stage.base;
  if (startedAt && !done && !cancelled) {
    const timeFrac = Math.min(1, (now.getTime() - startedAt.getTime()) / (durationMin * 60000));
    progress = Math.max(stage.base, Math.min(stage.base + 0.15, 0.15 + timeFrac * 0.8));
    if (!ready) progress = Math.min(progress, 0.95);
  }
  if (done) progress = 1;

  const activeLead = job?.assignments
    ?.filter(a => !a.removedAt)
    .sort(a => (a.role === 'lead' ? -1 : 1))[0];

  return {
    stage,
    progress,
    technician: activeLead?.employeeName ?? null,
    startedAt,
    elapsedMin,
    eta: done || cancelled ? null : eta,
    etaConfidence,
    live: ACTIVE.includes(booking.status) && !done,
  };
}

/* ── small formatters the tracker + Live Activity share ─────────────────── */

export const fmtClock = (d: Date) =>
  d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

export const fmtElapsed = (min: number): string => {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

/** Honest one-liner for the ETA slot. */
export const etaLine = (care: CareState): string | null => {
  if (!care.eta || !care.etaConfidence) return null;
  if (care.etaConfidence === 'overrun') return 'Taking a little longer — quality comes first.';
  if (care.etaConfidence === 'planned') return `Planned finish around ${fmtClock(care.eta)}`;
  return `Ready around ${fmtClock(care.eta)}`;
};

/* ── unread updates (Live Activity dot) ─────────────────────────────────── */

const seenKey = (bookingId: string) => `automodz-care-seen-${bookingId}`;

export const careUpdateCount = (job: Job | null): number =>
  (job?.statusHistory?.length ?? 0) + (job?.photos?.length ?? 0);

export const hasUnseenUpdates = (bookingId: string, job: Job | null): boolean => {
  if (typeof window === 'undefined' || !job) return false;
  const seen = parseInt(localStorage.getItem(seenKey(bookingId)) ?? '0', 10);
  return careUpdateCount(job) > seen;
};

export const markCareSeen = (bookingId: string, job: Job | null): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(seenKey(bookingId), String(careUpdateCount(job)));
};
