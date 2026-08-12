'use client';
/**
 * "I HAVE PAID FOR IT" — the customer's word on a membership.
 *
 * Source: docs/AUTOMODZ-OS.md §15, §16, §19.1
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────
 * A pending membership said "The studio has not taken payment for this yet"
 * and gave the customer nothing to do about it. That is a true sentence and a
 * dead end: somebody who has just paid by UPI at the counter, or transferred
 * it that morning, has something to tell the studio and no way to tell it.
 *
 * ── AND WHY IT GRANTS NOTHING ────────────────────────────────────────────
 * It is a CLAIM, and the product already has a word for that shape:
 * `lib/os/lifecycle` models a customer returning from their bank application
 * as `submitted`, which is a different state from `paid` and releases nothing.
 * This is the same thing for a membership — it records a reference and moves
 * no status. The Club still starts when the studio has seen the money.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authedFetch } from '@/lib/clientSession';
import { Pane, Label, Action } from '@/components/os';
import {
  color, space, MEASURE, HAIRLINE, TARGET_MIN, radius, type as typeScale,
} from '@/design';

const REFUSAL: Record<string, string> = {
  'reference-invalid': 'The reference, as your bank shows it.',
  'not-yours': 'That membership is not yours.',
  'not-found': 'We could not find that membership.',
  'not-configured': 'The studio cannot be reached just now. Try again shortly.',
};
const SIGNED_OUT = 'Your session has expired. Sign in again and we’ll keep this.';
const UNKNOWN = 'That didn’t send. Your connection, most likely — try again.';

export function ClaimPayment(
  { subscriptionId, claimed }: { subscriptionId: string; claimed?: string },
) {
  const router = useRouter();
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const send = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await authedFetch('/api/membership', {
        method: 'PATCH',
        body: JSON.stringify({ subscriptionId, reference }),
      });
      if (res.status === 401) { setError(SIGNED_OUT); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: '' })) as { error?: string };
        setError(REFUSAL[body.error ?? ''] ?? UNKNOWN);
        return;
      }
      setSent(true);
      router.refresh();
    } catch {
      setError(UNKNOWN);
    } finally {
      setBusy(false);
    }
  };

  /* §19.1 — what has already been said is a state, not an empty form. */
  if (sent || claimed) {
    return (
      <Pane style={{ marginTop: space.line, padding: `${space.gap}px ${space.gap + 2}px` }}>
        <p
          aria-live="polite"
          style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: color.ink2, maxWidth: MEASURE }}
        >
          You told us the reference {claimed && !sent ? <b>{claimed}</b> : null}
          {claimed && !sent ? ' — ' : '. '}
          the studio will confirm it against the payment.
        </p>
      </Pane>
    );
  }

  return (
    <Pane
      as="section"
      aria-labelledby="club-claim"
      style={{
        marginTop: space.line,
        padding: `${space.gap + 2}px ${space.gap + 4}px`,
        display: 'flex', flexDirection: 'column', gap: space.line,
      }}
    >
      <h2 id="club-claim" style={{ margin: 0 }}>
        <Label style={{ fontSize: 9.5, letterSpacing: '0.24em' }}>Already paid?</Label>
      </h2>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: color.ink2, maxWidth: MEASURE }}>
        Give us the reference and the studio will match it against the payment.
        The Club starts the moment they do.
      </p>

      <label style={{ display: 'block' }}>
        <Label style={{ letterSpacing: '0.14em' }}>Payment reference</Label>
        <input
          value={reference}
          onChange={e => setReference(e.target.value)}
          autoComplete="off"
          style={{
            display: 'block', width: '100%', minHeight: TARGET_MIN,
            marginTop: space.hair, padding: `${space.breath}px 0`,
            background: 'transparent', border: 'none',
            borderBottom: `${HAIRLINE}px solid ${color.edge}`,
            borderRadius: radius.chip,
            fontFamily: typeScale.body.family, fontSize: typeScale.body.size,
            color: color.ink, outline: 'none',
          }}
        />
      </label>

      {error ? (
        <p
          aria-live="polite"
          style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: color.urgent }}
        >
          {error}
        </p>
      ) : null}

      <Action onClick={() => { void send(); }} disabled={busy} quiet style={{ fontSize: 14 }}>
        {busy ? 'Sending…' : 'Send the reference'}
      </Action>
    </Pane>
  );
}
