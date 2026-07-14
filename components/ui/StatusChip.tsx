import { ReactNode } from 'react';

/**
 * Status pill. `tone` maps to the status tokens; "accent" is the chrome
 * LIVE treatment. Pass `pulse` for in-progress states.
 */
const TONES = {
  success: { fg: 'var(--success)', bg: 'color-mix(in srgb, var(--success) 14%, transparent)', bd: 'color-mix(in srgb, var(--success) 35%, transparent)' },
  warning: { fg: 'var(--warning)', bg: 'color-mix(in srgb, var(--warning) 13%, transparent)', bd: 'color-mix(in srgb, var(--warning) 32%, transparent)' },
  danger:  { fg: 'var(--danger)',  bg: 'color-mix(in srgb, var(--danger) 13%, transparent)',  bd: 'color-mix(in srgb, var(--danger) 32%, transparent)' },
  info:    { fg: 'var(--info)',    bg: 'color-mix(in srgb, var(--info) 13%, transparent)',    bd: 'color-mix(in srgb, var(--info) 32%, transparent)' },
  neutral: { fg: 'var(--muted)',   bg: 'var(--fog)',          bd: 'var(--border)' },
  accent:  { fg: 'var(--fg)',      bg: 'var(--accent-mist)',  bd: 'var(--border-strong)' },
} as const;

export type StatusTone = keyof typeof TONES;

export default function StatusChip({
  children,
  tone = 'neutral',
  pulse = false,
  className = '',
}: {
  children: ReactNode;
  tone?: StatusTone;
  pulse?: boolean;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <span
      className={`status-badge ${className}`}
      style={{ color: t.fg, background: t.bg, border: `1px solid ${t.bd}` }}
    >
      {pulse && (
        <span
          className="animate-breathe inline-block rounded-full"
          style={{ width: 6, height: 6, background: 'currentColor' }}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}
