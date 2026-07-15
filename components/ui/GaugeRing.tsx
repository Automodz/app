'use client';
import { ReactNode, useEffect, useState } from 'react';

/**
 * Instrument-style circular progress dial (Aston "Oil Life" reference).
 * Draws an SVG ring on the champagne-gold accent gradient with a soft track.
 * Animates the sweep on mount. Center holds free-form children (value + label).
 */
export default function GaugeRing({
  value,
  size = 120,
  stroke = 8,
  label,
  caption,
  danger = false,
  children,
  className = '',
}: {
  value: number;              // 0..100
  size?: number;
  stroke?: number;
  label?: ReactNode;          // big center text
  caption?: ReactNode;        // small text under label
  danger?: boolean;           // tint the sweep with the danger status hue
  children?: ReactNode;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gid = `gauge-${Math.round(size)}-${danger ? 'd' : 'a'}`;

  return (
    <div className={`relative inline-grid place-items-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            {danger ? (
              <>
                <stop offset="0%" stopColor="#E06C75" />
                <stop offset="100%" stopColor="#B93838" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="var(--accent)" />
                <stop offset="100%" stopColor="var(--accent-2)" />
              </>
            )}
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--smoke)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (shown / 100) * c}
          style={{
            transition: 'stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)',
            filter: 'drop-shadow(0 0 6px var(--accent-glow))',
          }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-tight">
        {children ?? (
          <div>
            {label != null && (
              <div className="font-display font-700 text-xl" style={{ color: danger ? 'var(--danger)' : 'var(--fg)' }}>
                {label}
              </div>
            )}
            {caption != null && (
              <div className="data-label mt-0.5" style={{ fontSize: 10 }}>{caption}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
