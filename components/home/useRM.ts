'use client';
import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * SSR-safe reduced-motion. `useReducedMotion()` reads matchMedia, which yields
 * `false` on the server but can be `true` on the client's first paint — any DOM
 * or `initial` style branched on it then triggers a hydration mismatch. Gating
 * behind a mounted flag makes the server and first client render identical
 * (both un-reduced), and the real preference takes effect one tick later.
 */
export function useRM(): boolean {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? !!reduced : false;
}
