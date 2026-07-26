'use client';
/**
 * THE HERO VEHICLE - the car, and the boundary behind which it is rendered.
 * (Design Language §1 · §5)
 *
 * The customer's own photograph fills the top of the screen edge to edge: a
 * window, not a picture hung on a wall. Nothing competes with it, there is one
 * per screen, and information lives *on* it as glass rather than beside it.
 *
 * WHY THIS IS A COMPONENT AND NOT A PICTURE.
 * `renderer` is the seam. Today it is a photograph. Tomorrow it may be
 * photogrammetry, a scan, a model or AR - and nothing outside this file
 * changes, because the overlays, the hotspots, the states and the journey are
 * all renderer-agnostic by construction. That is the whole point of naming it
 * HeroVehicle rather than HeroPhoto.
 *
 * THE FOUR MOTIONS (the only ambient motion the product permits - the car is
 * the product and must feel alive; chrome keeps the blanket ban):
 *   · intro settle   1.06 → 1.00, once, on open
 *   · parallax       the hero moves slower than the content over it
 *   · device tilt    5-10px of perspective, imperceptible if you look for it
 *   · light sweep    one soft pass every 20-30s
 *
 * THE MOTION LAW. Motion decorates content; it never gates it. The photograph
 * is opaque from the first frame - only its *scale* animates - so a throttled
 * frame, a slow device or a JS fault can never leave the owner looking at a
 * black rectangle where their car should be.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { studioEase, scene } from '@/lib/os/motion';
import HeroMedia from './HeroMedia';
import IdentityPlate from './IdentityPlate';
import { Whisper } from './text';

/** Where a tap lands on the car, in fractions of the frame (0-1). */
export interface HeroHotspot {
  key: string;
  /** normalised centre - survives any crop, any renderer */
  x: number;
  y: number;
  label: string;
  /** true only while this zone's state is asking for something */
  attention?: boolean;
  onTap: () => void;
}

export interface HeroVehicleProps {
  name: string;
  registration?: string;
  photo?: string;
  /** the seam. 'photo' today; the others are named so the contract is explicit. */
  renderer?: 'photo' | 'photogrammetry' | 'model' | 'ar';
  hotspots?: HeroHotspot[];
  /** rendered over the hero's floor - the state, the one Display of the screen */
  children?: ReactNode;
  /** override the frame's height. Defaults to a full hero for a photograph,
   *  and a shorter band when there is none. Always full-bleed horizontally. */
  height?: string;
  priority?: boolean;
  /** the surface the hero's floor settles into */
  scrimTo?: string;
}

