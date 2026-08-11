'use client';
/**
 * WE FOUND SOMETHING — design screen 12.
 *
 * The only screen in the product where a customer agrees to spend more money
 * after their car is already on a bay. Everything about it is shaped by that.
 *
 * ── WHAT IT SHOWS, AND WHY EACH ONE ──────────────────────────────────────
 *   the photographs   because "trust us" is not evidence
 *   what changed      in the studio's own words, unsigned (§2.2)
 *   the price delta   as a delta AND as a new total, because a customer
 *                     agreeing to "+₹6,000" is agreeing to a total, and only
 *                     one of those two numbers is the one they will pay
 *   the time delta    because "same day" and "another day" are different
 *                     decisions and the price does not say which
 *
 * ── AND WHAT IT NEVER SHOWS ──────────────────────────────────────────────
 * Who found it. §2.2 — no individual is ever named on a customer surface. The
 * studio found it; the studio is asking.
 *
 * ── DECLINING IS A FIRST-CLASS ANSWER ────────────────────────────────────
 * "Skip it · film as planned" is drawn as a real control beside the approval,
 * not as a way out of a dialogue. A screen that makes declining feel like an
 * error is a screen extracting consent rather than asking for it.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { authedFetch } from '@/lib/clientSession';
import { color, space, radius, imageSizes } from '@/design';
import { Screen, Pane, Label, Rail, Action, RoomHeader } from '@/components/os';
import { OfflineNote, useOnline } from '@/components/system';

export interface ApprovalModel {
  id: string;
  /** "IN THE STUDIO · BMW M340i" */
  eyebrow: string;
  /** "We found something under the film" */
  headline: string;
  /** The studio's explanation, unsigned. */
  detail?: string;
  photos: { url: string; caption: string }[];
  /** "Extra stage" */
  proposedLabel: string;
  /** "+₹6,000" */
  priceDelta: string;
  /** "+2 hours · same day" */
  timeDelta: string;
  /** "₹43,622" — what the visit becomes. */
  newTotal: string;
  /** What it stands at now, so the delta can be checked. */
  currentTotal: string;
  /** Absent while it still stands. Set once it is answered or has run out. */
  settled?: string;
  /** "Until 6:20 pm" — when the request retires itself. */
  standsUntil?: string;
  visitHref: string;
}

const REFUSAL: Record<string, string> = {
  'approval-expired': 'That request has run out. Call the studio and we will pick it up.',
  'already-approved': 'You have already approved this one.',
  'already-declined': 'You have already declined this one.',
  'visit-already-closed': 'This visit is finished, so there is nothing left to change.',
  'not-found': 'We cannot find that request.',
  'not-signed-in': 'Your session has expired. Sign in again and we will hold the car.',
};

