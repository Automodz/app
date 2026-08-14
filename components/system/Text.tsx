/**
 * TEXT
 *
 * Source: docs/AUTOMODZ-OS.md §9.5, §9.1
 *
 * §9.5 names five typographic roles. Three of them are text - Body, Data and
 * Whisper. The other two are headings and live in `Heading`, because §21.6
 * ties them to a document outline that a body paragraph must never enter.
 *
 * The `role` variant is justified: §9.5 states the roles exist and what each
 * is for. No other variant is offered - a size or weight prop would let a
 * caller invent a sixth role, which §9.5 forbids by saying "everything is one
 * of them".
 */
import type { CSSProperties, ElementType, ReactNode } from 'react';
import { type as typeScale } from '@/design';
import { toneColor, type Tone } from './tone';

/** §9.5 - the three text roles. Display and Title are headings. */
export type TextRole = 'body' | 'data' | 'whisper';

export interface TextProps {
  /** §9.5. Defaults to Body - "what is being said". */
  role?: TextRole;
  /** §9.1, §9.2. Defaults to primary ink. */
  tone?: Tone;
  /** Override the element without changing the role's appearance. */
  as?: ElementType;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** §21.7 - for text that changes without the customer acting. */
  'aria-live'?: 'polite' | 'off';
  id?: string;
}

export function Text({
  role = 'body',
  tone = 'ink',
  as,
  children,
  className,
  style,
  ...rest
}: TextProps) {
  const t = typeScale[role];
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
