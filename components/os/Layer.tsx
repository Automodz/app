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
      style={{ marginTop: 'var(--st-movement)', paddingLeft: 'var(--st-inset)', paddingRight: 'var(--st-inset)' }}
    >
      {title && (
        <div style={{ marginBottom: 24 }}>
          {/* the mark - one repeating letterhead motif that ties every section
              of the Glance into a single crafted record (UX-1) */}
          <div aria-hidden style={{
            width: 28, height: 2, borderRadius: 2,
            background: 'var(--st-ink)', marginBottom: 'var(--st-line)',
          }} />
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            gap: 'var(--st-gap)',
          }}>
            <Title>{title}</Title>
            {action && <Action variant="forward" onClick={action.onClick}>{action.label}</Action>}
          </div>
        </div>
      )}
      {children}
    </motion.section>
  );
}
