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
}

export default function StudioSheet({ open, onOpenChange, children, label }: StudioSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay
          className="studio"
          style={{ position: 'fixed', inset: 0, background: 'rgba(12,13,14,0.40)', zIndex: 60 }}
        />
        <Drawer.Content
          aria-label={label}
          className="studio"
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 61,
            background: 'var(--st-gallery)',
            borderRadius: '24px 24px 0 0',
            boxShadow: 'var(--st-lift)',
            maxHeight: '88vh',
            display: 'flex', flexDirection: 'column',
            outline: 'none',
          }}
        >
          <div aria-hidden style={{
            width: 40, height: 4, borderRadius: 2, background: 'var(--st-hairline)',
            margin: '12px auto 0',
          }} />
          <div style={{
            padding: 24, paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
            overflowY: 'auto',
          }}>
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
