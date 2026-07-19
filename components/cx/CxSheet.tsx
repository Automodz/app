'use client';
/**
 * CxSheet — THE bottom sheet of the customer app. Built on vaul, so it
 * drags, snaps and dismisses like a native surface (Apple Wallet feel)
 * instead of the seven hand-rolled overlay+spring copies it replaces.
 *
 * One sheet primitive. No screen may roll its own overlay again.
 */
import { ReactNode } from 'react';
import { Drawer } from 'vaul';

export default function CxSheet({ open, onClose, children, title, tall = false }: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** screen-reader name for the sheet (visual titles live in the content) */
  title: string;
  /** near-full-height content (passport, flows); default sizes to content */
  tall?: boolean;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }} />
        <Drawer.Content
          className="fixed bottom-0 inset-x-0 z-50 rounded-t-3xl outline-none flex flex-col"
          style={{
            background: 'var(--deep)',
            borderTop: '1px solid var(--border-2)',
            maxHeight: tall ? '92vh' : '88vh',
            paddingBottom: 'var(--sab)',
          }}>
          <Drawer.Title className="sr-only">{title}</Drawer.Title>
          <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-1 shrink-0" style={{ background: 'var(--border-2)' }} />
          <div className="overflow-y-auto overscroll-contain px-5 pt-3 pb-6">
            <div className="max-w-lg mx-auto">{children}</div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
