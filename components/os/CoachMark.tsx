'use client';
/**
 * The one nudge (audit #5 — the Conversation is undiscoverable).
 *
 * The capsule is the only global control, and nothing tells a first-timer it
 * is the door to the studio. One sentence, once, sitting just above the
 * capsule it points at; dismissed by reading it or by opening the Desk, and
 * never shown again. It is not a tutorial and it never returns.
 */
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { rise } from '@/lib/os/motion';
import { Body } from './text';
import Action from './Action';

const SEEN = 'automodz-coach-desk';

/** Remembers that the customer has met the capsule — also called on Desk open. */
export function markCoachSeen() {
  try { localStorage.setItem(SEEN, '1'); } catch { /* private mode — the nudge simply repeats */ }
}

export default function CoachMark({ show }: { show: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!show) { setOpen(false); return; }
    let seen = true;
    try { seen = localStorage.getItem(SEEN) === '1'; } catch { /* treat as seen */ }
    setOpen(!seen);
  }, [show]);

  if (!open) return null;

  const dismiss = () => { markCoachSeen(); setOpen(false); };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={rise.transition}
      style={{
        position: 'fixed', left: 0, right: 0,
        bottom: 'calc(env(safe-area-inset-bottom) + 80px)',
        display: 'flex', justifyContent: 'center', zIndex: 49,
        padding: '0 var(--st-inset)', pointerEvents: 'none',
      }}
    >
      <div style={{
        pointerEvents: 'auto',
        maxWidth: 'min(560px, 100%)',
        background: 'var(--st-paper)', borderRadius: 'var(--st-r-card)',
        boxShadow: 'var(--st-lift)', padding: 'var(--st-gap)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 'var(--st-gap)', flexWrap: 'wrap',
      }}>
        <Body tone="ink-2" style={{ flex: '1 1 200px' }}>
          Anything you need — booking, a question, your history — starts here.
        </Body>
        <Action onClick={dismiss}>Got it</Action>
      </div>
    </motion.div>
  );
}
