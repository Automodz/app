'use client';
/**
 * The identity plate (design system §7.1, photo-absent state).
 *
 * Most cars have no photograph, so the photo-less rendering is the *default*
 * state, not a fallback - it is designed to the same bar as photography.
 *
 * THE OVERTURE (hero): the marque stands as a lit chrome monument on seamless
 * paper - a slow specular sweeps its face, an ambient bloom breathes behind it,
 * a soft reflection grounds it, and on a pointer device the whole monument tilts
 * to the cursor like a machined object catching the light. Every motion is a
 * single settle, a slow ambient loop, or pointer-linked - and all of it is
 * dropped under reduced motion. The `band` and `row` variants stay flat plate
 * material (Papers, Stay, Chapter, the sheets rely on them unchanged).
 */
import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { DisplayLarge, Display, Emphasis, Whisper } from './text';

/** The shared photo-less material: gallery ground, one hairline, no graphics. */
export const plateSurface: CSSProperties = {
  background: 'var(--st-gallery)',
  boxShadow: 'inset 0 0 0 1px var(--st-hairline)',
};

interface IdentityPlateProps {
  /** The car as the owner says it: "Mercedes-AMG C 43". */
  name: string;
  registration?: string;
  /**
   * `portrait` fills a hero · `band` sits inside an existing framed ratio ·
   * `row` is the in-flow line that names the car a surface is acting on.
   */
  variant?: 'portrait' | 'band' | 'row';
  style?: CSSProperties;
}

/**
 * The owner writes one name ("Mercedes-AMG C 43"); the marque is its first
 * word and the model is the rest. A single-word name stays whole.
 */
function split(name: string): { marque?: string; model: string } {
  const trimmed = name.trim();
  const cut = trimmed.indexOf(' ');
  if (cut < 1) return { model: trimmed };
  return { marque: trimmed.slice(0, cut), model: trimmed.slice(cut + 1) };
}

