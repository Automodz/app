'use client';
/**
 * Glance section wrapper (design system §7.5): movement-96 rhythm,
 * title header, renders nothing when empty (the silence law).
 */
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { rise } from '@/lib/os/motion';
import { Title } from './text';
import Action from './Action';

interface LayerProps {
  title?: string;
  action?: { label: string; onClick: () => void };
  children?: ReactNode;
}

export default function Layer({ title, action, children }: LayerProps) {
  if (!children) return null;
  return (
    <motion.section
      // Content is visible immediately (craft law) - the reveal is position-only,
      // so a missed IntersectionObserver tick can never hide a layer.
      initial={{ y: 8 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: '-10%' }}
      transition={rise.transition}
      style={{ marginTop: 'var(--st-rest)', paddingLeft: 'var(--st-inset)', paddingRight: 'var(--st-inset)' }}
    >
      {title && (
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          gap: 'var(--st-gap)', marginBottom: 'var(--st-line)',
        }}>
          {/* a quiet section label, not a heavy repeated heading - the eye scans
              past it to the content (Wallet/Linear-style section label) */}
          <Title as="h2" style={{
            fontSize: 13, fontWeight: 560, letterSpacing: '0.06em',
            lineHeight: 1.2, textTransform: 'uppercase', color: 'var(--st-ink-3)',
          }}>
            {title}
          </Title>
          {action && <Action variant="forward" onClick={action.onClick}>{action.label}</Action>}
        </div>
      )}
      {children}
    </motion.section>
  );
}
