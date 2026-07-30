'use client';
/**
 * LOADING — the breath.
 *
 * Source: docs/AUTOMODZ-OS.md §19.1, §19.2, §19.3, §7.4, §7.6
 *
 * §19.2: "While the application establishes itself, it shows a calm, branded
 * moment — quiet, unhurried, confident. NOT a spinner. A spinner says
 * *waiting*; a considered moment says *preparing*."
 *
 * So this is a slowly breathing hairline, not a rotating anything. §19.3 puts
 * the product's only spinner inside a pressed control, and it lives in
 * `Button` where it cannot be reused.
 *
 * "Branded" is the caller's to supply — a wordmark, a name, nothing at all.
 * This component knows no brand (it may not), so branding arrives as children.
 *
 * §19.1 — this is LOADING, and must be distinguishable from empty and failed.
 * The caption exists so it can say so out loud.
 */
import { motion, useReducedMotion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';
import { color, space, radius, loop, easing } from '@/design';
import { Text } from './Text';

export interface LoadingProps {
  /** Said plainly, so loading never reads as empty (§19.1). */
  caption?: string;
  /** The "branded moment" (§19.2) — supplied by the caller, never known here. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Loading({ caption, children, className, style }: LoadingProps) {
  const still = useReducedMotion();
  return (
    <div
      className={className}
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.gap,
        ...style,
      }}
    >
      {children}
      <div
        aria-hidden
        style={{
          width: space.movement,
          height: 2,
          borderRadius: radius.pill,
          background: color.edge,
          overflow: 'hidden',
        }}
      >
        <motion.div
          /* `initial` is NOT branched on reduced motion. `useReducedMotion()`
             returns null while server-rendering and a boolean once mounted, so
             `opacity: still ? 0.6 : undefined` emitted no opacity attribute on
             the server and `0.6` on the client — an attribute mismatch React
             refuses to patch. The resting value is therefore identical on both
             and §7.6 is honoured by withholding the ANIMATION instead. */
          initial={{ opacity: 0.6, scaleX: 0.15 }}
          animate={still ? undefined : { scaleX: [0.15, 1, 0.15], opacity: [0.4, 1, 0.4] }}
          transition={still ? undefined : {
            duration: loop.breathPeriod / 1000,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            width: '100%',
            height: '100%',
            transformOrigin: 'left',
            background: color.ink2,
            transition: easing.ease,
          }}
        />
      </div>
      {caption ? <Text role="whisper" tone="ink3">{caption}</Text> : null}
    </div>
  );
}
