'use client';
/**
 * THE PANEL - the one glass surface (Design Language §2 · §4).
 *
 * Four surfaces exist in the product and there are no others: the environment,
 * glass, ground, and photography. This is glass, and it is the only component
 * allowed to mint it - so three laws are enforced here once rather than
 * remembered everywhere:
 *
 *   1. every glass surface carries the carved edge (`--st-edge`). It is what
 *      makes a pane read as machined rather than as a translucent rectangle,
 *      and it is not optional.
 *   2. glass never nests. A glass card inside a glass panel produces mud and
 *      doubles the blur cost, so a Panel inside a Panel renders flat.
 *   3. elevation comes from the BAND, never from the component. `raised` and
 *      `float` pick their own shadow; a caller cannot.
 */
import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';

/** Depth bands that a panel may occupy (Design Language §4). */
type Band = 'raised' | 'float';

const SHADOW: Record<Band, string> = {
  raised: 'var(--st-raise), var(--st-edge)',
  float: 'var(--st-lift), var(--st-edge)',
};

/** Tracks whether we are already inside glass, so nesting can be refused. */
const InGlass = createContext(false);

export interface PanelProps {
  children: ReactNode;
  band?: Band;
  /** over photography the pane must be heavier to stay legible */
  onPhoto?: boolean;
  as?: 'div' | 'section' | 'article' | 'li';
  padding?: string;
  radius?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

export default function Panel({
  children, band = 'raised', onPhoto = false, as: Tag = 'div',
  padding = 'var(--st-gap)', radius = 'var(--st-r-card)', style, ariaLabel,
}: PanelProps) {
  const nested = useContext(InGlass);

  /* Nested glass falls back to a flat, hairline-separated group. The content
     still renders - refusing the material must never refuse the content. */
  const surface: CSSProperties = nested
    ? { background: 'transparent', border: '1px solid var(--st-hairline)' }
    : {
        background: onPhoto ? 'var(--st-glass-on-photo)' : 'var(--st-glass)',
        backdropFilter: 'var(--st-glass-blur)',
        WebkitBackdropFilter: 'var(--st-glass-blur)',
        border: '1px solid var(--st-hairline)',
        boxShadow: SHADOW[band],
      };

  return (
    <InGlass.Provider value>
      <Tag aria-label={ariaLabel} style={{ borderRadius: radius, padding, ...surface, ...style }}>
        {children}
      </Tag>
    </InGlass.Provider>
  );
}
