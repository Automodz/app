import { ReactNode } from 'react';

/**
 * CSS-only animated silver gradient mesh (the Liquid Chrome identity
 * background). Pure decoration: content renders normally on top, animation
 * stops under prefers-reduced-motion (handled in globals.css).
 */
export default function AnimatedGradientBg({
  children,
  className = '',
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-mesh relative ${className}`} style={{ overflowX: 'clip' }}>
      {children}
    </div>
  );
}
