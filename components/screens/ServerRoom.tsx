import 'server-only';
/**
 * THE ROOM SHELL, ON THE SERVER.
 *
 * Source: docs/AUTOMODZ-OS.md §19.1, §20.1, §20.2, §20.4, §22.2
 *
 * The client `Room` answered four questions — establishing, signed out, failed,
 * ready — and three of them existed only because the data arrived after the
 * page did. On the server there is no establishing state: the request either
 * has a session and the documents, or it does not, and either way the first
 * byte of HTML is the answer.
 *
 * §19.1 said loading is a state, not an absence. The best version of that rule
 * is a room that was never absent.
 */
import type { ReactNode } from 'react';
import { color, space, column, stack } from '@/design';
import { Heading, Text, Button } from '@/components/system';
import { currentSession } from '@/lib/server/session';
import { loadCustomerPicture } from '@/lib/server/customerPicture';
import type { CustomerPicture } from '@/lib/customer/source';

function Centred({ children }: { children: ReactNode }) {
  return (
    <main
      style={{
        background: color.paper,
        minHeight: '100svh',
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

/** §18.4's shape, for a room that needs a car and has none. */
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

/**
 * Resolve the session, read the picture, hand it to the room.
 *
 * §20.3 — "distinguish ours from theirs." A missing session is not a failure and
 * does not pretend to be one; a read that throws is ours and says so (§20.4 —
 * the car is safe, say it).
 */
export async function ServerRoom(
  { children }: { children: (p: CustomerPicture) => ReactNode },
) {
  const session = await currentSession();

  if (!session) {
    return (
      <Centred>
        <Heading level="display">Your car is behind a sign-in.</Heading>
        <div style={{ marginTop: space.gap }}>
          <Button tier="forward" href="/auth/login">Sign in</Button>
        </div>
      </Centred>
    );
  }

  try {
    const picture = await loadCustomerPicture(session);
    return <>{children(picture)}</>;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[customer] server read failed', err);
    }
    return (
      <Centred>
        <Heading level="display">We could not reach your garage.</Heading>
        <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
          Your car and its records are safe. This is our connection, not your car.
        </Text>
        <div style={{ marginTop: space.gap }}>
          {/* A server-rendered failure recovers by asking again for the page —
              there is no client fetch left to retry. */}
          <Button tier="forward" href="/">Try again</Button>
        </div>
      </Centred>
    );
  }
}
