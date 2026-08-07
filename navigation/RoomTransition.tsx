'use client';
/**
 * ONE ROOM BECOMING ANOTHER.
 *
 * Rooms used to swap instantly. Every other motion in the product is
 * considered, and the single most frequent transition in it — moving between
 * rooms — had none at all, which is what made the application read as a set of
 * separate screens rather than one place.
 *
 * OPACITY ONLY, AND THAT IS NOT A COMPROMISE. A `transform` on an ancestor
 * creates a containing block, which would reparent every `position: fixed`
 * descendant and silently break the Hero's scroll parallax. §7.6 also names
 * opacity as the one property that may survive reduced motion, so the same
 * treatment serves both cases and there is no second code path.
 *
 * `duration.move` (§7.3 — "an element changing place or state") rather than
 * `scene`. A room arriving at 480ms is a room the customer waits for.
 */
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { duration, curve } from '@/design';

export function RoomTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const still = useReducedMotion();

  return (
    <motion.div
      /* Keyed on the address, so the entrance runs per room rather than once
         for the life of the session. */
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: still ? 0 : duration.move / 1000,
        ease: curve.ease,
      }}
    >
      {children}
    </motion.div>
  );
}
