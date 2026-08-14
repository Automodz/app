'use client';
/**
 * HERO - the full-bleed subject.
 *
 * Source: docs/AUTOMODZ-OS.md §3.1, §3.2, §7.4, §7.6, §8.4, §11.2, §11.5, §21.1
 *
 * §3.1 makes the photograph the interface and §3.2 makes it the one subject on
 * the screen. §8.4 puts it full-bleed. This component is that frame.
 *
 * IT DOES NOT KNOW WHAT IT IS SHOWING. The media arrives as `children` rather
 * than as a `src`, which is what lets the thing inside change - a photograph
 * today, something else later - without this frame or anything composing it
 * being touched.
 *
 * §7.4 lists the ONLY ambient motion permitted anywhere in the product, and it
 * is permitted here: a gentle scale settle on entrance. Parallax, tilt and the
 * light sweep are scroll- and device-driven, so they belong to whatever is
 * composed inside; the magnitudes for all four live in `heroMotion`.
 *
 * §7.6 - the settle stops under reduced motion and the frame renders complete.
 * §7.1 - the media is never gated on the animation; only a wrapper transforms.
 *
 * §21.1 - text over a photograph carries a scrim "sufficient for the worst
 * image, not the best one". `overlay` content is always scrimmed, at the value
 * derived in design/colors.ts. It cannot be switched off.
 *
 * §11.5 - the no-media state is a different height, because a full-height
 * empty frame reads as broken where a shorter composed one reads as awaiting.
 *
 * ── `over2` MUST NOT BE USED IN AN OVERLAY ───────────────────────────────
 * §9.1 offers two tones for text on a photograph, `over` and `over2`. Only
 * one of them is safe here, and it is worth writing down why, because the
 * reason is not visible by looking.
 *
 * `scrim.photoFloor` was solved for WHITE text on a pure-white photograph -
 * the §21.1 worst case - and it lands on 4.76:1, barely over AA. `over2` is
 * 72% white, so over a bright image it composites TOWARD the background it is
 * meant to contrast with: the two converge, and the pair measures 3.33:1.
 * Raising the scrim until `over2` passes takes it to 0.66, which blacks out
 * the band of photograph the frame exists to show. There is no floor that
 * satisfies both.
 *
 *   scrim   over    over2
 *   0.55    4.76    3.33   ← the current floor
 *   0.60    5.74    3.88
 *   0.66    7.26    4.70   ← over2 finally passes; the photograph is gone
 *
 * So: over a photograph, quiet means SMALLER, not fainter. Hierarchy comes
 * from the type scale (§9.5), and `over2` belongs to surfaces whose ground is
 * known - never to one that can be any image at all.
 */
