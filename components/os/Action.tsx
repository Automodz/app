'use client';
/**
 * The one button (design system §7.12). Text-first; `primary` is the only
 * filled variant and lives full-width inside sheets.
 */
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { studioEase, tick } from '@/lib/os/motion';

type Variant = 'primary' | 'quiet' | 'destructive' | 'on-photo';

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
  const color =
    variant === 'destructive' ? 'var(--st-caution)'
    : variant === 'on-photo'  ? 'var(--st-over)'
    : isPrimary               ? 'var(--st-paper)'
    : 'var(--st-ink)';

  return (
    <span style={{ display: isPrimary ? 'block' : 'inline-block' }}>
      <motion.button
        type={type}
        onClick={onClick}
        disabled={disabled || loading}
        whileTap={disabled || loading ? undefined : { scale: 0.98 }}
        transition={{ duration: tick, ease: studioEase }}
        style={{
          fontFamily: 'var(--st-text)', fontWeight: 520, fontSize: isPrimary ? 16 : 19,
          lineHeight: 1.45, color: disabled ? 'var(--st-ink-3)' : color,
          background: isPrimary ? (disabled ? 'var(--st-linen)' : 'var(--st-ink)') : 'transparent',
          border: 'none', borderRadius: isPrimary ? 12 : 0,
          padding: isPrimary ? '14px 24px' : '10px 0',
          width: isPrimary ? '100%' : undefined,
          minHeight: 44, cursor: disabled || loading ? 'default' : 'pointer',
        }}
      >
        {loading ? (
          <span aria-label="working" className="loader-ring" style={{
            display: 'inline-block', width: 14, height: 14,
            border: '1.5px solid currentColor', borderTopColor: 'transparent',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite',
          }} />
        ) : children}
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
