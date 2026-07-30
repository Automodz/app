'use client';
/**
 * useDismissable — the behaviour every layer over the room shares.
 *
 * Source: docs/AUTOMODZ-OS.md §21.5, §22.2
 *
 * §21.5: "Sheets and takeovers trap focus while open and return it where it
 * came from." Both `BottomSheet` and `Modal` owe exactly that, plus Escape and
 * a locked page behind them.
 *
 * §22.2 — one implementation of anything. Two layers with two copies of this
 * logic is how one of them ends up not returning focus, or not releasing the
 * scroll lock, and nobody notices until a customer is stuck.
 */
import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useDismissable(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    // §21.5 — remember where focus came from, so it can go back.
    returnTo.current = document.activeElement as HTMLElement | null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // move focus into the layer
    const first = ref.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? ref.current)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      // §21.5 — the trap. Tab cycles inside the layer and never leaves it.
      if (e.key !== 'Tab' || !ref.current) return;
      const nodes = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(n => n.offsetParent !== null);
      if (nodes.length === 0) { e.preventDefault(); return; }
      const firstNode = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === firstNode) {
        e.preventDefault();
        lastNode.focus();
      } else if (!e.shiftKey && document.activeElement === lastNode) {
        e.preventDefault();
        firstNode.focus();
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = previousOverflow;
      // §21.5 — and back where it came from.
      returnTo.current?.focus?.();
    };
  }, [open, onClose]);

  return ref;
}
