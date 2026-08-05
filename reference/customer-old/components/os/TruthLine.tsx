'use client';
/**
 * One sentence of state (design system §7.2). Crossfades on change; aria-live.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { crossfade } from '@/lib/os/motion';

export default function TruthLine({ text, onPhoto = false }: { text: string; onPhoto?: boolean }) {
  return (
    <div aria-live="polite" style={{ minHeight: 28 }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={text}
          {...crossfade}
          style={{
            fontFamily: 'var(--st-text)', fontWeight: 400, fontSize: 19, lineHeight: 1.45,
            color: onPhoto ? 'var(--st-over-2)' : 'var(--st-ink-2)', margin: 0,
          }}
        >
          {text}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
