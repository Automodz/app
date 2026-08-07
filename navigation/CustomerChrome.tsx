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
import { PaletteProvider } from './Palette';
import { RoomTransition } from './RoomTransition';
import { StudioBoot, Ambient } from '@/components/system';
import { roomFor, HOME } from './routes';

export function CustomerChrome(
  { children, signedIn = true }: { children: ReactNode; signedIn?: boolean },
) {
  const pathname = usePathname() ?? '/';

  /* Not a room — not the customer application. Hand the page straight through
     with no provider, no bar and no customer state of any kind. */
  if (!roomFor(pathname)) return <>{children}</>;

  /* `/` without a session is the public landing, not a room. It is the one
     address the product serves to people who have no car here yet, and a bar
     whose four slots all lead to a sign-in wall is four dead ends. Same
     reasoning as above: nothing is mounted, not hidden. */
  if (!signedIn && pathname === HOME) return <>{children}</>;

  return (
    <NavigationProvider>
      {/* THE ROOM. Mounted once, behind everything, for the life of the
          session — not per screen, or each navigation would restart its drift
          and the field would visibly jump between rooms. */}
      <Ambient />
      <StudioBoot />
      {/* The palette is chrome, not a screen. Mounted once here, it answers
          ⌘K at every address in the customer application — see Palette.tsx. */}
      <PaletteProvider>
        {/* The room arrives rather than appearing. Inside the palette provider
            so the Desk is not remounted on every navigation, and OUTSIDE the
            navigation bar so the bar never fades — it is the one thing that
            stays put while rooms change. */}
        <RoomTransition>{children}</RoomTransition>
        <BottomNavigation />
      </PaletteProvider>
    </NavigationProvider>
  );
}
