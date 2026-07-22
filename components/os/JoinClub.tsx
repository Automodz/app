'use client';
/**
 * The Join sheet (P2D1 §C7 · P2D3 C-10) - `?sheet=join-club`.
 *
 * Membership is an object you hold, so joining is not a checkout: each tier
 * is shown card-shaped, with what it actually gives and - when the car's own
 * history can say it - how that compares to how often this customer really
 * washes. Then one honest choice of how to pay, and a pending state that
 * tells the truth: the studio confirms, and the card goes live.
 *
 * The membership itself is created by the existing subscription engine; no
 * pricing, plan or cycle arithmetic is redefined here.
 */
import { useMemo, useState } from 'react';
import type { Booking, MembershipPlan, Subscription } from '@/lib/types';
import { MEMBERSHIP_PLANS } from '@/lib/types';
import { createSubscription } from '@/lib/services/subscriptions';
import { useAppStore } from '@/lib/store';
import { cadenceLine } from '@/lib/os/club';
import Action from './Action';
import { Title, Emphasis, Body, Data, Whisper } from './text';

const todayISO = () => new Date().toISOString().split('T')[0];
const cycleEnd = (fromISO: string) => {
  const d = new Date(`${fromISO}T12:00:00`);
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
};

interface JoinClubProps {
  /** the car in context - the Club belongs to the person, but it is felt by the car */
  vehicleName: string;
  /** this customer's completed wash visits, newest first */
  washes: Booking[];
  /** true when a lapsed membership is being taken up again */
  rejoining: boolean;
  onJoined: () => void;
}

export default function JoinClub({ vehicleName, washes, rejoining, onJoined }: JoinClubProps) {
  const { user } = useAppStore();
  const [plan, setPlan] = useState<MembershipPlan | null>(null);
  const [method, setMethod] = useState<'cash' | 'upi'>('cash');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = useMemo(
    () => MEMBERSHIP_PLANS.find(p => p.id === plan) ?? null,
    [plan],
  );

  const join = async () => {
    if (!user || !chosen) return;
    setBusy(true); setError(null);
    const start = todayISO();
    const payload: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'> = {
      userId: user.uid,
      userName: user.name,
      userEmail: user.email,
      userPhone: user.phone || '',
      plan: chosen.id,
      status: 'pending',
      startDate: start,
      endDate: cycleEnd(start),
      washesTotal: chosen.washesPerMonth,
      washesUsed: 0,
      paymentMethod: method,
    };
    try {
      await createSubscription(payload);
      onJoined();
    } catch {
      setError('That didn’t reach the studio - try again.');
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 'var(--st-inset)', paddingBottom: 'var(--st-breath)' }}>
      <Title>{rejoining ? 'Rejoin the Club' : 'The Club'}</Title>
      <Body tone="ink-2">
        A standing arrangement for the {vehicleName} - washes kept, and the studio
        keeping an eye on it between them.
      </Body>

      <div style={{ display: 'grid', gap: 'var(--st-gap)' }}>
        {MEMBERSHIP_PLANS.map(p => {
          const selected = plan === p.id;
          const cadence = cadenceLine({ washesPerMonth: p.washesPerMonth, washes });
          return (
            <button
              key={p.id}
              onClick={() => setPlan(p.id)}
              aria-pressed={selected}
              className="st-tap"
              style={{
                display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                background: 'var(--st-paper)', borderRadius: 'var(--st-r-card)',
                border: '1px solid var(--st-hairline)',
                boxShadow: selected ? 'var(--st-hold)' : 'none',
                overflow: 'hidden', padding: 0,
              }}
            >
              <div aria-hidden style={{
                height: 3, background: selected ? 'var(--st-assent)' : 'var(--st-hairline)',
              }} />
              <div style={{ padding: 'var(--st-inset)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--st-gap)' }}>
                  <Emphasis as="p">{p.label}</Emphasis>
                  <Data>₹{p.price.toLocaleString('en-IN')} / month</Data>
                </div>
                <Body tone="ink-2" style={{ marginTop: 'var(--st-breath)' }}>
                  {p.perks.join(' · ')}
                </Body>
                {cadence && <Whisper style={{ marginTop: 'var(--st-breath)' }}>{cadence}</Whisper>}
              </div>
            </button>
          );
        })}
      </div>

      {chosen && (
        <div>
          <Body tone="ink-2" style={{ marginBottom: 'var(--st-line)' }}>How would you like to pay?</Body>
          <div style={{ display: 'flex', gap: 'var(--st-breath)', flexWrap: 'wrap' }}>
            {([
              { id: 'cash' as const, label: 'At the studio' },
              { id: 'upi' as const, label: 'UPI' },
            ]).map(opt => (
              <button
                key={opt.id}
                onClick={() => setMethod(opt.id)}
                aria-pressed={method === opt.id}
                className="st-tap"
                style={{
                  padding: '10px 14px', borderRadius: 'var(--st-r-chip)', border: 'none',
                  cursor: 'pointer', minHeight: 44,
                  background: method === opt.id ? 'var(--st-linen)' : 'transparent',
                  fontFamily: 'var(--st-text)', fontSize: 14, color: 'var(--st-ink)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Whisper style={{ marginTop: 'var(--st-line)' }}>
            {method === 'upi'
              ? 'The studio sends a UPI reference and confirms once it lands.'
              : 'Pay on your next visit - the studio confirms and the card goes live.'}
          </Whisper>
        </div>
      )}

      {error && <Body tone="caution">{error}</Body>}

      {chosen && (
        <Action variant="primary" onClick={join} loading={busy}>
          {rejoining ? `Rejoin on ${chosen.label}` : `Join on ${chosen.label}`}
        </Action>
      )}
    </div>
  );
}
