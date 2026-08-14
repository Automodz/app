'use client';
/**
 * TOAST - the visible consequence.
 *
 * Source: docs/AUTOMODZ-OS.md §4.6, §9.3, §20.1, §21.7, §3.3
 *
 * §4.6 is why this exists: "Nothing the customer does may complete invisibly.
 * A save says *saved*. If a mutation produces no visible change, the customer
 * will do it again."
 *
 * §9.3 - it sits in the `alert` band, the one nothing may sit above, because a
 * confirmation the customer cannot see has not confirmed anything.
 *
 * §21.7 - announced politely. A confirmation that only exists visually is
 * invisible to anyone not looking at the screen.
 *
 * §3.3, §9.2 - a toast may carry one of the four state tones when it IS a
 * state. It is never coloured for emphasis.
 *
 * §20.1 - an error toast speaks like the studio. This component takes the
 * words; it never composes them.
 */
import { motion, useReducedMotion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';
import { color, elevation, radius, space, duration, INSET, HAIRLINE, curve,
} from '@/design';
import type { Tone } from './tone';
import { Text } from './Text';

export interface ToastProps {
  children: ReactNode;
  /** §9.2 - only where the message IS a state. */
  tone?: Tone;
  /** Rendered when the message needs a way forward (§20.2). */
  action?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Toast({ children, tone = 'ink', action, className, style }: ToastProps) {
  const still = useReducedMotion();
  return (
    <motion.div
      className={className}
      role="status"
      aria-live="polite"
      initial={still ? false : { opacity: 0, y: space.gap }}
      animate={{ opacity: 1, y: 0 }}
      exit={still ? undefined : { opacity: 0, y: space.gap }}
      transition={still ? { duration: 0 } : {
        duration: duration.move / 1000,
        ease: curve.ease,
      }}
      style={{
        position: 'fixed',
        insetInline: INSET,
        bottom: `calc(${space.rest}px + env(safe-area-inset-bottom, 0px))`,
        zIndex: elevation.alert.z,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space.gap,
        margin: '0 auto',
        maxWidth: 480,
        padding: space.gap,
        borderRadius: radius.card,
        background: color.surface,
        border: `${HAIRLINE}px solid ${color.edge}`,
        boxShadow: elevation.alert.shadow,
        ...style,
      }}
    >
      <Text role="body" tone={tone}>{children}</Text>
      {action}
    </motion.div>
  );
}
