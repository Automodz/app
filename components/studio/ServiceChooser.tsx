'use client';
/**
 * CHOOSING THE WORK - the catalogue as a decision, not a price list.
 *
 * Source: docs/AUTOMODZ-OS.md §2.2, §3.2, §3.4, §4.3, §5.2, §6.4, §10.2,
 *         §18.1, §21.3, §21.6, §22.1, §22.2
 *
 * ── WHAT THIS REPLACES, AND WHY ──────────────────────────────────────────
 * The Studio drew every active service as one flat column: eighteen panes, six
 * of them films whose names differ by a single word ("LLumar Platinum",
 * "Garware Platinum"), each with a price beside it. A customer who had already
 * decided they wanted paint protection was asked to hold six films, two brands
 * and six warranties in their head at once and pick a row.
 *
 * That is a price list. What the studio actually sells is a decision that
 * narrows three times, and the three questions are not the same question:
 *
 *   1 WHAT DOES THE CAR NEED   film, coating, correction, or a wash
 *   2 WHOSE                    the brand standing behind it - and its warranty
 *   3 WHICH OF THEIRS          the tier, which is what the price is FOR
 *
 * Asked one at a time, each step holds two to six choices that differ in ONE
 * dimension, which is the only kind of comparison a person can actually make.
 * §3.2 - one subject per surface; this gives each question its own.
 *
 * ── WHY A SHEET RATHER THAN THREE PAGES ──────────────────────────────────
 * §4.3 allows a depth of one. Choosing is not a place a customer arrives at,
 * it is something they are in the middle of - and a wrong turn at step two has
 * to cost one tap, not a page load and a back button. The sheet is that: the
 * studio stays visible behind it, and every step is still ADDRESSABLE (§6.4),
 * because the room above owns `?choose=` and `?brand=` and hands the position
 * down. A link to "the LLumar films" is a real link.
 *
 * ── THE UNBRANDED HALF IS THE SAME MODEL, ONE STEP SHORTER ───────────────
 * Detailing and washing carry no brand: the studio's own hands are what stands
 * behind them, and inventing a house brand to fill step 2 would be a step that
 * asks nothing. They go discipline → service, in this same sheet, with the same
 * shapes - so the product has ONE way of choosing work rather than a chooser
 * for films and a list for everything else (§22.2).
 *
 * A discipline with exactly ONE brand skips step 2 for the same reason and
 * names the brand at the head of step 3 instead. Kovalent is not hidden; it is
 * simply not a question when it is the only answer.
 *
 * ── WHY THE DISCIPLINES ARE DRAWN AND NOT PHOTOGRAPHED ───────────────────
 * The obvious composition is four photographs, and the studio has four - one
 * per discipline, its own, and good ones. Every one of them has a person in it
 * with their face to the camera. §2.2 forbids naming an individual on a
 * customer surface, and a face names someone far louder than text does, so
 * this room's own rule is that no photograph on it may contain a person.
 *
 * The marks below are therefore drawn, in the one language every other mark in
 * the customer product is drawn in: a single 1.4px stroke on a 24 grid,
 * `currentColor` throughout. They are the things themselves - film over a
 * nose, a bead standing on a panel, the polisher, foam - not an icon set.
 *
 * ── NOTHING HERE DECIDES ANYTHING ────────────────────────────────────────
 * Every word, price and address on this sheet is built by the projection and
 * rendered here unchanged. §22.1 - money is the server's; ARCHITECTURE §1 - a
 * renderer builds no addresses. This file decides which step to draw, and
 * nothing else.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  color, space, INSET, MEASURE, radius, TARGET_MIN, HAIRLINE, DOT,
} from '@/design';
import { BottomSheet } from '@/components/system';
import { Pane, Label, Chevron, DISPLAY } from '@/components/os';

/* ── What the chooser needs to be true ───────────────────────────────────
   Three nested shapes, worded by `toStudio`. They are declared here rather
   than in the projection because this sheet is what they describe - the same
   arrangement `CarriedEstimate` has with the booking flow. */

export interface ChooserProduct {
  id: string;
  name: string;
  /** "from ₹1,45,000" - a floor, said as one. The server prices the real work. */
  from: string;
  /** What it is, in the studio's words. */
  description?: string;
  /** "5 years", "Lifetime" - the film's own cover, which is half the choice. */
  warranty?: string;
  /** "2 days in the studio" - the fact an owner actually plans around. */
  away?: string;
  /** The studio's own recommendation. At most one per brand (§3.2). */
  popular?: boolean;
  /** Where choosing it goes - the scope screen. Built by the resolver. */
  href?: string;
}

