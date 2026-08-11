'use client';
/**
 * READY · PAY · RATE — design screen 13.
 *
 * The handover. Three things happen here and they are deliberately not one
 * flow: the customer reads what the visit came to, settles it, and says how it
 * went. A customer who does not want to rate must be able to pay, and one who
 * has already paid must still be able to rate.
 *
 * ── EVERY FIGURE IS THE STUDIO'S ─────────────────────────────────────────
 * Nothing here adds up. The line items, the discount, the total and the amount
 * payable all arrive from the projection, which reads the studio's own
 * records. The Pay control sends a BOOKING ID and nothing else — the server
 * resolves what is owed and builds the UPI link from its own figure, so there
 * is no number on this screen that a browser could change.
 *
 * ── AND OPENING A UPI LINK IS NOT PAYING ─────────────────────────────────
 * There is no gateway. The screen says so plainly rather than showing a tick
 * the moment the customer returns from their bank: the studio confirms against
 * the credit, and until then this reads "with the studio to confirm". A screen
 * that claimed otherwise would be telling a customer their car is released
 * when it is not.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authedFetch } from '@/lib/clientSession';
import { color, space, HAIRLINE, TARGET_MIN, radius, type as typeScale } from '@/design';
import { Screen, Pane, Label, Rail, Action, RoomHeader } from '@/components/os';
import { OfflineNote, useOnline } from '@/components/system';

export interface SettleLine {
  label: string;
  /** "₹1,32,000", or "−₹5,040" for a benefit. */
  value: string;
  detail?: string;
}

export interface SettleModel {
  bookingId: string;
  /** "VISIT · CLOSED" */
  eyebrow: string;
  /** "Back with you." */
  headline: string;
  /** "Back with you by 7:30 pm", or where to collect it. */
  handover: string;
  lines: SettleLine[];
  /** "₹43,622" */
  total: string;
  /** Absent when nothing is left to pay. */
  payable?: string;
  /** The studio's word for where the payment stands, and its one line. */
  paymentWord: string;
  paymentLine: string;
  /** Whether the Pay control should be offered at all. */
  payable_now: boolean;
  /** True once the customer has told us a reference and we are checking. */
  awaitingConfirmation: boolean;
  /** "UPI · aa•••@okhdfc", or an invitation to save one. */
  method: string;
  methodHref: string;
  /** Absent when this visit has no sealed record to rate. */
  visitId?: string;
  /** Set once the customer has rated it — a visit is rated once. */
  rated?: string;
  photosHref?: string;
  recordHref: string;
  /** Said when the studio cannot take UPI in the application at all. */
  upiUnavailable?: string;
}

const REFUSAL: Record<string, string> = {
  'nothing-to-pay': 'There is nothing outstanding on this visit.',
  'upi-not-configured': 'The studio is not taking UPI in the app just now — settle at the counter.',
  'reference-invalid': 'That reference does not look right. It is the long code on your bank’s receipt.',
  'already-paid': 'This one is already settled.',
  'already-rated': 'You have already rated this visit.',
  'not-sealed': 'This visit is not finished yet.',
  'not-found': 'We cannot find that.',
  'not-signed-in': 'Your session has expired. Sign in again and we will pick this up.',
};

const say = (code: string) => REFUSAL[code] ?? 'That did not go through. Try again in a moment.';

