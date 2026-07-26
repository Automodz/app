'use client';
/**
 * THE SECTION - vertical rhythm, made a component so it cannot drift.
 * (Design Language §10)
 *
 * The spacing law is that rhythm ESCALATES, never alternates: `line` within a
 * group, `rest` between sections, `movement` between acts. A section that uses
 * `gap` where its neighbour uses `rest` reads as a mistake even when nobody
 * can say why - so the numbers live here instead of in every screen.
 *
 * It also owns the one page gutter (`--st-inset`) and the heading level, so a
 * screen gets a real document outline for free rather than a wall of divs.
 */
import type { ReactNode } from 'react';
import { Whisper } from './text';
import Action from './Action';

const RHYTHM = {
  /** between sections */
  rest: 'var(--st-rest)',
  /** between acts - a change of subject */
  movement: 'var(--st-movement)',
  /** a continuation of the section above it */
  line: 'var(--st-gap)',
} as const;

export interface SectionProps {
  /** the small label above the content. Omit for an unheaded section. */
  title?: string;
  /** one optional action, aligned to the title */
  actionLabel?: string;
  onAction?: () => void;
  /** how much air sits above this section */
  rhythm?: keyof typeof RHYTHM;
  /** the hero is full-bleed; everything else takes the page gutter */
  bleed?: boolean;
  children: ReactNode;
}

export default function Section({
  title, actionLabel, onAction, rhythm = 'rest', bleed = false, children,
}: SectionProps) {
  return (
    <section
      aria-label={title}
      style={{
        marginTop: RHYTHM[rhythm],
        padding: bleed ? 0 : '0 var(--st-inset)',
        // the reading column is capped and centred; the hero stays full-bleed
        maxWidth: bleed ? undefined : 'var(--st-measure)',
        marginLeft: bleed ? undefined : 'auto',
        marginRight: bleed ? undefined : 'auto',
      }}
    >
      {title && (
        <header style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          gap: 'var(--st-line)', marginBottom: 'var(--st-line)',
          padding: bleed ? '0 var(--st-inset)' : 0,
        }}>
          {/* a mono kicker, not a heading shout - the content carries the weight */}
          <Whisper
            as="h2"
            tone="ink-2"
            style={{
              fontFamily: 'var(--st-data)', fontSize: 11, letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}
          >
            {title}
          </Whisper>
          {actionLabel && onAction && (
            <Action variant="forward" scale="inline" onClick={onAction}>{actionLabel}</Action>
          )}
        </header>
      )}
      {children}
    </section>
  );
}
