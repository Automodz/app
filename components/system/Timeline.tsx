'use client';
/**
 * TIMELINE - an ordered sequence with one current step.
 *
 * Source: docs/AUTOMODZ-OS.md §13.5, §16.1, §21.6, §21.7, §3.3
 *
 * §13.5 gives the two rules that shape this component:
 *   "the stages, with the current one evident"
 *   "A stage that can never be reached must not be shown. A permanently unlit
 *    step teaches the customer the interface is decorative."
 *
 * The second binds the caller - this component renders the steps it is given
 * and cannot know which are reachable. It is checklist question 16 ("is every
 * control's destination real?") applied to a display.
 *
 * §21.6 - the sequence is a real ordered list, so it is announced as one, and
 * the current step is marked with aria-current rather than by colour alone.
 * §3.3 - a done step is ink, a pending step is ink3; nothing is coloured to
 * show progress.
 */
import type { CSSProperties, ReactNode } from 'react';
import { color, space, radius, duration, easing, HAIRLINE } from '@/design';
import { toneColor, type Tone } from './tone';
import { Text } from './Text';

export interface TimelineStep {
  id: string;
  label: ReactNode;
  /** Optional second line - what was seen or done. */
  detail?: ReactNode;
}

export interface TimelineProps {
  steps: TimelineStep[];
  /** Index of the current step. Everything before it is complete. */
  current: number;
  /** §3.3 - the tone of completed steps. State colours only where it IS a state. */
  tone?: Tone;
  className?: string;
  style?: CSSProperties;
}

export function Timeline({
  steps,
  current,
  tone = 'ink',
  className,
  style,
}: TimelineProps) {
  const done = toneColor(tone);
  return (
    <ol
      className={className}
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: space.gap,
        ...style,
      }}
    >
      {steps.map((s, i) => {
        const complete = i < current;
        const isCurrent = i === current;
        const reached = complete || isCurrent;
        return (
          <li
            key={s.id}
            aria-current={isCurrent ? 'step' : undefined}
            style={{ display: 'flex', gap: space.gap, alignItems: 'flex-start' }}
          >
            <span
              aria-hidden
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                alignSelf: 'stretch',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: space.line,
                  height: space.line,
                  borderRadius: radius.pill,
                  marginTop: space.hair,
                  background: reached ? done : 'transparent',
                  border: reached ? 'none' : `${HAIRLINE}px solid ${color.edge}`,
                  transition: `background ${duration.move}ms ${easing.ease}`,
                }}
              />
              {i < steps.length - 1 ? (
                <span
                  style={{
                    flex: 1,
                    width: HAIRLINE,
                    minHeight: space.gap,
                    marginBlock: space.hair,
                    background: complete ? done : color.edge,
                  }}
                />
              ) : null}
            </span>
            <span style={{ paddingBottom: space.breath }}>
              <Text role="body" tone={reached ? 'ink' : 'ink3'}>{s.label}</Text>
              {s.detail ? (
                <Text role="whisper" tone="ink3" style={{ marginTop: space.hair }}>
                  {s.detail}
                </Text>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
