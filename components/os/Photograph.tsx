'use client';
/**
 * EVERY PHOTOGRAPH IN THE CUSTOMER PRODUCT.
 *
 * Source: docs/AUTOMODZ-OS.md §11.2, §11.5, §19.1, §21.1, §21.6
 *
 * ── WHAT THE PIPELINE ACTUALLY IS ────────────────────────────────────────
 * Traced before anything here was written, because the owner reported "images
 * are not showing on the live" and the honest answer had to come first:
 *
 *   upload → `lib/services/storage.ts` → Cloudinary → `secure_url` stored whole
 *   → the projection passes it through unchanged → this component
 *
 * The stored value is a COMPLETE, PERMANENT, UNSIGNED https URL on
 * `res.cloudinary.com`. There is no signing, no expiry and no Firebase Storage
 * path anywhere in the customer pipeline; `path: 'cloudinary:<public_id>'` is
 * kept beside it only so a delete can find the asset. The host is allowed in
 * both `next.config.js` `remotePatterns` and the CSP's `img-src`, and it
 * answers.
 *
 * So a URL that exists loads. The empty plates on production are visits the
 * studio has not photographed YET - and the interface was drawing that exactly
 * like a photograph that failed, which is the actual defect. §19.1: an absence
 * is a state, and it is not the same state as a failure.
 *
 * ── THE THREE STATES, KEPT APART ─────────────────────────────────────────
 *   `absent`   nothing was ever uploaded. §11.5's composed absence - a field
 *              lit from above, never a grey box and never an apology.
 *   `loading`  a URL exists and is on its way. The same ground, breathing.
 *   `failed`   a URL exists and the browser could not load it. Said plainly,
 *              because pretending otherwise hides a real data fault from the
 *              studio - the thing the previous fallback did.
 *
 * The frame owns the size in all three, so the composition never moves and
 * nothing reflows when a photograph arrives or does not.
 *
 * ── AND THE ALT TEXT STAYS INSIDE ────────────────────────────────────────
 * A broken `<img>` collapses to its alt text at body size and pushes the
 * layout apart. The text stays - a screen reader needs it (§21.6) - but it is
 * never allowed to lay anything out.
 */
import { useState, type CSSProperties } from 'react';
import Image from 'next/image';
import { color, ground, radius, space } from '@/design';

export type PhotographState = 'absent' | 'loading' | 'ready' | 'failed';

export interface PhotographProps {
  /** The stored URL. Absent means never photographed - a different thing. */
  src?: string | null;
  /**
   * §21.6 - what the photograph shows, for somebody who cannot see it. Empty
   * string only when the image is decorative and its meaning is already said
   * in text beside it.
   */
  alt: string;
  /** `next/image` sizes hint. */
  sizes?: string;
  /** Fill the positioned parent (the usual case) rather than a fixed box. */
  fill?: boolean;
  width?: number;
  height?: number;
  /** The first photograph on the screen - the hero - is not lazy. */
  priority?: boolean;
  /** Shape of the frame. Defaults to the pane radius. */
  radius?: number | string;
  /** `object-fit`, for the rare frame that must not crop. */
  fit?: CSSProperties['objectFit'];
  style?: CSSProperties;
  /** Told when the photograph could not load, so a screen can say so once. */
  onFailed?: () => void;
}

export function Photograph({
  src, alt, sizes, fill = true, width, height, priority = false,
  radius: r, fit = 'cover', style, onFailed,
}: PhotographProps) {
  const [failed, setFailed] = useState(false);
  const usable = typeof src === 'string' && src.trim().length > 0;
  const state: PhotographState = !usable ? 'absent' : failed ? 'failed' : 'ready';

  return (
    <span
      /* THE FRAME OWNS THE SIZE. Whatever happens to the photograph, the
         composition around it does not move. */
      data-photograph={state}
      style={{
        position: fill ? 'absolute' : 'relative',
        ...(fill ? { inset: 0 } : { display: 'block', width, height }),
        overflow: 'hidden',
        borderRadius: r ?? radius.pane,
        /* §11.5 - a field lit from slightly above centre. The same ground for
           absent and for failed: the difference is said, not coloured. */
        background: ground.awaiting,
        ...style,
      }}
    >
      {state === 'ready' ? (
        <Image
          src={src as string}
          alt={alt}
          {...(fill ? { fill: true } : { width: width ?? 0, height: height ?? 0 })}
          sizes={sizes}
          priority={priority}
          onError={() => { setFailed(true); onFailed?.(); }}
          style={{
            objectFit: fit,
            /* The alt text is kept for a screen reader and never allowed to
               lay the page out if the image collapses to it. */
            fontSize: 0, color: 'transparent',
          }}
        />
      ) : null}

      {state === 'failed' ? (
        /* SAID, NOT HIDDEN. A photograph that exists and will not load is a
           fault the studio needs to know about; dressing it as "not taken yet"
           is how a broken asset stays broken. Quiet, inside the frame, and it
           never changes the frame's size. */
        <span
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: space.line, textAlign: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 9.5,
            letterSpacing: '0.16em', textTransform: 'uppercase',
            color: color.ink3,
          }}
        >
          Photograph unavailable
        </span>
      ) : null}
    </span>
  );
}
