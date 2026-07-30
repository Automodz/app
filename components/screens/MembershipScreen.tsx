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
import { color, space, column, stack } from '@/design';
import type { StateTone } from '@/design';
import { Heading, Text, Button, toneColor } from '@/components/system';

export interface MembershipModel {
  /** §18.1 — no membership is silence plus an invitation, never a sales page. */
  held: boolean;
  /** §15.3 #1 — that they have one, and which tier. The one Display. */
  tier?: string;
  /** §15.3 #2 — what remains. */
  remaining?: string;
  /** §15.3 #3 — when it renews or lapses. */
  term?: string;
  tone?: StateTone;
  /**
   * §15.6 — leaving is easy and not defended by a maze. This pointed at `/you`
   * and cancelled nothing. There is no in-app cancel surface, so it opens the
   * studio's own channel — the one place that can actually end a membership
   * today — rather than pretending to.
   */
  leaveHref?: string;
  /** Where joining happens. §5.2 puts arranging inside the Studio. */
  joinHref?: string;
}

export function MembershipScreen({ model }: { model: MembershipModel }) {
  const { held, tier, remaining, term, tone, leaveHref, joinHref } = model;

  return (
    <main
      style={{
        background: color.paper,
        minHeight: '100svh',
        paddingBottom: stack.contentFloor,
      }}
    >
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
          <div style={{ marginTop: space.gap }}>
            {joinHref ? (
              <Button tier="forward" href={joinHref}>What the club includes</Button>
            ) : null}
          </div>
        </section>
      ) : (
        <>
          <section
            style={{ ...column, paddingTop: `calc(${stack.top} + ${space.movement}px)` }}
          >
            {/* §9.5 — the one Display: which tier they hold. */}
            <Heading level="display">{tier}</Heading>
            {/* §15.3 #2 and #3. §8.6 — facts, so lines of text. §3.3 — the term
                carries colour only when it needs attention. */}
            <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
              {remaining}
            </Text>
            <Text
              role="body"
              style={{
                marginTop: space.line,
                color: tone && tone !== 'assent' ? toneColor(tone) : color.ink2,
              }}
            >
              {term}
            </Text>
          </section>

          {/* §15.6 — "cancelling is available, plainly worded, and not defended
              by a maze." §10.4 gives `quiet` to a secondary path; a filled
              control here would be the room urging them out of it. */}
          <section style={{ ...column, paddingTop: space.movement }}>
            {leaveHref ? (
              <Button tier="quiet" href={leaveHref}>Leave the club</Button>
            ) : null}
          </section>
        </>
      )}
    </main>
  );
}
