/**
 * BOOKED — design screen 09.
 *
 * The screen a customer lands on the moment they commit. It exists to do one
 * thing: state plainly what the studio now holds, so that nobody has to go
 * looking for confirmation of something they just did.
 *
 * ── WHAT THIS SCREEN MAY NOT DO ──────────────────────────────────────────
 * It renders. It holds no data, fetches nothing, builds no address and does no
 * arithmetic — every value below, including the estimate and the calendar
 * link, arrives already decided by `toBooked` (ARCHITECTURE §1).
 *
 * It is a SERVER component: it holds no state and handles no event, so there
 * is nothing here worth hydrating. The primitives it composes bring their own
 * client boundaries where they need one.
 *
 * ── "NOTHING IS CHARGED NOW" IS LOAD-BEARING ─────────────────────────────
 * The design's closing sentence is a promise about money and it is the last
 * thing read before the customer leaves. It is a constant here rather than a
 * projected string precisely so that no state can produce a screen where it is
 * absent while a figure is on show.
 */
import { color, space } from '@/design';
import { Screen, Pane, Label, Rail, Action, Pulse, RoomHeader } from '@/components/os';
/* Deep import, not the `components/system` barrel: reaching through the barrel
   from a server component pulls a dozen client primitives into the page's
   bundle (see the note in ServerRoom.tsx). */
import { OfflineNote } from '@/components/system/OfflineNote';

export interface BookedRow {
  label: string;
  value: string;
  detail?: string;
}

export interface BookedModel {
  /** "The bay is yours" — or the honest weaker sentence while it is a request. */
  headline: string;
  /** "CONFIRMED" · "AWAITING THE STUDIO" */
  standing: string;
  /** True while the studio has not yet accepted. Nothing is promised then. */
  awaiting: boolean;
  /**
   * IS THE STUDIO STILL HOLDING A BAY FOR THIS?
   *
   * The pane is lit and breathing ONLY then. A cancelled or expired visit that
   * pulses is the screen saying something is happening while its own headline
   * says it is not — and the pulse is the product's entire vocabulary for
   * "this is happening now" (§17.1).
   */
  holds: boolean;
  /** "Wednesday 12 February", or "Wed 12 – Thu 13 February" across days. */
  when: string;
  /** How the car gets there, in a sentence. */
  collection: string;
  /** Work · In the bay · Back to you · Estimate. */
  rows: BookedRow[];
  /** Absent while the studio has not accepted — there is no bay to add yet. */
  calendarHref?: string;
  manageHref: string;
  /** Why the booking can no longer be changed here, when it cannot. */
  lockedBecause?: string;
  visitHref?: string;
  homeHref: string;
}

export function BookedScreen({ model }: { model: BookedModel }) {
  const {
    headline, standing, awaiting, holds, when, collection, rows,
    calendarHref, manageHref, lockedBecause, visitHref, homeHref,
  } = model;

  return (
    <Screen top={space.gap}>
      <OfflineNote />
      {/* Arranged in the Studio, opened again from a notification — so the
          way out is the Studio, not whatever was on screen a moment ago. */}
      {/* One header: the way back, the eyebrow and the Display, at one
          scale. These five drew the same three elements by hand and disagreed
          on the size — 28, 29 and 30 — which nobody chose. */}
      <RoomHeader eyebrow={standing} lit={holds && !awaiting}>{headline}</RoomHeader>

      <Pane
        tone={holds && !awaiting ? 'lit' : 'plain'}
        style={{
          marginTop: space.gap,
          padding: `${space.gap + 2}px ${space.gap + 4}px`,
          display: 'flex', flexDirection: 'column', gap: space.line,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: space.line }}>
          {holds && !awaiting ? <Pulse /> : null}
          <span className="am-display" style={{ fontSize: 22, lineHeight: 1.2 }}>{when}</span>
        </span>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: color.ink2 }}>
          {collection}
        </p>
      </Pane>

      {/* ── WHAT WAS AGREED ─────────────────────────────────────────────
          Four facts, in the design's order: the work, how long the bay is
          held, when the car comes back, and what it is expected to cost. */}
      <section
        aria-labelledby="booked-terms"
        style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line }}
      >
        <h2 id="booked-terms" style={{ margin: 0 }}><Rail>What we agreed</Rail></h2>
        <Pane style={{ padding: `${space.breath}px ${space.gap + 4}px` }}>
          {rows.map((r, i) => (
            <div
              key={r.label}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                /* See `Value` in components/os/parts — a value that will not
                   yield breaks the car's name one word per line. */
                flexWrap: 'wrap',
                gap: space.line, paddingBlock: space.line,
                borderBottom: i === rows.length - 1
                  ? undefined : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <span style={{ fontSize: 14.5, color: color.ink }}>{r.label}</span>
                {r.detail ? (
                  <span style={{ fontSize: 12.5, color: color.ink3 }}>{r.detail}</span>
                ) : null}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12.5,
                  color: color.champagne, textAlign: 'right',
                  marginLeft: 'auto', overflowWrap: 'anywhere',
                }}
              >
                {r.value}
              </span>
            </div>
          ))}
        </Pane>
      </section>

      {/* THE PROMISE ABOUT MONEY. Constant, so no state can drop it. */}
      <p style={{ margin: `${space.gap}px 0 0`, fontSize: 13, lineHeight: 1.6, color: color.ink3 }}>
        Nothing is charged now. You approve the final figure at handover.
      </p>

      <div style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line }}>
        {calendarHref ? (
          /* A REAL FILE, generated from this booking. `download` rather than a
             navigation, because the browser must hand it to the calendar
             instead of trying to render it. */
          <Action href={calendarHref} download>Add to calendar</Action>
        ) : null}
        {lockedBecause ? (
          <Pane style={{ padding: `${space.gap}px ${space.gap + 2}px` }}>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: color.ink2 }}>
              {lockedBecause}
            </p>
          </Pane>
        ) : (
          <Action href={manageHref} quiet>Manage booking</Action>
        )}
        {visitHref ? <Action href={visitHref} quiet>Follow the visit</Action> : null}
        <Action href={homeHref} quiet>Done</Action>
      </div>

      {awaiting ? (
        <Label style={{ marginTop: space.gap, fontSize: 9.5, letterSpacing: '0.18em' }}>
          We confirm by message, usually within the hour
        </Label>
      ) : null}
    </Screen>
  );
}
