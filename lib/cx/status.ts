/**
 * CX status system — one mapping from booking status to tone + concierge
 * voice. Replaces per-file colour ternaries and robotic labels on every
 * customer surface. (Staff surfaces keep getStatusLabel — operational
 * vocabulary is theirs.)
 */
import type { BookingStatus } from '@/lib/types';

export type Tone = 'waiting' | 'live' | 'good' | 'done' | 'stopped';

export const TONE_COLOR: Record<Tone, string> = {
  waiting: 'var(--info)',
  live: 'var(--success)',
  good: 'var(--success)',
  done: 'var(--steel)',
  stopped: 'var(--danger)',
};

export const STATUS_CX: Record<BookingStatus, { label: string; line: string; tone: Tone }> = {
  pending:            { label: 'Requested',      line: 'The studio is confirming your slot.',        tone: 'waiting' },
  confirmed:          { label: 'Confirmed',      line: 'Your slot is reserved. See you soon.',       tone: 'waiting' },
  vehicle_received:   { label: 'In the studio',  line: 'Your car has been checked in.',              tone: 'live' },
  in_progress:        { label: 'Being cared for',line: 'Work is underway in the bay.',               tone: 'live' },
  quality_check:      { label: 'Final inspection', line: 'Every panel gets a second look.',          tone: 'live' },
  ready_for_delivery: { label: 'Ready',          line: 'Your car is ready whenever you are.',        tone: 'good' },
  completed:          { label: 'Delivered',      line: 'Thanks for trusting us with your car.',      tone: 'done' },
  cancelled:          { label: 'Cancelled',      line: 'This visit was cancelled.',                  tone: 'stopped' },
};
