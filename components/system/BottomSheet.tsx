'use client';
/**
 * BOTTOM SHEET — a drawer over the room.
 *
 * Source: docs/AUTOMODZ-OS.md §9.3, §7.2, §7.6, §3.6, §21.5, §6.4
 *
 * §9.3 — the `sheet` band. Its shadow and its stacking order both come from
 * that band, so they cannot disagree.
 *
 * §7.2 — a sheet is finger-driven, so it moves on the SPRING. "Finger-driven
 * motion on an ease curve feels dead." Dragging it down dismisses it, and the
 * drag follows the hand because the spring has weight rather than a duration.
 *
 * §3.6 — the sheet is the material. Anything composed inside it that would
 * normally be a Surface renders flat, because `Surface` refuses to nest.
 *
 * §21.5 — focus is trapped while open and returned on close, via the one
 * implementation in `useDismissable`.
 *
 * §6.4 — "every screen and every sheet has a URL." This component does not
 * manage that; whoever opens it owns the address, so a sheet is never a piece
 * of state that a link cannot reach.
 */
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';
import { color, elevation, radius, space, scrim, spring, duration, stack } from '@/design';
import { useDismissable } from './useDismissable';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** §21.6 — the accessible name of the layer. */
  label: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function BottomSheet({
  open, onClose, label, children, className, style,
}: BottomSheetProps) {
  const still = useReducedMotion();
  const ref = useDismissable(open, onClose);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            aria-hidden
            onClick={onClose}
            initial={still ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={still ? undefined : { opacity: 0 }}
            transition={{ duration: still ? 0 : duration.move / 1000 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: elevation.sheet.z,
              background: `rgba(0,0,0,${scrim.layer})`,
            }}
          />
          <motion.div
            ref={ref}
            className={className}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            initial={still ? false : { y: '100%' }}
            animate={{ y: 0 }}
            exit={still ? undefined : { y: '100%' }}
            /* §7.2 — the spring, because a finger drives this. */
            transition={still ? { duration: 0 } : { type: 'spring', ...spring }}
            drag={still ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > space.movement) onClose();
            }}
            style={{
              position: 'fixed',
              insetInline: 0,
              bottom: 0,
              zIndex: elevation.sheet.z + 1,
              maxHeight: '88svh',
              overflowY: 'auto',
              background: color.surface,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
              boxShadow: elevation.sheet.shadow,
              paddingBottom: `calc(${space.rest}px + ${stack.top})`,
              ...style,
            }}
          >
            {/* the grab handle — the affordance for the drag above */}
            <div
              aria-hidden
              style={{
                width: space.rest,
                height: space.hair,
                borderRadius: radius.pill,
                background: color.edge,
                margin: `${space.line}px auto ${space.breath}px`,
              }}
            />
            {children}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
