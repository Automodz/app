'use client';
/**
 * THE TOGGLE PILL - a preference as a tactile object, never a settings row.
 * (Design Language §9 · §13)
 *
 * EXTRACTED, not written for one screen. It lived as `NotifPill` inside the
 * Home controller where nothing else could reach it, and a two-state
 * preference is the most reusable control a product has - channels, reminders,
 * consent, visibility. It moves here so the next one costs nothing.
 *
 * On: filled ink with an assent tick. Off: a quiet hairline outline. The state
 * is carried by the FILL, not by colour - the colour language belongs to
 * status (Chip), and a preference is not a status.
 */
import { motion, useReducedMotion } from 'framer-motion';
import { studioEase, tick } from '@/lib/os/motion';

export interface TogglePillProps {
  on: boolean;
  label: string;
  onTap: () => void;
  /** a change in flight - the control holds still rather than lying */
  busy?: boolean;
  disabled?: boolean;
}

export default function TogglePill({ on, label, onTap, busy, disabled }: TogglePillProps) {
  const reduced = useReducedMotion();
  const inert = busy || disabled;

  return (
    <motion.button
      onClick={onTap}
      disabled={inert}
      aria-pressed={on}
      whileTap={inert || reduced ? undefined : { scale: 0.96 }}
      transition={{ duration: tick, ease: studioEase }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        // the target is never smaller than a thumb, whatever the label
        minHeight: 44, padding: '0 16px',
        borderRadius: 'var(--st-r-pill)',
        cursor: inert ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        background: on ? 'var(--st-ink)' : 'transparent',
        border: `1px solid ${on ? 'var(--st-ink)' : 'var(--st-hairline)'}`,
        color: on ? 'var(--st-paper)' : 'var(--st-ink-2)',
        fontFamily: 'var(--st-text)', fontWeight: 500, fontSize: 15,
        transition: 'background var(--st-move) var(--st-ease), color var(--st-move) var(--st-ease), border-color var(--st-move) var(--st-ease)',
      }}
    >
      <span aria-hidden style={{
        width: 15, height: 15, flex: '0 0 auto', display: 'grid', placeItems: 'center',
      }}>
        {on ? (
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
            <path d="M1.5 6.5 L4.5 9.5 L10.5 2.5" stroke="var(--st-paper)" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <span style={{
            width: 11, height: 11, borderRadius: 999, border: '1.5px solid var(--st-ink-3)',
          }} />
        )}
      </span>
      {label}
    </motion.button>
  );
}
