'use client';
/**
 * THE ROOM.
 *
 * Three magenta lights on the far wall, drifting slowly and leaning very
 * slightly toward wherever the customer is pointing. Everything else in the
 * application stands in front of this; nothing is ever drawn on top of the
 * content by it.
 *
 * WHY CSS AND NOT framer-motion. This never stops for the life of the session,
 * and a spring driving three radial gradients through React would repaint on
 * every frame for as long as the app is open. The drift is a CSS keyframe on
 * the compositor; the pointer lean is one CSS custom property written outside
 * React. Neither costs a re-render — the component renders once and then never
 * again.
 *
 * §7.6 — under reduced motion the field is STILL THERE and still coloured; it
 * simply stops moving. "The interface must lose nothing but movement."
 *
 * §3.6 — this is not glass. It is the lit ground glass sits on. One glass
 * layer over it, never two.
 */
import { useEffect, useRef } from 'react';
import { ambient, type AmbientLight } from '@/design';

/** One light, as a radial gradient sized and placed from the token. */
const light = (l: AmbientLight) =>
  `radial-gradient(${l.size}vmax ${l.size}vmax at ${l.x}% ${l.y}%, `
  + `${l.hue}${Math.round(l.opacity * 255).toString(16).padStart(2, '0')} 0%, `
  + 'transparent 62%)';

export function Ambient() {
  const ref = useRef<HTMLDivElement>(null);

  /**
   * THE REACTION, written straight to the DOM.
   *
   * A pointer move can fire at 120Hz. Routed through `useState` that is 120
   * re-renders a second of a component whose output never changes shape — so
   * the handler writes two custom properties and React is not involved at all.
   *
   * Passive listeners, because this never calls `preventDefault` and a
   * non-passive move handler blocks scrolling on touch.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    /* Honoured here as well as in CSS: a customer who asks for less motion
       should not have the field leaning at them either. */
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (still.matches) return undefined;

    let frame = 0;
    const lean = (x: number, y: number) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        /* -1…1 from centre, scaled to the token. */
        const dx = (x / window.innerWidth - 0.5) * 2 * ambient.react;
        const dy = (y / window.innerHeight - 0.5) * 2 * ambient.react;
        el.style.setProperty('--lean-x', `${dx.toFixed(2)}%`);
        el.style.setProperty('--lean-y', `${dy.toFixed(2)}%`);
      });
    };

    const onPointer = (e: PointerEvent) => lean(e.clientX, e.clientY);
    window.addEventListener('pointermove', onPointer, { passive: true });

    /* On a phone there is no pointer, so the field leans with the device. */
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      const x = (Math.max(-30, Math.min(30, e.gamma)) / 30 + 1) / 2;
      const y = (Math.max(-30, Math.min(30, e.beta - 45)) / 30 + 1) / 2;
      lean(x * window.innerWidth, y * window.innerHeight);
    };
    window.addEventListener('deviceorientation', onTilt);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('deviceorientation', onTilt);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="am-field"
      style={{
        position: 'fixed',
        inset: `-${ambient.drift * 2}%`,
        zIndex: 0,
        pointerEvents: 'none',
        backgroundImage: [light(ambient.key), light(ambient.warm), light(ambient.cool)].join(', '),
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
}
