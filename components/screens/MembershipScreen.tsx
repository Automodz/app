'use client';
/**
 * THE CLUB
 *
 * Source: docs/AUTOMODZ-OS.md §5.2, §8.6, §9.5, §10.4, §15.1, §15.2, §15.3,
 *         §15.6, §18.1, §21.6
 *         design "AutoModz App.dc.html" — screen 1i
 *
 * §5.2 — the club: "what it includes, what remains, what it is worth, how to
 * join or leave". §15.3 names the four facts a member must always know, and
 * three of them are here; the fourth is recorded below as absent rather than
 * invented.
 *
 * ── THE CARD ─────────────────────────────────────────────────────────────
 * The design gives the membership an object: a card, with the tier, the
 * holder's name, a number and a renewal date, lit by a slow band of light
 * moving across it. Everything under the card is a plain row.
 *
 * That division is the whole design of this room. §15.1 is that a membership
 * is a RELATIONSHIP, and a relationship is embodied, not tabulated — so the
 * one thing that is beautiful here is the card, and the benefits it carries
 * are stated as flatly as possible underneath. A room of equally decorated
 * benefit tiles would be a pricing page, which is §15.6's warning.
 *
 * ── HOW THIS INTEGRATES WITH VEHICLE PROTECTION ──────────────────────────
 * §15.2 — "A membership is a protection. It appears alongside everything else
 * protecting the car." It guards no panel — it guards the relationship — so it
 * is not a region answer on the Vehicle. It appears instead on Home, beside
 * the coating and the insurance. This room is the detail behind that line.
 *
 * No photograph: a membership is a relationship, and §3.1's photograph rule
 * governs vehicle surfaces.
 */

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { MEMBERSHIP_PLANS } from '@/lib/types';
import type { MembershipPlan } from '@/lib/types';
import { ClubFlow, LeaveClub } from '@/components/membership/ClubFlow';
import type { ClubIntent } from '@/components/membership/ClubFlow';
import { color, space, radius, TARGET_MIN } from '@/design';
import type { StateTone } from '@/design';
import { OfflineNote } from '@/components/system';
import {
  Screen, Pane, Label, Statement, Rail, Row, Value, Action, Meter,
} from '@/components/os';

/** One line of the record. */
export interface MembershipHistoryEntry {
  id: string;
  plan: string;
  period: string;
  status: string;
}

export interface MembershipModel {
  /** §18.1 — no membership is silence plus an invitation, never a sales page. */
  held: boolean;
  /** §15.3 #1 — that they have one, and which tier. The one Display. */
  tier?: string;
  /** Whose card it is. Design 1i. */
  holder?: string;
  /** The membership's own number — the subscription's id, shortened. */
  memberNo?: string;
  /** The year the relationship started. */
  memberSince?: string;
  /** §15.3 #2 — what remains, from `os/club`. */
  remaining?: string;
  /** How much of the cycle's washes are left, 0–1. Drawn, not described twice. */
  share?: number;
  /** §15.3 #3 — when it renews or lapses. */
  term?: string;
  /** The countdown, from `os/club.cycleDaysLeft`. Absent when it does not apply. */
  countdown?: string;
  /** The studio has not taken payment yet. */
  awaitingPayment?: boolean;
  tone?: StateTone;
  /** What this plan includes — the plan's own perks, never a second list. */
  benefits?: readonly string[];
  /** Booking a wash that is already paid for. */
  bookWashHref?: string;
  /** The subscription the customer may cancel, when there is one. */
  subscriptionId?: string;
  /** The plan in force, so it is not offered as a change to itself. */
  currentPlan?: MembershipPlan | null;
  /** Every membership held, newest first. */
  history?: readonly MembershipHistoryEntry[];
}

const TONE: Record<StateTone, string> = {
  assent: color.champagne,
  caution: color.amber,
  urgent: color.urgent,
  lapsed: color.ink3,
};

