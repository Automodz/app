'use client';
/**
 * The status chip (UX-1) - the one at-a-glance status object in the customer
 * product. Monochrome + the two brand accents only: `ok` (protected / live),
 * `warn` (needs attention), `neutral` (pending / quiet). A whisper-tint ground,
 * a status dot, one word of `st-data`. Never a fill, never a colour block.
 */
import type { ReactNode } from 'react';

type Tone = 'ok' | 'warn' | 'neutral';

const FG: Record<Tone, string> = {
  ok: 'var(--st-ok)', warn: 'var(--st-warn)', neutral: 'var(--st-neutral)',
};
const BG: Record<Tone, string> = {
  ok: 'var(--st-ok-bg)', warn: 'var(--st-warn-bg)', neutral: 'var(--st-neutral-bg)',
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
