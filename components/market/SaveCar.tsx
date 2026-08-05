'use client';
/**
 * KEEPING A CAR.
 *
 * The `savedCars` subcollection has existed since before the rebuild, is
 * cleared when an account is deleted, and had no way to write to it — the
 * capability was declared and never built.
 *
 * Optimistic, because the answer is a foregone conclusion and waiting for a
 * round trip to fill in a heart feels broken. If the write fails the control
 * goes back to what it was and says so, rather than lying quietly.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { space } from '@/design';
import { Button, Text } from '@/components/system';

export function SaveCar(
  { listingId, saved, signedIn }:
  { listingId: string; saved: boolean; signedIn: boolean },
) {
  const [on, setOn] = useState(saved);
  const [failed, setFailed] = useState(false);
  const [busy, start] = useTransition();
  const router = useRouter();

  /* Nothing to keep it against. Rather than a control that opens a sign-in
     wall, the invitation is honest about what it costs. */
  if (!signedIn) {
    return (
      <div style={{ marginTop: space.gap }}>
        <Button tier="quiet" href="/auth/login" style={{ paddingInline: 0 }}>
          Sign in to keep this car
        </Button>
      </div>
    );
  }

  const toggle = () => {
    const want = !on;
    setOn(want);
    setFailed(false);
    start(async () => {
      try {
        const { auth } = await import('@/lib/firebase');
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('no-token');
        const res = await fetch('/api/cars/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ listingId, saved: want }),
        });
        if (!res.ok) throw new Error('save-failed');
        /* The saved list is read on the server, so the next render has to see
           this. Without it the card would show the old state on going back. */
        router.refresh();
      } catch {
        setOn(!want);
        setFailed(true);
      }
    });
  };

  return (
    <div style={{ marginTop: space.gap }}>
      <Button
        tier="quiet"
        onClick={toggle}
        disabled={busy}
        aria-pressed={on}
        style={{ paddingInline: 0 }}
      >
        {on ? 'Kept' : 'Keep this car'}
      </Button>
      {failed ? (
        <Text role="whisper" tone="ink3" style={{ marginTop: space.hair }}>
          That didn’t save. Try again in a moment.
        </Text>
      ) : null}
    </div>
  );
}