export default function HeroVehicle({
  name, registration, photo, renderer = 'photo', hotspots = [],
  children, height, priority, scrimTo = 'var(--st-paper)',
}: HeroVehicleProps) {
  /* a photograph earns the full frame; a monument stands shorter rather than
     floating in a void it cannot fill */
  const frameHeight = height ?? (photo ? 'min(62svh, 560px)' : 'min(42svh, 380px)');
  const reduced = useReducedMotion();
  const frame = useRef<HTMLDivElement>(null);

  /* PARALLAX - the hero drifts slower than the page over it. Transform-only,
     so it composites on the GPU and costs nothing on a mid-range Android. */
  const { scrollYProgress } = useScroll({
    target: frame,
    offset: ['start start', 'end start'],
  });
  const driftRaw = useTransform(scrollYProgress, [0, 1], ['0%', '14%']);
  const drift = reduced ? undefined : driftRaw;

  /* DEVICE TILT - a machined object catching the light. iOS requires a user
     gesture to grant DeviceOrientation, and asking unprompted is hostile, so
     this attaches only where the browser hands it over freely; everywhere
     else it degrades to nothing at all. */
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (reduced || typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;
    // iOS gates this behind requestPermission(); we never prompt for decoration
    const needsPermission = typeof (DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    }).requestPermission === 'function';
    if (needsPermission) return;

    const MAX = 8; // px - the design language's 5-10px band
    const onTilt = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma ?? 0;   // left/right, -90..90
      const beta = e.beta ?? 0;     // front/back
      setTilt({
        x: Math.max(-MAX, Math.min(MAX, (gamma / 45) * MAX)),
        y: Math.max(-MAX, Math.min(MAX, ((beta - 45) / 45) * MAX)),
      });
    };
    window.addEventListener('deviceorientation', onTilt);
    return () => window.removeEventListener('deviceorientation', onTilt);
  }, [reduced]);

  /* The car we have not photographed yet.
     `portrait` looks like the right variant and is not: it is a COMPLETE hero
     composition - its own wordmark, bloom and reflection - so nesting it here
     collides with this hero's own state word. `band` is the plate material,
     and absence is expressed instead by the frame itself standing shorter: a
     photograph earns the full height, a monument does not pretend to.
     (Design Language §11 - absence renders as silence, not as a void.) */
  const plate = <IdentityPlate name={name} registration={registration} variant="band" />;

  /* Hotspots point at panels of a photograph. With no photograph there is
     nothing to point at, and a dot floating over an empty frame is noise. */
  const zones = photo ? hotspots : [];

  return (
    <section
      ref={frame}
      aria-label={`${name}${registration ? `, ${registration}` : ''}`}
      style={{
        position: 'relative',
        // full bleed: a window, never an inset card (Design Language §1)
        width: '100%', height: frameHeight, overflow: 'hidden',
        background: 'var(--st-stage)',
      }}
    >
      {/* the renderer. Only this block changes when the seam moves. */}
      <motion.div
        style={{
          position: 'absolute', inset: '-7% 0 0',
          y: drift,
          x: reduced ? 0 : tilt.x,
          translateZ: 0,
        }}
        /* the settle: scale only. The photograph is opaque from frame one -
           the motion law forbids gating the payload on an animation. */
        initial={reduced ? false : { scale: 1.06 }}
        animate={{ scale: 1 }}
        transition={{ duration: scene, ease: studioEase }}
      >
        {renderer === 'photo' ? (
          <HeroMedia photo={photo} fallback={plate} alt={name} priority={priority} scrimTo={scrimTo} />
        ) : (
          // the seam is declared, not yet built - fall back to the photograph
          <HeroMedia photo={photo} fallback={plate} alt={name} priority={priority} scrimTo={scrimTo} />
        )}
      </motion.div>

      {/* THE LIGHT SWEEP - one soft pass every ~25s. Explicitly guarded:
          this is a CSS animation, so MotionConfig does not reach it. */}
      {!reduced && photo && (
        <div aria-hidden className="st-hero-sweep" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'soft-light',
        }} />
      )}

      {/* HOTSPOTS - invisible until they have something to say. Tap the actual
          area of your own car to learn what protects it. */}
      {zones.map(h => (
        <button
          key={h.key}
          onClick={h.onTap}
          aria-label={h.label}
          className={h.attention && !reduced ? 'st-hotspot st-hotspot-live' : 'st-hotspot'}
          style={{
            position: 'absolute',
            left: `${h.x * 100}%`, top: `${h.y * 100}%`,
            transform: 'translate(-50%, -50%)',
            width: 48, height: 48, borderRadius: 999,
            border: 'none', background: 'transparent', cursor: 'pointer',
            display: 'grid', placeItems: 'center', zIndex: 2,
          }}
        >
          <span aria-hidden style={{
            width: 10, height: 10, borderRadius: 999,
            background: h.attention ? 'var(--st-warn)' : 'var(--st-over-2)',
            boxShadow: '0 0 0 3px rgba(0,0,0,0.28)',
          }} />
        </button>
      ))}

      {/* the hero's floor - the state reads over the car, never beside it */}
      {children && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 1,
          padding: '0 var(--st-inset) var(--st-gap)',
          // the state is READ, so it sits in the same reading column as the
          // content below it - the frame is full-bleed, the words are not
          maxWidth: 'var(--st-measure)', marginLeft: 'auto', marginRight: 'auto',
        }}>
          {children}
        </div>
      )}
    </section>
  );
}

/**
 * The car we have not photographed yet.
 *
 * Absence is designed, not defaulted (Design Language §11): the frame stays
 * full, the marque stands as a lit monument, and one quiet line says what
 * happens next. There is deliberately NO upload button - the studio takes
 * this photograph, and asking the owner to do it cheapens the promise.
 */
export function HeroAwaitingPhoto({
  name, registration, height = 'min(62svh, 560px)',
}: {
  name: string; registration?: string; height?: string;
}) {
  return (
    <HeroVehicle name={name} registration={registration} height={height}>
      <Whisper tone="over-2" style={{ paddingBottom: 'var(--st-breath)' }}>
        Photographed at your first visit.
      </Whisper>
    </HeroVehicle>
  );
}
