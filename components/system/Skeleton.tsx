'use client';
/**
 * SKELETON
 *
 * Source: docs/AUTOMODZ-OS.md §19.4, §19.1, §7.4, §7.6
 *
 * §19.4: "When the room is already on screen and one thing inside it is still
 * arriving, that thing shows its own placeholder AT ITS FINAL SIZE, so nothing
 * moves when it lands. Layout that shifts under a reading customer is a
 * failure of preparation."
 *
 * That sentence is why `width` and `height` are required rather than defaulted
 * - a skeleton that does not know the size it is reserving is not doing the
 * one job it exists for.
 *
 * §7.4 permits looping motion in exactly two places, and a loading state is
 * one of them. §7.6 stops it under reduced motion, where the placeholder
 * simply rests at its dimmest.
 *
 * §19.1 - this is LOADING. It must never be left on screen to represent empty
 * or failed; those are different states with different treatments (§18, §20).
 */
import { motion, useReducedMotion } from 'framer-motion';
import type { CSSProperties } from 'react';
import { color, radius, loop } from '@/design';
import type { Radius } from '@/design';

export interface SkeletonProps {
  /** §19.4 - the final size. Required. */
  width: number | string;
  /** §19.4 - the final size. Required. */
  height: number | string;
  radius?: Radius;
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({
  width,
  height,
  radius: r = 'card',
  className,
  style,
}: SkeletonProps) {
  const still = useReducedMotion();
  return (
    <motion.div
      className={className}
      aria-hidden
      /* Deterministic on both sides - see the note in Loading.tsx. A style
         branched on `useReducedMotion()` is an attribute mismatch, because the
         hook returns null on the server and a boolean on the client. */
      initial={{ opacity: 0.5 }}
      animate={still ? undefined : { opacity: [0.5, 0.9, 0.5] }}
      transition={still ? undefined : {
        duration: loop.breathPeriod / 1000,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      style={{
        width,
        height,
        borderRadius: radius[r],
        background: color.surface,
        ...style,
      }}
    />
  );
}
