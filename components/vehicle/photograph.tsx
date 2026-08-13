'use client';
/**
 * THE PHOTOGRAPH RENDERER
 *
 * Source: docs/AUTOMODZ-OS.md §3.1, §3.4, §3.6, §7.1, §7.6, §11.2, §11.3,
 *         §11.4, §11.5, §21.1, §21.6
 *
 * One implementation of `VehicleRendering` — the only one that exists today.
 * §11.3: "a great photograph is achievable today, on a phone, by the studio",
 * and a 3D car built because it is possible is worse than one.
 *
 * THIS IS THE ONLY FILE IN THE VEHICLE SURFACE THAT KNOWS WHAT A PHOTOGRAPH
 * IS. `next/image` is imported here and nowhere else. Adding a photogrammetric
 * or AR renderer means adding a sibling to this file and changing which one the
 * route asks for; the screen does not move.
 *
 * ── HOW THIS MEDIUM ANSWERS `focus` ──────────────────────────────────────
 * §11.4 — "touching a region reveals the state of that region." A photograph
 * cannot turn toward a wheel, so it answers the only way a flat image can:
 * everything except the region recedes. The region is not lit by ADDING
 * light, which would wash an unknown image out; it is lit by being the one
 * part from which nothing was taken. §3.4 — light is the only ornament, and
 * this is the ornament.
 *
 * ── COVER SPACE, AND WHY IT IS BUILT BY HAND ─────────────────────────────
 * `object-fit: cover` scales and crops, so a region authored at 0.30 of the
 * photograph can be drawn at 0.15 of the frame — measured, on a 390×844
 * viewport, with the placeholder image. Positioning a mark by fraction of the
 * frame therefore puts it somewhere off the car, and does it silently.
 *
 * So the photograph is not drawn with `object-fit` into the frame. A BOX THE
 * SHAPE OF THE PHOTOGRAPH is sized to cover the frame and centred in it, and
 * the image, the recession and every mark live inside that box. Inside it, a
 * fraction of the photograph is a fraction of the box, exactly, at every
 * viewport — so the marks stay on the car by construction rather than by
 * being re-authored per breakpoint.
 *
 * The cover size is computed in CSS, from the frame, with no measurement:
 *
 *     width  = max(100cqw, 100cqh × aspect)
 *     height = max(100cqh, 100cqw ÷ aspect)
 *
 * Container query units rather than viewport units on purpose — the frame is
 * the whole viewport on the Vehicle screen today, and hard-coding that would
 * be this file learning where it is being used.
 */
import { useState } from 'react';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { color, ground, scrim, duration, curve, imageSizes } from '@/design';
import { inReadingOrder } from './renderer';
import type { RenderedRegion, RenderingProps, VehicleRendering } from './renderer';

/**
 * The geometry of the hole in the recession, as a percentage of the box.
 *
 * `CLEAR` is the radius left completely alone — sized so a whole wheel or the
 * whole windscreen sits inside it, because the customer asked about a part of
 * a car and not about a point. `FALLOFF` is where the dim reaches full
 * strength; the gap between the two is the softness. A hard edge would read as
 * a cut-out laid on the photograph, which is the boxes §3.6 rejects.
 */
const CLEAR = 14;
const FALLOFF = 42;

export interface PhotographSource {
  /** The image itself. Absent until the studio has photographed the car. */
  url?: string;
  /**
   * The photograph's own shape, width ÷ height. Required with `url`, because
   * cover space cannot be built without it — and getting it wrong moves every
   * mark, which is why it is stated rather than sniffed.
   */
  aspect?: number;
  /**
   * §21.6 — "images that carry meaning have descriptions". This one carries
   * the whole screen.
   */
  description?: string;
  /**
   * §11.4 — where the regions are IN THIS PHOTOGRAPH, as fractions of it.
   * Authored per image, because only whoever looked at it knows where its
   * wheels are. A photograph with none cannot be asked about itself, and the
   * screen stays whole without the interaction.
   */
  regions?: readonly RenderedRegion[];
}

/**
 * §11.3 — "the surface asks for the hero for this vehicle and receives one."
 * This is that resolution, for the medium we have.
 */