export function SettleScreen({ model }: { model: SettleModel }) {
  const router = useRouter();
  const online = useOnline();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [ratedNow, setRatedNow] = useState(false);

  /** Ask the server what is owed, and open the customer's UPI application. */
  const pay = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
            const res = await authedFetch('/api/payment', {
        method: 'POST',
        /* THE BOOKING, AND NOTHING ELSE. No amount travels from here. */
        body: JSON.stringify({ bookingId: model.bookingId }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(say((b as { error?: string }).error ?? ''));
        return;
      }
      const { payment, link } = await res.json() as { payment: { id: string }; link: string };
      setPaymentId(payment.id);
      /* The UPI application takes over from here. On a desktop browser nothing
         will happen, which is why the reference field appears regardless — a
         customer who paid from another device can still tell us. */
      window.location.href = link;
    } catch {
      setError('That did not reach us. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const tellUs = async () => {
    if (!paymentId || busy) return;
    setBusy(true);
    setError(null);
    try {
            const res = await authedFetch('/api/payment', {
        method: 'PATCH',
        body: JSON.stringify({ paymentId, reference }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(say((b as { error?: string }).error ?? ''));
        return;
      }
      router.refresh();
    } catch {
      setError('That did not reach us. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const rate = async () => {
    if (!model.visitId || stars < 1 || busy) return;
    setBusy(true);
    setError(null);
    try {
            const res = await authedFetch('/api/rating', {
        method: 'POST',
        body: JSON.stringify({ visitId: model.visitId, rating: stars, comment }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(say((b as { error?: string }).error ?? ''));
        return;
      }
      setRatedNow(true);
      router.refresh();
    } catch {
      setError('That did not reach us. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen top={space.gap}>
      <OfflineNote />
      {/* Settling is something done TO a visit, so the visit is where
          this goes — `recordHref` is that address. */}
      {/* One header: the way back, the eyebrow and the Display, at one
          scale. These five drew the same three elements by hand and disagreed
          on the size — 28, 29 and 30 — which nobody chose. */}
      <RoomHeader
        parent={{ href: model.recordHref, name: 'The visit' }}
        eyebrow={model.eyebrow}
      >
        {model.headline}
      </RoomHeader>
      <p style={{ margin: `${space.line}px 0 0`, fontSize: 14.5, lineHeight: 1.6, color: color.ink2 }}>
        {model.handover}
      </p>

      {/* ── WHAT IT CAME TO ─────────────────────────────────────────────
          Line by line, including anything approved mid-visit, so a total that
          rose can be checked rather than merely announced. */}
      <section
        aria-labelledby="settle-lines"
        style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line }}
      >
        <h2 id="settle-lines" style={{ margin: 0 }}><Rail>What it came to</Rail></h2>
        <Pane style={{ padding: `${space.breath}px ${space.gap + 4}px` }}>
          {model.lines.map((l, i) => (
            <div
              key={`${l.label}-${i}`}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                gap: space.line, paddingBlock: space.line,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <span style={{ fontSize: 14, color: color.ink }}>{l.label}</span>
                {l.detail ? (
                  <span style={{ fontSize: 12, color: color.ink3 }}>{l.detail}</span>
                ) : null}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 12.5,
                color: color.ink2, flexShrink: 0,
              }}>
                {l.value}
              </span>
            </div>
          ))}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            gap: space.line, paddingBlock: space.gap,
          }}>
            <span style={{ fontSize: 15, color: color.ink }}>Total</span>
            <span className="am-display" style={{ fontSize: 24, lineHeight: 1 }}>{model.total}</span>
          </div>
        </Pane>
      </section>

      {/* ── SETTLING ────────────────────────────────────────────────────
          The word and the line are the studio's, and "submitted" is never
          drawn as "paid": there is no gateway, so the application cannot know
          the money moved and does not claim to. */}
      <section
        aria-labelledby="settle-pay"
        style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line }}
      >
        <h2 id="settle-pay" style={{ margin: 0 }}><Rail>{model.paymentWord}</Rail></h2>
        <Pane
          tone={model.payable_now ? 'warm' : 'plain'}
          aria-live="polite"
          style={{
            padding: `${space.gap + 2}px ${space.gap + 4}px`,
            display: 'flex', flexDirection: 'column', gap: space.breath,
          }}
        >
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: color.ink2 }}>
            {model.paymentLine}
          </p>
          {model.upiUnavailable ? (
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: color.ink3 }}>
              {model.upiUnavailable}
            </p>
          ) : null}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: space.line }}>
            <Label style={{ fontSize: 9.5, letterSpacing: '0.18em' }}>{model.method}</Label>
            <a
              href={model.methodHref}
              className="am-tap am-label"
              style={{ color: color.amber, letterSpacing: '0.16em', flexShrink: 0, textDecoration: 'none' }}
            >
              Change
            </a>
          </div>
        </Pane>

        {model.payable_now && model.payable && !model.upiUnavailable ? (
          <Action onClick={pay} disabled={!online || busy}>
            {busy ? 'One moment…' : `Pay ${model.payable}`}
          </Action>
        ) : null}

        {/* THE REFERENCE. A claim, and labelled as one. It releases nothing;
            the studio confirms against the credit. */}
        {paymentId || model.awaitingConfirmation ? (
          <Pane style={{ padding: `${space.gap}px ${space.gap + 2}px` }}>
            <Label style={{ fontSize: 9.5, letterSpacing: '0.18em' }}>Paid already?</Label>
            <p style={{ margin: `${space.breath}px 0 0`, fontSize: 13, lineHeight: 1.6, color: color.ink3 }}>
              Tell us the reference from your bank and the studio will confirm it.
              Nothing is released on this alone.
            </p>
            <input
              value={reference}
              onChange={e => setReference(e.target.value)}
              aria-label="Transaction reference"
              placeholder="412345678901"
              style={{
                display: 'block', width: '100%', minHeight: TARGET_MIN,
                marginTop: space.line, padding: `${space.breath}px ${space.line}px`,
                background: 'rgba(255,255,255,0.045)',
                border: `${HAIRLINE}px solid ${color.edge}`,
                borderRadius: radius.card,
                fontFamily: 'var(--font-mono)', fontSize: 13, color: color.ink,
                outline: 'none',
              }}
            />
            <div style={{ marginTop: space.line }}>
              <Action onClick={tellUs} quiet disabled={!online || busy || reference.trim().length < 6}>
                Tell the studio
              </Action>
            </div>
          </Pane>
        ) : null}
      </section>

      {/* ── HOW IT WENT ─────────────────────────────────────────────────
          Separate from paying, deliberately. A customer who does not want to
          rate must still be able to settle, and one who has settled must still
          be able to rate. */}
      {model.visitId ? (
        <section
          aria-labelledby="settle-rate"
          style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line }}
        >
          <h2 id="settle-rate" style={{ margin: 0 }}><Rail>How it went</Rail></h2>
          {model.rated || ratedNow ? (
            <Pane style={{ padding: `${space.gap}px ${space.gap + 2}px` }}>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: color.ink2 }}>
                {model.rated ?? 'Thank you — that reaches the studio, not a public page.'}
              </p>
            </Pane>
          ) : (
            <Pane style={{ padding: `${space.gap + 2}px ${space.gap + 4}px` }}>
              <div role="radiogroup" aria-label="How was the visit" style={{ display: 'flex', gap: space.breath }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={stars === n}
                    aria-label={`${n} out of 5`}
                    onClick={() => setStars(n)}
                    className="am-tap"
                    style={{
                      minWidth: TARGET_MIN, minHeight: TARGET_MIN,
                      borderRadius: radius.card,
                      border: `${HAIRLINE}px solid ${stars >= n ? 'rgba(232,217,190,0.4)' : color.edge}`,
                      background: stars >= n
                        ? 'linear-gradient(160deg, rgba(232,217,190,0.24), rgba(232,217,190,0.07))'
                        : 'rgba(255,255,255,0.04)',
                      color: stars >= n ? color.champagneHot : color.ink3,
                      fontFamily: typeScale.body.family, fontSize: 15, cursor: 'pointer',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
                aria-label="Anything you want the studio to know"
                placeholder="Anything you want the studio to know."
                style={{
                  display: 'block', width: '100%', marginTop: space.line,
                  padding: `${space.breath}px ${space.line}px`,
                  background: 'rgba(255,255,255,0.045)',
                  border: `${HAIRLINE}px solid ${color.edge}`,
                  borderRadius: radius.card,
                  fontFamily: typeScale.body.family, fontSize: 14, color: color.ink,
                  outline: 'none', resize: 'vertical',
                }}
              />
              <div style={{ marginTop: space.line }}>
                <Action onClick={rate} quiet disabled={!online || busy || stars < 1}>
                  Send it to the studio
                </Action>
              </div>
            </Pane>
          )}
        </section>
      ) : null}

      {error ? (
        <p aria-live="polite" style={{ margin: `${space.gap}px 0 0`, fontSize: 13.5, lineHeight: 1.6, color: color.ink2 }}>
          {error}
        </p>
      ) : null}

      <div style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line }}>
        {model.photosHref ? (
          <Action href={model.photosHref} quiet>Before &amp; after</Action>
        ) : null}
        <Action href={model.recordHref} quiet>The visit’s record</Action>
      </div>
    </Screen>
  );
}