import { motion, useReducedMotion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';
import { heroMotion, heroSize, scrim, ground, space, INSET, duration, curve } from '@/design';

/**
 * THE SCRIM IS MEASURED IN PIXELS, NOT PERCENT.
 *
 * A percentage would tie the darkening to the FRAME, so a taller photograph
 * would be darkened over a greater absolute distance - the opposite of what
 * is wanted, since a taller frame exists to show more photograph. The scrim
 * protects the overlay, so it is sized to the overlay.
 *
 * `SCRIM_BAND` is the distance up from the bottom edge over which the scrim
 * stays at or above `scrim.photoFloor` - the value solved for white text on a
 * pure-white photograph. It is the height of the overlay it has to protect,
 * which is why there are two of them: this frame carries the tall §5.3 block
 * on a vehicle surface and a three-line caption in the collection, and one
 * band sized for the first turns the second into mud.
 *
 * Above the band the scrim ramps to zero, gently enough that no edge is
 * visible. Everything past that point is untouched photograph - on a 94svh
 * hero, the greater part of the frame.
 */
const SCRIM_BAND = {
  /**
   * The §5.3 block in full: identity, a Display wrapped to three lines, a
   * sentence wrapped to two, one control, and the frame's bottom padding.
   * ~287px at the phone type scale.
   */
  full: space.movement * 3, // 288
  /**
   * Identity, one phrase at Title, one quiet line - what a photograph in the
   * collection carries (§12.3: "its photograph, its name, its plate, and one
   * line of state"). ~110px, rounded up so both the phrase and the line may
   * wrap without leaving type in the thin part.
   */
  brief: space.movement + space.rest, // 144
} as const;

/**
 * Where the fade reaches zero, as a multiple of the hold band. Held as one
 * ratio rather than a second table so the two bands cannot drift apart: a
 * shorter overlay gets a proportionally shorter ramp, which is what keeps a
 * 470px collection frame from being darkened like an 800px hero.
 */
const SCRIM_FADE = 5 / 3;

/** Which of those two shapes the overlay is. */
export type HeroBand = keyof typeof SCRIM_BAND;

export interface HeroProps {
  /**
   * Whatever is being shown. A photograph, a composed awaiting state, anything.
   * The frame never knows (§11.3 - the renderer is replaceable).
   */
  children?: ReactNode;
  /** Content laid over the media. Always scrimmed (§21.1). */
  overlay?: ReactNode;
  /**
   * §11.5 - `awaiting` is shorter on purpose. Not a style choice: a full-height
   * empty frame reads as broken.
   */
  state?: 'media' | 'awaiting';
  /**
   * How tall the overlay is, so the scrim can be sized to it (§21.1).
   *
   * Not a style knob - the frame cannot measure its own overlay without
   * breaking §8.5's "no screen may position a fixed element by measuring
   * another", and a single band sized for the tallest case darkens a short
   * frame into mud. Two values, because the product has two overlay shapes.
   */
  band?: HeroBand;
  className?: string;
  /**
   * `height` here intentionally wins over the frame's own - that is how the
   * collection (§12) sizes its lead and its successors from `photoSize`
   * without this component learning what a garage is.
   */
  style?: CSSProperties;
}

export function Hero({
  children,
  overlay,
  state = 'media',
  band = 'full',
  className,
  style,
}: HeroProps) {
  const still = useReducedMotion();
  const height = state === 'media' ? heroSize.withPhoto : heroSize.awaitingPhoto;
  const hold = SCRIM_BAND[band];

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height,
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* §7.1 - the WRAPPER settles; the media itself is never animated, so it
          renders whether or not the animation runs.

          `initial` is NOT branched on reduced motion. `useReducedMotion()`
          returns null while server-rendering and a boolean once mounted, so a
          branch here emits `scale(1.06)` in the server HTML and `none` on the
          client - a hydration mismatch React refuses to patch. The starting
          transform is therefore identical on both, and §7.6 is honoured by
          collapsing the DURATION instead: with motion reduced the settle
          resolves in a single paint and is never seen.

          §11.5, §22.2 - THE COMPOSED ABSENCE LIVES HERE, ONCE. "Composed, not
          defaulted… never a grey box, never a placeholder silhouette." Four
          surfaces had grown an identical copy of that gradient; a frame that
          already knows it is `awaiting` is the one place the fact belongs, so a
          caller with nothing to show passes no children and gets it. */}
      <motion.div
        initial={{ scale: heroMotion.settleFrom }}
        animate={{ scale: 1 }}
        transition={still ? { duration: 0 } : {
          duration: heroMotion.settleDuration / 1000,
          ease: curve.ease,
        }}
        style={{ position: 'absolute', inset: 0 }}
      >
        {children ?? (
          <div
            aria-hidden
            style={{ position: 'absolute', inset: 0, background: ground.awaiting }}
          />
        )}
      </motion.div>

      {overlay ? (
        <>
          {/* §21.1 - sufficient for the worst image. Not optional OVER MEDIA,
              and that qualifier is the whole point of the `state` prop.

              The scrim defends against an image nobody has seen. In the
              `awaiting` state there is no such image: §11.5 requires that
              composition to be made by the product, and the product makes it
              dark. Scrimming it anyway crushed a radial gradient into a flat
              black rectangle - which is precisely the "grey box" §11.5 names
              as the failure. Defend the unknown; do not flatten the known.

              The gradient HOLDS AT `photoFloor` for the whole band the overlay
              can occupy, and only then begins to fade. The previous curve fell
              to 0.36 by 40% of the frame - below the floor solved for white
              text on a pure-white photograph - which was survivable only while
              the frame was short enough that type never reached that high. A
              taller frame, or a state phrase that wraps to three lines, puts
              type squarely in the thin part. A scrim that is correct only for
              short content is not "sufficient for the worst image".

              In the `awaiting` state the ground beneath is a composition
              rather than a photograph, and this darkens it. That is accepted
              deliberately: §11.3 makes the renderer replaceable, so this frame
              must never assume what is inside it is dark enough to skip a
              contrast guarantee. */}
          {state === 'media' ? (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                /* A decorative overlay must never eat input. Without this the
                   scrim covers the whole frame and, being later in the DOM
                   than the media, silently swallows every click meant for
                   whatever is composed inside - a vehicle surface whose car
                   is touchable (§11.4) cannot be built over it. */
                pointerEvents: 'none',
                background: [
                  'linear-gradient(to top',
                  `rgba(0,0,0,${scrim.photo}) 0px`,
                  `rgba(0,0,0,${scrim.photoFloor}) ${hold}px`,
                  `rgba(0,0,0,0) ${hold * SCRIM_FADE}px)`,
                ].join(', '),
              }}
            />
          ) : null}
          <div
            style={{
              position: 'absolute',
              insetInline: 0,
              bottom: 0,
              paddingInline: INSET,
              paddingBottom: space.gap,
              transition: `opacity ${duration.move}ms`,
            }}
          >
            {overlay}
          </div>
        </>
      ) : null}
    </div>
  );
}
