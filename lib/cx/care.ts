/**
 * TEMPORARY ADAPTER (PRE-1) — Generation-A care model, now a pure consumer
 * of the translation layer. Every customer-facing label and sentence here
 * derives from lib/os/visit (ACT_TITLE / ACT_LINE / PHASE_*); no copy and
 * no status mapping may be defined in this file. Progress/ETA derivation
 * stays until the Stay owns it.
 *
 * TODO(P3): the Stay replaces deriveCare/etaLine and the tracker; delete
 * this file with it. The unread helpers die with the strip (P1).
 */
import type { Booking, Job, JobStatus } from '@/lib/types';
import {
  visitPhase, careAct, actFromJobStatus, actIndex, ACT_ORDER,
  ACT_TITLE, ACT_LINE, PHASE_TITLE, PHASE_LINE, type CareAct,
} from '@/lib/os/visit';

/* ── tones — colour language keyed off phase/act, no copy here ─────────── */

export type Tone = 'waiting' | 'live' | 'good' | 'done' | 'stopped';

export const TONE_COLOR: Record<Tone, string> = {
  waiting: 'var(--info)',
  live: 'var(--success)',
  good: 'var(--success)',
  done: 'var(--steel)',
  stopped: 'var(--danger)',
};

export type CareStage = {
  label: string;
  line: string;
  /** baseline progress fraction for this stage */
  base: number;
  tone: Tone;
};

/** Progress baseline per act — position along the five-act arc. */
const ACT_BASE: Record<CareAct, number> = {
  received: 0.15, looked_over: 0.3, in_care: 0.45, final_checks: 0.82, ready: 0.97,
};

const actStage = (act: CareAct): CareStage => ({
  label: ACT_TITLE[act],
  line: ACT_LINE[act],
  base: ACT_BASE[act],
  tone: act === 'ready' ? 'good' : 'live',
});

const phaseStage = (phase: 'proposed' | 'agreed' | 'archived' | 'cancelled'): CareStage => ({
  label: PHASE_TITLE[phase],
  line: PHASE_LINE[phase],
  base: phase === 'archived' ? 1 : phase === 'agreed' ? 0.08 : phase === 'proposed' ? 0.03 : 0,
  tone: phase === 'archived' ? 'done' : phase === 'cancelled' ? 'stopped' : 'waiting',
});

/** Stage for a booking status — always via the translation layer. */
function bookingStage(status: Booking['status']): CareStage {
  const phase = visitPhase(status);
  if (phase === 'live') return actStage(careAct(status)!);
  return phaseStage(phase);
}

/** Stage for a job status — same boundary, ops jobs vocabulary included. */
function jobStage(status: JobStatus): CareStage {
  const act = actFromJobStatus(status);
  if (act) return actStage(act);
  return phaseStage(status === 'completed' ? 'archived' : 'cancelled');
}

/** Legacy lookup-table shims for existing consumers. */
export const BOOKING_STAGE: Record<Booking['status'], CareStage> = {
  pending: bookingStage('pending'),
  confirmed: bookingStage('confirmed'),
  vehicle_received: bookingStage('vehicle_received'),
  in_progress: bookingStage('in_progress'),
  quality_check: bookingStage('quality_check'),
  ready_for_delivery: bookingStage('ready_for_delivery'),
  completed: bookingStage('completed'),
  cancelled: bookingStage('cancelled'),
};

/** Concierge line for a timeline event (statusHistory entry). */
export const eventLine = (status: JobStatus): string => jobStage(status).line;

/* ── derived live state (Stay precursor) ────────────────────────────────── */

export type CareState = {
  stage: CareStage;
  progress: number;
  technician: string | null;
  startedAt: Date | null;
  elapsedMin: number | null;
  eta: Date | null;
  etaConfidence: 'live' | 'planned' | 'overrun' | null;
  live: boolean;
};

export function deriveCare(booking: Booking, job: Job | null, now = new Date()): CareState {
  const stage = job ? jobStage(job.status) : bookingStage(booking.status);
  const durationMin = booking.serviceDurationMinutes ?? 60;

  const firstEntry = job?.statusHistory?.[0];
  const startedAt = firstEntry ? firstEntry.at.toDate() : null;

  const scheduled = new Date(`${booking.scheduledDate}T${booking.scheduledTime || '09:00'}:00`);
  const anchor = startedAt ?? scheduled;
  const eta = new Date(anchor.getTime() + durationMin * 60000);

  const elapsedMin = startedAt ? Math.max(0, Math.round((now.getTime() - startedAt.getTime()) / 60000)) : null;

  const done = booking.status === 'completed' || job?.status === 'completed';
  const jobAct = job ? actFromJobStatus(job.status) : null;
  const ready = jobAct === 'ready' || careAct(booking.status) === 'ready';
  const cancelled = booking.status === 'cancelled' || job?.status === 'cancelled';

  let etaConfidence: CareState['etaConfidence'] = null;
  if (!done && !ready && !cancelled) {
    if (startedAt) etaConfidence = now > eta ? 'overrun' : 'live';
    else etaConfidence = 'planned';
  }

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
    live: visitPhase(booking.status) === 'live' && !done,
  };
}

/* ── small formatters shared by tracker + strip + home ─────────────────── */

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


/* re-export the boundary for consumers that only need phase checks */
export { visitPhase, careAct, actIndex, ACT_ORDER };
