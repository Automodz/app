/**
 * The AutoModz wordmark - the real logo typeface, not text.
 * Uses transparent PNGs derived from the brand logo (public/wordmark-*.png).
 *
 *  variant="auto"  → ink in light theme, white in dark theme (default)
 *  variant="white" → always white (use over photos / dark surfaces)
 *  variant="ink"   → always graphite ink
 *
 * `height` sets the rendered wordmark height in px; width follows the 10.1:1
 * logo ratio automatically.
 */
/**
 * `height` accepts a number (px) OR any CSS length - including responsive
 * values like `clamp(16px, 4.5vw, 22px)` - so the wordmark can size fluidly
 * across the app (header, footer, hero, invoices…). Width follows the logo
 * ratio automatically via CSS (`img { height:100%; width:auto }`).
 */
export default function Wordmark({
  height = 18,
  variant = 'auto',
  className = '',
  alt = 'AutoModz',
}: {
  height?: number | string;
  variant?: 'auto' | 'white' | 'ink';
  className?: string;
  alt?: string;
}) {
  const h = typeof height === 'number' ? `${height}px` : height;
  return (
    <span
      className={`wordmark wm-${variant} ${className}`}
      style={{ height: h, width: 'auto', display: 'inline-block', lineHeight: 0 }}
      aria-label={alt}
      role="img"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="wm-i" src="/wordmark-ink.png" alt="" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="wm-w" src="/wordmark-white.png" alt="" />
    </span>
  );
}
