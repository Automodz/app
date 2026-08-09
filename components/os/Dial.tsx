'use client';
/**
 * THE DIAL — one number, and nothing else.
 *
 * Source: docs/AUTOMODZ-OS.md §3.2, §3.5, §5.3, §7.6, §9.5, §14.2
 *         design "AutoModz App.dc.html" — screens 1a and 1c
 *
 * The design opens the product on a single ring holding a single number: how
 * long until the car is ready, or how much of its protection is left. §3.2
 * asks each surface to have exactly one thing it is about; this is the most
 * literal answer the product has — the screen is a number, and everything
 * under it is context for it.
 *
 * ── WHY THE ARC IS DRAWN AND NOT ANIMATED ON A LOOP ──────────────────────
 * It sweeps once, on arrival, over 2.4s. That is the difference between a
 * measurement being TAKEN and a thing spinning: a loop would read as loading,
 * and this number is never loading — it is known before the screen paints.
 * §7.6 — under reduced motion the arc is simply already drawn.
 *
 * ── WHY THE TRACK IS ALMOST INVISIBLE ────────────────────────────────────
 * §3.5. The unfilled part of a dial is the part that carries no information.
 * At 7% white it is enough for the arc to be read as a proportion and not
 * enough to be read as a second ring.
 */
import type { ReactNode } from 'react';
import { color } from '@/design';

/* The geometry, once. r=88 on a 200 viewBox leaves room for a 3px stroke and
   its round cap without either touching the edge; the circumference follows
   from it rather than being typed in — the design's `stroke-dasharray:553` is
   this number, and hard-coding it in two places is how they drift apart. */
const R = 88;
const LEN = 2 * Math.PI * R; // ≈ 553

export interface DialProps {
  /**
   * How much of the ring is filled, 0–1. Clamped, because a proportion that
   * arrives as 1.4 (a coat "past due") must draw a full ring rather than
   * wrapping around and drawing a short one.
   */
  fill: number;
  /** The number itself, already worded — "3h 40m", "82%". */
  children: ReactNode;
  /** The line under it. Mono, tracked, quiet — never a sentence. */
  caption?: string;
  /** Diameter in px. 250 in the design; 262 for the resting state. */
  size?: number;
  /**
   * The arc's colour. Amber when the number is counting toward something the
   * studio is doing; champagne when it is describing something already in
   * force. The default is the gradient between them, which the design uses
   * for the live visit.
   */
  stroke?: 'gradient' | 'amber' | 'champagne';
  /** The dotted inner ring the resting dial carries. Absent while work runs. */
  ticks?: boolean;
  /** Accessible reading, e.g. "3 hours 40 minutes remaining". */
  label: string;
}

export function Dial({
  fill, children, caption, size = 250, stroke = 'gradient', ticks = false, label,
}: DialProps) {
  const bounded = Math.max(0, Math.min(1, fill));
  const offset = LEN * (1 - bounded);
  const id = `dial-${stroke}`;

  return (
    <div
      style={{ position: 'relative', width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg
        viewBox="0 0 200 200" aria-hidden
        style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}
      >
        {/* The track. */}
        <circle
          cx="100" cy="100" r={R} fill="none"
          stroke="rgba(255,255,255,0.07)" strokeWidth={3}
        />
        {/* The arc. */}
        <circle
          className="am-dial-arc"
          cx="100" cy="100" r={R} fill="none"
          stroke={
            stroke === 'amber' ? color.amber
              : stroke === 'champagne' ? color.champagne
                : `url(#${id})`
          }
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={LEN}
          strokeDashoffset={offset}
          /* The keyframe animates FROM the full circumference, and the
             component is the only thing that knows what that is. */
          style={{ ['--dial-len' as string]: `${LEN}` }}
        />
        {ticks ? (
          <circle
            cx="100" cy="100" r={R - 14} fill="none"
            stroke="rgba(224,164,92,0.28)" strokeWidth={1} strokeDasharray="2 7"
          />
        ) : null}
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={color.amber} />
            <stop offset="1" stopColor={color.champagne} />
          </linearGradient>
        </defs>
      </svg>

      {/* The number, centred in the ring rather than under it. */}
      <div
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 4,
          textAlign: 'center',
        }}
      >
        <span
          className="am-display"
          style={{
            fontSize: Math.round(size * 0.25),
            lineHeight: 1,
            letterSpacing: '-0.03em',
          }}
        >
          {children}
        </span>
        {caption ? (
          <span className="am-label" style={{ letterSpacing: '0.28em' }}>{caption}</span>
        ) : null}
      </div>

      {/* The bloom inside the ring. §3.4 — the dial is lit, not outlined. */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 16, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(224,164,92,0.14), transparent 68%)',
          filter: 'blur(12px)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

/**
 * The unit inside a dial's number — the "h" in "3h 40m", the "%" in "82%".
 * Half the size and quiet, so the digits are the thing being read.
 */
export function Unit({ children }: { children: ReactNode }) {
  return <span style={{ fontSize: '0.4em', color: color.ink3 }}>{children}</span>;
}
