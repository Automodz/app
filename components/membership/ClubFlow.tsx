'use client';
/**
 * JOINING, UPGRADING, RENEWING - and leaving.
 *
 * Source: reference/customer-old/components/os/JoinClub.tsx
 *
 * WHY JOIN, UPGRADE AND RENEW ARE ONE PATH. All three are one request naming
 * one plan; the SERVER decides which of the three it actually is, from what
 * the customer already holds (`lib/os/membership.mayJoin`). Modelling upgrade
 * as a plan edit would be inventing a path the server refuses.
 *
 * ── THIS FILE COMPUTES NOTHING, AND THAT IS NEW ──────────────────────────
 * It used to assemble the whole subscription document - plan, start date, end
 * date, wash count, payment method - and write it straight to Firestore, which
 * accepted it because it said `pending`. So the terms of a standing
 * entitlement were the browser's to write: `washesTotal: 999` and an `endDate`
 * in 2099 were one devtools session away, and the studio's activation screen
 * had no reason to doubt the record in front of it.
 *
 * Now it sends a plan NAME and a payment method, and nothing else exists to
 * send. The price, the dates and the wash count are derived server-side from
 * the catalogue and the studio's clock (`/api/membership`).
 */
import { useEffect, useMemo, useState } from 'react';
import { authedFetch } from '@/lib/clientSession';
import { useRouter } from 'next/navigation';
import { MEMBERSHIP_PLANS } from '@/lib/types';
import type { MembershipPlan } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { BottomSheet, Heading, Text, Button, OfflineNote, useOnline } from '@/components/system';
import {
  color, space, INSET, MEASURE, HAIRLINE, TARGET_MIN, radius,
  type as typeScale,
} from '@/design';

/**
 * EVERY WAY THE STUDIO CAN REFUSE, IN THE CUSTOMER'S WORDS.
 *
 * Keyed by the same codes the engine and the route return, so a refusal
 * invented on the server still arrives as a sentence rather than a slug.
 */
const REFUSAL: Record<string, string> = {
  'plan-unknown': 'That plan is not one we offer any more.',
  'payment-method-invalid': 'Choose how you would like to pay.',
  'already-pending': 'You already have one with the studio. We will confirm it shortly.',
  'already-a-member': 'You are already in the Club on that plan or a better one.',
  'not-configured': 'The studio cannot be reached just now. Try again shortly.',
};
const SIGNED_OUT = 'Your session has expired. Sign in again and we\u2019ll pick this up.';
const UNKNOWN = 'That didn\u2019t reach the studio - try again.';

/** What the customer is here to do. All three write the same shape. */
export type ClubIntent = 'join' | 'upgrade' | 'renew';

const TITLE: Record<ClubIntent, string> = {
  join: 'The Club',
  upgrade: 'Change your plan',
  renew: 'Renew the Club',
};

const LEAD: Record<ClubIntent, string> = {
  join: 'A standing arrangement - washes kept, and the studio on hand.',
  upgrade: 'Choose the plan you want next. It starts once the studio confirms.',
  renew: 'Carry it on for another cycle.',
};

export interface ClubFlowProps {
  open: boolean;
  onClose: () => void;
  intent: ClubIntent;
  /** The plan in force, so it is not offered as a change to itself. */
  currentPlan?: MembershipPlan | null;
}

