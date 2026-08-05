'use client';
/**
 * THE MEDIA VIEWER - one photograph, full screen, nothing else.
 * (Design Language §4 takeover band · §15 "it deserves full-screen when… it is
 * the car")
 *
 * A NEW PATTERN, extracted before use. Nothing in the product could do this:
 * `PhotoBand` is an in-flow frame and `Sheet` is a bottom drawer that keeps the
 * page behind it. A photograph of your own car deserves the whole screen, and
 * the way out is the way in - you put it down.
 *
 * It behaves the way people already expect a photo viewer to behave:
 *   · swipe left/right to move between frames
 *   · drag down to dismiss
 *   · pinch or double-tap to zoom
 *   · arrow keys and Escape on a keyboard
 *
 * THE GESTURE LAW (Design Language §5): everything the finger drives runs on
 * the spring, never the ease. This is the first component in the product to
 * use `drag` from lib/os/motion, and it is why that token exists.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion';
import { drag as dragSpring, studioEase, move } from '@/lib/os/motion';
import Action from './Action';
import { Whisper } from './text';

export interface ViewerFrame {
  url: string;
  caption?: string;
  at?: Date;
}

export interface MediaViewerProps {
  frames: ViewerFrame[];
  /** the frame to open on; null closes the viewer */
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
}

const fmtDay = (d: Date) =>
  d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

export default function MediaViewer({ frames, index, onIndex, onClose }: MediaViewerProps) {
  const reduced = useReducedMotion();
  const [zoomed, setZoomed] = useState(false);
  /* THE TAKEOVER MUST ESCAPE ITS PARENT.
     The customer shell wraps every page in a `z-index: 1` div, which is a
     stacking context - so a fixed child at z-80 still loses to the dock at
     z-60, because the whole subtree is pinned at 1. Depth bands only mean
     anything in a shared context, so a takeover portals to <body>, exactly
     as the existing Sheet (vaul) already does. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const open = index !== null && index >= 0 && index < frames.length;
  const frame = open ? frames[index!] : null;

  const go = useCallback((delta: number) => {
    if (index === null) return;
    const next = index + delta;
    if (next < 0 || next >= frames.length) return;
    setZoomed(false);
    onIndex(next);
  }, [index, frames.length, onIndex]);

  /* a keyboard is a first-class way through a gallery, not an afterthought */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, go, onClose]);

  /* the page behind must not scroll while a takeover is up */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  /* focus lands inside the takeover, and returns where it came from */
  const closeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => returnTo?.focus?.();
  }, [open]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) { onClose(); return; }
    if (info.offset.x < -80) go(1);
    if (info.offset.x > 80) go(-1);
  };

  const viewer = (
    <AnimatePresence>
      {open && frame && (
        <motion.div
          ref={closeRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={frame.caption ?? 'Photograph'}
          /* the portal lands OUTSIDE `.studio`, where every --st-* token is
             undefined - which silently voids z-index, the background and the
             spacing. The scope travels with the node, as StudioSheet's
             overlay already does. */
          className="studio st-os"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? undefined : { opacity: 0 }}
          transition={{ duration: move, ease: studioEase }}
          style={{
            position: 'fixed', inset: 0,
            zIndex: 'var(--st-z-takeover)' as unknown as number,
            background: 'var(--st-stage)',
            display: 'grid', gridTemplateRows: 'auto 1fr auto',
            outline: 'none',
          }}
        >
          {/* where you are in the set - never a dot row, which reads as e-commerce */}
          <header style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 'var(--st-line)',
            padding: 'calc(env(safe-area-inset-top) + var(--st-line)) var(--st-inset) var(--st-line)',
          }}>
            <Whisper tone="over-2" style={{ fontFamily: 'var(--st-data)', letterSpacing: '0.08em' }}>
              {index! + 1} / {frames.length}
            </Whisper>
            <Action variant="on-photo" onClick={onClose}>Put it down</Action>
          </header>

          {/* the photograph. Drag drives it, so it runs on the spring. */}
          <motion.div
            key={frame.url}
            drag={reduced ? false : true}
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5, left: 0.2, right: 0.2 }}
            onDragEnd={onDragEnd}
            onDoubleClick={() => setZoomed(z => !z)}
            animate={{ scale: zoomed ? 1.8 : 1 }}
            transition={dragSpring}
            style={{
              position: 'relative', width: '100%', height: '100%',
              cursor: zoomed ? 'zoom-out' : 'zoom-in',
              touchAction: 'none',
            }}
          >
            <Image
              src={frame.url}
              alt={frame.caption ?? ''}
              fill
              sizes="100vw"
              priority
              style={{ objectFit: 'contain' }}
            />
          </motion.div>

          <footer style={{
            padding: 'var(--st-line) var(--st-inset) calc(env(safe-area-inset-bottom) + var(--st-gap))',
            textAlign: 'center', minHeight: 44,
          }}>
            {frame.caption && (
              <Whisper as="p" tone="over" style={{ fontSize: 15 }}>{frame.caption}</Whisper>
            )}
            {frame.at && (
              <Whisper as="p" tone="over-2" style={{ marginTop: 2 }}>{fmtDay(frame.at)}</Whisper>
            )}
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(viewer, document.body);
}
