'use client';
/**
 * MEMBERSHIP
 *
 * Source: docs/AUTOMODZ-OS.md §5.2, §8.6, §9.5, §10.4, §15.1, §15.2, §15.3,
 *         §15.6, §18.1, §21.6
 *
 * §5.2 — the club: "what it includes, what remains, what it is worth, how to
 * join or leave". §15.3 names the four facts a member must always know, and
 * three of them are here; the fourth is recorded below as absent rather than
 * invented.
 *
 * ── HOW THIS INTEGRATES WITH VEHICLE PROTECTION ──────────────────────────
 * §15.2 — "A membership is a protection. It appears alongside everything else
 * protecting the car." `PROTECTION_CLASS` in lib/types.ts already classifies
 * every kind, and it calls membership `relational` where ppf/ceramic/glass/
 * interior are `physical`.
 *
 * That existing classification settles it without a new concept: §11.4's
 * regions are PARTS OF A CAR, so only a physical protection can answer for one.
 * A membership guards no panel — it guards the relationship — so it is not a
 * region answer on the Vehicle, and the Vehicle needed no change. It appears
 * instead on the surface that shows the car WHOLE: Home's protection list
 * carries it as a living measure beside the coating and the insurance, which is
 * exactly what §15.2 asks for. This room is the detail behind that line.
 *
 * No photograph: a membership is a relationship, and §3.1's photograph rule
 * governs vehicle surfaces.
 */

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { MembershipPlan } from '@/lib/types';
import { ClubFlow, LeaveClub } from '@/components/membership/ClubFlow';
import type { ClubIntent } from '@/components/membership/ClubFlow';
import { color, space, column, stack, radius, HAIRLINE, MEASURE, INSET } from '@/design';
import type { StateTone } from '@/design';
import { Heading, Text, Button, toneColor, OfflineNote } from '@/components/system';

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

export function MembershipScreen({ model }: { model: MembershipModel }) {
  const {
    held, tier, remaining, share, term, countdown, awaitingPayment, tone,
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

  return (
    <main
      style={{
        background: color.paper,
        minHeight: '100svh',
        paddingBottom: stack.contentFloor,
      }}
    >
      {/* §20.3 — the room was rendered on the server and is still true; only
          what happens NEXT needs a connection. One implementation (§22.2). */}
      <OfflineNote />
      {!held ? (
        /* §18.1 — an invitation, one line and one action. §15.1 is what a
           membership is; this room does not argue for one. */
        <section
          style={{
            ...column,
            minHeight: `calc(100svh - ${stack.navHeight}px)`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <Heading level="display">You are not a member.</Heading>
          <Text role="body" tone="ink2" style={{ marginTop: space.line, maxWidth: MEASURE }}>
            A standing arrangement &mdash; washes kept, and the studio on hand.
          </Text>
          <div style={{ marginTop: space.gap }}>
            <Button tier="primary" onClick={() => go('join')}>What the club includes</Button>
          </div>
        </section>
      ) : (
        <>
          <section style={{ ...column, paddingTop: `calc(${stack.top} + ${space.movement}px)` }}>
            {/* §9.5 — the one Display: which tier they hold. */}
            <Heading level="display">{tier}</Heading>

            {awaitingPayment ? (
              <Text role="body" tone="ink2" aria-live="polite" style={{ marginTop: space.line }}>
                Waiting on the studio to confirm payment.
              </Text>
            ) : null}

            <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
              {remaining}
            </Text>

            {/* The washes drawn as well as said — §14.4, a measure is easier to
                read at a glance than a fraction. The words carry it too, so
                nothing depends on seeing the bar (§21.6). */}
            {share !== undefined ? (
              <div
                aria-hidden
                style={{
                  position: 'relative',
                  height: HAIRLINE,
                  marginTop: space.line,
                  background: color.edge,
                  borderRadius: radius.pill,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    insetBlock: 0,
                    left: 0,
                    width: `${share * 100}%`,
                    background: color.ink2,
                    borderRadius: radius.pill,
                  }}
                />
              </div>
            ) : null}

            <Text
              role="body"
              style={{
                marginTop: space.line,
                color: tone && tone !== 'assent' ? toneColor(tone) : color.ink2,
              }}
            >
              {term}
            </Text>

            {countdown ? (
              <Text role="data" tone="ink3" style={{ marginTop: space.breath }}>
                {countdown}
              </Text>
            ) : null}

            {/* Booking a wash that is already paid for — the whole point of
                holding one. §15.5: the benefit is used, not admired. */}
            {bookWashHref ? (
              <div style={{ marginTop: space.rest }}>
                <Button tier="primary" href={bookWashHref}>Book an included wash</Button>
              </div>
            ) : null}
          </section>

          {/* WHAT IT INCLUDES — the plan's own perks. */}
          {benefits.length > 0 ? (
            <section style={{ ...column, paddingTop: space.movement }}>
              <Text role="data" tone="ink3">What it includes</Text>
              <ul style={{ margin: 0, marginTop: space.gap, paddingLeft: INSET }}>
                {benefits.map(b => (
                  <li key={b} style={{ marginTop: space.breath }}>
                    <Text role="body" tone="ink2" as="span">{b}</Text>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* CHANGING IT. Upgrade and renew are the same write as joining —
              a new pending subscription — because the rules permit nothing
              else from a customer. */}
          <section style={{ ...column, paddingTop: space.movement, display: 'flex', gap: space.gap, flexWrap: 'wrap' }}>
            <Button tier="forward" onClick={() => go('upgrade')}>Change plan</Button>
            <Button tier="forward" onClick={() => go('renew')}>Renew</Button>
          </section>

          {/* THE RECORD. §18.1 — a first membership has no history and shows
              none, rather than a heading over an empty list. */}
          {history.length > 1 ? (
            <section style={{ ...column, paddingTop: space.movement }}>
              <Text role="data" tone="ink3">Your memberships</Text>
              <div style={{ marginTop: space.gap }}>
                {history.map((h, i) => (
                  <div
                    key={h.id}
                    style={{
                      paddingBlock: space.line,
                      borderTop: i === 0 ? undefined : `${HAIRLINE}px solid ${color.edge}`,
                    }}
                  >
                    <Text role="body" tone="ink">{h.plan}</Text>
                    <Text role="whisper" tone="ink3" style={{ marginTop: space.hair }}>
                      {h.period} · {h.status}
                    </Text>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* §15.6 — "cancelling is available, plainly worded, and not defended
              by a maze." §10.4 gives `quiet` to a secondary path; a filled
              control here would be the room urging them out of it. */}
          <section style={{ ...column, paddingTop: space.movement }}>
            <Button tier="quiet" onClick={() => go('leave')}>Leave the club</Button>
          </section>
        </>
      )}

      <ClubFlow
        open={flowOpen}
        onClose={() => go(null)}
        intent={intent}
        currentPlan={currentPlan}
      />
      <LeaveClub
        open={club === 'leave'}
        onClose={() => go(null)}
        subscriptionId={subscriptionId ?? null}
      />
    </main>
  );
}
