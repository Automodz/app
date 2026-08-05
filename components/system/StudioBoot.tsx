'use client';
/**
 * THE ARRIVAL — the studio opening, once a session.
 *
 * Source: reference/customer-old/components/os/StudioBoot.tsx
 *         docs/AUTOMODZ-OS-ARCHITECTURE.md §7
 *
 * The old one was a SPLASH: it covered the screen while the client fetched the
 * customer's garage, and it existed because there was nothing to show yet. The
 * rooms render on the server now, so the facts are in the first byte of HTML —
 * and §7 forbids "motion that delays a fact the customer is waiting for."
 *
 * So the capability is restored, not the blocking. The mark lifts OVER content
 * that is already painted and already readable; a customer who looks past it
 * has lost nothing, and one who does not gets the moment of arrival the old app
 * gave them. It runs once per session, and not at all under reduced motion.
 *
 * `pointerEvents: none` throughout — an arrival that could swallow a tap would
 * be a splash wearing different clothes.
 */
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Wordmark from '@/components/ui/Wordmark';
import { color, elevation, duration, curve } from '@/design';

const SEEN = 'automodz-arrived';

/** Long enough to register, short enough never to be in the way. */
const HOLD_MS = 620;

export function StudioBoot() {
  const still = useReducedMotion();
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    if (still) return;
    let seen = true;
    try { seen = sessionStorage.getItem(SEEN) === '1'; } catch { /* private mode: skip it */ }
    if (seen) return;
    try { sessionStorage.setItem(SEEN, '1'); } catch { /* nothing to remember it with */ }
    setShowing(true);
    const t = setTimeout(() => setShowing(false), HOLD_MS);
    return () => clearTimeout(t);
  }, [still]);

  return (
    <AnimatePresence>
      {showing ? (
        <motion.div
          aria-hidden
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: duration.scene / 1000, ease: curve.ease }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: elevation.alert.z,
            background: color.paper,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: duration.move / 1000, ease: curve.ease }}
          >
            <Wordmark height="clamp(20px, 6vw, 32px)" variant="white" />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
