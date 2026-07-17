'use client';
import { useEffect } from 'react';
import Lenis from 'lenis';

/**
 * Buttery inertial scrolling for the landing page only. Lenis drives the real
 * window scroll (not a transform), so Framer Motion's `useScroll` reads it for
 * free - no bridge needed. Disabled entirely under prefers-reduced-motion, and
 * torn down on unmount so the rest of the app keeps native scrolling.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({
      duration: 1.05,
      // gentle exponential ease-out - premium, never floaty
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
      lerp: 0.1,
    });

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return null;
}
