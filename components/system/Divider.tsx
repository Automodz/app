/**
 * DIVIDER
 *
 * Source: docs/AUTOMODZ-OS.md §9.1, §3.4
 *
 * §9.1 names Edge - "the hairline that separates a material from its ground".
 * §3.4 constrains what it may do: depth comes from light, so a divider marks a
 * boundary and never creates a lift. It is the thinnest visible line and
 * nothing more.
 *
 * No variants. A thicker or coloured divider would be decoration, and §3.3
 * permits no colour that does not carry meaning.
 */
import type { CSSProperties } from 'react';
import { color, space, HAIRLINE } from '@/design';

export interface DividerProps {
  /** Vertical breathing room around the line, from the rhythm scale (§8.3). */
  inset?: keyof typeof space | 'none';
  className?: string;
  style?: CSSProperties;
}

export function Divider({ inset = 'none', className, style }: DividerProps) {
  const m = inset === 'none' ? 0 : space[inset];
  return (
    <hr
      className={className}
      aria-hidden
      style={{
        border: 0,
        height: HAIRLINE,
        background: color.edge,
        marginBlock: m,
        marginInline: 0,
        ...style,
      }}
    />
  );
}
