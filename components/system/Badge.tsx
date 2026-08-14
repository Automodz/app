/**
 * BADGE - a neutral marker.
 *
 * Source: docs/AUTOMODZ-OS.md §3.3, §9.2, §9.5
 *
 * §3.3: "Colour is information, never decoration." §9.2 reserves saturated
 * colour for exactly four states. A badge is therefore DELIBERATELY colourless
 * - it counts, labels or tags, and none of those is a state.
 *
 * When the thing being marked *is* one of the four states, the component is
 * `StatusChip`, not a coloured Badge. Keeping them apart is what stops the
 * palette leaking into decoration.
 */
import type { CSSProperties, ReactNode } from 'react';
import { color, radius, space, type as typeScale, HAIRLINE } from '@/design';
import { toneColor } from './tone';
import type { InkTone } from './tone';

export interface BadgeProps {
  /** Ink only - a badge may never take a state colour. §9.2 */
  tone?: InkTone;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Badge({ tone = 'ink2', children, className, style }: BadgeProps) {
  const t = typeScale.whisper;
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: space.hair,
        paddingInline: space.breath,
        paddingBlock: space.hair,
        borderRadius: radius.chip,
        border: `${HAIRLINE}px solid ${color.edge}`,
        fontFamily: t.family,
        fontSize: t.size,
        fontWeight: t.weight,
        lineHeight: t.lineHeight,
        letterSpacing: t.letterSpacing,
        color: toneColor(tone),
        ...style,
      }}
    >
      {children}
    </span>
  );
}
