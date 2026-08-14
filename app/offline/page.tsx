/**
 * NO CONNECTION.
 *
 * Source: docs/AUTOMODZ-OS.md §19.1, §20.3, §20.4, §21.8
 *
 * The service worker's fallback document - what a customer meets when the
 * network is gone and the shell has nothing cached for where they were going.
 *
 * ── WHY IT WAS REWRITTEN ─────────────────────────────────────────────────
 * It was the last surface still speaking the pre-rewrite identity, and it
 * disagreed with the product on nearly every axis at once: three lucide icons
 * (nothing else in the customer product uses an icon set - every mark is drawn
 * at 1.4px on a 24 grid), Tailwind utilities including `min-h-screen`, which is
 * `100vh` and puts content under the browser's own bars on a phone, a
 * `font-800` display where the product's display face is Outfit 200, a
 * shouted ALL-CAPS headline, and an amber-gradient tile with a lightning bolt
 * in it.
 *
 * The copy disagreed too. "book services, track jobs, and manage your garage"
 * - a JOB is what the floor calls it (§21.8 wants the customer's word, and the
 * customer's word is a visit), and "book services" describes a transaction
 * where §2.1 makes the car the subject. Now it says the one true thing: the
 * connection is gone, the car is not.
 */
'use client';
import { Screen, RoomHeader, Action } from '@/components/os';
import { space } from '@/design';

export default function Offline() {
  return (
    <Screen top={space.rest} style={{ justifyContent: 'center' }}>
      <RoomHeader
        eyebrow="No connection"
        supporting={
          <>
            We can’t reach the studio from here. Nothing is lost - your car,
            its record and anything you’ve arranged are all still with us.
          </>
        }
      >
        You’re offline
      </RoomHeader>

      <div style={{ marginTop: space.rest }}>
        {/* §19.3 - the one control, and it commits to something: another
            attempt. A reload rather than a router push, because the shell
            itself may be what failed to arrive. */}
        <Action onClick={() => window.location.reload()}>Try again</Action>
      </div>
    </Screen>
  );
}
