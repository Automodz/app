'use client';
/**
 * The offline line. A calm, translucent bar at the very top of the customer
 * shell that appears only when the connection drops - the app keeps showing the
 * last saved details beneath it. No spinner, no alarm; it fades in and out.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { crossfade } from '@/lib/os/motion';
import { useOnline } from './useOnline';
import { Whisper } from './text';

export default function OfflineBar() {
  const online = useOnline();
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          {...crossfade}
          role="status"
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 70,
            paddingTop: 'calc(env(safe-area-inset-top) + 8px)', paddingBottom: 8,
            paddingLeft: 'var(--st-inset)', paddingRight: 'var(--st-inset)',
            textAlign: 'center',
            background: 'var(--st-glass)',
            backdropFilter: 'var(--st-glass-blur)', WebkitBackdropFilter: 'var(--st-glass-blur)',
            borderBottom: '1px solid var(--st-hairline)',
          }}
        >
          <Whisper tone="ink-2">You’re offline — showing your last saved details.</Whisper>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
