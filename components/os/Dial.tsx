'use client';
/**
 * THE DIAL - one number, and nothing else.
 *
 * Source: docs/AUTOMODZ-OS.md §3.2, §3.5, §5.3, §7.6, §9.5, §14.2
 *         design "AutoModz App.dc.html" - screens 1a and 1c
 *
 * The design opens the product on a single ring holding a single number: how
 * long until the car is ready, or how much of its protection is left. §3.2
 * asks each surface to have exactly one thing it is about; this is the most
 * literal answer the product has - the screen is a number, and everything
 * under it is context for it.
 *
 * ── WHY THE ARC IS DRAWN AND NOT ANIMATED ON A LOOP ──────────────────────
 * It sweeps once, on arrival, over 2.4s. That is the difference between a
 * measurement being TAKEN and a thing spinning: a loop would read as loading,
 * and this number is never loading - it is known before the screen paints.
 * §7.6 - under reduced motion the arc is simply already drawn.
 *
 * ── WHY THE TRACK IS ALMOST INVISIBLE ────────────────────────────────────
 * §3.5. The unfilled part of a dial is the part that carries no information.
 * At 7% white it is enough for the arc to be read as a proportion and not
 * enough to be read as a second ring.
 *
 * ── WHY IT NOW BOUNDS ITSELF ─────────────────────────────────────────────
 * `size` was a fixed width AND a fixed height, and the number inside it was
 * sized at a quarter of that with nothing clipping it. Both assumptions held
 * only for the content the design drew - "3h 40m", "82%" - and a caller who
 * put a SENTENCE in the slot got 62px type wrapped over six lines, spilling
 * out of a 250px box in every direction and over the screen's own header and
 * the pane below it. That is exactly what happened in production.
 *
 * A primitive whose layout depends on its caller behaving is not bounded, so
 * three things changed, and none of them is an offset:
 *
 *   · `size` is a MAXIMUM. The ring is `min(size, 100%)` on a square aspect,
 *     so a 262px dial in a 327px column stays 262, and the same dial in a
 *     narrower one shrinks instead of overflowing.
 *   · The number is measured against THE RING, not against the prop - in
 *     container units, so it is right at whatever width the ring actually
 *     took. `size * 0.25` is kept as the fallback for a browser without
 *     container queries, where it was already correct.
 *   · The number's box is clipped to the ring's inner square. Nothing put in
 *     this slot can reach anything outside the dial, whatever it is.
 *
 * And it says so out loud in development: prose in a number slot is a caller
 * bug, and a clipped sentence is a symptom that should not have to be noticed
 * on a phone in production before anybody hears about it.
 */
import type { ReactNode } from 'react';
import { color } from '@/design';

/* The geometry, once. r=88 on a 200 viewBox leaves room for a 3px stroke and
   its round cap without either touching the edge; the circumference follows
   from it rather than being typed in - the design's `stroke-dasharray:553` is
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
  /**
   * The number itself, already worded - "3h 40m", "82%".
   *
   * A MEASURE, NOT A SENTENCE. The slot is a quarter of the ring high; nothing
   * longer than a short reading belongs in it, and the component clips rather
   * than lets it out. See `MEASURE_MAX`.
   */
  children: ReactNode;
  /** The line under it. Mono, tracked, quiet - never a sentence. */
  caption?: string;
  /** Diameter in px, and a CEILING rather than a fixed width - see the note
   *  at the top. 250 in the design; 262 for the resting state. */
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

/**
 * The longest reading the slot is designed for.
 *
 * Not just a measure: screen 1c puts the STATE in the ring when a car has no
 * term to count down - "Cared for", "Final checks" - and those are what set
 * this bound, at twelve characters plus room. Past it the content is prose,
 * it belongs in a line of body text, and it is clipped rather than allowed
 * out.
 */
const MEASURE_MAX = 14;

