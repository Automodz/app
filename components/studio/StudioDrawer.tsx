'use client';
/**
 * StudioDrawer — the Studio Board's context workspace. Walk-ins, jobs and
 * bookings open here, over the board, so the operator never leaves the
 * screen that runs the day. Right-side panel on desktop, full sheet on
 * mobile. One drawer, one target at a time; cross-links switch the target
 * in place (job → its booking) instead of navigating.
 */
import { ReactNode, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import WalkInFlow from '@/components/intake/WalkInFlow';
import JobWorkspace from '@/components/workspace/JobWorkspace';
import BookingWorkspace from '@/components/workspace/BookingWorkspace';

export type DrawerTarget =
  | { kind: 'walkin' }
  | { kind: 'job'; id: string }
  | { kind: 'booking'; id: string }
  | { kind: 'tech'; id: string };

export default function StudioDrawer({ target, onClose, onTarget, renderTech }: {
  target: DrawerTarget | null;
  onClose: () => void;
  onTarget: (t: DrawerTarget) => void;
  /** the board supplies the technician workspace with its own live data */
  renderTech?: (employeeId: string) => ReactNode;
}) {
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [target, onClose]);

  let content: ReactNode = null;
  if (target?.kind === 'walkin') {
    content = <WalkInFlow onDone={id => onTarget({ kind: 'job', id })} />;
  } else if (target?.kind === 'job') {
    content = <JobWorkspace id={target.id} onBack={onClose} backLabel="STUDIO BOARD"
      onOpenBooking={id => onTarget({ kind: 'booking', id })} />;
  } else if (target?.kind === 'booking') {
    content = <BookingWorkspace id={target.id} onBack={onClose} backLabel="STUDIO BOARD" />;
  } else if (target?.kind === 'tech') {
    content = renderTech?.(target.id) ?? null;
  }

  return (
    <AnimatePresence>
      {target && (
        <div className="fixed inset-0 z-[90]">
          <motion.div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            key={target.kind + ('id' in target ? target.id : '')}
            className="absolute right-0 top-0 bottom-0 w-full md:max-w-2xl lg:max-w-3xl flex flex-col"
            style={{ background: 'var(--void)', borderLeft: '1px solid var(--border)', paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)' }}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}>
            <button onClick={onClose} aria-label="Close"
              className="absolute top-4 right-4 z-10 w-9 h-9 flex items-center justify-center rounded-xl"
              style={{ background: 'var(--dark)', color: 'var(--steel)', border: '1px solid var(--border)' }}>
              <X size={15} />
            </button>
            <div className="flex-1 overflow-y-auto overscroll-contain">{content}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