export interface ChooserBrand {
  /** The brand's own name, and the key `?brand=` carries. */
  id: string;
  name: string;
  /** "Three films · 5 to 12 years" - what choosing this brand commits to. */
  line: string;
  /** "from ₹1,45,000" */
  from: string;
  products: ChooserProduct[];
}

export interface ChooserDiscipline {
  /** The catalogue's category - the key `?choose=` carries. */
  id: string;
  name: string;
  /** The one line under the name. */
  line: string;
  /** "from ₹85,000" */
  from: string;
  /** "Six films · Two brands" */
  count: string;
  /**
   * Whether somebody else's name stands behind this work. False for the
   * disciplines the studio does with its own hands, and the difference is
   * visible: an unbranded discipline goes straight to its services.
   */
  branded: boolean;
  /** The studio's question at step 2, where this discipline has one. */
  askBrand?: string;
  /** The studio's question at step 3 - "Which film", "Which wash". */
  askProduct: string;
  brands: ChooserBrand[];
}

/* ── THE FOUR MARKS ──────────────────────────────────────────────────────
   One 1.4px stroke on a 24 grid, `currentColor`, drawn - see the note above
   for why these are not the studio's photographs. Keyed by the catalogue's
   own category so a fifth discipline cannot silently render nothing. */
const MARK: Record<string, ReactNode> = {
  /* PPF - film laid over the nose of a car: the panel, and the film's own
     edge following it a little inside. */
  PPF: (
    <>
      <path d="M12 3.4l7 2.6v6c0 3.9-2.9 6.9-7 7.7-4.1-.8-7-3.8-7-7.7V6z" />
      <path d="M12 6.8l3.9 1.5v3.5c0 2.2-1.6 3.9-3.9 4.4" />
    </>
  ),
  /* Ceramic - a bead standing on a panel, which is the whole promise. */
  Ceramic: (
    <>
      <path d="M12 4.4c2.5 3 4.3 5.1 4.3 7.2a4.3 4.3 0 11-8.6 0c0-2.1 1.8-4.2 4.3-7.2z" />
      <path d="M4 19.6h16" />
    </>
  ),
  /* Detailing - the polisher resting on a panel, pad and all. */
  Coating: (
    <>
      <circle cx="10" cy="10.4" r="4.6" />
      <circle cx="10" cy="10.4" r="1.7" />
      <path d="M13.5 7.1l3.5-3.5" />
      <path d="M4 19.6h16" />
    </>
  ),
  /* Wash - foam over a panel, and the water coming down onto it. */
  Washing: (
    <>
      <path d="M4 19.6h16" />
      <circle cx="8.6" cy="13" r="2.5" />
      <circle cx="13.7" cy="11.2" r="3.3" />
      <circle cx="17.8" cy="14" r="1.9" />
      <path d="M6.8 6.6v2M12 4.4v2.2M17.4 7v1.8" />
    </>
  ),
};

/** A discipline the catalogue carries but this file has no mark for. */
const FALLBACK_MARK = MARK.Coating;

export function DisciplineMark({ id, size = 22 }: { id: string; size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" aria-hidden
      fill="none" stroke="currentColor" strokeWidth={1.4}
      strokeLinecap="round" strokeLinejoin="round"
    >
      {MARK[id] ?? FALLBACK_MARK}
    </svg>
  );
}

/**
 * ONE DISCIPLINE, AS A DOOR.
 *
 * Drawn identically on the Studio itself and as step 1 of this sheet, because
 * they are the same choice arrived at two ways - from the room, and from the
 * top of the chooser. §22.2: one implementation, so the two cannot drift.
 */
