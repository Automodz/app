'use client';
/**
 * The conversation's index (design system §7.4): adaptive object shelf rows —
 * Body 19 words, no icons, no chevrons. One component, two presentations
 * (Desk surface and capsule long-press sheet). Thread & search arrive in P2.
 */
import { motion } from 'framer-motion';
import { studioEase, tick } from '@/lib/os/motion';
import { Whisper } from './text';

export interface ShelfRow {
  label: string;            // "The C 43's care"
  detail?: string;          // whisper alongside ("2 records")
  onTap: () => void;
}

export default function Desk({ rows }: { rows: ShelfRow[] }) {
  return (
    <nav aria-label="The studio's desk">
      {rows.map(row => (
        <motion.button
          key={row.label}
          onClick={row.onTap}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: tick, ease: studioEase }}
          style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            width: '100%', minHeight: 52, padding: '12px 0',
            background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <span style={{
            fontFamily: 'var(--st-text)', fontWeight: 400, fontSize: 19,
            lineHeight: 1.45, color: 'var(--st-ink)',
          }}>
            {row.label}
          </span>
          {row.detail && <Whisper as="span">{row.detail}</Whisper>}
        </motion.button>
      ))}
    </nav>
  );
}
