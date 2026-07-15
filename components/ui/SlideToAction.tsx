'use client';
import { useRef, useState } from 'react';
import { ChevronsRight } from 'lucide-react';

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
        <ChevronsRight size={22} strokeWidth={2.5} />
      </div>
    </div>
  );
}
