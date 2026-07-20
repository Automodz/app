'use client';
/**
 * TEMPORARY ADAPTER (PRE-1) — Generation-A sheet API over the ONE overlay
 * primitive (components/os/StudioSheet). No drawer implementation may live
 * here; this file only maps the legacy props and ground colour.
 *
 * TODO(P1–P6): each phase migrates its surfaces to StudioSheet directly;
 * P7 deletes this file.
 */
import { ReactNode } from 'react';
import StudioSheet from '@/components/os/StudioSheet';

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
    <StudioSheet
      open={open}
      onOpenChange={o => { if (!o) onClose(); }}
      label={title}
      ground="var(--deep)"
      maxHeight={tall ? '92vh' : '88vh'}
    >
      <div className="max-w-lg mx-auto">{children}</div>
    </StudioSheet>
  );
}
