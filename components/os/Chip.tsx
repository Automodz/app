'use client';
/**
 * The status chip - the one at-a-glance status object in the customer product,
 * and the primary carrier of the colour language:
 *
 *   ok      green   protected · ready · completed · active
 *   warn    amber   waiting · due · approval required
 *   info    blue    booked · membership
 *   urgent  red     expired · payment · warranty issue
 *   neutral quiet   nothing owed
 *
 * A whisper-tint ground, a status dot, one word of `st-data`. Never a fill,
 * never a colour block, never decoration - the colour IS the meaning.
 */
import type { ReactNode } from 'react';

export type Tone = 'ok' | 'warn' | 'info' | 'urgent' | 'neutral';

const FG: Record<Tone, string> = {
  ok: 'var(--st-ok)', warn: 'var(--st-warn)', info: 'var(--st-info)',
  urgent: 'var(--st-urgent)', neutral: 'var(--st-neutral)',
};
const BG: Record<Tone, string> = {
  ok: 'var(--st-ok-bg)', warn: 'var(--st-warn-bg)', info: 'var(--st-info-bg)',
  urgent: 'var(--st-urgent-bg)', neutral: 'var(--st-neutral-bg)',
};

export default function Chip({
  tone = 'neutral', dot = true, children,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, flex: '0 0 auto',
      background: BG[tone], color: FG[tone],
      borderRadius: 'var(--st-r-pill)', padding: '4px 10px',
      fontFamily: 'var(--st-data)', fontSize: 12, lineHeight: 1.2, whiteSpace: 'nowrap',
    }}>
      {dot && <span aria-hidden style={{
        width: 5, height: 5, borderRadius: '50%', background: 'currentColor',
      }} />}
      {children}
    </span>
  );
}
