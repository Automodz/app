'use client';
/**
 * LiquidOrb - a 3D-looking metallic sphere with liquid-morphism around it,
 * built entirely from CSS + SVG (no WebGL, no external assets, no runtime deps).
 * It always paints on first frame, so it can never block or break page load.
 * Motion is pure CSS and honours `prefers-reduced-motion` via globals.css.
 */
export default function LiquidOrb({ className = '' }: { className?: string }) {
  return (
    <div className={`liquid-orb ${className}`} aria-hidden>
      {/* soft ground shadow */}
      <span className="lo-shadow" />

      {/* morphing liquid satellites (behind the sphere) */}
      <span className="lo-blob lo-blob-a" />
      <span className="lo-blob lo-blob-b" />

      {/* the metallic sphere */}
      <span className="lo-sphere">
        <span className="lo-sheen" />
        <span className="lo-spec" />
      </span>
    </div>
  );
}
