'use client';
/**
 * WHERE THE CUSTOMER WALKED FROM, AS A PARENT.
 *
 * `Back` needs one answer, and there are two sources for it: the walk this
 * session actually took (`lib/os/navstack`) and the parent map (`parentOf`).
 * This adapts the first into the shape the control already speaks, so the
 * control stays a control and the choice between the two is one line.
 *
 * Returns `undefined` — not `null` — so `walked ?? parentOf(here)` reads as
 * "the walk, or else the map".
 */
import { useNavigationOptional } from './NavigationProvider';
import { previousRoute } from '@/lib/os/navstack';
import { parentOf, type Parent } from './resolve';

export function useWalkedFrom(here: string): Parent | undefined {
  /* No provider means no walk to consult — a screen rendered on its own, or a
     surface outside the customer shell. The parent map answers instead. */
  const nav = useNavigationOptional();
  const step = nav ? previousRoute(nav.walk, here) : null;
  if (!step) return undefined;

  /* NAMED FOR WHERE IT GOES, never "Back" (§21.8). The map already knows the
     customer's word for every address in the product, so the walk borrows it
     rather than inventing a second vocabulary. */
  const named = parentOf(`${step.href.split('?')[0]}/x`) ?? parentOf(step.href);
  return { href: step.href, name: nameFor(step.href) ?? named?.name ?? 'Back' };
}

/** The customer's word for a room, by address. */
function nameFor(href: string): string | undefined {
  const path = href.split('?')[0];
  if (path === '/') return 'Now';
  if (path === '/garage') return 'Your garage';
  if (path === '/vehicle') return 'The car';
  if (path === '/studio') return 'The studio';
  if (path === '/membership') return 'The Club';
  if (path === '/you') return 'You';
  if (path === '/history') return 'Your visits';
  if (path === '/cars') return 'All cars';
  if (path.startsWith('/history/')) return 'The visit';
  if (path.startsWith('/booking/')) return 'Your booking';
  if (path.startsWith('/cars/')) return 'The car';
  return undefined;
}
