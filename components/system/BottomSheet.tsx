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
 * §21.5 — focus trap, dismiss layer, scroll lock, `aria-modal` and Escape come
 * from Radix Dialog. This file used to reimplement all five in
 * `useDismissable`; once `Expansion` arrived on Radix the product had TWO focus
 * traps, and §22.2 allows one implementation of anything. The hand-rolled one
 * is deleted. Every visual value below is still ours — no Radix stylesheet is
 * imported, and the drag-to-dismiss gesture stays because Radix has no opinion
 * about it and §7.2 says a finger-driven surface moves on a spring.
 *
 * §6.4 — "every screen and every sheet has a URL." This component does not
 * manage that; whoever opens it owns the address, so a sheet is never a piece
 * of state that a link cannot reach.
 */
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';
import { color, elevation, radius, space, scrim, spring, duration, stack } from '@/design';

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

  return (
    <Dialog.Root open={open} onOpenChange={o => { if (!o) onClose(); }}>
    <AnimatePresence>
      {open ? (
        <Dialog.Portal forceMount>
          <Dialog.Overlay asChild>
          <motion.div
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
          </Dialog.Overlay>
          <Dialog.Content asChild aria-label={label}>
          <motion.div
            className={className}
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
              overscrollBehavior: 'contain',
              ...style,
            }}
          >
            {/* Radix asks for a title to name the layer; the label is it, and
                it is not drawn because the sheet's own content says what this
                is (§18.1 — nothing decorative). */}
            <Dialog.Title style={{
              position: 'absolute', width: 1, height: 1, overflow: 'hidden',
              clipPath: 'inset(50%)', whiteSpace: 'nowrap',
            }}>{label}</Dialog.Title>

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
          </Dialog.Content>
        </Dialog.Portal>
      ) : null}
    </AnimatePresence>
    </Dialog.Root>
  );
}
