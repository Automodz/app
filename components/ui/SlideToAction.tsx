'use client';
import { useRef, useState } from 'react';

/** Animated slide chevrons - the "»" of slide-to-unlock, staggered shimmer. */
function Chevrons({ active }: { active: boolean }) {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" fill="none" aria-hidden>
      {[0, 7, 14].map((dx, i) => (
        <path key={dx} d={`M${2 + dx} 2l6 6-6 6`} stroke="currentColor" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"
          style={{
            opacity: active ? 1 : undefined,
            animation: active ? undefined : `slideChevron 1.6s ease-in-out ${i * 0.18}s infinite`,
          }} />
      ))}
      <style>{`@keyframes slideChevron { 0%,100% { opacity: 0.35 } 50% { opacity: 1 } }`}</style>
    </svg>
  );
}

/**
 * Apple-style "Slide to Book" control. Drag the knob across the track to fire
 * `onComplete`. Premium feel: shimmer label, chevron pulse, glow that builds
 * with progress, damped resistance over the last stretch, a haptic tick and a
 * success flash on unlock. Snaps home if released early. Keyboard accessible.
 */
export default function SlideToAction({
  label = 'Slide to book',
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

  // Damped resistance over the last 25% - the unlock has to be earned.
  const move = (clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const raw = Math.max(0, Math.min(maxX(), clientX - rect.left - knob / 2));
    const soft = maxX() * 0.75;
    setX(raw <= soft ? raw : soft + (raw - soft) * 0.45);
  };

  const unlock = () => {
    setX(maxX());
    setDone(true);
    try { navigator.vibrate?.(12); } catch { /* no haptics on this device */ }
    onComplete();
  };

  const start = () => { if (!disabled && !done) setDragging(true); };
  const end = () => {
    if (!dragging) return;
    setDragging(false);
    if (x >= maxX() * 0.82) unlock();
    else setX(0);
  };

  const pct = maxX() > 0 ? Math.min(1, x / maxX()) : 0;

  return (
    <div
      ref={trackRef}
      className={`relative select-none overflow-hidden ${className}`}
      style={{
        height: 60,
        borderRadius: 30,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.04))',
        backdropFilter: 'blur(20px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
        border: `1px solid rgba(255,255,255,${done ? 0.4 : 0.12 + pct * 0.15})`,
        boxShadow: done
          ? 'inset 0 1px 0 rgba(255,255,255,0.25), 0 0 40px rgba(255,255,255,0.25)'
          : `inset 0 1px 0 rgba(255,255,255,0.12), 0 0 ${20 + pct * 30}px rgba(255,255,255,${0.04 + pct * 0.14})`,
        opacity: disabled ? 0.5 : 1,
        touchAction: 'none',
        transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
      }}
      onPointerMove={(e) => dragging && move(e.clientX)}
      onPointerUp={end}
      onPointerLeave={end}
    >
      {/* trail the knob leaves behind */}
      <div
        aria-hidden
        className="absolute top-1 bottom-1 left-1 rounded-full"
        style={{
          width: knob + x,
          background: 'linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.14))',
          opacity: done ? 1 : 0.9,
          transition: dragging ? 'none' : 'width 0.35s cubic-bezier(0.22,1,0.36,1)',
        }}
      />
      {/* shimmer label - a light sweep keeps the affordance alive */}
      <div
        className="absolute inset-0 grid place-items-center font-display"
        style={{ opacity: 1 - pct * 1.4, fontSize: 14, fontWeight: 600, letterSpacing: '0.02em' }}
      >
        <span style={{
          background: 'linear-gradient(90deg, rgba(255,255,255,0.45) 35%, #fff 50%, rgba(255,255,255,0.45) 65%)',
          backgroundSize: '200% 100%',
          WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
          animation: 'slideSheen 2.4s linear infinite',
        }}>{done ? 'Booked in' : label}</span>
        <style>{`@keyframes slideSheen { 0% { background-position: 130% 0 } 100% { background-position: -30% 0 } }`}</style>
      </div>
      <div
        role="button"
        aria-label={label}
        tabIndex={disabled ? -1 : 0}
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); start(); }}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !disabled && !done) unlock(); }}
        className="absolute top-1 left-1 grid place-items-center"
        style={{
          width: knob,
          height: knob,
          borderRadius: 26,
          background: 'linear-gradient(180deg, #fff 0%, #e6e8ec 100%)',
          color: '#0b0c0e',
          transform: `translateX(${x}px) scale(${done ? 1.06 : dragging ? 1.03 : 1})`,
          transition: dragging ? 'none' : 'transform 0.35s cubic-bezier(0.22,1,0.36,1)',
          boxShadow: done
            ? '0 0 0 6px rgba(255,255,255,0.12), 0 8px 30px rgba(255,255,255,0.35)'
            : `inset 0 1px 0 rgba(255,255,255,0.9), 0 6px 20px rgba(0,0,0,0.45), 0 0 ${pct * 26}px rgba(255,255,255,${pct * 0.35})`,
          cursor: disabled ? 'not-allowed' : done ? 'default' : 'grab',
        }}
      >
        {done ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            <path d="M3.5 9.5l4 4 7-8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <Chevrons active={dragging} />
        )}
      </div>
    </div>
  );
}
