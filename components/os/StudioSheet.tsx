'use client';
/**
 * The single overlay (design system §7.10) — vaul drawer, gallery ground,
 * 24 top radius, drag-dismiss. Confirm/done states live INSIDE the sheet.
 */
import { Drawer } from 'vaul';
import type { ReactNode } from 'react';

interface StudioSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  label: string; // accessibility name
  /** PRE-1 legacy overrides — used only by the CxSheet adapter while
   *  Generation-A surfaces await replacement. TODO(P7): remove both. */
  ground?: string;
  maxHeight?: string;
}

export default function StudioSheet({
  open, onOpenChange, children, label,
  ground = 'var(--st-gallery)', maxHeight = '88vh',
}: StudioSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay
          className="studio"
          style={{ position: 'fixed', inset: 0, background: 'rgba(12,13,14,0.40)', zIndex: 60 }}
        />
        <Drawer.Content
          className="studio"
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 61,
            background: ground,
            borderRadius: 'var(--st-r-sheet) var(--st-r-sheet) 0 0',
            boxShadow: 'var(--st-lift)',
            maxHeight,
            display: 'flex', flexDirection: 'column',
            outline: 'none',
          }}
        >
          <Drawer.Title className="sr-only">{label}</Drawer.Title>
          <div aria-hidden style={{
            width: 40, height: 4, borderRadius: 2, background: 'var(--st-hairline)',
            margin: '12px auto 0',
          }} />
          <div style={{
            padding: 'var(--st-inset)',
            paddingBottom: 'calc(var(--st-inset) + env(safe-area-inset-bottom))',
            overflowY: 'auto',
          }}>
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
