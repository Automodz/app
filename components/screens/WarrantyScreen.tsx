/**
 * THE WARRANTY CARD - what a brand's claims desk asks for.
 *
 * Source: docs/AUTOMODZ-OS.md §2.2, §3.4, §5.5, §8.6, §9.5, §14.6, §21.6
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────
 * A film or a coat is warranted by the BRAND that made it - LLumar, Garware
 * and Kovalent on today's price list - and honouring a claim means proving
 * three things: which
 * product went on, which car it went on, and who owns that car. Until now the
 * product held all three and showed none of them together: the customer had a
 * term in a ledger and nothing they could hand to anybody.
 *
 * So this is a card, and it is deliberately the shape of one. The brand's name
 * is the Display; under it are the facts a claim is made from, in the order a
 * form asks for them - the product, the car, the owner, and the studio that
 * fitted it as installer of record.
 *
 * ── IT IS A RECORD, NOT A CONTROL ────────────────────────────────────────
 * There is nothing to press. §14.6 keeps a warranty a promise with an end, and
 * this states the end; a "claim" button would be the studio pretending to own
 * a process that belongs to the brand. The one thing that leaves is the visit
 * the work was done at, because that is the evidence behind the card.
 *
 * ── DATA ─────────────────────────────────────────────────────────────────
 * This component holds none and fetches none. Every line is worded by
 * `toWarranty`; the brand list it belongs to is the catalogue's, so a brand
 * the studio adds tomorrow gets this card without an edit here.
 *
 * And it is a SERVER component, because it has no state, no handler and no
 * motion - a card is read, not operated. The primitives it composes carry
 * their own client boundaries where they need one.
 */
import { color, space, radius, MEASURE, HAIRLINE } from '@/design';
/* DEEP, NOT THROUGH THE BARREL. This is a server component, and the barrel
   re-exports every primitive - a dozen of them `'use client'` with Radix and
   framer-motion behind them - so reaching through it would pull all of that
   into this page's bundle. See __tests__/polish/bundle. */
import { OfflineNote } from '@/components/system/OfflineNote';
import { Screen, Pane, Label, Statement, Rail, Action, Row, Value } from '@/components/os';

export interface WarrantyFact {
  label: string;
  value: string;
}

export interface WarrantyModel {
  /** "LLumar" - the Display, because the claim is made against them. */
  brand: string;
  /** "Paint protection film" */
  title: string;
  /** "Full body", where the record says. */
  covers?: string;
  /** Already worded - "Through August 2036", "For as long as you own it". */
  term: string;
  /** Whether the term still stands. A lapsed card says so rather than hiding. */
  lapsed: boolean;
  /** "Fitted 14 August 2025" */
  fitted?: string;
  /** The claim reference. */
  reference: string;
  /** The car, then the owner, then the studio - the order a claim form asks. */
  car: readonly WarrantyFact[];
  owner: readonly WarrantyFact[];
  installer: readonly WarrantyFact[];
  /** The visit that created it, where the record can point at a sealed one. */
  visitHref?: string;
  /** What the customer should know before they rely on this. */
  note: string;
}

export function WarrantyScreen({ model }: { model: WarrantyModel }) {
  const {
    brand, title, covers, term, lapsed, fitted, reference,
    car, owner, installer, visitHref, note,
  } = model;

  return (
    <Screen top={space.gap}>
      <OfflineNote />

      {/* THE CARD. The one object in the room, and the only surface here that
          is lit - champagne, because a warranty is a thing already in force and
          amber would make it ask for something (§3.3). A lapsed one keeps the
          shape and loses the light: it is still the record of what was fitted,
          which is exactly what somebody checking a date needs. */}
      <Pane
        tone={lapsed ? 'plain' : 'cool'}
        live={!lapsed}
        round={radius.sheet}
        style={{
          marginTop: space.gap,
          padding: space.gap + 6,
          display: 'flex', flexDirection: 'column', gap: space.gap + 4,
          minHeight: 176, justifyContent: 'space-between',
          ...(lapsed ? null : {
            background:
              'linear-gradient(150deg, rgba(232,217,190,0.22), rgba(224,164,92,0.09) 55%, rgba(255,255,255,0.03))',
            borderColor: 'rgba(232,217,190,0.3)',
          }),
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.line }}>
          <Statement eyebrow={title}>{brand}</Statement>
          <Label style={{ fontSize: 9, letterSpacing: '0.24em', flexShrink: 0, marginTop: 6 }}>
            Warranty
          </Label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: space.line, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            {covers ? (
              <Label style={{ fontSize: 10, letterSpacing: '0.16em' }}>{covers}</Label>
            ) : null}
            <span style={{ fontSize: 14.5, color: color.ink }}>{term}</span>
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'right' }}>
            <Label style={{ fontSize: 9, letterSpacing: '0.2em' }}>Reference</Label>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: color.ink }}>
              {reference}
            </span>
          </span>
        </div>
      </Pane>

      {fitted ? (
        <p style={{ margin: `${space.line}px 0 0`, fontSize: 13, color: color.ink3 }}>{fitted}</p>
      ) : null}

      {/* ── WHAT A CLAIM IS MADE FROM ───────────────────────────────────
          §8.6 - facts, so rows. Three groups in the order a brand's form asks
          for them, because the whole point of the card is that it can be read
          straight down while somebody fills one in. */}
      {([
        ['The car', car],
        ['The owner', owner],
        ['Fitted by', installer],
      ] as const).map(([heading, facts]) => (
        facts.length > 0 ? (
          <section
            key={heading}
            style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line }}
          >
            <h2 style={{ margin: 0 }}><Rail>{heading}</Rail></h2>
            <Pane style={{ padding: `${space.hair}px ${space.gap + 2}px` }}>
              {facts.map((f, i) => (
                <Row key={f.label} last={i === facts.length - 1} value={<Value>{f.value}</Value>}>
                  {f.label}
                </Row>
              ))}
            </Pane>
          </section>
        ) : null
      ))}

      {/* THE EVIDENCE BEHIND THE CARD. Offered only where the visit sealed -
          a reconstructed promise has no chapter to open, and a link to a page
          that does not exist is worse than no link (§10.5). */}
      {visitHref ? (
        <div style={{ marginTop: space.rest / 2 }}>
          <Action href={visitHref} quiet style={{ fontSize: 14 }}>The visit it was fitted at</Action>
        </div>
      ) : null}

      <p
        style={{
          marginTop: space.rest / 2, marginBottom: 0,
          fontSize: 12.5, lineHeight: 1.6, color: color.ink3,
          maxWidth: MEASURE,
          paddingTop: space.line,
          borderTop: `${HAIRLINE}px solid ${color.edge}`,
        }}
      >
        {note}
      </p>
    </Screen>
  );
}