export function DisciplineCard(
  { discipline, onChoose, lit = false }:
  { discipline: ChooserDiscipline; onChoose: (id: string) => void; lit?: boolean },
) {
  const d = discipline;
  return (
    <Pane
      tone={lit ? 'warm' : 'plain'}
      as="button"
      type="button"
      onClick={() => onChoose(d.id)}
      className="am-tap"
      style={{
        padding: `${space.gap + 2}px ${space.gap + 3}px`,
        display: 'flex', alignItems: 'flex-start', gap: space.gap,
        width: '100%', textAlign: 'left', font: 'inherit', cursor: 'pointer',
      }}
    >
      {/* The mark, held in its own round of light. §3.4 - light is the
          ornament, so the medallion is a glow rather than a filled chip.
          Aligned to the NAME rather than centred on the block: the card grows
          by a line whenever a description wraps, and a mark that floats down
          with it stops reading as belonging to the title. */}
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: TARGET_MIN, height: TARGET_MIN,
          borderRadius: radius.pill,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `${HAIRLINE}px solid rgba(232,217,190,0.16)`,
          background: 'radial-gradient(circle at 50% 30%, rgba(224,164,92,0.20), rgba(224,164,92,0.04))',
          color: lit ? color.amberHot : color.champagne,
        }}
      >
        <DisciplineMark id={d.id} />
      </span>

      <span style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 16.5, color: color.ink }}>{d.name}</span>
        <span style={{ fontSize: 13, lineHeight: 1.5, color: color.ink3 }}>{d.line}</span>
        <Label style={{ fontSize: 9, letterSpacing: '0.18em', marginTop: 1 }}>
          {[d.count, d.from].filter(Boolean).join(DOT)}
        </Label>
      </span>

      {/* Centred against the whole card while the mark holds the title line -
          the chevron is about the card, not about the name. */}
      <span style={{ alignSelf: 'center', display: 'flex', flexShrink: 0 }}>
        <Chevron size={17} />
      </span>
    </Pane>
  );
}

export interface ServiceChooserProps {
  open: boolean;
  disciplines: readonly ChooserDiscipline[];
  /** How far the customer has got. Held in the address by the room above. */
  category: string | null;
  brand: string | null;
  onCategory: (category: string | null) => void;
  onBrand: (brand: string | null) => void;
  onClose: () => void;
  /**
   * The way on for a catalogue entry with no scope screen behind it - a
   * customer with an empty garage has no car to be quoted for. §10.5: the way
   * out is a control, and the booking sheet is where a car gets added.
   */
  onArrange: () => void;
}

