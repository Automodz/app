/**
 * The four text primitives - every character in the customer product is one
 * of these (design system §3). Raw font sizes outside this file are a defect.
 */
import type { CSSProperties, ReactNode, ElementType } from 'react';

type Tone = 'ink' | 'ink-2' | 'ink-3' | 'over' | 'over-2' | 'assent' | 'caution';

const COLOR: Record<Tone, string> = {
  'ink': 'var(--st-ink)', 'ink-2': 'var(--st-ink-2)', 'ink-3': 'var(--st-ink-3)',
  'over': 'var(--st-over)', 'over-2': 'var(--st-over-2)',
  'assent': 'var(--st-assent)', 'caution': 'var(--st-caution)',
};

interface TextProps {
  children: ReactNode;
  tone?: Tone;
  as?: ElementType;
  style?: CSSProperties;
  className?: string;
}

function make(base: CSSProperties, defaultTone: Tone, defaultTag: ElementType) {
  return function Text({ children, tone = defaultTone, as, style, className }: TextProps) {
    const Tag = as ?? defaultTag;
    return (
      <Tag className={className} style={{ ...base, color: COLOR[tone], margin: 0, ...style }}>
        {children}
      </Tag>
    );
  };
}

/** 24 / 32 / 44 - the car's name, act titles, chapter titles. */
export const Display = make(
  { fontFamily: 'var(--st-display)', fontWeight: 620, fontSize: 32, lineHeight: 1.1, letterSpacing: '-0.02em' },
  'ink', 'h1',
);
export const DisplayLarge = make(
  { fontFamily: 'var(--st-display)', fontWeight: 620, fontSize: 44, lineHeight: 1.05, letterSpacing: '-0.02em' },
  'ink', 'h1',
);
export const Title = make(
  { fontFamily: 'var(--st-display)', fontWeight: 560, fontSize: 24, lineHeight: 1.2, letterSpacing: '-0.01em' },
  'ink', 'h2',
);

/** 16 default · 19 emphasis. */
export const Body = make(
  { fontFamily: 'var(--st-text)', fontWeight: 400, fontSize: 16, lineHeight: 1.45 },
  'ink', 'p',
);
export const Emphasis = make(
  { fontFamily: 'var(--st-text)', fontWeight: 520, fontSize: 19, lineHeight: 1.45 },
  'ink', 'p',
);

/** Plates, VINs, dates, amounts only. */
export const Data = make(
  { fontFamily: 'var(--st-data)', fontWeight: 400, fontSize: 14, lineHeight: 1.45 },
  'ink-2', 'span',
);

/** 12/14 - staleness, hints, silence. */
export const Whisper = make(
  { fontFamily: 'var(--st-text)', fontWeight: 400, fontSize: 12, lineHeight: 1.45 },
  'ink-3', 'p',
);
