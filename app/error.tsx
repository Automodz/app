'use client';
/**
 * THE ERROR BOUNDARY.
 *
 * Source: reference/customer-old/app/app/error.tsx
 *         docs/AUTOMODZ-OS.md §20.3, §20.4
 *
 * `/api/report` has existed since the rebuild with NO CALLER — every client
 * error since then has gone unreported. This is that caller.
 *
 * §20.4 — the customer is told their car is safe, because it is: this is our
 * connection failing, not their property. §20.3 — ours, not theirs.
 */
import { useEffect } from 'react';
import { space } from '@/design';
import { Screen, RoomHeader, Action } from '@/components/os';

export default function Error(
  { error, reset }: { error: Error & { digest?: string }; reset: () => void },
) {
  useEffect(() => {
    /* Best-effort and deliberately unawaited: a failed report must never
       become a second error on top of the first. */
    void fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        where: 'customer',
      }),
    }).catch(() => {});
  }, [error]);

  return (
    /* The same room every other surface is, rather than a page of its own.
       It painted `color.paper` opaque, which was the one moment in the product
       where the ambient field behind the rooms visibly switched off — the same
       thing `app/loading.tsx` was fixed for. */
    <Screen top={space.rest} style={{ justifyContent: 'center' }}>
      <RoomHeader
        eyebrow="Something failed"
        supporting="Your car and its records are safe. This is our connection, not your car."
      >
        Something went wrong at our end
      </RoomHeader>

      <div
        style={{
          marginTop: space.rest, display: 'flex',
          flexDirection: 'column', gap: space.line,
        }}
      >
        {/* §6.3 — one control commits, the other only moves. */}
        <Action onClick={reset}>Try again</Action>
        <Action href="/" quiet>Back to your car</Action>
      </div>
    </Screen>
  );
}