export function ServiceChooser({
  open, disciplines, category, brand, onCategory, onBrand, onClose, onArrange,
}: ServiceChooserProps) {
  const discipline = disciplines.find(d => d.id === category) ?? null;
  const brands = discipline?.brands ?? [];

  /* ONE BRAND IS NOT A QUESTION - it is named at the head of step 3 instead. */
  const only = brands.length === 1 ? brands[0] : null;
  const chosen = brands.find(b => b.id === brand) ?? only ?? null;

  const step: 'discipline' | 'brand' | 'product' =
    !discipline ? 'discipline' : !chosen ? 'brand' : 'product';

  /* THE WAY BACK IS THE WAY IN, REVERSED. From the products of a studio's only
     brand there is no brand step to return to, so it returns a step further -
     a back control that lands on a screen the customer never saw is worse than
     no back control at all. */
  const stepBack = step === 'product'
    ? () => (only ? onCategory(null) : onBrand(null))
    : step === 'brand'
      ? () => onCategory(null)
      : null;

  const backName = step === 'product' && !only
    ? (discipline?.name ?? 'All the work')
    : 'All the work';

  const asked = step === 'discipline'
    ? 'What does it need?'
    : step === 'brand'
      ? `${discipline?.askBrand ?? 'Which brand'}?`
      : `${discipline?.askProduct ?? 'Which one'}?`;

  const path = [discipline?.name, only ? null : chosen?.name]
    .filter(Boolean).join(DOT) || 'The studio';

  return (
    <BottomSheet open={open} onClose={onClose} label="Choose the work">
      <div
        style={{
          paddingInline: INSET, maxWidth: MEASURE + INSET * 2,
          marginInline: 'auto', width: '100%',
        }}
      >
        {/* WHERE YOU ARE, AND WHAT IS BEING ASKED. The label is the path
            already walked; the Display is the one question this step exists to
            put (§9.5 - one Display per surface, and a sheet is one). */}
        {stepBack ? (
          <button
            type="button"
            onClick={stepBack}
            className="am-tap"
            aria-label={`Back to ${backName}`}
            style={{
              display: 'flex', width: 'fit-content', alignItems: 'center',
              gap: space.breath, minHeight: TARGET_MIN,
              marginLeft: -space.breath, paddingInline: space.breath,
              marginBottom: space.breath,
              background: 'none', border: 'none', font: 'inherit',
              color: color.ink2, cursor: 'pointer',
            }}
          >
            <svg
              width={17} height={17} viewBox="0 0 24 24" aria-hidden
              fill="none" stroke="currentColor" strokeWidth={1.4}
              strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M15 6l-6 6 6 6" />
            </svg>
            <span style={{ fontSize: 14 }}>{backName}</span>
          </button>
        ) : null}

        <Label style={{ letterSpacing: '0.3em' }}>{path}</Label>
        <h2
          className="am-display"
          style={{ margin: `${space.hair}px 0 0`, fontSize: DISPLAY.nested }}
        >
          {asked}
        </h2>

        {/* ── STEP 1 · WHAT THE CAR NEEDS ───────────────────────────────
            The four disciplines, in the studio's own order - the same order
            and the same card the room above draws, so arriving here from
            "Arrange a visit" and arriving from the room meet one screen. */}
        {step === 'discipline' ? (
          <div style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line }}>
            {disciplines.map(d => (
              <DisciplineCard key={d.id} discipline={d} onChoose={onCategory} />
            ))}
            {disciplines.length === 0 ? (
              /* §19.1 - an absence is a state. A catalogue that has not
                 arrived is not an empty studio, and the way on is the studio
                 itself rather than a blank column. */
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: color.ink2 }}>
                The catalogue is not with us right now. Arrange a visit and
                we&rsquo;ll take it from there.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* ── STEP 2 · WHOSE ────────────────────────────────────────────
            The brands the studio actually fits, and what choosing one commits
            to. No logos: §3.4 keeps light the only ornament, and a row of
            somebody else's marks is their brand doing the talking. */}
        {step === 'brand' ? (
          <div style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line - 1 }}>
            {brands.map(b => (
              <Pane
                key={b.id}
                as="button"
                type="button"
                onClick={() => onBrand(b.id)}
                className="am-tap"
                style={{
                  padding: `${space.gap + 2}px ${space.gap + 3}px`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: space.line, width: '100%',
                  textAlign: 'left', font: 'inherit', cursor: 'pointer',
                }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                  <span style={{ fontSize: 17, color: color.ink }}>{b.name}</span>
                  <span style={{ fontSize: 13, lineHeight: 1.5, color: color.ink3 }}>{b.line}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: space.breath, flexShrink: 0 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: 12,
                      color: 'rgba(232,217,190,0.8)',
                    }}
                  >
                    {b.from}
                  </span>
                  <Chevron size={16} />
                </span>
              </Pane>
            ))}
          </div>
        ) : null}

        {/* ── STEP 3 · WHICH ONE ────────────────────────────────────────
            The tier, which is what the price is actually for. Everything that
            separates one from the next is on the pane: the cover it carries,
            how long the car is away, and what the studio says it is.
            Choosing one LEAVES the sheet for the scope screen (design 07),
            where the coverage is chosen and the server prices it. */}
        {step === 'product' && chosen ? (
          <div style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line - 1 }}>
            {/* THE BRAND, WHEN IT WAS NEVER ASKED ABOUT. Only where there IS
                one: an unbranded discipline's "brand" is its own name, and
                printing it here would say the heading twice. */}
            {only && discipline?.branded ? (
              <p style={{ margin: `0 0 ${space.breath}px`, fontSize: 13.5, lineHeight: 1.55, color: color.ink2 }}>
                {only.name} - {only.line}
              </p>
            ) : null}

            {chosen.products.map(p => (
              <Pane
                key={p.id}
                tone={p.popular ? 'warm' : 'plain'}
                as={p.href ? Link : 'button'}
                {...(p.href ? { href: p.href } : { type: 'button', onClick: onArrange })}
                className="am-tap"
                style={{
                  padding: `${space.gap + 1}px ${space.gap + 3}px`,
                  display: 'flex', flexDirection: 'column', gap: space.breath,
                  width: '100%', textAlign: 'left', font: 'inherit',
                  cursor: 'pointer', textDecoration: 'none',
                }}
              >
                <span
                  style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'baseline', gap: space.line, flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontSize: 16, color: color.ink }}>{p.name}</span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: 12,
                      marginLeft: 'auto', textAlign: 'right', overflowWrap: 'break-word',
                      color: p.popular ? color.champagne : 'rgba(232,217,190,0.8)',
                    }}
                  >
                    {p.from}
                  </span>
                </span>
                {p.description ? (
                  <span style={{ fontSize: 13, lineHeight: 1.5, color: color.ink3 }}>
                    {p.description}
                  </span>
                ) : null}
                {p.popular || p.warranty || p.away ? (
                  <Label style={{ fontSize: 9.5, letterSpacing: '0.18em' }}>
                    {[p.popular ? 'Most asked for' : null, p.warranty, p.away]
                      .filter(Boolean).join(DOT)}
                  </Label>
                ) : null}
              </Pane>
            ))}

            <p style={{ margin: `${space.breath}px 0 0`, fontSize: 12.5, lineHeight: 1.55, color: color.ink3 }}>
              Every figure is where the work starts. What your car actually
              needs is priced on the next screen, and it is final on inspection.
            </p>
          </div>
        ) : null}
      </div>
    </BottomSheet>
  );
}
