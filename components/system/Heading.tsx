/**
 * HEADING
 *
 * Source: docs/AUTOMODZ-OS.md §9.5, §3.2, §21.6
 *
 * Two levels, because §9.5 names two heading roles and no more:
 *
 *   display - "the one statement per screen". Renders the top-level heading.
 *   title   - "a section".
 *
 * §9.5 and §3.2 both bind the caller rather than this component: one Display
 * per screen, because a screen with two has two subjects, "which means it has
 * none". This component cannot enforce that - a component sees one screen's
 * worth of nothing - so it is a review-checklist item (§7 of the checklist),
 * not a runtime guard.
 *
 * §21.6 requires headings to descend without skipping. The element comes from
 * the token, so `display` is always the h1 and `title` always the h2; `as`
 * exists for the case where a title appears somewhere an h2 would break the
 * outline, and it changes the element without touching the appearance.
 */
import type { CSSProperties, ElementType, ReactNode } from 'react';
import { type as typeScale } from '@/design';
import { toneColor, type Tone } from './tone';

/** §9.5 - the two heading roles. */
export type HeadingLevel = 'display' | 'title';

export interface HeadingProps {
  /** Defaults to `title`; a Display is a deliberate choice, never a default. */
  level?: HeadingLevel;
  tone?: Tone;
  /** Change the element only. Appearance stays with the level. */
  as?: ElementType;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  id?: string;
}

export function Heading({
  level = 'title',
  tone = 'ink',
  as,
  children,
  className,
  style,
  ...rest
}: HeadingProps) {
  const t = typeScale[level];
  const Tag = (as ?? t.element) as ElementType;

  return (
    <Tag
      className={className}
      style={{
        margin: 0,
        fontFamily: t.family,
        fontSize: t.size,
        fontWeight: t.weight,
        lineHeight: t.lineHeight,
        letterSpacing: t.letterSpacing,
        color: toneColor(tone),
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
