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
import { color, space, INSET, MEASURE } from '@/design';
import { Heading, Text, Button } from '@/components/system';

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
    <main
      style={{
        minHeight: '100svh',
        background: color.paper,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        paddingInline: INSET,
      }}
    >
      <div style={{ maxWidth: MEASURE + INSET * 2, marginInline: 'auto', width: '100%' }}>
        <Heading level="display">Something went wrong at our end.</Heading>
        <Text role="body" tone="ink2" style={{ marginTop: space.line, maxWidth: MEASURE }}>
          Your car and its records are safe. This is our connection, not your car.
        </Text>
        <div style={{ marginTop: space.gap, display: 'flex', gap: space.gap, flexWrap: 'wrap' }}>
          <Button tier="primary" onClick={reset}>Try again</Button>
          <Button tier="quiet" href="/">Back to your car</Button>
        </div>
      </div>
    </main>
  );
}
