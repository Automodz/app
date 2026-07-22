'use client';
/**
 * A paper, as an object you hold (P2D1 §C1 Papers · §C5).
 *
 * The vault and the Chapter both keep documents; they keep them the same
 * way - a gallery-toned card with the document's name and its one true
 * detail. A card exists only when its document does.
 */
import type { ReactNode } from 'react';
import { Emphasis, Data } from './text';

interface DocumentCardProps {
  title: string;
  detail: string;
  /** an external paper (the invoice PDF) opens in its own tab */
  href?: string;
  onOpen?: () => void;
}

const surface = {
  display: 'block', width: '100%', textAlign: 'left' as const, textDecoration: 'none',
  background: 'var(--st-gallery)', borderRadius: 'var(--st-r-card)',
  padding: 'var(--st-gap)', minHeight: 96, border: 'none', cursor: 'pointer',
};

export default function DocumentCard({ title, detail, href, onOpen }: DocumentCardProps) {
  const body: ReactNode = (
    <>
      <Emphasis as="p">{title}</Emphasis>
      <Data style={{ display: 'block', marginTop: 'var(--st-hair)' }}>{detail}</Data>
    </>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="st-tap st-card" style={surface}>
        {body}
      </a>
    );
  }
  return (
    <button onClick={onOpen} className="st-tap st-card" style={surface}>
      {body}
    </button>
  );
}

/** The one grid papers live in, wherever they are shown. */
export function DocumentGrid({ children }: { children: ReactNode }) {
  return (
    <div style={{
      display: 'grid', gap: 'var(--st-gap)',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    }}>
      {children}
    </div>
  );
}
