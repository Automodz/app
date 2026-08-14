'use client';
/**
 * THE ROOM SHELL - loading, absence and failure, once.
 *
 * Source: docs/AUTOMODZ-OS.md §19.1, §19.2, §19.5, §20.1, §20.2, §20.3, §22.2
 *
 * Seven routes need the same four answers to "what is on screen before the data
 * is": establishing, signed out, failed, ready. §22.2 - one implementation.
 *
 * §19.5 - "never tear down what is already true." A route that has rendered its
 * room does not fall back to the breath on a refetch; only the first load has
 * nothing to show.
 */
import type { ReactNode } from 'react';
import { color, space, column, stack } from '@/design';
import { Heading, Text, Button, Loading } from '@/components/system';
import { useCustomerPicture } from '@/lib/customer/source';
import type { CustomerPicture } from '@/lib/customer/source';

function Centred({ children }: { children: ReactNode }) {
  return (
    <main
      style={{
        background: color.paper,
        minHeight: '100svh',
        /* THE TOP INSET, ONCE. `Screen` has always reserved it for the rooms
           that use it; the shells that roll their own `<main>` did not, and the
           product is installable - in standalone the first line sat under the
           status bar. §8.5 keeps the inset in the token, never at a call site. */
        paddingTop: stack.top,
        paddingBottom: stack.contentFloor,
      }}
    >
      <section
        style={{
          ...column,
          minHeight: `calc(100svh - ${stack.navHeight}px)`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {children}
      </section>
    </main>
  );
}

/**
 * §19.2 - the breath, on its own. A route that reads the address bar has to be
 * wrapped in a Suspense boundary (Next bails out of prerendering otherwise), and
 * that boundary needs the same establishing state the room uses. One breath, two
 * callers.
 */
export function RoomBreath() {
  return <Centred><Loading /></Centred>;
}

export function Room({ children }: { children: (p: CustomerPicture) => ReactNode }) {
  const state = useCustomerPicture();

  /* §19.2 - the breath, while the application establishes itself. */
  if (state.status === 'loading') return <RoomBreath />;

  /* Signed out. §20.1 - the studio's voice, not an error code. */
  if (state.status === 'anonymous') {
    return (
      <Centred>
        <Heading level="display">Your car is behind a sign-in.</Heading>
        <div style={{ marginTop: space.gap }}>
          <Button tier="forward" href="/auth/login">Sign in</Button>
        </div>
      </Centred>
    );
  }

  /* §20.2 - always recoverable. §20.4 - the car is safe; say so. */
  if (state.status === 'failed') {
    return (
      <Centred>
        <Heading level="display">We could not reach your garage.</Heading>
        <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
          Your car and its records are safe. This is our connection, not your car.
        </Text>
        <div style={{ marginTop: space.gap }}>
          <Button tier="forward" onClick={state.retry}>Try again</Button>
        </div>
      </Centred>
    );
  }

  return <>{children(state.picture)}</>;
}

/**
 * §18.4 - "No cars → invitation, the whole screen, warm, one action." A room
 * that needs a car and has none says so the same way everywhere.
 */
export function NoCar() {
  return (
    <Centred>
      <Heading level="display">Your car&rsquo;s place is ready.</Heading>
      <div style={{ marginTop: space.gap }}>
        <Button tier="forward" href="/studio">Arrange its first visit</Button>
      </div>
    </Centred>
  );
}
