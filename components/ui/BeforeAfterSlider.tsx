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
        {/* divider + glass handle */}
        <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}>
          <div className="h-full mx-auto" style={{ width: 1.5, background: 'linear-gradient(180deg, rgba(255,255,255,0.2), rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.2))', boxShadow: '0 0 18px rgba(255,255,255,0.35)' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(18,19,22,0.55)',
              backdropFilter: 'blur(16px) saturate(1.5)', WebkitBackdropFilter: 'blur(16px) saturate(1.5)',
              border: '1px solid rgba(255,255,255,0.25)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 8px 24px rgba(0,0,0,0.45)',
            }}>
            <svg width="16" height="10" viewBox="0 0 16 10" fill="none" aria-hidden>
              <path d="M5 1 1 5l4 4M11 1l4 4-4 4" stroke="rgba(255,255,255,0.85)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        {/* labels */}
        <span className="absolute top-3 left-3 font-mono rounded-full px-2.5 py-1"
          style={{ fontSize: 8.5, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.75)', background: 'rgba(5,5,7,0.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)' }}>BEFORE</span>
        <span className="absolute top-3 right-3 font-mono rounded-full px-2.5 py-1"
          style={{ fontSize: 8.5, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.9)', background: 'rgba(5,5,7,0.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)' }}>AFTER</span>
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
