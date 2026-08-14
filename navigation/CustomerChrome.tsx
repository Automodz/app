'use client';
/**
 * CUSTOMER CHROME - the isolation boundary.
 *
 * Source: docs/AUTOMODZ-OS.md §6.2, §22.2
 *
 * The root layout is shared with the studio's operations application, so every
 * `/admin/*` address passes through it. This component is the ONE place that
 * decides whether the customer shell exists at an address, and it decides by
 * asking the route table a single question: is this an address that is a room?
 *
 * It mounts nothing when the answer is no. Not a hidden bar, not a suppressed
 * one, not a provider sitting idle - nothing. That distinction is the whole
 * point of the file:
 *
 *   - a bar animated out still leaves its links in the tab order
 *   - a bar at `pointerEvents: none` is invisible to a pointer and present to
 *     a keyboard
 *   - a provider mounted "harmlessly" still runs its effects, still writes the
 *     remembered room, and still keeps a navigation stack for a surface that
 *     has no rooms to navigate between
 *
 * §22.2 - one implementation of anything. Because this is the only gate, the
 * provider and the bar below it may both assume they are inside a room, and
 * neither repeats the check.
 */
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { NavigationProvider } from './NavigationProvider';
import { BottomNavigation } from './BottomNavigation';
import { PaletteProvider } from './Palette';
import { RoomTransition } from './RoomTransition';
import { RoomTheme } from './RoomTheme';
import { StudioBoot, Ambient } from '@/components/system';
import { Menu } from './Menu';
import { roomFor, isCustomerSurface, HOME } from './routes';

export function CustomerChrome(
  { children, signedIn = true }: { children: ReactNode; signedIn?: boolean },
) {
  const pathname = usePathname() ?? '/';

  /* Not a room - no provider, no bar and no customer state of any kind.
     It may still be the customer's PRODUCT, though: the marketplace and the
     sell form are public and carry no navigation on purpose, and they are
     drawn in the room's palette like everything else. So they get the room's
     light and nothing more. See `isCustomerSurface`. */
  if (!roomFor(pathname)) {
    /* THE LIGHT COMES WITH THE PALETTE, because half of it is not a palette.
       These addresses took `RoomTheme` and stopped there, so they were the
       room's near-black WITHOUT the room's field - and the difference is not
       subtle: every actual room is lit amber and champagne from two corners,
       and these read as flat black beside them. The door and the landing are
       the first two things anybody sees, so they were the two surfaces least
       able to afford looking like a different product. */
    return isCustomerSurface(pathname)
      ? <><RoomTheme /><Ambient />{children}</>
      : <>{children}</>;
  }

  /* `/` without a session is the public landing, not a room. It is the one
     address the product serves to people who have no car here yet, and a bar
     whose four slots all lead to a sign-in wall is four dead ends. Same
     reasoning as above: nothing is mounted, not hidden - except the light,
     because the landing is the customer's product too. */
  if (!signedIn && pathname === HOME) return <><RoomTheme /><Ambient />{children}</>;

  return (
    <NavigationProvider>
      {/* FIRST, BEFORE ANYTHING IS DRAWN. A room is always dark, and this is
          the only place that knows an address is a room - see RoomTheme for
          what a light-themed room did to a customer on production. */}
      <RoomTheme />
      {/* THE ROOM. Mounted once, behind everything, for the life of the
          session - not per screen, or each navigation would restart its drift
          and the field would visibly jump between rooms. */}
      <Ambient />
      <StudioBoot />
      {/* THE OVERFLOW, ON EVERY ROOM. The dock has five slots and the product
          has more places than that; this is where the rest live. Mounted here
          rather than per screen for the same reason the dock is - a control
          that exists on one room is a control the customer cannot rely on. */}
      <Menu />
      {/* The palette is chrome, not a screen. Mounted once here, it answers
          ⌘K at every address in the customer application - see Palette.tsx. */}
      <PaletteProvider>
        {/* The room arrives rather than appearing. Inside the palette provider
            so the Desk is not remounted on every navigation, and OUTSIDE the
            navigation bar so the bar never fades - it is the one thing that
            stays put while rooms change. */}
        <RoomTransition>{children}</RoomTransition>
        <BottomNavigation />
      </PaletteProvider>
    </NavigationProvider>
  );
}