/**
 * The number's size, as a fraction of the ring, stepped by how much there is
 * to read. The design's quarter holds a four-character measure - "3h 40m",
 * "82%" - and anything longer gets SMALLER rather than wider, because the
 * ring's inner square is the bound and the type has to live inside it.
 *
 * Each step was chosen so the reading still fills the ring at two lines:
 * "Cared for" at 0.165 and "Final checks" at 0.125 both wrap once and sit
 * comfortably within the 74% of the box the arc encloses.
 */
function scaleFor(length: number): number {
  if (length <= 4) return 0.25;
  if (length <= 6) return 0.20;
  if (length <= 9) return 0.165;
  if (length <= MEASURE_MAX) return 0.125;
  return 0.11;
}

/** The plain length of whatever was handed to the slot, when it is readable. */
function readingLength(children: ReactNode): number {
  if (typeof children === 'string') return children.length;
  if (typeof children === 'number') return String(children).length;
  if (Array.isArray(children)) {
    return children.reduce<number>((n, c) => n + readingLength(c as ReactNode), 0);
  }
  /* An element - a `<Unit>` beside a number, which is what this slot is for.
     Counted as its own small contribution rather than measured, since reading
     into an element's children is guessing at a render. */
  return children ? 2 : 0;
}

export function Dial({
  fill, children, caption, size = 250, stroke = 'gradient', ticks = false, label,
}: DialProps) {
  const bounded = Math.max(0, Math.min(1, fill));
  const offset = LEN * (1 - bounded);
  const id = `dial-${stroke}`;

  const reading = readingLength(children);
  const scale = scaleFor(reading);

  /* SAID OUT LOUD, IN DEVELOPMENT ONLY. The production symptom of prose in
     this slot is a clipped word, which is quiet enough to ship - and did. */
  if (process.env.NODE_ENV !== 'production' && reading > MEASURE_MAX) {
    console.error(
      `[Dial] the number slot was given ${reading} characters. It holds a `
      + `measure ("3h 40m", "82%"), not a sentence - the sentence belongs in a `
      + `line of body text. It will be clipped to the ring.`,
    );
  }

  return (
    <div
      className="am-dial"
      style={{
        position: 'relative',
        /* §8.1 - the column is one column at every width, so the ring takes
           the width it is given and never more. `size` is the ceiling. */
        width: `min(${size}px, 100%)`,
        maxWidth: size,
        aspectRatio: '1 / 1',
      }}
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

      {/* The number, centred in the ring rather than under it.
          `inset: 13%` is the ring's inner square: r=88 on a 200 viewBox with a
          3px stroke leaves ~86% of the box inside the arc, and the content is
          held there rather than at `inset: 0` - so the bound is the RING, not
          the element, and nothing can be drawn over the arc it belongs to. */}
      <div
        style={{
          position: 'absolute', inset: '13%',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 4,
          textAlign: 'center',
          overflow: 'hidden',
        }}
      >
        <span
          className="am-display am-dial-value"
          style={{
            /* The fallback, and what every browser without container queries
               gets: exactly the arithmetic this component has always used.
               `--dial-value` is the same number for the class to pick up in
               container units, where it is measured against the ring's REAL
               width rather than against the prop. */
            ['--dial-scale' as string]: scale,
            fontSize: Math.round(size * scale),
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            /* Two lines at most, and clipped - a caller cannot push anything
               out of the ring, whatever they put in it. */
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
            overflowWrap: 'break-word',
            maxWidth: '100%',
          }}
        >
          {children}
        </span>
        {caption ? (
          <span
            className="am-label"
            style={{
              letterSpacing: '0.28em',
              /* The caption is one short word; it wraps inside the ring rather
                 than widening it. */
              maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {caption}
          </span>
        ) : null}
      </div>

      {/* The bloom inside the ring. §3.4 - the dial is lit, not outlined. */}
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
 * The unit inside a dial's number - the "h" in "3h 40m", the "%" in "82%".
 * Half the size and quiet, so the digits are the thing being read.
 */
export function Unit({ children }: { children: ReactNode }) {
  return <span style={{ fontSize: '0.4em', color: color.ink3 }}>{children}</span>;
}