export function ClubFlow({ open, onClose, intent, currentPlan = null }: ClubFlowProps) {
  const router = useRouter();
  const online = useOnline();

  const [plan, setPlan] = useState<MembershipPlan | null>(null);
  const [method, setMethod] = useState<'cash' | 'upi'>('cash');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const chosen = useMemo(
    () => MEMBERSHIP_PLANS.find(p => p.id === plan) ?? null,
    [plan],
  );

  useEffect(() => {
    if (!open) return;
    setPlan(intent === 'renew' ? currentPlan : null);
    setMethod('cash');
    setError(null);
    setDone(false);
  }, [open, intent, currentPlan]);

  const submit = async () => {
    if (!chosen) return;
    if (!online) { setError('You\u2019re offline - reconnect to do this.'); return; }
    setBusy(true);
    setError(null);
    try {
      /* A PLAN NAME AND A PAYMENT METHOD. That is the whole request, and
         there is deliberately nothing else to send: the price, the dates and
         the wash count are the studio's to decide, and the route derives them
         from the catalogue and its own clock. Announcing it to the studio
         happens there too, in the same request that writes the record. */
      const res = await authedFetch('/api/membership', {
        method: 'POST',
        body: JSON.stringify({ plan: chosen.id, paymentMethod: method }),
      });

      if (res.status === 401) { setError(SIGNED_OUT); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: '' })) as { error?: string };
        setError(REFUSAL[body.error ?? ''] ?? UNKNOWN);
        return;
      }

      setDone(true);
      router.refresh();
    } catch {
      setError(UNKNOWN);
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} label={TITLE[intent]}>
      <div style={{ paddingInline: INSET, maxWidth: MEASURE + INSET * 2, marginInline: 'auto', width: '100%' }}>
        {done ? (
          <div aria-live="polite">
            <Heading level="title">The studio has it.</Heading>
            <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
              {chosen?.label} - {formatCurrency(chosen?.price ?? 0)} a month.
              We&rsquo;ll confirm once payment is settled at the studio.
            </Text>
            <Text role="whisper" tone="ink3" style={{ marginTop: space.gap }}>
              Pending &mdash; it starts the moment the studio confirms.
            </Text>
            <div style={{ marginTop: space.rest }}>
              <Button tier="primary" onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <Heading level="title">{TITLE[intent]}</Heading>
            <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
              {LEAD[intent]}
            </Text>

            <OfflineNote inline caption="You’re offline. This needs a connection." />

            {/* THE PLANS, each with what it actually includes. §15.4 - the
                benefits are the plan's own `perks`, never a marketing list
                written twice. */}
            <div style={{ marginTop: space.rest, display: 'grid', gap: space.gap }}>
              {MEMBERSHIP_PLANS.map(p => {
                const on = plan === p.id;
                const held = currentPlan === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlan(p.id)}
                    aria-pressed={on}
                    style={{
                      appearance: 'none',
                      textAlign: 'left',
                      width: '100%',
                      padding: INSET,
                      borderRadius: radius.card,
                      border: `${HAIRLINE}px solid ${on ? color.ink : color.edge}`,
                      background: color.surface,
                      cursor: 'pointer',
                      minHeight: TARGET_MIN,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: space.gap, alignItems: 'baseline' }}>
                      <Text role="body" tone="ink" as="span">
                        {p.label}{held ? ' · your plan' : ''}
                      </Text>
                      <Text role="data" tone="ink2" as="span">
                        {formatCurrency(p.price)} / month
                      </Text>
                    </div>
                    <Text role="whisper" tone="ink3" style={{ marginTop: space.hair }}>
                      {p.washesPerMonth} washes a month
                    </Text>
                    <ul style={{ margin: 0, marginTop: space.breath, paddingLeft: space.gap }}>
                      {p.perks.map(perk => (
                        <li key={perk}>
                          <Text role="whisper" tone="ink3" as="span">{perk}</Text>
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            {/* HOW IT IS PAID. Settled at the studio either way - there is no
                gateway in the product, and saying so is honest. */}
            <div style={{ marginTop: space.rest }}>
              <Text role="data" tone="ink3">Paying</Text>
              <div style={{ display: 'flex', gap: space.breath, marginTop: space.breath }}>
                {(['cash', 'upi'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    aria-pressed={method === m}
                    style={{
                      minHeight: TARGET_MIN,
                      paddingInline: space.gap,
                      borderRadius: radius.pill,
                      border: `${HAIRLINE}px solid ${method === m ? color.ink : color.edge}`,
                      background: method === m ? color.ink : 'transparent',
                      color: method === m ? color.paper : color.ink2,
                      fontFamily: typeScale.body.family,
                      fontSize: typeScale.data.size,
                      cursor: 'pointer',
                    }}
                  >
                    {m === 'cash' ? 'Cash' : 'UPI'}
                  </button>
                ))}
              </div>
              <Text role="whisper" tone="ink3" style={{ marginTop: space.breath }}>
                Settled at the studio. Nothing is charged here.
              </Text>
            </div>

            {error ? (
              <Text role="body" tone="ink2" aria-live="polite" style={{ marginTop: space.gap }}>
                {error}
              </Text>
            ) : null}

            <div style={{ marginTop: space.rest, display: 'flex', gap: space.gap, flexWrap: 'wrap' }}>
              <Button tier="primary" onClick={submit} loading={busy} disabled={!chosen || !online || busy}>
                {intent === 'join' ? 'Join the Club' : intent === 'renew' ? 'Renew it' : 'Change to this'}
              </Button>
              <Button tier="quiet" onClick={onClose}>Not now</Button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

/**
 * LEAVING.
 *
 * §15.6 - "cancelling is available, plainly worded, and not defended by a
 * maze." One confirmation, because it cannot be undone, and then the one
 * service call the rules permit.
 */
export function LeaveClub({
  open, onClose, subscriptionId,
}: {
  open: boolean;
  onClose: () => void;
  subscriptionId: string | null;
}) {
  const router = useRouter();
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leave = async () => {
    if (!subscriptionId) return;
    setBusy(true);
    setError(null);
    try {
      /* Through the same door as everything else. Leaving is a lifecycle
         transition like any other, and `membershipTransition` is what decides
         whether this membership may take it - a cancelled one cannot be
         cancelled again, and an expired one is history rather than something
         to leave. */
      const res = await authedFetch('/api/membership', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'leave', subscriptionId }),
      });
      if (res.status === 401) { setError(SIGNED_OUT); return; }
      if (!res.ok) { setError('That didn’t cancel. Try again in a moment.'); return; }
      onClose();
      router.refresh();
    } catch {
      setError('That didn’t cancel. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} label="Leave the Club">
      <div style={{ paddingInline: INSET, maxWidth: MEASURE + INSET * 2, marginInline: 'auto', width: '100%' }}>
        <Heading level="title">Leave the Club?</Heading>
        <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
          Your washes stop at the end of the cycle you have paid for. You can
          rejoin whenever you like.
        </Text>

        <OfflineNote inline caption="You’re offline. This needs a connection." />

        {error ? (
          <Text role="body" tone="ink2" aria-live="polite" style={{ marginTop: space.gap }}>
            {error}
          </Text>
        ) : null}

        <div style={{ marginTop: space.rest, display: 'flex', gap: space.gap, flexWrap: 'wrap' }}>
          <Button tier="primary" onClick={leave} loading={busy} disabled={!online || busy}>
            Yes, leave
          </Button>
          <Button tier="quiet" onClick={onClose}>Stay</Button>
        </div>
      </div>
    </BottomSheet>
  );
}
