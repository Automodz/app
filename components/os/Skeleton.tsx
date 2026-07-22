import type { CSSProperties } from 'react';

/**
 * A calm placeholder for the one case that needs it - an image still loading
 * (design system §13). A gentle breathe on the gallery surface, never a
 * shimmer, and fully static under reduced motion. Not for text: cached truth
 * renders instantly, so text never waits behind a skeleton.
 */
export default function Skeleton({
  radius = 'var(--st-r-card)', style,
}: {
  radius?: string;
  style?: CSSProperties;
}) {
  return <div aria-hidden className="st-skeleton" style={{ borderRadius: radius, ...style }} />;
}
