'use client';
import { ReactNode, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * Bottom sheet on mobile, centered dialog feel on desktop (max-w).
 * Content is never opacity-gated - the sheet slides, the content is solid.
 */
export default function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
          <motion.div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="glass-strong relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl pb-safe max-h-[88dvh] overflow-y-auto no-scrollbar"
            initial={{ y: 48 }} animate={{ y: 0 }} exit={{ y: 48, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            <div className="sticky top-0 z-10 glass-nav flex items-center justify-between px-5 py-4 rounded-t-3xl">
              <h3 className="font-display font-600 text-base">{title}</h3>
              <button
                onClick={onClose}
                aria-label="Close"
                className="btn-ghost !p-2 !rounded-full"
                style={{ minWidth: 44, minHeight: 44 }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
