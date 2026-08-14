/**
 * SECTION
 *
 * Source: docs/AUTOMODZ-OS.md §8.2, §8.3, §8.4, §9.5, §18.1
 *
 * A titled group, and the place the rhythm scale is actually spent. §8.3 gives
 * two step sizes that matter at this level:
 *
 *   rest      between groups
 *   movement  between sections - "where the eye is meant to pause"
 *
 * Those are the only two `rhythm` values, because those are the only two §8.3
 * offers for separating groups.
 *
 * §8.2 - the measure caps reading width. §8.4 - text and controls are inset to
 * the gutter. Both are applied here so a caller composing sections gets the
 * column for free and cannot accidentally place body text full-bleed.
 *
 * §18.1 binds the CALLER, not this component: "absence renders as silence" -
 * a section with nothing in it should not be rendered at all, rather than
 * rendered empty. There is deliberately no `empty` prop to make that easy.
 */
import type { CSSProperties, ReactNode } from 'react';
import { space, INSET, MEASURE } from '@/design';
import { Heading } from './Heading';

export interface SectionProps {
  /** Optional. An unheaded section is a group, not a mistake. */
  title?: ReactNode;
  /** A single control belonging to the heading - "read more", "all of it". */
  action?: ReactNode;
  /** §8.3 - the space BELOW this section. */
  rhythm?: 'rest' | 'movement';
  /** §8.4 - set false for full-bleed children (photographs, immersive media). */
  inset?: boolean;
  /** §8.2 - set false for content exempt from the measure. */
  measured?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Section({
  title,
  action,
  rhythm = 'rest',
  inset = true,
  measured = true,
  children,
  className,
  style,
}: SectionProps) {
  return (
    <section
      className={className}
      style={{
        marginBottom: space[rhythm],
        paddingInline: inset ? INSET : 0,
        maxWidth: measured ? MEASURE + INSET * 2 : undefined,
        marginInline: measured ? 'auto' : undefined,
        width: '100%',
        ...style,
      }}
    >
      {(title || action) ? (
        <header
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: space.gap,
            marginBottom: space.gap,
          }}
        >
          {title ? <Heading level="title">{title}</Heading> : <span />}
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}
