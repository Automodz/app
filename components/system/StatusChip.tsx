/**
 * STATUS CHIP — one of the four states.
 *
 * Source: docs/AUTOMODZ-OS.md §9.2, §3.3, §21.6
 *
 * §9.2 names four states and no others: assent, caution, urgent, lapsed. The
 * `tone` prop is closed to exactly those, so the component cannot be used to
 * introduce a fifth meaning or to colour something decoratively (§3.3).
 *
 * §21.6 — colour alone must never be the only carrier of meaning, so the chip
 * always renders its label. There is no icon-only or dot-only mode; a dot on
 * its own is invisible to anyone who cannot separate these four hues.
 */
import type { CSSProperties, ReactNode } from 'react';
import { radius, space, type as typeScale } from '@/design';
import type { StateTone } from '@/design';
import { toneColor } from './tone';

export interface StatusChipProps {
  /** §9.2 — the four states, closed. */
  tone: StateTone;
  /** The label. Required: colour is never the only signal (§21.6). */
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function StatusChip({ tone, children, className, style }: StatusChipProps) {
  const t = typeScale.whisper;
  const c = toneColor(tone);
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: space.breath,
        paddingInline: space.breath,
        paddingBlock: space.hair,
        borderRadius: radius.chip,
        fontFamily: t.family,
        fontSize: t.size,
        fontWeight: t.weight,
        lineHeight: t.lineHeight,
        letterSpacing: t.letterSpacing,
        color: c,
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          width: space.breath,
          height: space.breath,
          borderRadius: radius.pill,
          background: c,
          flexShrink: 0,
        }}
      />
      {children}
    </span>
  );
}
