'use client';
import { useState } from 'react';

/**
 * Before/after reveal slider - pure CSS/JS trust widget. The after image
 * sits underneath; the before layer is clipped to the handle position.
 * Content-first: both images render immediately; the range input drives
 * a clip-path only.
 */
export default function BeforeAfterSlider({
  before,
  after,
  alt = 'Before and after',
  className = '',
  beforeFilter,
  dirtBefore = false,
}: {
  before: string;
  after: string;
  alt?: string;
  className?: string;
  /** CSS filter applied to the "before" layer — lets you pass the SAME image
   *  for before/after and simulate the uncorrected state (dull/hazy). */
  beforeFilter?: string;
  /** Paint a grime/dust layer over the "before" side so the same car reads as
   *  dirty before → clean after. */
  dirtBefore?: boolean;
}) {
  const [pos, setPos] = useState(50);
  return (
    <div className={`relative rounded-2xl overflow-hidden select-none ${className}`}
      style={{ background: 'var(--dark)', border: '1px solid var(--border)' }}>
      <div className="relative aspect-[4/3]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt={`${alt} - after`} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={before} alt={`${alt} - before`} className="w-full h-full object-cover" draggable={false} style={beforeFilter ? { filter: beforeFilter } : undefined} />
          {dirtBefore && (
            <div
              aria-hidden
              className="absolute inset-0 mix-blend-multiply pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at 18% 30%, rgba(92,68,38,0.55) 0 6px, transparent 7px),' +
                  'radial-gradient(circle at 32% 62%, rgba(74,58,34,0.5) 0 9px, transparent 10px),' +
                  'radial-gradient(circle at 55% 25%, rgba(88,66,40,0.45) 0 5px, transparent 6px),' +
                  'radial-gradient(circle at 68% 70%, rgba(70,54,30,0.5) 0 11px, transparent 12px),' +
                  'radial-gradient(circle at 82% 44%, rgba(90,66,38,0.5) 0 7px, transparent 8px),' +
                  'radial-gradient(circle at 44% 82%, rgba(76,58,34,0.45) 0 8px, transparent 9px),' +
                  'linear-gradient(160deg, rgba(83,64,40,0.4), rgba(48,38,24,0.28))',
                backgroundColor: 'rgba(70,54,32,0.16)',
              }}
            />
          )}
          {dirtBefore && (
            <div aria-hidden className="absolute inset-0 noise-overlay pointer-events-none" style={{ opacity: 0.5 }} />
          )}
        </div>
        {/* divider + handle */}
        <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}>
          <div className="w-0.5 h-full mx-auto" style={{ background: 'var(--chrome)', boxShadow: 'var(--ember-glow-sm)' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'var(--accent-grad)', boxShadow: 'var(--shadow-sm)' }}>
            <span style={{ color: 'var(--on-accent)', fontSize: 12, letterSpacing: 1 }}>⇄</span>
          </div>
        </div>
        {/* labels */}
        <span className="absolute top-2 left-2 status-badge" style={{ background: 'rgba(5,5,7,0.7)', color: 'var(--warning)' }}>BEFORE</span>
        <span className="absolute top-2 right-2 status-badge" style={{ background: 'rgba(5,5,7,0.7)', color: 'var(--success)' }}>AFTER</span>
        <input
          type="range" min={0} max={100} value={pos}
          onChange={e => setPos(Number(e.target.value))}
          aria-label="Reveal before and after"
          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
        />
      </div>
    </div>
  );
}