export function photograph(source: PhotographSource): VehicleRendering {
  const { url, aspect = 1, description, regions = [] } = source;

  function Surface({ focus, priority, mark }: RenderingProps) {
    const still = useReducedMotion();
    const at = focus ? regions.find(r => r.id === focus) : undefined;
    /**
     * §11.5 — AND A PHOTOGRAPH THAT WILL NOT LOAD IS NOT ONE THAT WAS NEVER
     * TAKEN.
     *
     * This was the last raw `<Image>` on a customer surface, and it was the
     * largest element in the product: a car whose hero 404s collapsed the
     * image to its ALT TEXT at 16px in full ink — "Kia Seltos, photographed at
     * AutoModz" sprawled across half the display. Every geometric assertion
     * passed; the box was the right size and the words were inside it.
     *
     * `components/os/Photograph` cannot be used here because the cover box is
     * bespoke — the marks live in the photograph's own coordinates and that is
     * the whole reason this renderer exists — so it borrows the primitive's
     * VOCABULARY instead: the same composed ground, and the same sentence.
     */
    const [failed, setFailed] = useState(false);

    if (!url || failed) {
      /* §11.5 — "composed, not defaulted… it reads as awaiting the first
         visit." Never a grey box, never a placeholder silhouette. There is no
         cover space to build and nothing to ask about, so this branch is the
         composition and nothing else. */
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: ground.awaiting,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {failed ? (
            /* SAID, NOT HIDDEN — a photograph that exists and will not load is
               a fault the studio needs to know about, and dressing it as "not
               photographed yet" is how a broken asset stays broken. The same
               words `Photograph` uses, because there is one vocabulary. */
            <span
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 9.5,
                letterSpacing: '0.16em', textTransform: 'uppercase',
                color: color.ink3,
              }}
            >
              Photograph unavailable
            </span>
          ) : null}
        </div>
      );
    }

    return (
      <div style={{ position: 'absolute', inset: 0, containerType: 'size' }}>
        {/* COVER SPACE. Everything inside is in the photograph's coordinates. */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: `max(100cqw, calc(100cqh * ${aspect}))`,
            height: `max(100cqh, calc(100cqw / ${aspect}))`,
          }}
        >
          <Image
            src={url}
            alt={description ?? ''}
            fill
            priority={priority}
            sizes={imageSizes.fullBleed}
            onError={() => setFailed(true)}
            /* `contain`, not `cover` — the box is already the photograph's
               shape, so there is nothing left to crop. Using `cover` here
               would re-introduce the very crop this box exists to remove. */
            style={{
              objectFit: 'contain',
              /* The alt text is kept — it is what a screen reader reads — and
                 never allowed to lay the screen out if the image collapses to
                 it. The same two declarations the primitive sets. */
              fontSize: 0, color: 'transparent',
            }}
          />

          {/* The recession. One element, always mounted, opacity-driven.

              §7.6 — "transforms and parallax stop. Opacity transitions may
              remain." This is opacity and colour only, so under reduced motion
              it survives intact rather than being switched off: the customer
              still gets the answer, just without the fade. §7.1 — motion
              decorates, it never gates.

              The centre travels as two custom properties, so moving between
              regions slides attention across the car instead of cutting. When
              `focus` clears the centre is deliberately LEFT WHERE IT WAS —
              animating it home would drag a spotlight across the photograph on
              the way out, which reads as an effect rather than as attention
              being released. */}
          <motion.div
            aria-hidden
            initial={false}
            animate={{
              opacity: at ? 1 : 0,
              ...(at ? { '--fx': `${at.x * 100}%`, '--fy': `${at.y * 100}%` } : {}),
            }}
            transition={{
              duration: still ? 0 : duration.move / 1000,
              ease: curve.ease,
            }}
            style={{
              position: 'absolute',
              inset: 0,
              // An origin for the first fade, before any region is asked about.
              ['--fx' as string]: '50%',
              ['--fy' as string]: '50%',
              background: [
                'radial-gradient(circle at var(--fx) var(--fy)',
                'rgba(0,0,0,0) 0%',
                `rgba(0,0,0,0) ${CLEAR}%`,
                `rgba(0,0,0,${scrim.region}) ${FALLOFF}%`,
                `rgba(0,0,0,${scrim.region}) 100%)`,
              ].join(', '),
            }}
          />

          {/* The screen's marks, placed in the photograph's own space.

              Mapped in reading order, not authoring order: DOM order is tab
              order, and §21.5 wants the keyboard to move the way a person
              moves around a car. That ordering is derived from geometry, so it
              belongs here with the geometry rather than in the screen. */}
          {mark
            ? inReadingOrder(regions).map(r => (
              <div
                key={r.id}
                style={{
                  position: 'absolute',
                  left: `${r.x * 100}%`,
                  top: `${r.y * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {mark(r)}
              </div>
            ))
            : null}
        </div>
      </div>
    );
  }

  return { Surface, regions, present: Boolean(url) };
}
