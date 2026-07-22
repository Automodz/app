'use client';
/**
 * The action system (design system §7.12 · UX-1 CTA tiers). Text-first, with a
 * clear hierarchy carried by weight and two functional glyphs - never colour:
 *
 *   primary      filled ink pill, full-width, sheets only (Confirm / Join)
 *   forward  →   the section's own action (Arrange it, Read its chapter)
 *   external ↗   leaves the app (WhatsApp, Maps, the studio's reviews)
 *   quiet        tertiary text (Later, Edit details, Sign out)
 *   destructive  caution text
 *   on-photo     over photography
 *
 * The glyph nudges on hover - the only motion, one curve, one tick.
 */
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { studioEase, tick } from '@/lib/os/motion';
import Spinner from './Spinner';

type Variant = 'primary' | 'forward' | 'external' | 'quiet' | 'destructive' | 'on-photo';

const GLYPH: Partial<Record<Variant, string>> = { forward: '→', external: '↗' };

interface ActionProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  type?: 'button' | 'submit';
}

export default function Action({
  children, onClick, variant = 'quiet', loading, disabled, disabledReason, type = 'button',
}: ActionProps) {
  const isPrimary = variant === 'primary';
  const glyph = GLYPH[variant];
  const color =
    disabled                  ? 'var(--st-ink-3)'
    : variant === 'destructive' ? 'var(--st-caution)'
    : variant === 'on-photo'  ? 'var(--st-over)'
    : isPrimary               ? 'var(--st-paper)'
    : 'var(--st-ink)';

  const interactive = !(disabled || loading);

  return (
    <span style={{ display: isPrimary ? 'block' : 'inline-block' }}>
      <motion.button
        type={type}
        onClick={onClick}
        disabled={!interactive}
        initial="rest"
        animate="rest"
        whileHover={interactive && glyph ? 'hover' : undefined}
        whileTap={interactive ? { scale: 0.98 } : undefined}
        transition={{ duration: tick, ease: studioEase }}
        style={{
          fontFamily: 'var(--st-text)', fontWeight: isPrimary ? 600 : 520,
          fontSize: isPrimary ? 16 : 19, lineHeight: 1.45, color,
          background: isPrimary ? (disabled ? 'var(--st-linen)' : 'var(--st-ink)') : 'transparent',
          border: 'none', borderRadius: isPrimary ? 'var(--st-r-chip)' : 0,
          padding: isPrimary ? '14px 24px' : '10px 0',
          width: isPrimary ? '100%' : undefined,
          minHeight: 44, cursor: interactive ? 'pointer' : 'default',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        {loading ? <Spinner /> : (
          <>
            <span>{children}</span>
            {glyph && (
              <motion.span
                aria-hidden
                variants={{ rest: { x: 0 }, hover: { x: variant === 'external' ? 2 : 3, y: variant === 'external' ? -2 : 0 } }}
                transition={{ duration: tick, ease: studioEase }}
                style={{
                  display: 'inline-block',
                  color: variant === 'external' ? 'var(--st-ink-2)' : 'inherit',
                }}
              >
                {glyph}
              </motion.span>
            )}
          </>
        )}
      </motion.button>
      {disabled && disabledReason && (
        <span style={{
          display: 'block', fontFamily: 'var(--st-text)', fontSize: 12,
          color: 'var(--st-ink-3)', marginTop: 4,
        }}>
          {disabledReason}
        </span>
      )}
    </span>
  );
}
