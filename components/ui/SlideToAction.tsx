'use client';
import { useRef, useState } from 'react';

/** Sleek sports-car silhouette (side profile) — richer than the stock glyph. */
function SportsCar({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 32" fill="none" aria-hidden>
      <path
        d="M2 22c0-1.2.9-2.1 2-2.3l4.2-.7 4.8-5.4c1.3-1.5 3.2-2.4 5.2-2.4h8.9c1.6 0 3.1.6 4.3 1.6l4.4 3.9 5.1 1.2c1.6.4 2.8 1.8 2.8 3.5V22c0 1.1-.9 2-2 2h-3.1"
        stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" fillOpacity="0.14"
      />
      <path d="M13 12.2l3 5.3h9.5l-4-5.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 24H5.5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      <circle cx="15" cy="24" r="4" fill="var(--track,#111)" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="34" cy="24" r="4" fill="var(--track,#111)" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="15" cy="24" r="1.3" fill="currentColor" />
      <circle cx="34" cy="24" r="1.3" fill="currentColor" />
    </svg>
  );
}

/**
 * Aston "Slide to Start" control. Drag the knob to ~90% of the track to fire
 * `onComplete`. Pointer + touch driven, snaps back if released early. Respects
 * disabled state. The knob rides the champagne-gold accent gradient.
 */
export default function SlideToAction({
  label = 'Slide to Start',
  onComplete,
  disabled = false,
  className = '',
}: {
  label?: string;
  onComplete: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(false);
  const knob = 52;

  const maxX = () => (trackRef.current?.offsetWidth ?? 0) - knob - 8;

  const move = (clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const next = Math.max(0, Math.min(maxX(), clientX - rect.left - knob / 2));
    setX(next);
  };

  const start = () => { if (!disabled && !done) setDragging(true); };
  const end = () => {
    if (!dragging) return;
    setDragging(false);
    if (x >= maxX() * 0.9) {
      setX(maxX());
      setDone(true);
      onComplete();
    } else {
      setX(0);
    }
  };

  const pct = maxX() > 0 ? x / maxX() : 0;

  return (
    <div
      ref={trackRef}
      className={`relative select-none overflow-hidden glass ${className}`}
      style={{
        height: 60,
        borderRadius: 30,
        border: '1px solid var(--glass-border)',
        opacity: disabled ? 0.5 : 1,
        touchAction: 'none',
      }}
      onPointerMove={(e) => dragging && move(e.clientX)}
      onPointerUp={end}
      onPointerLeave={end}
    >
      {/* soft trail the knob leaves behind as it slides — no dashed line */}
      <div
        aria-hidden
        className="absolute top-1 bottom-1 left-1 rounded-full"
        style={{
          width: knob + x,
          background: 'var(--accent-mist)',
          opacity: 0.9 * (1 - pct * 0.4),
        }}
      />
      <div
        className="absolute inset-0 grid place-items-center font-display font-600 tracking-wide"
        style={{ color: 'var(--muted)', opacity: 1 - pct, fontSize: 14 }}
      >
        {label}
      </div>
      <div
        role="button"
        aria-label={label}
        tabIndex={disabled ? -1 : 0}
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); start(); }}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !disabled && !done) { setDone(true); onComplete(); } }}
        className="absolute top-1 left-1 grid place-items-center"
        style={{
          width: knob,
          height: knob,
          borderRadius: 26,
          background: 'var(--accent-grad)',
          color: 'var(--on-accent)',
          transform: `translateX(${x}px)`,
          transition: dragging ? 'none' : 'transform 0.35s cubic-bezier(0.22,1,0.36,1)',
          boxShadow: 'var(--ember-glow-sm)',
          cursor: disabled ? 'not-allowed' : 'grab',
        }}
      >
        <SportsCar size={28} />
      </div>
    </div>
  );
}
