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
}: {
  before: string;
  after: string;
  alt?: string;
  className?: string;
  /** CSS filter applied to the "before" layer — lets you pass the SAME image
   *  for before/after and simulate the uncorrected state (dull/hazy). */
  beforeFilter?: string;
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
