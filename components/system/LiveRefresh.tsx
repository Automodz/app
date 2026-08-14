'use client';
/**
 * THE ROOM THAT KEEPS ITSELF CURRENT.
 *
 * Source: docs/AUTOMODZ-OS.md §5.4, §7.6, §19.2, §20.3
 *
 * The customer rooms render on the SERVER, which is what makes them arrive
 * whole with no loading bar - and it is also why they were frozen at the
 * moment they were requested. Live Visit is the room where that mattered:
 * a customer watching their own car being worked on saw the act it was in
 * when the page loaded, and nothing after it. New photographs did not appear.
 * The stage rail did not advance. The one screen in the product named "live"
 * was the one screen that never changed, and the only way to see the studio's
 * progress was to know to pull-to-refresh.
 *
 * So this asks the server again, on a cadence, and lets the server component
 * re-render with whatever is true now. `router.refresh()` is the right verb:
 * it re-fetches the CURRENT route on the server and reconciles in place -
 * no navigation, no remount, no scroll jump, and nothing the customer is
 * looking at is thrown away.
 *
 * WHAT IT DELIBERATELY DOES NOT DO:
 *
 *   It does not poll a hidden tab. A phone in a pocket must not spend its
 *   battery and its data on a screen nobody is looking at, so the interval is
 *   torn down on `visibilitychange` and a fresh read is taken the moment the
 *   customer comes back - which is also the moment they most want it current.
 *
 *   It does not poll a finished visit. `active` is the room's own judgement,
 *   and when the work is done this stops permanently rather than asking
 *   forever about something that cannot change again.
 *
 *   It does not render. There is no spinner, no "updating…", no timestamp
 *   ticking in a corner. §19.2 - the room is either current or it is not, and
 *   a customer should never be made to watch the machinery. The act line and
 *   the timing are already `aria-live`, so a screen reader hears the change
 *   without this having to announce anything itself.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface LiveRefreshProps {
  /**
   * Keep asking while this is true. A sealed or cancelled visit sets it
   * false and the room settles for good.
   */
  active?: boolean;
  /**
   * Seconds between reads. The default is tuned for a person standing in a
   * waiting room: fast enough that a new photograph feels like it arrived on
   * its own, slow enough that an afternoon of watching costs nothing worth
   * counting. Detailing is measured in hours; this is not a trading screen.
   */
  everySeconds?: number;
}

export function LiveRefresh({ active = true, everySeconds = 25 }: LiveRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return undefined;

    let timer: ReturnType<typeof setInterval> | undefined;

    const stop = () => {
      if (timer) { clearInterval(timer); timer = undefined; }
    };

    const start = () => {
      stop();
      /* Guarded on the interval as well as on the listener: a tab can be
         hidden between the listener firing and this running. */
      if (document.visibilityState !== 'visible') return;
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') router.refresh();
      }, Math.max(5, everySeconds) * 1000);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        /* Back on screen: answer the question they are about to ask before
           the next tick would have. */
        router.refresh();
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active, everySeconds, router]);

  return null;
}
