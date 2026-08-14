/**
 * THE POLLUTION CERTIFICATE
 *
 * Source: docs/AUTOMODZ-OS.md §4.3, §10.5, §14.2, §14.6, §17.1, §18.4, §19.1,
 *         §21.3, §21.6, §21.8, §22.2
 *
 * ── WHAT THIS SCREEN IS ──────────────────────────────────────────────────
 * One fact about one car, and the act that keeps it true. It is reached from
 * the car's own protection ledger and from nowhere else, so it never has to
 * ask which car it is about.
 *
 * The order is the answer to "is my car certified?", asked from most settled
 * to least:
 *
 *   what stands right now, and until when
 *   what the studio has not decided yet
 *   what the studio refused, and what it said
 *   the way to send one
 *   every certificate this car has ever had
 *
 * ── IT IS NOT A CLIENT COMPONENT ─────────────────────────────────────────
 * The room renders on the server like every other. Only the ACT needs a
 * browser session, so only the act carries one: `components/protection/
 * PucForm.tsx` is a client island, exactly as `CarForm` is. A renderer that
 * fetched would be a second data layer (ARCHITECTURE §1).
 *
 * ── AND IT HOLDS NO BUSINESS RULE ────────────────────────────────────────
 * Whether a certificate may be sent, what state the car is in and what each
 * control should say are all decided in `lib/os/puc.ts` and worded in
 * `lib/customer/project.ts`. This draws what it is handed.
 */
import { color, space, MEASURE, radius, TARGET_MIN } from '@/design';
import type { StateTone } from '@/design';
/* DEEP IMPORTS, NOT THE BARRELS. This is a SERVER component, and both barrels
   re-export a dozen `'use client'` primitives with Radix and framer-motion
   behind them - reaching through one drags all of that into this page's
   bundle. Measured elsewhere at 35% of a page's JavaScript. */
import { OfflineNote } from '@/components/system/OfflineNote';
import { Screen } from '@/components/os/Screen';
import { RoomHeader } from '@/components/os/RoomHeader';
import { Pane } from '@/components/os/Pane';
import { Label, Rail, Row, Value, Action } from '@/components/os/parts';
import { Photograph } from '@/components/os/Photograph';
import { PucForm } from '@/components/protection/PucForm';

/* ── What the certificate needs to be true ───────────────────────────── */

/**
 * One certificate, already worded.
 *
 * `reference` and `issued` are optional because a protection that was seeded
 * rather than declared has neither - every pollution certificate in production
 * is one. §18.1: an absent fact is not printed, and the row goes with it.
 */
export interface PucCertificate {
  reference?: string;
  /**
   * "26 February 2026" - BARE. The row's label is the word for it, and a value
   * that repeats its own label reads as a stammer: the first cut of this
   * screen said "Issued · Issued 26 February 2026" and "Valid · Valid until 26
   * August 2026", which is how the visual pass found it.
   */
  issued?: string;
  /**
   * The word for the end of the term - "Valid until" while it holds, "Ran out"
   * once it has gone. It is a LABEL rather than part of the value because a
   * lapsed certificate filed under "Valid" is the room contradicting its own
   * headline two lines above.
   */
  untilLabel: string;
  /** "26 August 2026", or the term engine's words for a term with no date. */
  until: string;
  /** The photograph of it, when the owner sent one. */
  evidenceUrl?: string;
}

/** One line of the record. Nothing here is ever edited or removed. */
export interface PucRecordRow {
  id: string;
  reference: string;
  /** "Until 26 August 2026" - the date that decided anything. */
  validity: string;
  /** The studio's word for what became of it. */
  state: string;
  tone: StateTone;
}

export interface PucModel {
  car: string;
  plate: string;
  /** The state, as a customer would say it out loud (§21.8). */
  state: string;
  /** The sentence under it. Never a restatement of the state. */
  line: string;
  tone: StateTone;

  /** What AutoModz stands behind right now, when it stands behind anything. */
  standing?: PucCertificate;
  /** What is with the studio, unanswered. Bare dates, for the same reason. */
  pending?: { reference: string; sent: string; until: string };
  /** The last refusal, and the studio's own sentence about it. */
  refused?: { reference: string; on: string; because?: string };

