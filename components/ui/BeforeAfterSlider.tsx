'use client';
import { useState } from 'react';

/* Organic grime textures - SVG fractal noise, not geometric overlays.
   MUD: low-frequency brown blotches (splatter/road film).
   DUST: high-frequency fine speckle (brake dust / dried dirt). */
const svgTile = (freq: number, octaves: number, seed: number, rgb: string, alpha: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='280' height='280'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='${octaves}' seed='${seed}'/><feColorMatrix type='matrix' values='0 0 0 0 ${rgb.split(' ')[0]}  0 0 0 0 ${rgb.split(' ')[1]}  0 0 0 0 ${rgb.split(' ')[2]}  ${alpha}'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`,
  )}")`;
const MUD  = svgTile(0.045, 4, 11, '0.30 0.23 0.14', '0 0 1.4 -0.45 0');
const DUST = svgTile(0.65, 2, 4, '0.42 0.36 0.27', '0 0 0.9 -0.28 0');

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
  afterFilter,
  dirtBefore = false,
  showLabels = true,
}: {
  before: string;
  after: string;
  alt?: string;
  className?: string;
  /** CSS filter applied to the "before" layer - lets you pass the SAME image
   *  for before/after and simulate the uncorrected state (dull/hazy). */
  beforeFilter?: string;
  /** CSS filter applied to the "after" layer - a gloss/ceramic boost. */
  afterFilter?: string;
  /** Paint a grime/dust layer over the "before" side so the same car reads as
   *  dirty before → clean after. */
  dirtBefore?: boolean;
  /** Hide the BEFORE/AFTER pills when the imagery speaks for itself. */
  showLabels?: boolean;
}) {
  const [pos, setPos] = useState(50);
  return (
    <div className={`relative rounded-2xl overflow-hidden select-none ${className}`}
      style={{ background: 'var(--dark)', border: '1px solid var(--border)' }}>
      <div className="relative aspect-[4/3]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt={`${alt} - after`} className="absolute inset-0 w-full h-full object-cover" draggable={false} style={afterFilter ? { filter: afterFilter } : undefined} />
        {afterFilter && (
          /* ceramic sheen: a soft diagonal light streak across the clean side */
          <div aria-hidden className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(115deg, transparent 42%, rgba(255,255,255,0.10) 50%, transparent 58%)' }} />
        )}
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={before} alt={`${alt} - before`} className="w-full h-full object-cover" draggable={false} style={beforeFilter ? { filter: beforeFilter } : undefined} />
          {dirtBefore && (
            /* road film: heavy organic mud low on the body, thinning upward */
            <div
              aria-hidden
              className="absolute inset-0 mix-blend-multiply pointer-events-none"
              style={{
                backgroundImage: MUD,
                backgroundSize: '280px 280px',
                // wheels/sills catch the worst - fade the mud out above mid-body
                WebkitMaskImage: 'linear-gradient(0deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0.12) 100%)',
                maskImage: 'linear-gradient(0deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0.12) 100%)',
              }}
            />
          )}
          {dirtBefore && (
            /* fine dust + brake-dust speckle over the whole panel */
            <div
              aria-hidden
              className="absolute inset-0 mix-blend-multiply pointer-events-none"
              style={{ backgroundImage: DUST, backgroundSize: '280px 280px', opacity: 0.38 }}
            />
          )}
          {dirtBefore && (
            /* dulling film: an even haze that kills the clear-coat gloss */
            <div
              aria-hidden
              className="absolute inset-0 mix-blend-multiply pointer-events-none"
              style={{ background: 'linear-gradient(160deg, rgba(126,110,86,0.2), rgba(90,76,56,0.16))' }}
            />
          )}
          {dirtBefore && (
            /* water spots - hard-edged pale rings that read as dried droplets */
            <div
              aria-hidden
              className="absolute inset-0 mix-blend-screen pointer-events-none"
              style={{
                opacity: 0.5,
                background:
                  'radial-gradient(circle at 38% 38%, transparent 3px, rgba(210,205,195,0.4) 3.5px, transparent 5px),' +
                  'radial-gradient(circle at 47% 52%, transparent 2px, rgba(210,205,195,0.35) 2.5px, transparent 4px),' +
                  'radial-gradient(circle at 58% 42%, transparent 3px, rgba(210,205,195,0.38) 3.5px, transparent 5px),' +
                  'radial-gradient(circle at 64% 58%, transparent 2px, rgba(210,205,195,0.32) 2.5px, transparent 4px),' +
                  'radial-gradient(circle at 30% 56%, transparent 2.5px, rgba(210,205,195,0.36) 3px, transparent 4.5px),' +
                  'radial-gradient(circle at 74% 34%, transparent 2px, rgba(210,205,195,0.3) 2.5px, transparent 4px)',
              }}
            />
          )}
          {dirtBefore && (
            <div aria-hidden className="absolute inset-0 noise-overlay pointer-events-none" style={{ opacity: 0.65 }} />
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
        {showLabels && <><span className="absolute top-3 left-3 font-mono rounded-full px-2.5 py-1"
          style={{ fontSize: 8.5, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.75)', background: 'rgba(5,5,7,0.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)' }}>BEFORE</span>
        <span className="absolute top-3 right-3 font-mono rounded-full px-2.5 py-1"
          style={{ fontSize: 8.5, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.9)', background: 'rgba(5,5,7,0.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)' }}>AFTER</span></>}
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
