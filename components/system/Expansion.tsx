'use client';
/**
 * CONTEXTUAL EXPANSION — the object you tapped, opened.
 *
 * Source: docs/AUTOMODZ-OS-ARCHITECTURE.md §5, §6
 *
 * §5 — "Do not navigate when you can open." A protection, a timeline event, a
 * membership and a chapter are all objects already on the screen. Routing to
 * them would make them somewhere you go; opening them keeps them something you
 * have. Apple Wallet and Photos do the same, and it is the whole reason the
 * surface feels like an object rather than a document.
 *
 * BEHAVIOUR IS BORROWED, APPEARANCE NEVER IS (§6).
 * Radix supplies the focus trap, the dismiss layer, the scroll lock, the
 * `aria-modal` wiring and the Escape handling — the parts that are easy to get
 * subtly wrong and that `useDismissable` reimplemented by hand. Not one Radix
 * stylesheet is imported: every value here comes from `design/`.
 *
 * WHY THIS AND NOT `BottomSheet`. A sheet is a surface that arrives from
 * offscreen; an expansion is a surface that GROWS FROM the thing you touched.
 * They are different gestures and the difference is the point. `BottomSheet`
 * keeps its job (arranging, managing — acts that are not an object on screen).
 */
import * as Dialog from '@radix-ui/react-dialog';
import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import {
  color, space, INSET, radius, elevation, HAIRLINE,
  duration, curve, spring, MEASURE, stack,
} from '@/design';
import { Heading } from './Heading';
import { IconButton } from './IconButton';

export interface ExpansionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * §21.6 — the accessible name. Also the visible heading, because an object
   * that opens should say what it is.
   */
  title: string;
  /**
   * The shared element id. The row that opened this carries the same
   * `layoutId`, so Motion morphs one into the other rather than crossfading —
   * §7's "the object you opened is the object you tapped".
   */
  layoutId?: string;
  children: ReactNode;
}

export function Expansion({ open, onOpenChange, title, layoutId, children }: ExpansionProps) {
  const still = useReducedMotion();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal forceMount={open ? true : undefined}>
        {open ? (
          <>
            {/* The layer beneath. §9.3's scrim, not a Radix default. */}
            <Dialog.Overlay asChild>
              <motion.div
                className="am-scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: duration.move / 1000, ease: curve.ease }}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: color.paper,
                  opacity: 0.6,
                  zIndex: elevation.sheet.z,
                }}
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              {/* Radix owns focus and dismissal; Motion owns the morph. The
                  `layoutId` is what makes this read as the row growing rather
                  than a panel arriving. Under reduced motion the morph is
                  dropped and only opacity remains (§7.6). */}
              <motion.div
                layoutId={still ? undefined : layoutId}
                initial={still ? { opacity: 0 } : false}
                animate={still ? { opacity: 1 } : undefined}
                transition={still
                  ? { duration: duration.tick / 1000 }
                  : { type: 'spring', ...spring }}
                style={{
                  position: 'fixed',
                  insetInline: 0,
                  bottom: 0,
                  zIndex: elevation.sheet.z + 1,
                  maxHeight: '86svh',
                  overflowY: 'auto',
                  overscrollBehavior: 'contain',
                  background: color.surface,
                  borderTopLeftRadius: radius.sheet,
                  borderTopRightRadius: radius.sheet,
                  borderTop: `${HAIRLINE}px solid ${color.edge}`,
                  boxShadow: elevation.sheet.shadow,
                  paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${space.rest}px)`,
                }}
              >
                {/* The grip. It says "this can be pushed back down" without a
                    word, which is why there is no word. */}
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

                <div
                  style={{
                    paddingInline: INSET,
                    maxWidth: MEASURE + INSET * 2,
                    marginInline: 'auto',
                    width: '100%',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: space.gap,
                    }}
                  >
                    <Dialog.Title asChild>
                      <Heading level="title">{title}</Heading>
                    </Dialog.Title>

                    <Dialog.Close asChild>
                      <IconButton label="Close">
                        {/* A line, not an icon set. §22.4 — no third-party glyph
                            vocabulary enters the product for one control. */}
                        <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden>
                          <path
                            d="M5 5l10 10M15 5L5 15"
                            stroke="currentColor"
                            strokeWidth={1.5}
                            strokeLinecap="round"
                          />
                        </svg>
                      </IconButton>
                    </Dialog.Close>
                  </div>

                  <div style={{ marginTop: space.gap, paddingBottom: stack.navGap }}>
                    {children}
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </>
        ) : null}
      </Dialog.Portal>
    </Dialog.Root>
  );
}
