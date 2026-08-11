'use client';
/**
 * THE CAR
 *
 * Source: docs/AUTOMODZ-OS.md §2.1, §3.1, §3.2, §4.3, §5.5, §11.2, §11.3,
 *         §11.4, §11.5, §14.2, §14.4, §14.6, §17.1, §17.3, §18.4, §21.1,
 *         §21.5, §21.6
 *         design "AutoModz App.dc.html" — screen 1d
 *
 * ── WHAT THIS SCREEN IS ──────────────────────────────────────────────────
 * §2.1 — the car is the subject of the product, and this is the one room
 * where it is the subject of the screen too. The design opens on the
 * photograph at half the height of the display, with nothing over it but the
 * plate, the name and one line of description, and then states, in order:
 *
 *   the protection ledger — every layer, as a proportion of its term
 *   what the studio stands behind, and how far the car has gone
 *   the album
 *
 * That order is the answer to "how is my car", asked from most permanent to
 * most recent. Nothing on this screen is a control except the album, the
 * notice and the one action at the foot.
 *
 * ── THE PHOTOGRAPH IS NOT DRAWN HERE ─────────────────────────────────────
 * §11.3 — a `VehicleRendering` is handed in. This screen never imports
 * `next/image`, never positions a mark, and never learns what medium is
 * showing the car. See components/vehicle/renderer.ts for why that boundary
 * is drawn where it is; the design changed the composition around the
 * photograph and changed nothing about it.
 *
 * ── DATA ─────────────────────────────────────────────────────────────────
 * This component holds none and fetches none.
 */
import { useState } from 'react';
import Link from 'next/link';
import { color, space, INSET, MEASURE, radius, stack, TARGET_MIN } from '@/design';
import type { StateTone } from '@/design';
import type { RegionId, VehicleRendering } from '@/components/vehicle';
import { REGION_NAME } from '@/components/vehicle';
import { OfflineNote } from '@/components/system';
import { Back } from '@/components/os/RoomHeader';
import {
  Pane, Label, Rail, Pulse, Chevron, Meter, Action, Stat,
} from '@/components/os';

/* ── What the car needs to be true ───────────────────────────────────── */

export interface VehicleProtection {
  id: string;
  /** §11.4 — where on the car it is, when the medium can locate it. */
  region?: RegionId;
  label: string;
  tone: StateTone;
  /** Already worded at the precision that is honest (§14.3, §14.4). */
  term: string;
  /**
   * 0–1 of the term still to run. The design draws every layer as a
   * proportion; a layer that does not deplete (perpetual, or a term with no
   * recorded start) carries no bar and states its term alone.
   */
  remaining?: number;
  /**
   * IS `remaining` A MEASUREMENT OR A CATEGORY?
   *
   * `measured` — a real fraction between a recorded `since` and a dated term.
   * `estimated` — no trustworthy start date, so the engine falls back to a
   * health bucket (0.8 / 0.2 / 0.05 / 0). Eight legacy protections are in that
   * state and no date may be invented for them.
   *
   * Carried so no surface can imply a bucketed 0.8 was measured. What each
   * screen does with it is a design decision this model does not make.
   */
  measurement?: 'measured' | 'estimated';
  /** §14.6 — the file, where one exists. */
  documentHref?: string;
}

export interface VehicleFrame {
  id: string;
  url: string;
  caption?: string;
  visitHref?: string;
}

export interface VehicleMediaMonth {
  month: string;
  frames: VehicleFrame[];
}

export interface VehicleModel {
  name: string;
  plate: string;
  /** "Phantom Black · Hatchback · 2023", from what the owner has told us. */
  descriptor?: string;
  state: string;
  since: string;
  /** §14.6 — the furthest date the studio stands behind, already worded. */
  warranty?: string;
  /** The owner's own number, grouped for reading. Absent until they give it. */
  odometer?: string;
  historyHref: string;
  protections: readonly VehicleProtection[];
  notice?: { id: string; title: string; href: string };
  media: readonly VehicleMediaMonth[];
  editHref: string;
  declareHref?: string;
  next?: {
    service: string;
    when: string;
    settled: boolean;
    manageHref?: string;
  };
  followHref?: string;
  arrangeHref: string;
}

