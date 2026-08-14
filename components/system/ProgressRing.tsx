'use client';
/**
 * PROGRESS RING - determinate only.
 *
 * Source: docs/AUTOMODZ-OS.md §19.3, §7.6, §21.6, §21.7, §3.3
 *
 * §19.3 permits exactly one spinner in the product, inside a pressed control.
 * This is NOT that: an indeterminate ring would be a second spinner, so
 * `value` is required and the component has no indeterminate mode. It shows a
 * known fraction of something, and nothing else.
 *
 * §3.3 - the track and the arc are ink by default. A state colour is allowed
 * only where the progress ITSELF is one of the four states (§9.2); it is never
 * coloured to look lively.
 *
 * §21.6 - a ring is a graphic, so it carries a `label` and reports its value
 * through the progressbar role. §21.7 - a value that changes without the
 * customer acting is announced politely.
 */
import { motion, useReducedMotion } from 'framer-motion';
import type { CSSProperties } from 'react';
import { color, duration, easing, STROKE, curve,
} from '@/design';
import { toneColor, type Tone } from './tone';

export interface ProgressRingProps {
  /** 0–1. Required - there is no indeterminate mode (§19.3). */
  value: number;
  /** Diameter in px. */
  size: number;
  /** §21.6 - what this ring is measuring, in the customer's words. */
  label: string;
  tone?: Tone;
  /** Multiple of the icon stroke, so the ring matches the glyphs beside it. */
  weight?: number;
  className?: string;
  style?: CSSProperties;
}

export function ProgressRing({
  value,
  size,
  label,
  tone = 'ink',
  weight = STROKE * 2,
  className,
  style,
}: ProgressRingProps) {
  const still = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, value));
  const r = (size - weight) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-live="polite"
      style={{ display: 'block', ...style }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color.edge}
        strokeWidth={weight}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={toneColor(tone)}
        strokeWidth={weight}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={false}
        animate={{ strokeDashoffset: circumference * (1 - clamped) }}
        transition={still ? { duration: 0 } : {
          duration: duration.move / 1000,
          ease: curve.ease,
        }}
        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: easing.ease }}
      />
    </svg>
  );
}
