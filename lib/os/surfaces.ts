import type { CSSProperties } from 'react';

/**
 * THE ONE CARD SURFACE.
 *
 * Every panel across the customer product - the Glance's cards, the Stay's
 * moment - is cut from this same glass, so the two surfaces read as one design
 * system. It is theme-aware through its tokens (light glass on paper, dark glass
 * on the stage), so the same material sits correctly on either surface.
 */
export const glass: CSSProperties = {
  background: 'var(--st-glass)',
  backdropFilter: 'var(--st-glass-blur)',
  WebkitBackdropFilter: 'var(--st-glass-blur)',
  border: '1px solid var(--st-hairline)',
  boxShadow: 'var(--st-hold), var(--st-edge)',
};
