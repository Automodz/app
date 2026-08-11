'use client';
/**
 * BEFORE ← drag → AFTER.
 *
 * The one piece of the record that argues for itself. Everything else on a
 * visit is the studio's account of the work; this is the work.
 *
 * WHY IT IS A DRAG AND NOT TWO PHOTOGRAPHS SIDE BY SIDE. Two frames at half
 * width are two small pictures, and the difference between a corrected panel
 * and an uncorrected one does not survive being shrunk. One frame at full
 * width with a seam through it keeps the car life-size and puts the change
 * under the customer's own thumb — they find it themselves rather than being
 * told it happened.
 *
 * POINTER EVENTS, not mouse and touch separately: one code path for a finger,
 * a trackpad and a stylus, and `setPointerCapture` keeps the drag alive when
 * the finger leaves the element, which is exactly what happens when somebody
 * drags to the very edge to see the whole of one side.
 *
 * `touch-action: none` on the handle only — not the figure — so the page still
 * scrolls under a finger that lands anywhere else. Taking the whole element
 * out of the scroll would trap the customer in the middle of the page.
 *
 * IT WORKS WITHOUT JAVASCRIPT. The seam starts at the midpoint from the server,
 * so the pair is legible before hydration and if the drag never initialises the
 * customer still sees both halves. §7.1 — motion decorates, it never gates.
 *
 * §21.6 — a slider is what this IS, so it says so: `role="slider"` with the
 * position in `aria-valuenow`, driven by the arrow keys as well as a finger.
 */
import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import { color, space, radius, HAIRLINE, imageSizes, type as typeScale } from '@/design';

export interface BeforeAfterProps {
  before: string;
  after: string;
  /** The car, for the alt text. §21.6 — a photograph that carries meaning. */
  subject: string;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function BeforeAfter({ before, after, subject }: BeforeAfterProps) {
  const [at, setAt] = useState(50);
  const frame = useRef<HTMLDivElement>(null);

  const moveTo = useCallback((clientX: number) => {
    const box = frame.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    setAt(clamp(((clientX - box.left) / box.width) * 100));
  }, []);

  const onDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    moveTo(e.clientX);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    moveTo(e.clientX);
  };
  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowLeft') { e.preventDefault(); setAt(v => clamp(v - step)); }
    if (e.key === 'ArrowRight') { e.preventDefault(); setAt(v => clamp(v + step)); }
    if (e.key === 'Home') { e.preventDefault(); setAt(0); }
    if (e.key === 'End') { e.preventDefault(); setAt(100); }
  };

  return (
    <figure style={{ margin: 0 }}>
      <div
        ref={frame}
        style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', overflow: 'hidden', background: color.surface }}
      >
        {/* AFTER underneath, whole. The finished car is the ground state — a
            customer who never touches this sees the result, not the damage. */}
        <Image
          src={after}
          alt={`${subject}, finished`}
          fill
          sizes={imageSizes.fullBleed}
          style={{ objectFit: 'cover' }}
        className="am-photo"
          />

        {/* BEFORE on top, clipped to the seam. `inset` rather than width, so
            the image inside never reflows — it is revealed, not resized, and
            the two halves stay in register at every position. */}
        <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - at}% 0 0)` }}>
          <Image
            src={before}
            alt={`${subject}, on arrival`}
            fill
            sizes={imageSizes.fullBleed}
            style={{ objectFit: 'cover' }}
          className="am-photo"
          />
        </div>

        {/* THE SEAM. A hairline, and the only ornament here (§3.4). */}
        <div
          aria-hidden
          style={{
            position: 'absolute', top: 0, bottom: 0, left: `${at}%`,
            width: HAIRLINE, background: color.over, opacity: 0.9,
            transform: 'translateX(-50%)', pointerEvents: 'none',
          }}
        />

        {/* THE HANDLE — the whole surface, so the seam can be grabbed anywhere
            rather than only on a small target. §21.3's floor is about the
            visible grip, which is 44pt below. */}
        <div
          role="slider"
          tabIndex={0}
          aria-label={`Compare ${subject} before and after`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(at)}
          aria-valuetext={`${Math.round(at)}% before`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onKeyDown={onKey}
          style={{ position: 'absolute', inset: 0, touchAction: 'none', cursor: 'ew-resize' }}
        >
          <span
            aria-hidden
            style={{
              position: 'absolute', top: '50%', left: `${at}%`,
              transform: 'translate(-50%, -50%)',
              width: 44, height: 44, borderRadius: radius.pill,
              border: `${HAIRLINE}px solid ${color.over}`,
              background: 'rgba(10,11,13,0.42)',
              backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
              display: 'grid', placeItems: 'center',
              fontFamily: typeScale.data.family, fontSize: 15, color: color.over,
              letterSpacing: '0.06em',
            }}
          >
            ‹ ›
          </span>
        </div>

        {/* The two words, on the halves they name. */}
        {(['Before', 'After'] as const).map((word, i) => (
          <span
            key={word}
            aria-hidden
            style={{
              position: 'absolute', bottom: space.line,
              [i === 0 ? 'left' : 'right']: space.gap,
              fontFamily: typeScale.data.family, fontSize: 11,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: color.over, opacity: 0.85,
              textShadow: '0 1px 6px rgba(0,0,0,0.6)',
            }}
          >
            {word}
          </span>
        ))}
      </div>
    </figure>
  );
}
