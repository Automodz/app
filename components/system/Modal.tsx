'use client';
/**
 * MODAL — a full-screen moment.
 *
 * Source: docs/AUTOMODZ-OS.md §8.6, §9.3, §7.2, §7.6, §21.5, §13.2
 *
 * §8.6 — "a thing deserves a full screen when it is the customer's whole
 * attention." That is what this is for: a photograph opened, a live account.
 * If the thing is one of several comparable things, it is a card, not this.
 *
 * §9.3 — the `takeover` band.
 *
 * §7.2 — unlike `BottomSheet`, a takeover is system-initiated, so it moves on
 * the EASE curve. "System motion on a spring feels cheap." The two components
 * differ in curve for that reason, not for variety.
 *
 * §13.2 — "Navigation steps aside." Stepping aside is the caller's business;
 * this component only owns the layer.
 *
 * §21.5 — focus trapped and returned, through the shared hook.
 */
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';
import { color, elevation, scrim, duration, curve,
} from '@/design';
import * as Dialog from '@radix-ui/react-dialog';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** §21.6 — the accessible name of the layer. */
  label: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Modal({ open, onClose, label, children, className, style }: ModalProps) {
  const still = useReducedMotion();

  /* Focus trap, Escape, scroll lock and aria-modal come from Radix — one
     implementation for every layer in the product (§22.2). */
  return (
    <Dialog.Root open={open} onOpenChange={o => { if (!o) onClose(); }}>
    <AnimatePresence>
      {open ? (
        <Dialog.Portal forceMount>
        <Dialog.Content asChild aria-label={label}>
        <motion.div
          className={className}
          initial={still ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={still ? undefined : { opacity: 0 }}
          /* §7.2 — the ease curve; this is system-initiated. */
          transition={still ? { duration: 0 } : {
            duration: duration.scene / 1000,
            ease: curve.ease,
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: elevation.takeover.z,
            background: color.paper,
            overflowY: 'auto',
            ...style,
          }}
        >
          <Dialog.Title style={{
            position: 'absolute', width: 1, height: 1, overflow: 'hidden',
            clipPath: 'inset(50%)', whiteSpace: 'nowrap',
          }}>{label}</Dialog.Title>
          <Dialog.Close
            aria-hidden
            tabIndex={-1}
            style={{
              position: 'absolute', inset: 0, border: 0, padding: 0,
              background: `rgba(0,0,0,${scrim.layer})`, cursor: 'default',
            }}
          />
          <div style={{ position: 'relative' }}>{children}</div>
        </motion.div>
        </Dialog.Content>
        </Dialog.Portal>
      ) : null}
    </AnimatePresence>
    </Dialog.Root>
  );
}