export function ApprovalScreen({ model }: { model: ApprovalModel }) {
  const router = useRouter();
  const online = useOnline();
  const [busy, setBusy] = useState<'approved' | 'declined' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const answer = async (choice: 'approved' | 'declined') => {
    if (busy) return;
    setBusy(choice);
    setError(null);
    try {
            const res = await authedFetch('/api/approval', {
        method: 'PATCH',
        body: JSON.stringify({ approvalId: model.id, answer: choice }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(REFUSAL[(b as { error?: string }).error ?? ''] ?? 'That did not go through. Try again in a moment.');
        return;
      }
      router.replace(model.visitHref);
      router.refresh();
    } catch {
      setError('That did not reach us. Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen top={space.gap}>
      <OfflineNote />

      {/* MOVED UP FROM THE FOOT OF THE PAGE. It was a `quiet` Action after
          everything else, which is a footer link and not an escape route — a
          way out you reach by scrolling past the whole screen is one the
          customer has already given up looking for. One idiom, at the top,
          in every room. */}
      {/* One header: the way back, the eyebrow and the Display, at one
          scale. These five drew the same three elements by hand and disagreed
          on the size — 28, 29 and 30 — which nobody chose. */}
      <RoomHeader
        parent={{ href: model.visitHref, name: 'The visit' }}
        eyebrow={model.eyebrow}
        lit
      >
        {model.headline}
      </RoomHeader>

      {/* ── THE EVIDENCE ────────────────────────────────────────────────
          Shown before the price, because the question is "is this real"
          before it is "what does it cost". */}
      {model.photos.length > 0 ? (
        <div style={{
          marginTop: space.gap,
          display: 'grid',
          gridTemplateColumns: model.photos.length === 1 ? '1fr' : '1fr 1fr',
          gap: space.breath,
        }}>
          {model.photos.map(p => (
            <figure key={p.url} style={{ margin: 0 }}>
              <div style={{
                position: 'relative', aspectRatio: '4 / 3',
                borderRadius: radius.card, overflow: 'hidden',
              }}>
                <Image
                  src={p.url}
                  alt={p.caption}
                  fill
                  sizes={model.photos.length === 1 ? imageSizes.inMeasure : imageSizes.half}
                  style={{ objectFit: 'cover' }}
                className="am-photo"
          />
              </div>
              <figcaption style={{ marginTop: space.breath }}>
                <Label style={{ fontSize: 9, letterSpacing: '0.16em' }}>{p.caption}</Label>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}

      {model.detail ? (
        <p style={{ margin: `${space.gap}px 0 0`, fontSize: 15, lineHeight: 1.65, color: color.ink }}>
          {model.detail}
        </p>
      ) : null}

      {/* ── WHAT IT CHANGES ─────────────────────────────────────────────
          The delta and the new total, together. A customer agreeing to
          "+₹6,000" is agreeing to a total, and only one of those two figures
          is the one they will actually pay. */}
      <section
        aria-labelledby="approval-change"
        style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line }}
      >
        <h2 id="approval-change" style={{ margin: 0 }}><Rail>What changes</Rail></h2>
        <Pane tone="warm" style={{ padding: `${space.breath}px ${space.gap + 4}px` }}>
          <ChangeRow label={model.proposedLabel} value={model.priceDelta} />
          <ChangeRow label="Extra time" value={model.timeDelta} />
          <ChangeRow label="Was" value={model.currentTotal} quiet />
          <ChangeRow label="Becomes" value={model.newTotal} last strong />
        </Pane>
      </section>

      {model.settled ? (
        <Pane style={{ marginTop: space.gap, padding: `${space.gap}px ${space.gap + 2}px` }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: color.ink2 }}>
            {model.settled}
          </p>
        </Pane>
      ) : (
        <>
          {model.standsUntil ? (
            <Label style={{ marginTop: space.gap, fontSize: 9.5, letterSpacing: '0.18em' }}>
              {model.standsUntil}
            </Label>
          ) : null}

          {/* Both answers, both real. A screen that makes declining feel like
              an error is extracting consent rather than asking for it. */}
          <div style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line }}>
            <Action onClick={() => answer('approved')} disabled={!online || busy !== null}>
              {busy === 'approved' ? 'One moment…' : `Approve · ${model.priceDelta}`}
            </Action>
            <Action onClick={() => answer('declined')} quiet disabled={!online || busy !== null}>
              {busy === 'declined' ? 'One moment…' : 'Skip it · carry on as planned'}
            </Action>
          </div>
        </>
      )}

      {error ? (
        <p aria-live="polite" style={{ margin: `${space.gap}px 0 0`, fontSize: 13.5, lineHeight: 1.6, color: color.ink2 }}>
          {error}
        </p>
      ) : null}

      <div style={{ marginTop: space.rest / 2 }}>
      </div>
    </Screen>
  );
}

function ChangeRow(
  { label, value, last = false, strong = false, quiet = false }:
  { label: string; value: string; last?: boolean; strong?: boolean; quiet?: boolean },
) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      gap: space.line, paddingBlock: space.line,
      borderBottom: last ? undefined : '1px solid rgba(255,255,255,0.06)',
    }}>
      <span style={{ fontSize: 14.5, color: quiet ? color.ink3 : color.ink }}>{label}</span>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: strong ? 15 : 12.5,
        color: quiet ? color.ink3 : color.champagne,
        marginLeft: 'auto', textAlign: 'right', overflowWrap: 'anywhere',
      }}>
        {value}
      </span>
    </div>
  );
}
