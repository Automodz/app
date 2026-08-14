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
          /* AnimatePresence tracks children by key; a conditional child should
             carry one so enter/exit is unambiguous. (This did NOT turn out to
             be the source of the shell's "unique key" warning - see the
             carry-forward note in the shell phase - but it is correct either
             way and framer's own docs call for it.) */
          key="offline"
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
          <Whisper tone="ink-2">You’re offline - showing your last saved details.</Whisper>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