export function MembershipScreen({ model }: { model: MembershipModel }) {
  const {
    held, tier, holder, memberNo, memberSince, remaining, share, term, countdown,
    awaitingPayment, tone = 'assent',
    benefits = [], bookWashHref, subscriptionId, currentPlan, history = [],
  } = model;

  /* ADDRESSABLE (§6.4): `?club=join|upgrade|renew` and `?club=leave`, so each
     is linkable and the back button closes it. Home's "Rejoin the Club" and
     "Renew the Club" both land here with the right one already open. */
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const club = params.get('club');

  const go = (v: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set('club', v); else next.delete('club');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const intent: ClubIntent =
    club === 'upgrade' ? 'upgrade' : club === 'renew' ? 'renew' : 'join';
  const flowOpen = club === 'join' || club === 'upgrade' || club === 'renew';

  /* §18.1 — no membership is silence plus an invitation, never a sales page.
     §15.1 is what a membership IS; this room does not argue for one. */
  if (!held) {
    return (
      <Screen top={space.rest} style={{ justifyContent: 'center' }}>
        <OfflineNote />
        <Statement eyebrow="The AutoModz club">You are not a member</Statement>
        <p
          style={{
            marginTop: space.gap, marginBottom: 0,
            fontSize: 15, lineHeight: 1.65, color: color.ink2,
          }}
        >
          A standing arrangement — washes kept, and the studio on hand.
        </p>
        <div style={{ marginTop: space.rest }}>
          <Action onClick={() => go('join')}>What the club includes</Action>
        </div>
        <ClubFlow open={flowOpen} onClose={() => go(null)} intent={intent} currentPlan={currentPlan} />
      </Screen>
    );
  }

  /* The tiers other than the one held, in the catalogue's own order. The
     design shows the tier below and the tier above; this shows whatever the
     catalogue actually has, so adding a plan never leaves a screen behind. */
  const others = MEMBERSHIP_PLANS.filter(p => p.id !== currentPlan);
  const held_i = MEMBERSHIP_PLANS.findIndex(p => p.id === currentPlan);

  return (
    <Screen top={space.gap}>
      <OfflineNote />

      <Statement eyebrow={memberSince ? `Member since ${memberSince}` : 'The club'}>
        The AutoModz Club
      </Statement>

      {/* ── THE CARD ────────────────────────────────────────────────────
          The one object in the room. Champagne, because a membership is
          something already in force — amber would make it ask for something,
          and it asks for nothing until it lapses. */}
      <Pane
        tone="cool"
        live
        round={radius.sheet}
        style={{
          marginTop: space.gap + space.breath,
          padding: space.gap + 6,
          display: 'flex', flexDirection: 'column', gap: space.gap + 6,
          minHeight: 168, justifyContent: 'space-between',
          /* Deeper than the standard pane: the card is the one surface in the
             product that is meant to look like an object you could hold. */
          background:
            'linear-gradient(150deg, rgba(232,217,190,0.24), rgba(224,164,92,0.10) 55%, rgba(255,255,255,0.03))',
          borderColor: 'rgba(232,217,190,0.3)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28), 0 28px 56px -24px rgba(0,0,0,0.95)',
        }}
      >
        <div
          style={{
            position: 'relative', display: 'flex',
            justifyContent: 'space-between', alignItems: 'flex-start', gap: space.line,
          }}
        >
          <span
            className="am-display"
            style={{ fontWeight: 300, fontSize: 24, letterSpacing: '0.06em', textTransform: 'uppercase' }}
          >
            {currentPlan ?? tier}
          </span>
          {/* The studio signs its own card. The wordmark, quiet. */}
          <span className="am-label" style={{ letterSpacing: '0.32em', fontSize: 9 }}>
            AutoModz
          </span>
        </div>

        <div
          style={{
            position: 'relative', display: 'flex',
            justifyContent: 'space-between', alignItems: 'flex-end', gap: space.line,
          }}
        >
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {holder ? (
              <Label style={{ fontSize: 9.5, letterSpacing: '0.2em' }}>{holder}</Label>
            ) : null}
            {memberNo ? (
              <Label style={{ fontSize: 9.5, letterSpacing: '0.2em' }}>№ {memberNo}</Label>
            ) : null}
          </span>
          {term ? (
            <Label style={{ fontSize: 9.5, letterSpacing: '0.2em', textAlign: 'right' }}>
              {term}
            </Label>
          ) : null}
        </div>
      </Pane>

      {/* §16 — pending is not the same promise as confirmed. A membership the
          studio has not taken payment for says so, in the one place it
          matters, rather than presenting itself as active. */}
      {awaitingPayment ? (
        <Pane
          tone="warm"
          style={{ marginTop: space.line, padding: `${space.gap}px ${space.gap + 2}px` }}
        >
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: color.ink }}>
            The studio has not taken payment for this yet. It starts when they do.
          </p>
        </Pane>
      ) : null}

      {/* ── WHAT REMAINS ────────────────────────────────────────────────
          §15.3 #2. The cycle drawn as a proportion and said as a sentence —
          the bar is the shape, the words are the fact, and neither repeats
          the other's job. */}
      {remaining ? (
        <Pane style={{ marginTop: space.line, padding: `${space.gap + 2}px ${space.gap + 4}px` }}>
          {typeof share === 'number' ? (
            <Meter
              label={remaining}
              value={countdown ?? ''}
              fill={share}
              tone={TONE[tone]}
            />
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: color.ink }}>{remaining}</p>
          )}
          {bookWashHref ? (
            <div style={{ marginTop: space.gap }}>
              {/* §15.6 — the benefit is used, not admired. */}
              <Action href={bookWashHref} style={{ fontSize: 14 }}>Book a wash</Action>
            </div>
          ) : null}
        </Pane>
      ) : null}

      {/* ── WHAT IT INCLUDES ────────────────────────────────────────────
          Rows. §15.6 — a benefit stated plainly is a benefit; a benefit in a
          decorated tile is an advertisement for itself. */}
      {benefits.length > 0 ? (
        <section
          aria-labelledby="club-benefits"
          style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line }}
        >
          <h2 id="club-benefits" style={{ margin: 0 }}><Rail>What it includes</Rail></h2>
          <div>
            {benefits.map((b, i) => (
              <Row key={b} last={i === benefits.length - 1}>{b}</Row>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── THE OTHER TIERS ─────────────────────────────────────────────
          Named, not sold. A tier above says what it costs; a tier below says
          it is below. Neither carries a control — changing tier is one
          deliberate act, and it lives under them. */}
      {others.length > 0 ? (
        <section
          aria-labelledby="club-tiers"
          style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line }}
        >
          <h2 id="club-tiers" style={{ margin: 0 }}><Rail>The other tiers</Rail></h2>
          <div style={{ display: 'flex', gap: space.line }}>
            {others.map(p => {
              const above = MEMBERSHIP_PLANS.findIndex(x => x.id === p.id) > held_i;
              return (
                <Pane
                  key={p.id}
                  style={{
                    flex: 1, padding: `${space.gap}px ${space.line + 2}px`,
                    display: 'flex', flexDirection: 'column', gap: 5,
                    opacity: above ? 1 : 0.6,
                  }}
                >
                  <span
                    className="am-display"
                    style={{ fontSize: 15, letterSpacing: '0.05em', textTransform: 'uppercase' }}
                  >
                    {p.label}
                  </span>
                  <Label style={{ fontSize: 10, letterSpacing: '0.14em' }}>
                    {above ? `₹${p.price.toLocaleString('en-IN')} a month` : 'Below your tier'}
                  </Label>
                </Pane>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ── EVERY MEMBERSHIP HELD ───────────────────────────────────────
          §16 — the record. Rows, newest first, and no control on any of them:
          a past membership is a fact, not an offer. */}
      {history.length > 0 ? (
        <section
          aria-labelledby="club-history"
          style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line }}
        >
          <h2 id="club-history" style={{ margin: 0 }}><Rail>Your memberships</Rail></h2>
          <div>
            {history.map((h, i) => (
              <Row
                key={h.id}
                last={i === history.length - 1}
                value={<Value tone={color.ink3}>{h.status}</Value>}
              >
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span>{h.plan}</span>
                  <Label style={{ fontSize: 10, letterSpacing: '0.14em' }}>{h.period}</Label>
                </span>
              </Row>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── CHANGING IT ─────────────────────────────────────────────────
          §10.4 — one primary act. Leaving is a real control and is not hidden,
          but it is not dressed as an equal to renewing. */}
      <div
        style={{
          marginTop: space.rest / 2, display: 'flex',
          flexDirection: 'column', gap: space.line,
        }}
      >
        <Action onClick={() => go('upgrade')}>Change your tier</Action>
        <button
          type="button"
          onClick={() => go('leave')}
          className="am-tap"
          style={{
            minHeight: TARGET_MIN, background: 'none', border: 'none',
            cursor: 'pointer', color: color.ink3, fontSize: 14, font: 'inherit',
          }}
        >
          Leave the club
        </button>
      </div>

      <ClubFlow open={flowOpen} onClose={() => go(null)} intent={intent} currentPlan={currentPlan} />
      <LeaveClub
        open={club === 'leave'}
        onClose={() => go(null)}
        subscriptionId={subscriptionId ?? null}
      />
    </Screen>
  );
}
