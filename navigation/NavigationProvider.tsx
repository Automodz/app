'use client';
/**
 * NAVIGATION PROVIDER
 *
 * Source: docs/AUTOMODZ-OS.md §6.1, §6.2, §6.4, §6.5, §6.6, §7.2, §13.2
 *
 * Everything the application needs to know about where it is, and nothing
 * about what it is showing. No business logic passes through here.
 *
 * §6.1 - "Navigation moves between rooms in one lit space… Moving from Garage
 * to Vehicle should feel like walking toward something, not like loading a
 * page." `navigate()` wraps the route change in a view transition where the
 * browser supports one, so a photograph shared between two rooms carries
 * across (§7.5) instead of blinking. Where it is unsupported the navigation
 * still happens - §7.1, motion decorates, it never gates.
 *
 * §6.2 - the navigation "disappears for exactly one reason: a full-screen
 * takeover that demands the whole surface." Two things can cause that: an
 * address whose room declares `chrome: 'takeover'`, and a takeover that is not
 * an address at all - a photograph opened over the room (§8.6). `suppress()`
 * covers the second, and it counts rather than toggles, so two overlapping
 * takeovers cannot leave the bar stranded when only one closes.
 *
 * §6.5 - "Back returns to where the customer actually came from." The stack is
 * kept so that a room which was reached from two directions can be left in the
 * direction it was entered from.
 *
 * §6.6 - "A cold launch returns the customer to the car they were last looking
 * at." This provider REMEMBERS the room; it deliberately does not perform the
 * redirect, because that is the shell's decision and this file does not own a
 * layout. The memory is offered; acting on it is someone else's call.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import type { ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { pushRoute, previousRoute } from '@/lib/os/navstack';
import { parentOf } from './resolve';
import { activeSlotFor, chromeFor, roomFor } from './routes';
import type { Room } from './routes';

/** Where the last room is remembered across a cold launch. §6.6 */
const MEMORY_KEY = 'automodz.room';

interface NavigationValue {
  /** The current address. */
  pathname: string;
  /**
   * §6.5 - the rooms this session has walked through, newest last, each with
   * the car it was about. Exposed so `Back` can prefer the walk over the
   * parent map; the rules live in `lib/os/navstack`.
   */
  walk: readonly string[];
  /** The room the customer is standing in, if the address names one. */
  room: Room | undefined;
  /** Which navigation element is lit. §6.2 */
  activeSlot: string | undefined;
  /** Whether the navigation is on screen. §6.2, §13.2 */
  navVisible: boolean;
  /** §6.1 - move to a room, carrying the subject across where possible. */
  navigate: (path: string) => void;
  /** §6.5 - leave in the direction the room was entered from. */
  back: () => void;
  /** True when there is somewhere truthful to go back to. */
  canGoBack: boolean;
  /**
   * §6.2 - hide the navigation for a takeover that is not an address.
   * Returns the release function; call it when the takeover closes.
   */
  suppress: () => () => void;
  /** §6.6 - the room the customer was last in. Offered, never acted on here. */
  rememberedRoom: () => string | null;
}

const NavigationContext = createContext<NavigationValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const search = useSearchParams();
  const router = useRouter();

  /** §6.2 - how many non-address takeovers are currently open. */
  const [suppressed, setSuppressed] = useState(0);

  /**
   * §6.5 - how the customer actually got here.
   *
   * The rules live in `lib/os/navstack`, pure and tested, because this is the
   * thing that decides where Back goes and it was previously three lines in an
   * effect that pushed `pathname` alone. Dropping the query is what sent a
   * customer reading the BMW's record to Now: `/history?car=v1` became
   * `/history`, and `/history` is under `/`.
   */
  const stack = useRef<string[]>([]);
  /* A snapshot in state, so a control reading the walk re-renders with it. */
  const [walkSnapshot, setWalkSnapshot] = useState<readonly string[]>([]);

  useEffect(() => {
    /* The SEARCH is part of the address - see `CONTEXT_KEYS`. */
    const here = pathname + (search?.toString() ? `?${search.toString()}` : '');
    stack.current = pushRoute(stack.current, here);
    setWalkSnapshot(stack.current);
    /* §6.6 - remember the room. Reading it back is the shell's business.

       No room check here: `CustomerChrome` does not mount this provider outside
       a room, so the branch that used to guard this was unreachable. */
    try {
      window.localStorage.setItem(MEMORY_KEY, pathname);
    } catch {
      /* storage can be unavailable; navigation must still work without it */
    }
  }, [pathname]);

  /**
   * §6.1 - one lit space. A view transition lets the browser carry a shared
   * element between rooms; §7.5 wants exactly that for a photograph.
   */
  const navigate = useCallback((path: string) => {
    if (path === pathname) return;
    const start = (
      document as Document & { startViewTransition?: (cb: () => void) => void }
    ).startViewTransition;
    if (typeof start === 'function') {
      start.call(document, () => router.push(path));
    } else {
      router.push(path);
    }
  }, [pathname, router]);

  /**
   * §6.5, §17.3 - the walk when there is one, the parent map when there is not.
   *
   * NEVER `router.back()`. This used to fall through to it, and from an address
   * opened by a notification that leaves the application entirely while from a
   * shared link it does nothing at all - both indistinguishable from working
   * when you happen to have arrived through the front door.
   */
  const back = useCallback(() => {
    const here = pathname + (search?.toString() ? `?${search.toString()}` : '');
    const step = previousRoute(stack.current, here);
    if (step) {
      stack.current = step.stack;
      setWalkSnapshot(stack.current);
      navigate(step.href);
      return;
    }
    const parent = parentOf(here);
    if (parent) navigate(parent.href);
  }, [navigate, pathname, search]);

  const suppress = useCallback(() => {
    setSuppressed(n => n + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      setSuppressed(n => Math.max(0, n - 1));
    };
  }, []);

  const rememberedRoom = useCallback((): string | null => {
    try {
      return window.localStorage.getItem(MEMORY_KEY);
    } catch {
      return null;
    }
  }, []);

  const value = useMemo<NavigationValue>(() => ({
    pathname,
    walk: walkSnapshot,
    room: roomFor(pathname),
    activeSlot: activeSlotFor(pathname),
    /* §6.2 - hidden for an address that declares itself a takeover, and for a
       takeover laid over the room. Whether the address is a room at all is
       `CustomerChrome`'s question, asked once, above this provider. */
    navVisible: chromeFor(pathname) === 'nav' && suppressed === 0,
    navigate,
    back,
    canGoBack: walkSnapshot.length > 1,
    suppress,
    rememberedRoom,
  }), [pathname, walkSnapshot, suppressed, navigate, back, suppress, rememberedRoom]);

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

/**
 * The same context, without the throw.
 *
 * `Back` is drawn by screens that render server-side and by tests that mount a
 * screen on its own - neither has a provider, and neither is a bug. A control
 * that cannot be rendered outside a provider is a control that dictates where
 * it may be used.
 */
export function useNavigationOptional(): NavigationValue | null {
  return useContext(NavigationContext);
}

export function useNavigation(): NavigationValue {
  const value = useContext(NavigationContext);
  if (!value) {
    throw new Error('useNavigation must be used inside a NavigationProvider.');
  }
  return value;
}

/**
 * §6.2 - hide the navigation for as long as a takeover is mounted.
 * A hook rather than a prop, so the takeover owns the decision and the bar
 * cannot be left hidden by a component that forgot to put it back.
 */
export function useTakeover(active = true) {
  const { suppress } = useNavigation();
  useEffect(() => {
    if (!active) return;
    return suppress();
  }, [active, suppress]);
}