/** §3.3 — the state's own tone. One warm family, and nothing else. */
const TONE: Record<StateTone, string> = {
  assent: color.champagne,
  caution: color.amber,
  urgent: color.urgent,
  lapsed: color.ink3,
};

export function VehicleScreen(
  { model, rendering }: { model: VehicleModel; rendering: VehicleRendering },
) {
  const {
    name, plate, descriptor, state, since, warranty, odometer, historyHref,
    protections, notice, media, editHref, declareHref, next, followHref, arrangeHref,
  } = model;

  /* §11.4 — which region the customer is asking about. `null` is the resting
     state and the only state the screen has to be whole in, because a medium
     that cannot locate its regions never leaves it. */
  const [focus, setFocus] = useState<RegionId | null>(null);

  const frames = media.reduce((n, m) => n + m.frames.length, 0);

  return (
    <main
      style={{
        position: 'relative',
        minHeight: '100svh',
        paddingBottom: stack.contentFloor,
        background: 'transparent',
      }}
    >
      <OfflineNote />

      {/* The car is walked toward FROM the collection (§12.2), so the
          collection is where back leads. Over the photograph, because §11.2
          makes the photograph the largest element and a control does not get
          to push it down the screen. */}
      <div
        style={{
          position: 'absolute', zIndex: 2,
          top: `calc(${stack.top} + ${space.line}px)`, left: INSET,
        }}
      >
        <Back over />
      </div>

      {/* ── THE PHOTOGRAPH ──────────────────────────────────────────────
          §11.2 — the largest element on the screen, and the design fixes it
          at just over half the display so the ledger below is on the same
          screen as the car it describes. That co-presence is the point: this
          room is the car AND its condition, not one then the other. */}
      <section
        style={{
          position: 'relative',
          height: 'min(52svh, 440px)',
          /* The rendering fills its frame absolutely and owns everything
             inside it, so the frame needs a containing block and nothing
             else. `container-type` is what makes the renderer's cqw/cqh
             units resolve against this box. */
          containerType: 'size',
          overflow: 'hidden',
        }}
      >
        <rendering.Surface
          focus={focus}
          priority
          mark={region => (
            <button
              type="button"
              aria-label={`${REGION_NAME[region.id]} — ${
                protections.find(p => p.region === region.id)?.term ?? 'no record'
              }`}
              aria-pressed={focus === region.id}
              onClick={() => setFocus(focus === region.id ? null : region.id)}
              className="am-tap"
              style={{
                minWidth: TARGET_MIN, minHeight: TARGET_MIN,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 9, height: 9, borderRadius: '50%',
                  background: color.amber,
                  boxShadow: '0 0 14px 3px rgba(224,164,92,0.5)',
                }}
              />
            </button>
          )}
        />

        {/* §21.1 — the scrim, top and bottom. The words below are `over`. */}
        <span
          aria-hidden
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background:
              'linear-gradient(180deg, rgba(8,9,10,0.7), rgba(8,9,10,0.05) 40%, ${color.paper} 98%)',
          }}
        />

        {/* Identity, over the photograph. §5.5 — the plate is identity, not
            jargon, so it is set in mono and named first. */}
        <div
          style={{
            position: 'absolute', left: INSET, right: INSET, bottom: space.gap,
            display: 'flex', flexDirection: 'column', gap: 6, maxWidth: MEASURE,
          }}
        >
          <Label style={{ color: 'rgba(232,217,190,0.7)' }}>{plate}</Label>
          <h1 className="am-display" style={{ margin: 0, fontSize: 34, letterSpacing: '-0.02em' }}>
            {name}
          </h1>
          {descriptor ? (
            <span style={{ fontSize: 13.5, color: color.over2 }}>{descriptor}</span>
          ) : null}
        </div>
      </section>

      <div
        style={{
          paddingInline: INSET,
          maxWidth: MEASURE + INSET * 2,
          marginInline: 'auto',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: space.line,
          marginTop: space.gap,
        }}
      >
        {/* ── WHAT IS HAPPENING TO IT ─────────────────────────────────
            §5.3 #2 — the present tense, always. The car's own room saying
            nothing about the car's state while it sits at rest was the exact
            silence §11.1 exists to prevent; only the WAY IN to the live
            account is conditional, never the state itself.

            §5.4 — the live visit is a takeover reached from the car, so while
            there is one this pane is lit, breathing and pressable. */}
        <Pane
          tone={followHref ? 'lit' : 'plain'}
          live={Boolean(followHref)}
          as={followHref ? Link : 'div'}
          {...(followHref ? { href: followHref } : {})}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: space.line, padding: `${space.gap}px ${space.gap + 2}px`,
            textDecoration: 'none',
          }}
        >
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 14, color: color.ink }}>{state}</span>
            {followHref ? (
              <Label style={{ letterSpacing: '0.16em', fontSize: 10 }}>Follow the visit</Label>
            ) : null}
          </span>
          {followHref ? <Pulse /> : null}
        </Pane>

        {/* §17.1 — the car IS the inbox. One unread thing, as a doorway to
            the object it is about (§17.3). Never a feed, never a count. */}
        {notice ? (
          <Pane
            tone="warm"
            as={Link}
            {...{ href: notice.href }}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: space.line, padding: `${space.gap}px ${space.gap + 2}px`,
              textDecoration: 'none',
            }}
          >
            <span style={{ fontSize: 13.5, color: color.ink }}>{notice.title}</span>
            <Chevron />
          </Pane>
        ) : null}

        {/* ── THE PROTECTION LEDGER ───────────────────────────────────
            §14.2 — every layer, in the customer's words, as a proportion of
            its own term. One pane, because these are one fact about the car
            rather than several facts of the same kind (§10.2).

            The bar is drawn only where the term actually depletes. A
            perpetual protection with a full bar would be a lie shaped like a
            measurement; it states its term and nothing more. */}
        {protections.length > 0 ? (
          <Pane
            as="section"
            aria-labelledby="veh-ledger"
            style={{
              padding: `${space.gap + 2}px ${space.gap + 4}px`,
              display: 'flex', flexDirection: 'column', gap: space.gap - 2,
            }}
          >
            <h2 id="veh-ledger" style={{ margin: 0 }}>
              <Label style={{ fontSize: 9.5, letterSpacing: '0.24em' }}>What protects it</Label>
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: space.line }}>
              {protections.map(p => {
                const value = (
                  <>
                    {p.term}
                    {p.documentHref ? (
                      <>
                        {' '}
                        <Link
                          href={p.documentHref}
                          style={{ color: 'inherit', textDecoration: 'underline' }}
                        >
                          The original
                        </Link>
                      </>
                    ) : null}
                  </>
                );

                return typeof p.remaining === 'number' ? (
                  <Meter
                    key={p.id}
                    label={p.label}
                    value={value}
                    fill={p.remaining}
                    tone={TONE[p.tone]}
                  />
                ) : (
                  <div
                    key={p.id}
                    style={{
                      flexWrap: 'wrap',
                      display: 'flex', justifyContent: 'space-between',
                      gap: space.line, fontSize: 13.5,
                    }}
                  >
                    <span style={{ color: color.ink }}>{p.label}</span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)', color: TONE[p.tone],
                        marginLeft: 'auto', textAlign: 'right', overflowWrap: 'anywhere',
                      }}
                    >
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>
          </Pane>
        ) : declareHref ? (
          /* §18.4 — a car with nothing recorded is invited to say what
             protects it, rather than shown an empty ledger. */
          <Pane style={{ padding: `${space.gap + 2}px ${space.gap + 4}px` }}>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: color.ink2 }}>
              Nothing declared yet. If this car has a coating, a film or a policy
              from elsewhere, tell us and it will sit here.
            </p>
            <div style={{ marginTop: space.line }}>
              <Action href={declareHref} quiet style={{ fontSize: 13.5 }}>
                Tell us what protects it
              </Action>
            </div>
          </Pane>
        ) : null}

        {/* ── THE TWO STANDING FIGURES ────────────────────────────────
            Warranty and odometer. Either may be absent — a car with neither
            draws no row at all rather than two tiles of dashes. */}
        {warranty || odometer ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: warranty && odometer ? '1fr 1fr' : '1fr',
              gap: space.line,
            }}
          >
            {warranty ? (
              <Pane style={{ padding: space.gap }}>
                <Stat label="Warranty">
                  <span style={{ fontSize: 15 }}>{warranty}</span>
                </Stat>
              </Pane>
            ) : null}
            {odometer ? (
              <Pane style={{ padding: space.gap }}>
                <Stat label="Odometer">
                  <span style={{ fontSize: 15 }}>{odometer}</span>
                </Stat>
              </Pane>
            ) : null}
          </div>
        ) : null}

        {/* ── THE ALBUM ───────────────────────────────────────────────
            One line: how much of this car's life the studio has photographed,
            and the way into it. §4.3 — depth of one. */}
        <Pane
          as={Link}
          {...{ href: historyHref }}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: space.line, padding: `${space.gap}px ${space.gap + 2}px`,
            textDecoration: 'none',
          }}
        >
          <span style={{ fontSize: 13.5, color: color.ink2 }}>
            {frames > 0
              ? `Its history · ${frames} photograph${frames === 1 ? '' : 's'} across ${media.length} month${media.length === 1 ? '' : 's'}`
              : 'Its history · nothing photographed yet'}
          </span>
          <Chevron />
        </Pane>

        {/* ── WHAT IS COMING ──────────────────────────────────────────
            §16 — pending is not the same promise as confirmed, and a customer
            waiting on the studio is told they are waiting. */}
        {next ? (
          <Pane
            as={next.manageHref ? Link : 'div'}
            {...(next.manageHref ? { href: next.manageHref } : {})}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: space.line, padding: `${space.gap}px ${space.gap + 2}px`,
              textDecoration: 'none',
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 14.5, color: color.ink }}>{next.service}</span>
              <Label style={{ letterSpacing: '0.14em', fontSize: 10 }}>
                {next.when} · {next.settled ? 'Confirmed' : 'Awaiting the studio'}
              </Label>
            </span>
            {next.manageHref ? <Chevron /> : null}
          </Pane>
        ) : !followHref ? (
          /* §18.1 — nothing booked is an invitation, and the invitation IS the
             act: a line saying "nothing booked" with no way to book one is the
             product noticing a gap and leaving it. */
          <Pane
            tone="warm"
            as={Link}
            {...{ href: arrangeHref }}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: space.line, padding: `${space.gap}px ${space.gap + 2}px`,
              textDecoration: 'none',
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 14.5, color: color.ink }}>Nothing booked</span>
              <Label style={{ letterSpacing: '0.14em', fontSize: 10 }}>Arrange a visit</Label>
            </span>
            <Chevron />
          </Pane>
        ) : null}

        {/* ── THE RELATIONSHIP, AND THE TWO QUIET CONTROLS ────────────
            §2.1 — time with the studio, never a tally of transactions. */}
        <section
          aria-labelledby="veh-more"
          style={{ marginTop: space.gap, display: 'flex', flexDirection: 'column', gap: space.line }}
        >
          <h2 id="veh-more" style={{ margin: 0 }}><Rail>{since}</Rail></h2>
          <div style={{ display: 'flex', gap: space.breath }}>
            {!followHref ? (
              <Action href={arrangeHref} style={{ fontSize: 14 }}>Arrange a visit</Action>
            ) : null}
            <Action href={editHref} quiet style={{ fontSize: 14 }}>Correct the car</Action>
          </div>
        </section>

        {/* ── THE MEDIA, MONTH BY MONTH ───────────────────────────────
            The car's own life, in the order it happened. Each frame is a link
            into the visit it came from where the visit is known. */}
        {media.map(month => (
          <section
            key={month.month}
            aria-label={month.month}
            style={{ marginTop: space.gap, display: 'flex', flexDirection: 'column', gap: space.line }}
          >
            <Rail>{month.month}</Rail>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))',
                gap: space.breath,
              }}
            >
              {month.frames.map(f => {
                const tile = (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={f.url}
                    alt={f.caption ?? `${name}, photographed at the studio`}
                    loading="lazy"
                    style={{
                      width: '100%', aspectRatio: '1', objectFit: 'cover',
                      borderRadius: radius.chip, display: 'block',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  />
                );
                return f.visitHref ? (
                  <Link key={f.id} href={f.visitHref} className="am-tap">{tile}</Link>
                ) : (
                  <span key={f.id}>{tile}</span>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
