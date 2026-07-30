'use client';
/**
 * CUSTOMER CHROME — the isolation boundary.
 *
 * Source: docs/AUTOMODZ-OS.md §6.2, §22.2
 *
 * The root layout is shared with the studio's operations application, so every
 * `/admin/*` address passes through it. This component is the ONE place that
 * decides whether the customer shell exists at an address, and it decides by
 * asking the route table a single question: is this an address that is a room?
 *
 * It mounts nothing when the answer is no. Not a hidden bar, not a suppressed
 * one, not a provider sitting idle — nothing. That distinction is the whole
 * point of the file:
 *
 *   - a bar animated out still leaves its links in the tab order
 *   - a bar at `pointerEvents: none` is invisible to a pointer and present to
 *     a keyboard
 *   - a provider mounted "harmlessly" still runs its effects, still writes the
 *     remembered room, and still keeps a navigation stack for a surface that
 *     has no rooms to navigate between
 *
 * §22.2 — one implementation of anything. Because this is the only gate, the
 * provider and the bar below it may both assume they are inside a room, and
 * neither repeats the check.
 */
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { NavigationProvider } from './NavigationProvider';
import { BottomNavigation } from './BottomNavigation';
import { roomFor } from './routes';

export function CustomerChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';

  /* Not a room — not the customer application. Hand the page straight through
     with no provider, no bar and no customer state of any kind. */
  if (!roomFor(pathname)) return <>{children}</>;

  return (
    <NavigationProvider>
      {children}
      <BottomNavigation />
    </NavigationProvider>
  );
}
