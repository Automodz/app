/**
 * The AutoModz wordmark — the real logo typeface, not text.
 * Uses transparent PNGs derived from the brand logo (public/wordmark-*.png).
 *
 *  variant="auto"  → ink in light theme, white in dark theme (default)
 *  variant="white" → always white (use over photos / dark surfaces)
 *  variant="ink"   → always graphite ink
 *
 * `height` sets the rendered wordmark height in px; width follows the 10.1:1
 * logo ratio automatically.
 */
const RATIO = 1000 / 99;

export default function Wordmark({
  height = 18,
  variant = 'auto',
  className = '',
  alt = 'AutoModz',
}: {
  height?: number;
  variant?: 'auto' | 'white' | 'ink';
  className?: string;
  alt?: string;
}) {
  const width = Math.round(height * RATIO);
  return (
    <span
      className={`wordmark wm-${variant} ${className}`}
      style={{ height, width, display: 'inline-block', lineHeight: 0 }}
      aria-label={alt}
      role="img"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="wm-i" src="/wordmark-ink.png" alt="" width={width} height={height} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="wm-w" src="/wordmark-white.png" alt="" width={width} height={height} />
    </span>
  );
}