  /** Every declaration this car has, newest first. */
  record: readonly PucRecordRow[];

  /**
   * The form, when there is anything to send. Absent while the studio is
   * holding one - §10.5: the screen explains instead of disabling, and the
   * explanation is the pending pane above it.
   */
  declare?: {
    vehicleId: string;
    title: string;
    /** What the studio will do with it. Said before it is asked for. */
    note: string;
    submit: string;
  };

  /**
   * §18.4 - a way to reach a person. SECONDARY and named as an alternative,
   * never the path: this used to be the only way to declare anything, which
   * is how a product ends up with a control that opens WhatsApp and a
   * certificate that never arrives.
   */
  askHref: string;
}

/** §3.3 - the state's own tone. One warm family, and nothing else. */
const TONE: Record<StateTone, string> = {
  assent: color.champagne,
  caution: color.amber,
  urgent: color.urgent,
  lapsed: color.ink3,
};

export function PucScreen(
  { model, canAttach = true }:
  {
    model: PucModel;
    /**
     * Whether this deployment can accept a photograph at all. Read on the
     * server from the media configuration - §10.5, a control that always
     * fails is not a control.
     */
    canAttach?: boolean;
  },
) {
  const { car, plate, state, line, tone, standing, pending, refused, record, declare, askHref } = model;

  return (
    <Screen>
      <OfflineNote />

      <RoomHeader eyebrow={`${car} · ${plate}`} supporting={line} scale="subject">
        Pollution certificate
      </RoomHeader>

      <div
        style={{
          marginTop: space.rest,
          display: 'flex', flexDirection: 'column', gap: space.line,
        }}
      >
        {/* ── WHAT THE CAR IS, IN ONE LINE ────────────────────────────
            The state, in the state's own tone. Always drawn, because the
            answer to "is my car certified" is never absent - "not added" is
            an answer (§19.1). */}
        <Pane style={{ padding: `${space.gap}px ${space.gap + 2}px` }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 14, color: TONE[tone],
              overflowWrap: 'break-word',
            }}
          >
            {state}
          </span>
        </Pane>

        {/* ── WHAT STANDS RIGHT NOW ───────────────────────────────────
            §14.6 - the file where one exists, and the facts beside it. */}
        {standing ? (
          <Pane
            as="section"
            aria-labelledby="puc-standing"
            style={{
              padding: `${space.gap + 2}px ${space.gap + 4}px`,
              display: 'flex', flexDirection: 'column', gap: space.line,
            }}
          >
            <h2 id="puc-standing" style={{ margin: 0 }}>
              <Label style={{ fontSize: 9.5, letterSpacing: '0.24em' }}>
                What we hold
              </Label>
            </h2>
            {/* §18.1 - a row with nothing in it is not drawn. A certificate
                that was never declared has no number and no issue date, and
                printing "Certificate -" would be a hole where a fact goes. */}
            {standing.reference ? (
              <Row value={<Value>{standing.reference}</Value>}>Certificate</Row>
            ) : null}
            {standing.issued ? (
              <Row value={<Value tone={color.ink2}>{standing.issued}</Value>}>Issued</Row>
            ) : null}
            <Row value={<Value tone={TONE[tone]}>{standing.until}</Value>} last>
              {standing.untilLabel}
            </Row>

            {standing.evidenceUrl ? (
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '4 / 3',
                  borderRadius: radius.chip,
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <Photograph
                  src={standing.evidenceUrl}
                  alt={`The pollution certificate for ${car}`}
                  sizes="(max-width: 700px) 100vw, 620px"
                  fit="contain"
                  radius={radius.chip}
                />
              </div>
            ) : null}
          </Pane>
        ) : null}

        {/* ── WHAT THE STUDIO HAS NOT DECIDED ─────────────────────────
            §19.1 - a wait is a state. A customer who sent something last
            night is told it arrived, rather than being shown "not added"
            and sending it again. */}
        {pending ? (
          <Pane
            tone="warm"
            as="section"
            aria-labelledby="puc-pending"
            style={{
              padding: `${space.gap + 2}px ${space.gap + 4}px`,
              display: 'flex', flexDirection: 'column', gap: space.line,
            }}
          >
            <h2 id="puc-pending" style={{ margin: 0 }}>
              <Label style={{ fontSize: 9.5, letterSpacing: '0.24em' }}>
                With the studio
              </Label>
            </h2>
            <Row value={<Value>{pending.reference}</Value>}>Certificate</Row>
            <Row value={<Value tone={color.ink2}>{pending.until}</Value>}>Valid until</Row>
            <Row value={<Value tone={color.ink2}>{pending.sent}</Value>} last>Sent</Row>
          </Pane>
        ) : null}

        {/* ── WHAT THE STUDIO WOULD NOT STAND BEHIND ──────────────────
            Said plainly and with the studio's own sentence, because a
            refusal with no reason is a customer sending the same thing
            again. AutoModz answers - never a person (Art. 8). */}
        {refused ? (
          <Pane
            as="section"
            aria-labelledby="puc-refused"
            style={{
              padding: `${space.gap + 2}px ${space.gap + 4}px`,
              display: 'flex', flexDirection: 'column', gap: space.line,
            }}
          >
            <h2 id="puc-refused" style={{ margin: 0 }}>
              <Label style={{ fontSize: 9.5, letterSpacing: '0.24em', color: color.urgent }}>
                Not accepted
              </Label>
            </h2>
            <Row value={<Value tone={color.ink2}>{refused.on}</Value>}>
              {refused.reference}
            </Row>
            {refused.because ? (
              <p
                style={{
                  margin: 0, fontSize: 13.5, lineHeight: 1.55,
                  color: color.ink2, maxWidth: MEASURE,
                }}
              >
                {refused.because}
              </p>
            ) : null}
          </Pane>
        ) : null}

        {/* ── THE ACT ─────────────────────────────────────────────────
            The one client island on the screen. */}
        {declare ? (
          <PucForm
            vehicleId={declare.vehicleId}
            title={declare.title}
            note={declare.note}
            submit={declare.submit}
            canAttach={canAttach}
          />
        ) : null}

        {/* ── THE RECORD ──────────────────────────────────────────────
            Every certificate this car has had, newest first. It exists
            because nothing here is ever overwritten: a renewal adds, and
            what it replaced keeps its own dates for ever. */}
        {record.length > 0 ? (
          <section
            aria-labelledby="puc-record"
            style={{
              marginTop: space.gap,
              display: 'flex', flexDirection: 'column', gap: space.line,
            }}
          >
            <h2 id="puc-record" style={{ margin: 0 }}><Rail>Every certificate</Rail></h2>
            <Pane style={{ padding: `${space.breath}px ${space.gap + 2}px` }}>
              {record.map((r, i) => (
                <Row
                  key={r.id}
                  last={i === record.length - 1}
                  value={<Value tone={TONE[r.tone]}>{r.state}</Value>}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ overflowWrap: 'break-word' }}>{r.reference}</span>
                    <Label style={{ letterSpacing: '0.14em', fontSize: 10 }}>{r.validity}</Label>
                  </span>
                </Row>
              ))}
            </Pane>
          </section>
        ) : null}

        {/* ── THE OTHER WAY ───────────────────────────────────────────
            §18.4's invitation to reach a person, kept quiet and kept last.
            It is an alternative to the form above it, and it says so. */}
        <section
          style={{
            marginTop: space.gap,
            display: 'flex', flexDirection: 'column', gap: space.line,
          }}
        >
          <p
            style={{
              margin: 0, fontSize: 13, lineHeight: 1.55,
              color: color.ink3, maxWidth: MEASURE,
            }}
          >
            Would rather hand it over in person, or send a photograph another
            way? The studio will take it from there.
          </p>
          <Action
            href={askHref}
            quiet
            style={{ fontSize: 13.5, minHeight: TARGET_MIN }}
          >
            Message the studio
          </Action>
        </section>
      </div>
    </Screen>
  );
}
