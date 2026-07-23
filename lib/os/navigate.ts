'use client';
/**
 * useStudioRouter - navigation as camera movement, not a page swap.
 *
 * Wraps the Next router in the View Transitions API so a route change morphs
 * the shared vehicle (`view-transition-name: hero-vehicle`) and pushes the rest
 * of the surface in with depth, instead of cutting. Degrades safely: where the
 * API is absent or the OS asks for reduced motion, it is an ordinary, instant
 * navigation. Never blocks or delays the route change itself.
 *
 * Sheets (?sheet=, ?focus=) are overlays on the same route and keep the plain
 * router - opening one must never read as leaving the car.
 */
import { useRouter } from 'next/navigation';
import { useCallback, type CSSProperties } from 'react';

/** Assign a view-transition-name safely (not yet in React 18's CSSProperties). */
export const vtName = (name?: string): CSSProperties =>
  name ? ({ viewTransitionName: name } as unknown as CSSProperties) : {};

type StartViewTransition = (cb: () => void | Promise<void>) => { finished: Promise<void> };

const canTransition = (): boolean =>
  typeof document !== 'undefined'
  && typeof (document as unknown as { startViewTransition?: StartViewTransition }).startViewTransition === 'function'
  && !(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

function run(nav: () => void) {
  if (!canTransition()) { nav(); return; }
  const start = (document as unknown as { startViewTransition: StartViewTransition }).startViewTransition;
  start(() => {
    nav();
    // let the incoming route commit and paint before the "after" snapshot is
    // taken - two frames is enough for store-driven surfaces (no blocking fetch)
    return new Promise<void>(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

export function useStudioRouter() {
  const router = useRouter();
  const push = useCallback((href: string) => run(() => router.push(href)), [router]);
  const replace = useCallback((href: string) => run(() => router.replace(href)), [router]);
  return { push, replace };
}