/** The plate's own glyphs - the one place ALL-CAPS is allowed with the wordmark. */
function Registration({ value, style }: { value: string; style?: CSSProperties }) {
  return (
    <span
      style={{
        background: 'var(--st-linen)',
        borderRadius: 'var(--st-r-chip)',
        padding: '6px 12px', whiteSpace: 'nowrap',
        fontFamily: 'var(--st-data)', fontWeight: 400, fontSize: 14, lineHeight: 1.45,
        letterSpacing: '0.06em', color: 'var(--st-ink-2)',
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {value}
    </span>
  );
}

/* ── THE OVERTURE ─────────────────────────────────────────────────────────
   The photo-less hero, rebuilt as a machined monument that catches the light.
*/
function OvertureHero({ name, registration }: { name: string; registration?: string }) {
  const { marque, model } = split(name);
  const reduced = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const [interactive, setInteractive] = useState(false);

  // pointer-linked parallax tilt - a machined object turning to the cursor.
  // Only armed on a hover-capable device with motion allowed.
  const px = useMotionValue(0); // -0.5 .. 0.5
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 120, damping: 18, mass: 0.4 });
  const sy = useSpring(py, { stiffness: 120, damping: 18, mass: 0.4 });
  const rotY = useTransform(sx, [-0.5, 0.5], [7, -7]);
  const rotX = useTransform(sy, [-0.5, 0.5], [-5, 5]);
  const glintX = useTransform(sx, [-0.5, 0.5], ['38%', '62%']);
  const glintY = useTransform(sy, [-0.5, 0.5], ['34%', '58%']);
  const glintBg = useTransform([glintX, glintY], ([x, y]) =>
    `radial-gradient(28% 34% at ${x} ${y}, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 70%)`);

  useEffect(() => {
    if (reduced) return;
    const hoverable = typeof window !== 'undefined'
      && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    setInteractive(!!hoverable);
  }, [reduced]);

  const onMove = (e: React.PointerEvent) => {
    if (!interactive) return;
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return;
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => { px.set(0); py.set(0); };

  const tilt = interactive ? { rotateX: rotX, rotateY: rotY } : undefined;

  return (
    <div
      ref={stageRef}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{
        position: 'absolute', inset: 0, overflow: 'hidden',
        // seamless-paper sweep: the studio light the monument stands in
        background: 'radial-gradient(130% 86% at 50% 30%, var(--st-paper) 0%, var(--st-gallery) 56%, var(--st-linen) 100%)',
        boxShadow: 'var(--st-edge)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 'var(--st-inset)', textAlign: 'center',
        perspective: 1100,
      }}
    >
      {/* ambient light bloom, breathing slowly behind the monument */}
      <div aria-hidden className="st-bloom" style={{
        position: 'absolute', top: '18%', left: '50%', width: 'min(120vw, 720px)', height: '52%',
        transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 62%)',
        mixBlendMode: 'soft-light', opacity: 0.9,
      }} />

      {/* pointer-linked glint that rides the monument's chrome face */}
      {interactive && (
        <motion.div aria-hidden style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
          background: glintBg,
          mixBlendMode: 'overlay',
        }} />
      )}

      {/* the monument group: kicker · name · reflection · plate, tilting as one */}
      <motion.div
        className="st-overture-monument"
        style={{
          position: 'relative', zIndex: 1, width: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          transformStyle: 'preserve-3d', ...(tilt ?? {}),
        }}
      >
        {marque && (
          <Whisper tone="ink-3" style={{
            marginBottom: 'var(--st-gap)', letterSpacing: '0.42em',
            paddingLeft: '0.42em', fontFamily: 'var(--st-display)', fontWeight: 500,
            textTransform: 'uppercase', fontSize: 12,
          }}>
            {marque}
          </Whisper>
        )}

        {/* the machined name - brushed chrome with a slow specular sweep */}
        <DisplayLarge
          as="p"
          className="st-chrome st-chrome-sweep"
          style={{
            fontSize: 'clamp(44px, 15vw, 92px)', fontWeight: 700, lineHeight: 0.98,
            letterSpacing: '-0.03em', maxWidth: 760,
            // a faint machined edge so the chrome reads as raised metal
            textShadow: '0 1px 0 var(--st-chrome-edge)',
          }}
        >
          {model}
        </DisplayLarge>

        {/* the reflection - the monument grounded on seamless paper */}
        <div aria-hidden style={{
          marginTop: 2, transform: 'scaleY(-1)', opacity: 0.14,
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent 72%)',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent 72%)',
          pointerEvents: 'none', userSelect: 'none',
        }}>
          <DisplayLarge as="p" className="st-chrome" style={{
            fontSize: 'clamp(44px, 15vw, 92px)', fontWeight: 700, lineHeight: 0.98,
            letterSpacing: '-0.03em', maxWidth: 760,
          }}>
            {model}
          </DisplayLarge>
        </div>

        {registration && (
          <div style={{ marginTop: 'var(--st-inset)' }}>
            <Registration value={registration} />
          </div>
        )}
      </motion.div>

      {/* the studio's mark, held quiet at the base */}
      <Whisper tone="ink-3" style={{
        position: 'absolute', left: 0, right: 0, zIndex: 1,
        bottom: 'calc(env(safe-area-inset-bottom) + var(--st-rest))',
        fontFamily: 'var(--st-display)', letterSpacing: '0.4em', paddingLeft: '0.4em',
        fontSize: 11, opacity: 0.7,
      }}>
        AUTOMODZ
      </Whisper>
    </div>
  );
}

export default function IdentityPlate({
  name, registration, variant = 'portrait', style,
}: IdentityPlateProps) {
  const { marque, model } = split(name);
  const row = variant === 'row';

  if (variant === 'portrait') {
    return <OvertureHero name={name} registration={registration} />;
  }

  if (row) {
    return (
      <div
        style={{
          // the in-flow plate is a held object (UX-1): material, an edge of
          // light, a resting shadow - the car's own letterhead
          background: 'var(--st-card-fill)', border: '1px solid var(--st-hairline)',
          boxShadow: 'var(--st-hold), var(--st-edge)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 'var(--st-gap)',
          borderRadius: 'var(--st-r-card)', padding: 'var(--st-gap)',
          ...style,
        }}
      >
        <span style={{ minWidth: 0 }}>
          {marque && <Whisper tone="ink-3">{marque}</Whisper>}
          <Emphasis as="p">{model}</Emphasis>
        </span>
        {registration && <Registration value={registration} />}
      </div>
    );
  }

  // band - flat plate material inside an existing framed ratio
  return (
    <div
      style={{
        ...plateSurface,
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 'var(--st-gap)', textAlign: 'center',
        ...style,
      }}
    >
      {marque && (
        <Whisper tone="ink-3" style={{ marginBottom: 'var(--st-line)' }}>{marque}</Whisper>
      )}
      <Display
        as="p"
        style={{ fontSize: 'clamp(20px, 5vw, 32px)', maxWidth: 480 }}
      >
        {model}
      </Display>
      {registration && (
        <Registration value={registration} style={{ marginTop: 'var(--st-line)' }} />
      )}
    </div>
  );
}
