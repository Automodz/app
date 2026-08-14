/**
 * NOW - the customer's home.
 *
 * ── AND IT IS A SERVER COMPONENT AGAIN ───────────────────────────────────
 * It carried `'use client'` for one reason: the "Find" control called
 * `useOpenPalette`. That control is gone - the overflow it stood for lives in
 * `navigation/Menu`, mounted once by `CustomerChrome` - and with it went the
 * last hook, handler and animation on this screen. So the room a customer
 * opens most often now ships no JavaScript of its own.
 *
 * Source: docs/AUTOMODZ-OS.md §3.1, §3.2, §3.5, §4.5, §5.3, §9.5, §14.2,
 *         §14.4, §17.1, §20.3, §21.1, §21.6, §21.7
 *         design "AutoModz App.dc.html" - screens 1a, 1b, 1c
 *
 * ── WHAT THIS SCREEN IS ──────────────────────────────────────────────────
 * The design gives Home three directions and asks for them to be mixed. They
 * are not three layouts; they are two situations and one shared vocabulary:
 *
 *   1a  THE DIAL - the car is with us. One number: how long is left.
 *   1c  RESTING  - nothing is in the studio. One number: how much protection
 *                  is left.
 *   1b  THE FLOOR - the phases of the visit, the pair of standing figures,
 *                  the membership line. Not a third home: the parts of it
 *                  that survive are folded into 1a, where they belong.
 *
 * So this screen asks ONE question - is the car in the studio right now - and
 * everything above the fold follows from the answer. §3.2: exactly one thing
 * each surface is about.
 *
 * ── WHY THE PHOTOGRAPH LEFT HOME ─────────────────────────────────────────
 * This was a full-bleed photograph of the car with the state written over it.
 * The design replaces it with a dial, and that is not a demotion of the
 * photograph - it is the reason the Car became a dock slot (see routes.ts).
 * The car's own room (1d) opens on the photograph at the size of the screen.
 * Home is now the one question a phone gets pulled out of a pocket to answer,
 * and the answer is a number, not a picture.
 *
 * ── WHERE COLOUR IS ALLOWED ──────────────────────────────────────────────
 * §3.3, and stricter than before. Amber is the studio working: the live dial,
 * the pulse, the one action. Champagne is a thing already in force: the
 * resting dial, a term, a membership. Nothing else on this screen is coloured,
 * and no element carries a hue that is not saying one of those two things.
 *
 * ── DATA ─────────────────────────────────────────────────────────────────
 * This component holds none and fetches none.
 */
import type { CSSProperties } from 'react';
import Link from 'next/link';
import {
  color, space, MEASURE, INSET, TARGET_MIN, HAIRLINE, radius, imageSizes, ground,
} from '@/design';
import { dotted, type as typeScale } from '@/design';
import type { StateTone } from '@/design';
/* DEEP, NOT THROUGH THE BARREL. This is a server component now, and the
   barrel drags Radix and framer-motion across the boundary with it -
   measured at 35% of two pages' JavaScript. See __tests__/polish/bundle. */
import { OfflineNote } from '@/components/system/OfflineNote';
import type { Tone } from '@/components/system/tone';
import {
  Screen, Pane, Dial, Unit, Label, Rail, Pulse, Chevron, Action, Row, Value,
  Photograph, Greeting,
} from '@/components/os';

/* ── What Home needs to be true ──────────────────────────────────────────
   Unchanged from the model the projection has always produced. The design
   recomposes these facts; it does not ask for new ones, and the one number it
   needs that was not being drawn - a term's remaining fraction - was already
   in `HomeProtection.remaining` and had never been rendered. */

export interface HomeVehicle {
  name: string;
  plate: string;
  photo?: string;
}

export interface HomeState {
  /** The present tense, in one or two words (§5.3 #2). */
  word: string;
  line?: string;
  timing?: string;
  note?: string;
}

export interface HomeStudio {
  name: string;
  address: string;
  directions: string;
  call: string;
  message: string;
}

export interface HomeProtection {
  id: string;
  /** In the customer's words (§14.2). */
  label: string;
  /** Already spoken at the precision that is honest (§14.3, §14.4). */
  term: string;
  /** 0–1 of the term still to run, or absent when it does not run out. */
  remaining?: number;
  /** Whether `remaining` was measured between two dates or bucketed from a
   *  health state. See `VehicleProtection.measurement`. */
  measurement?: 'measured' | 'estimated';
  /* The state's own tone, not an arbitrary one - §3.3 keeps colour to
     information, and `StateTone` is the vocabulary of states. */
  tone: StateTone;
}

export interface HomeLiveActivity {
  title: string;
  when: string;
  note?: string;
  photo?: string;
  href: string;
}

export interface HomeTimelineEvent {
  id: string;
  title: string;
  line?: string;
  when: string;
  href?: string;
  /** Dated ahead of today - a thing coming toward the owner. */
  ahead?: boolean;
}

/**
 * SAID, NOT SHOWN.
 *
 * The heading a screen reader announces where the screen itself draws
 * something a screen reader cannot read - here, the phase bar. `display: none`
 * and `visibility: hidden` would take it out of the accessibility tree too,
 * which is the opposite of the point; this is the standard clip, and it is
 * spelled out rather than imported because the product has no other use for it.
 */
const SAID_NOT_SHOWN: CSSProperties = {
  position: 'absolute', width: 1, height: 1, margin: -1, padding: 0,
  overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', border: 0,
};

export interface HomeModel {
  /** The owner's first name, when the account has one. §2.2 permits it. */
  owner?: string;
  vehicle: HomeVehicle;
  state: HomeState;
  studio: HomeStudio;
  protections: HomeProtection[];
  liveActivity?: HomeLiveActivity;
  nextAction: { label: string; href: string };
  timeline: HomeTimelineEvent[];
  protection?: {
    headline: string;
    layers: readonly string[];
    said: string;
    tone: Tone;
    items: readonly { id: string; label: string; term: string; tone: Tone }[];
  };
  truth?: string;
  live?: {
    acts: readonly { label: string; done: boolean; current: boolean }[];
    timing?: string;
    frames: readonly { id: string; url: string; caption?: string }[];
    href: string;
  };
  /**
   * THE STUDIO'S SOONEST OPENING - design screens 03 and 05.
   *
   * Present only when the car has nothing booked and nothing in flight: a
   * customer whose visit is on Thursday does not need to be told the studio is
   * free on Thursday. It is a real query against real occupancy, and absent
   * rather than guessed when the studio cannot be reached - an invented
   * opening is a customer told to come on a day the bays are full.
   */
  nextOpening?: { line: string; href: string };
  suggestion?: { headline: string; reason: string; href: string };
  next?: { service: string; when: string; vehicleName: string; href: string };
  life?: { photo?: string; count: string; href: string };
  record: readonly { id: string; line: string; when: string }[];
  membership?: { plan: string; said: string; href: string };
  garage?: {
    cars: readonly {
      id: string; name: string; state: string; photo?: string; href: string; current: boolean;
    }[];
  };
  forSale: readonly {
    id: string; title: string; price: string; detail: string; photo?: string; href: string;
  }[];
  marketHref: string;
}

/**
 * §3.3 - a state's tone, resolved to the one light or the other. There is no
 * third hue: `lapsed` is deliberately uncoloured, because a lapsed thing is
 * a fact about the past and not an alarm.
 */
/**
 * THE PAGE'S ONE VERTICAL RHYTHM.
 *
 * Every top-level block on Home is separated by the same distance, and it was
 * being written three ways: `space.rest / 2`, `space.gap + space.breath` (the
 * same 24, spelled differently), and `space.line` - which is HALF of it, and
 * was what set the advisor pair and the life pair closer to what preceded them
 * than any other section on the screen. One name, so the rhythm is a decision
 * rather than an accident of whoever wrote the block.
 */
const SECTION = space.rest / 2;

const TONE: Record<StateTone, string> = {
  assent: color.champagne,
  caution: color.amber,
  urgent: color.urgent,
  lapsed: color.ink3,
};

export function HomeScreen({ model }: { model: HomeModel }) {
  const {
    owner, vehicle, state, truth, nextAction, live, suggestion, protection, protections,
    next, life, record, membership, garage, forSale, marketHref, studio, nextOpening,
  } = model;

  /* THE ONE QUESTION. Everything above the fold is decided by it. */
  const working = Boolean(live && live.acts.length > 0);

  /* ── THE DIAL'S NUMBER ─────────────────────────────────────────────────
     While the car is here: how far through the visit it is. The acts are the
     honest denominator - the studio publishes them, they are what the floor
     actually does, and a percentage invented from a clock would be a guess
     dressed as a measurement.

     At rest: the protection with the least of its term left, which is the one
     the owner would want to know about. §14.2. */
  const done = live ? live.acts.filter(a => a.done).length : 0;
  /**
   * HOW FAR THROUGH, COUNTING THE STAGE THE CAR IS IN.
   *
   * This was `done / acts.length`, and `done` counts only the stages already
   * finished - so a car that had just been RECEIVED, with its first stage lit
   * on the floor, read `0%`. A customer whose car is physically in the studio
   * being told nothing has happened is the reading being wrong, not blunt.
   *
   * A stage the studio is standing in has been REACHED, so it counts. Received
   * is 1 of 5; Ready, which is the last, is 5 of 5. It is also exactly what the
   * ring now draws - `done` segments lit plus the current one in amber - so the
   * number and the arc are the same statement and cannot drift apart.
   */
  const reached = live ? done + (live.acts.some(a => a.current) ? 1 : 0) : 0;
  const throughVisit = live && live.acts.length ? reached / live.acts.length : 0;

  const depleting = protections.filter(p => typeof p.remaining === 'number');
  const lead = depleting.length
    ? depleting.reduce((a, b) => ((a.remaining ?? 1) <= (b.remaining ?? 1) ? a : b))
    : undefined;

  return (
    <Screen top={space.line}>
      {/* ── OFFLINE ─────────────────────────────────────────────────────
          §20.3 - ours or theirs. Everything on this page was rendered on the
          server and is still true; only what happens NEXT is affected. */}
      <OfflineNote />

      {/* ── THE STATEMENT ───────────────────────────────────────────────
          §9.5 - the one Display on this screen, and the label above it names
          the situation the number belongs to. Lit only while work is running:
          amber is the studio, and at rest the studio is not doing anything. */}
      {/* THE FIND CONTROL IS GONE, and nothing replaced it HERE.
          It named a mechanism rather than an act (§21.8), opened a command
          palette a customer had no reason to expect, and existed on this one
          screen - so every other room's extra addresses had nowhere to live.
          They are all in `navigation/Menu`, which is mounted on every room by
          `CustomerChrome`, so this header no longer carries a control at all
          and the composition is just the statement. */}
      <header style={{ display: 'flex', flexDirection: 'column', gap: space.line }}>
        {/* WHOSE ROOM THIS IS, before what is happening in it. The screen
            opened straight onto "In the studio", which is the studio's state
            and not a greeting - so the one room a customer opens daily never
            acknowledged them. It sits ABOVE the eyebrow because it is the
            larger frame: the person first, then their car's situation. */}
        {owner ? <Greeting name={owner} /> : null}

        {/* THE STAGES LEFT THIS HEADER FOR THE RING.
            A five-segment bar naming the stages sat here, above a ring saying
            how far through them the car was - one statement in two shapes,
            stacked. The ring draws the segments now and names the one underway
            in its caption, so the header is back to what a header is: whose
            car, and what is happening to it.

            The heading is the state's word, and it is CLIPPED rather than set
            in Display type - the reading in the ring is this screen's one
            Display (§9.5), and setting the same word again above it in 46px
            type is the redundancy this whole change is removing. A screen
            reader still gets it, because a screen reader cannot read a ring. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: space.breath }}>
          <Label lit={working}>
            {working ? 'In the studio' : 'Nothing in the studio'}
          </Label>
          <h1 style={SAID_NOT_SHOWN}>{state.word}</h1>
          <span
            style={{
              fontFamily: typeScale.title.family,
              fontSize: typeScale.title.size,
              fontWeight: typeScale.title.weight,
              lineHeight: 1.25,
              color: color.ink,
            }}
          >
            {dotted(vehicle.name, vehicle.plate)}
          </span>
        </div>
      </header>

      {/* THE STATE'S OWN SENTENCE, AND ITS SECOND, QUIETER FACT.
          Both belong to the statement above and are said HERE, once. The live
          pane below carries only the TIMING, so no fact on this screen ever
          appears in two wordings - the failure this composition was rebuilt
          to prevent. §21.7 - the state changes without the customer acting,
          so it is announced politely. */}
      {state.line ? (
        <p
          aria-live="polite"
          style={{
            marginTop: space.line, marginBottom: 0,
            fontSize: 15, lineHeight: 1.6, color: color.ink2, maxWidth: MEASURE,
          }}
        >
          {state.line}
        </p>
      ) : null}

      {state.note ? (
        <p
          style={{
            marginTop: space.breath, marginBottom: 0,
            fontSize: 13.5, lineHeight: 1.55, color: color.ink3, maxWidth: MEASURE,
          }}
        >
          {state.note}
        </p>
      ) : null}

      {/* ── THE DIAL ────────────────────────────────────────────────────
          1a and 1c are the same object holding a different number. Centred,
          alone, with nothing beside it - §3.5, and the reason the number can
          be read from across a room.

          ── WHAT THE LIVE DIAL HOLDS, AND WHY IT CHANGED ─────────────────
          It held `state.timing`, and `state.timing` is a SENTENCE: the
          projection words it as "Planned finish around 5:40 pm." while a
          visit is on plan and "Running longer than planned - the work sets
          the pace." once it is not. A sentence in a number slot is 62px type
          wrapped over six lines, and on a phone it covered the car's own name
          above it and the pane below it. That was the production bug.

          The number is now the one the ring is ALREADY drawing: how far
          through the visit the floor has got. Nothing about the screen's
          composition changes - the same ring, the same fill - and three
          things become true that were not:

            · it is a measure, so it fits the slot the design drew for it
            · it is honest, because the acts are published by the studio and
              are what the floor actually does (the same denominator `fill`
              has always used), rather than a clock guessing
            · it is said exactly once. The TIMING sentence keeps its existing
              home in the pane below, where it has always been - so the fix
              adds no words to the screen and repeats none.

          §5.3 - the caption names what the number belongs to. */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: SECTION }}>
        {working ? (
          <Dial
            fill={throughVisit}
            /* THE STAGES ARE ON THE RING NOW. They were a five-segment bar in
               the header saying which stage, above a ring saying how far
               through the stages - one statement drawn twice, in two places,
               in two shapes. One object. */
            stages={live?.acts}
            /* And the caption names the stage the car is in, which is what the
               bar's lit segment was for. "through the visit" said nothing the
               ring was not already saying. */
            caption={live?.acts.find(a => a.current)?.label ?? state.word}
            label={
              `${state.word}. ${Math.round(throughVisit * 100)} percent through the visit`
              + `${state.timing ?? live?.timing ? `. ${state.timing ?? live?.timing}` : ''}`
            }
            size={250}
          >
            {Math.round(throughVisit * 100)}<Unit>%</Unit>
          </Dial>
        ) : (
          <Dial
            fill={lead?.remaining ?? 1}
            stroke="champagne"
            ticks
            size={262}
            caption={lead ? lead.label : 'protected'}
            label={
              lead
                ? `${lead.label}, ${Math.round((lead.remaining ?? 0) * 100)} percent of its term remaining`
                : state.word
            }
          >
            {lead
              ? <>{Math.round((lead.remaining ?? 0) * 100)}<Unit>%</Unit></>
              : state.word}
          </Dial>
        )}
      </div>

      {/* ── WHAT IS HAPPENING, IN ONE LINE ──────────────────────────────
          The live pane, and the only surface in the product that carries the
          sweep. §17.1 - the pulse IS the notification; there is no badge and
          no count anywhere on this screen.

          At rest this same slot carries `truth`: the one sentence the studio
          has to say about the car when it is not doing anything to it. */}
      {/* DRAWN ONLY WHEN IT HAS SOMETHING OF ITS OWN.
          Its title was "Follow the visit" - the exact words of the one action
          below, pointing at the same address. The timing is the fact only this
          pane holds, so it leads; and when there is no timing the pane has
          nothing left to say that the eyebrow, the phases and the action have
          not already said, so it is not drawn. §4.4 - a fact is said once. The
          pane is `lit`, never `warm`, so §10.4's one filled control per screen
          is untouched either way. */}
      {working && live && (live.timing ?? state.timing) ? (
        <Pane
          tone="lit" live
          as={Link}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: space.line, padding: `${space.gap}px ${space.gap + 2}px`,
            marginTop: SECTION, textDecoration: 'none',
          }}
          {...{ href: live.href }}
        >
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 14, color: color.ink }}>
              {live.timing ?? state.timing}
            </span>
            <Label style={{ letterSpacing: '0.16em', fontSize: 10 }}>
              In the studio
            </Label>
          </span>
          <Pulse />
        </Pane>
      ) : truth ? (
        <p
          style={{
            marginTop: SECTION, marginBottom: 0,
            fontSize: 15, lineHeight: 1.6, color: color.ink2, maxWidth: MEASURE,
          }}
        >
          {truth}
        </p>
      ) : null}

      {/* ── THE PHASES ──────────────────────────────────────────────────
          1b's progress strip. Four segments of hairline, lit as far as the
          floor has got. It says the same thing the dial does and says it as a
          shape rather than a number, which is what makes the pair readable at
          a glance - and it is the only place the acts are NAMED. */}
      {/* ── THE PHOTOGRAPHS, AS THEY ARE TAKEN ──────────────────────────
          While the car is here, the evidence belongs on Home. §13.2 makes the
          live account a takeover reached from here - but a customer should
          not have to open it to see that a photograph arrived. The strip is
          the reason to open it, and it is drawn ONLY while work is running:
          the moment the visit ends it is the album's, not Home's. */}
      {working && live && live.frames.length > 0 ? (
        <div
          className="no-scrollbar"
          style={{
            display: 'flex', gap: space.breath, overflowX: 'auto',
            marginInline: -INSET, paddingInline: INSET,
            paddingTop: space.line, paddingBottom: space.breath,
          }}
        >
          {live.frames.map(f => (
            /* THE FRAME IS THE FRAME, WHETHER OR NOT THE PHOTOGRAPH ARRIVES.
               A photograph that 404s used to collapse the `<img>` to its alt
               text, so the strip became three broken-image glyphs with the
               words "On arrival" and "In care" spilling out beside them at
               body size - visible on the production screenshot this was
               reported from. The size now belongs to the FRAME rather than to
               the image inside it, and the frame carries §11.5's composed
               absence, so a missing photograph is a quiet empty plate and
               never rearranges anything around it. */
            <Link
              key={f.id}
              href={live.href}
              className="am-tap"
              style={{
                /* POSITIONED, BECAUSE THE PHOTOGRAPH INSIDE IS NOT.
                   `Photograph` fills its frame with `position: absolute;
                   inset: 0`, which anchors to the nearest POSITIONED ancestor.
                   This frame had none, so the photograph climbed past it to the
                   initial containing block and covered the whole screen -
                   upscaled from the 104px source `sizes` had asked for, so it
                   arrived as a blurred wallpaper painted over the room. */
                position: 'relative',
                flex: '0 0 auto', width: 104, height: 104,
                borderRadius: radius.chip, overflow: 'hidden',
                textDecoration: 'none', background: ground.awaiting,
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              {/* THROUGH THE PRIMITIVE. This hid a failed photograph with an
                  `onError` that set `visibility: hidden` - which works, and
                  was a fourth implementation of a rule the product already
                  owns in one place. `Photograph` composes the absence, SAYS
                  the failure rather than hiding it, and keeps the alt text out
                  of the layout in all three states. */}
              <Photograph
                src={f.url}
                alt={f.caption ?? `${vehicle.name} in the studio`}
                sizes="104px"
                radius={radius.chip}
              />
            </Link>
          ))}
        </div>
      ) : null}

      {/* ── ADVISOR & CONCIERGE ─────────────────────────────────────────
          The pair of small panes from 1a. Two different kinds of sentence and
          the design keeps them side by side: what the studio thinks the car
          will need, and what has already been arranged. Either may be absent,
          and a single surviving pane simply takes the width. */}
      {suggestion || next ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: suggestion && next ? '1fr 1fr' : '1fr',
            gap: space.line,
            marginTop: SECTION,
          }}
        >
          {suggestion ? (
            <Pane
              as={Link}
              {...{ href: suggestion.href }}
              style={{
                display: 'flex', flexDirection: 'column', gap: space.breath,
                padding: `${space.gap - 1}px ${space.gap}px`, textDecoration: 'none',
              }}
            >
              <Label style={{ fontSize: 9.5, letterSpacing: '0.2em' }}>Advisor</Label>
              <span style={{ fontSize: 13.5, lineHeight: 1.45, color: color.ink }}>
                {suggestion.headline}
              </span>
              <span style={{ fontSize: 12.5, lineHeight: 1.45, color: color.ink3 }}>
                {suggestion.reason}
              </span>
            </Pane>
          ) : null}

          {next ? (
            <Pane
              as={Link}
              {...{ href: next.href }}
              style={{
                display: 'flex', flexDirection: 'column', gap: space.breath,
                padding: `${space.gap - 1}px ${space.gap}px`, textDecoration: 'none',
              }}
            >
              <Label style={{ fontSize: 9.5, letterSpacing: '0.2em' }}>Concierge</Label>
              <span style={{ fontSize: 13.5, lineHeight: 1.45, color: color.ink }}>
                {next.service}
              </span>
              <span style={{ fontSize: 12.5, lineHeight: 1.45, color: color.ink3 }}>
                {next.when} · {next.vehicleName}
              </span>
            </Pane>
          ) : null}
        </div>
      ) : null}

      {/* ── WHAT IS PROTECTING IT ───────────────────────────────────────
          1c's rows: the layer, and the honest word for how long it has left.
          §14.4 - the term is already worded by the projection, so nothing
          here decides when a countdown becomes a date.

          Suppressed while the car is in the studio: one subject at a time
          (§3.2), and during a visit the subject is the visit. */}
      {!working && protections.length > 0 ? (
        <section
          aria-labelledby="home-protection"
          style={{ marginTop: SECTION, display: 'flex', flexDirection: 'column', gap: space.line }}
        >
          <h2 id="home-protection" style={{ margin: 0 }}>
            <Rail>{protection?.headline ?? 'Protection'}</Rail>
          </h2>

          {/* THE LAYERS ARE NO LONGER BEHIND A TAP.
              Home used to disclose them inside a `<details>`, on the argument
              that a glance should not be a reading exercise. The design's
              resting screen is a dial and two rows, and that is the better
              answer to the same worry: the DIAL is the glance, so the rows
              underneath it are already supporting detail and cost nothing to
              leave open. A disclosure control on two rows is more interface
              than the rows it hides. */}
          {protection ? (
            <p style={{ margin: 0, fontSize: 13, color: color.ink3 }}>
              {dotted(...protection.layers, protection.said)}
            </p>
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: space.breath + 2 }}>
            {protections.map(p => (
              <Pane
                key={p.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: space.line, padding: `${space.line + 3}px ${space.gap + 2}px`,
                }}
              >
                <span style={{ fontSize: 14, color: color.ink }}>{p.label}</span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    color: TONE[p.tone],
                    /* Yields rather than crushing the layer's name beside it -
                       see `Value` in components/os/parts. "Paint protection
                       film" against "Through November 2027" is the same
                       collision the booking had. */
                    marginLeft: 'auto', textAlign: 'right', overflowWrap: 'break-word',
                  }}
                >
                  {p.term}
                </span>
              </Pane>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── THE ONE ACTION ──────────────────────────────────────────────
          §6.3. Filled with light, because it is the only thing on the screen
          that commits to anything. In 1c it carries the next opening under
          its own label; here that line is the studio's, and it is only shown
          when the model has one to give. */}
      <Pane
        tone="warm"
        as={Link}
        {...{ href: nextAction.href }}
        style={{
          /* ONE ROW, AT THE TAP-TARGET FLOOR - the same shape as the rating
             strip on the landing. It was a stacked label over a mono line
             inside `space.gap + 2` padding, which made the single control on
             the screen a block about eighty pixels deep. Laid along one line it
             says the same two things and §21.3's 44 sets the depth. The
             38px chevron disc went with it: at this height the disc WAS the
             height, so the mark stands on its own. */
          marginTop: SECTION,
          minHeight: TARGET_MIN,
          paddingBlock: space.hair,
          paddingInline: `${space.line}px ${space.gap}px`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: space.line, textDecoration: 'none',
        }}
      >
        <span style={{ fontSize: 15, color: color.ink }}>{nextAction.label}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: space.breath, minWidth: 0 }}>
          {next ? (
            <Label style={{ letterSpacing: '0.14em', fontSize: 10 }}>
              Next · {next.when}
            </Label>
          ) : nextOpening ? (
            /* Design 1c/03/05 - the soonest the studio can actually take the
               car, under the one control that acts on it. Only when nothing is
               booked: a customer with a visit on Thursday does not need to be
               told the studio is free on Thursday. */
            <Label style={{ letterSpacing: '0.14em', fontSize: 10 }}>
              {nextOpening.line}
            </Label>
          ) : null}
          <Chevron tone={color.ink} />
        </span>
      </Pane>

      {/* ── ITS LIFE ────────────────────────────────────────────────────
          1b's standing pair, and the album behind them. A count of visits is
          a tally, and §2.1 says the car is the subject rather than the
          transaction - so the number is always spoken as time with the studio
          by the projection, and this only frames it. */}
      {life || membership ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: life && membership ? '1fr 1fr' : '1fr',
            gap: space.line,
            marginTop: SECTION,
          }}
        >
          {life ? (
            <Pane
              as={Link}
              {...{ href: life.href }}
              style={{
                position: 'relative', overflow: 'hidden', textDecoration: 'none',
                display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                minHeight: 132, padding: space.gap,
              }}
            >
              {life.photo ? (
                <>
                  <Photograph
                    src={life.photo}
                    alt={`${vehicle.name} at ${studio.name}`}
                    sizes={imageSizes.half}
                  />
                  {/* §21.1 - the scrim is solved for the worst image, and the
                      words below are `over`, never `over2`. */}
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(180deg, rgba(8,9,10,0.1), rgba(8,9,10,0.85))',
                    }}
                  />
                </>
              ) : null}
              <span style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Label style={{ fontSize: 9.5, letterSpacing: '0.2em' }}>
                  Its life at {studio.name}
                </Label>
                <span style={{ fontSize: 14, color: color.over }}>{life.count}</span>
              </span>
            </Pane>
          ) : null}

          {membership ? (
            <Pane
              tone="cool"
              as={Link}
              {...{ href: membership.href }}
              style={{
                display: 'flex', flexDirection: 'column', gap: space.breath,
                justifyContent: 'center', padding: space.gap, textDecoration: 'none',
                minHeight: 132,
              }}
            >
              <Label style={{ fontSize: 9.5, letterSpacing: '0.2em' }}>
                {studio.name.toUpperCase()} CLUB
              </Label>
              <span className="am-display" style={{ fontSize: 24, letterSpacing: '0.04em' }}>
                {membership.plan}
              </span>
              <span style={{ fontSize: 12.5, lineHeight: 1.45, color: color.ink2 }}>
                {membership.said}
              </span>
            </Pane>
          ) : null}
        </div>
      ) : null}

      {/* ── WHAT THE STUDIO HAS ALREADY SAID ────────────────────────────
          §17.1 - the record, not an inbox. Rows, because these are things
          that happened and a thing that happened is a line, not a card. */}
      {record.length > 0 ? (
        <section
          aria-labelledby="home-record"
          style={{ marginTop: SECTION, display: 'flex', flexDirection: 'column', gap: space.line }}
        >
          <h2 id="home-record" style={{ margin: 0 }}><Rail>Recently</Rail></h2>
          {/* A RECORD, NOT A PARAGRAPH.
              These were bare `Row`s on the page's own ground - hairline rules
              between lines of text, no surface, nothing to say they belonged
              together. Read next to the panes above them they looked like
              something that had not been designed yet.

              They are on the product's one glass now, and each entry carries a
              mark on the left: a filled champagne point for the newest and a
              hollow one for the rest, joined by the rule that runs between
              them. That is a timeline, which is what a record IS - and it is
              built from the two things §3.3 already allows a colour to mean. */}
          <Pane style={{ padding: `${space.breath}px ${space.gap}px` }}>
            {record.map((e, i) => (
              <div key={e.id} style={{ display: 'flex', gap: space.line }}>
                {/* The thread. It runs between the marks rather than past the
                    last one, so the record ends where the record ends. */}
                <span
                  aria-hidden
                  style={{
                    position: 'relative', flexShrink: 0, width: 9,
                    display: 'flex', justifyContent: 'center',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute', top: 22, bottom: 0, width: HAIRLINE,
                      background: i === record.length - 1 ? 'transparent' : color.edge,
                    }}
                  />
                  <span
                    style={{
                      marginTop: 18, width: 7, height: 7, borderRadius: '50%',
                      background: i === 0 ? color.champagne : 'transparent',
                      border: i === 0 ? 'none' : `${HAIRLINE}px solid ${color.ink3}`,
                    }}
                  />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <Row last={i === record.length - 1} value={<Value tone={color.ink3}>{e.when}</Value>}>
                    {e.line}
                  </Row>
                </span>
              </div>
            ))}
          </Pane>
        </section>
      ) : null}

      {/* ── THE COLLECTION ──────────────────────────────────────────────
          A rail of the other cars, so switching which car Home is about never
          requires leaving Home. The current one is lit; §12.3 - cars are
          equals, and "current" is a position, not a rank. */}
      {garage && garage.cars.length > 1 ? (
        <section
          aria-labelledby="home-garage"
          style={{ marginTop: SECTION, display: 'flex', flexDirection: 'column', gap: space.line }}
        >
          <h2 id="home-garage" style={{ margin: 0 }}><Rail>Your cars</Rail></h2>
          <div
            className="no-scrollbar"
            style={{
              display: 'flex', gap: space.line, overflowX: 'auto',
              /* The gutter is the page's, so the rail bleeds to both edges
                 and the first card still lines up with everything above it. */
              marginInline: -INSET, paddingInline: INSET, paddingBottom: space.breath,
              scrollSnapType: 'x mandatory',
              /* SNAP INSIDE THE GUTTER, NOT UNDER IT.
                 The rail bleeds by `-INSET` and pads back by `INSET`, but a
                 mandatory snap aligns the first card to the SCROLLPORT - the
                 padding box - so on load it slid left underneath that padding
                 and the first card sat 20px off the edge of the screen.
                 Measured in the running page: card left `-20` without this,
                 `0` with it. `scroll-padding` is what shrinks the snapport to
                 the gutter, and it is the only thing that does. */
              scrollPaddingInline: INSET,
            }}
          >
            {garage.cars.map(c => (
              /* The car being shown says so - §6.2's "always shows where the
                 customer is", applied to which car Home is about. The mark is
                 the amber state line and `aria-current`, NOT a warm pane:
                 there is one warm surface on this screen and it is the action.
                 §12.3 - cars are equals, and "current" is a position. */
              /* THE CAR, NOT A CARD ABOUT THE CAR.
                 This was a 200x104 coloured pane with the name written on it -
                 in a product whose whole argument is that the car is the
                 subject (§2.1), the customer's own garage was the one strip
                 that showed no cars. The photograph is in the model and always
                 was. Same 232 width and same 126 plate as the market strip
                 below, because two rails of different-sized cards on one
                 screen read as two designs.

                 `Photograph` composes the absence, so a car with no picture
                 yet is a quiet lit field at exactly this size rather than a
                 shorter card that breaks the row. */
              <Link
                key={c.id}
                href={c.href}
                aria-current={c.current ? true : undefined}
                className="am-tap"
                style={{
                  flex: '0 0 auto', width: 232, textDecoration: 'none',
                  borderRadius: radius.sheet, overflow: 'hidden',
                  border: `1px solid ${c.current ? 'rgba(224,164,92,0.28)' : 'rgba(255,255,255,0.08)'}`,
                  scrollSnapAlign: 'start',
                }}
              >
                <span style={{ position: 'relative', display: 'block', height: 126 }}>
                  <Photograph src={c.photo} alt={c.name} sizes="232px" radius={0} />
                </span>
                <span
                  className="am-glass"
                  style={{
                    display: 'flex', flexDirection: 'column', gap: space.breath,
                    padding: `${space.gap}px ${space.gap + 2}px`, borderRadius: 0, border: 'none',
                  }}
                >
                  <span style={{ fontSize: 15, color: color.ink }}>{c.name}</span>
                  <Label lit={c.current} style={{ fontSize: 9.5, letterSpacing: '0.16em' }}>
                    {c.state}
                  </Label>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── THE MARKET ──────────────────────────────────────────────────
          Screen 1k lives at `/cars`; this is its doorway. Three cars, because
          Home is a glance and the market itself is one tap away. */}
      {forSale.length > 0 ? (
        <section
          aria-labelledby="home-market"
          style={{ marginTop: SECTION, display: 'flex', flexDirection: 'column', gap: space.line }}
        >
          <h2 id="home-market" style={{ margin: 0 }}><Rail>Cars for sale</Rail></h2>
          <div
            className="no-scrollbar"
            style={{
              display: 'flex', gap: space.line, overflowX: 'auto',
              marginInline: -INSET, paddingInline: INSET, paddingBottom: space.breath,
              scrollSnapType: 'x mandatory',
              /* SNAP INSIDE THE GUTTER, NOT UNDER IT.
                 The rail bleeds by `-INSET` and pads back by `INSET`, but a
                 mandatory snap aligns the first card to the SCROLLPORT - the
                 padding box - so on load it slid left underneath that padding
                 and the first card sat 20px off the edge of the screen.
                 Measured in the running page: card left `-20` without this,
                 `0` with it. `scroll-padding` is what shrinks the snapport to
                 the gutter, and it is the only thing that does. */
              scrollPaddingInline: INSET,
            }}
          >
            {forSale.map(c => (
              <Link
                key={c.id}
                href={c.href}
                className="am-tap"
                style={{
                  flex: '0 0 auto', width: 232, textDecoration: 'none',
                  borderRadius: radius.sheet, overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.08)',
                  scrollSnapAlign: 'start',
                }}
              >
                {c.photo ? (
                  <span style={{ position: 'relative', display: 'block', height: 126 }}>
                    <Photograph src={c.photo} alt={c.title} sizes="232px" />
                  </span>
                ) : null}
                <span
                  className="am-glass"
                  style={{
                    display: 'flex', flexDirection: 'column', gap: space.breath,
                    padding: `${space.gap}px ${space.gap + 2}px`, borderRadius: 0, border: 'none',
                  }}
                >
                  <span
                    style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'baseline', gap: space.breath,
                    }}
                  >
                    <span style={{ fontSize: 15, color: color.ink }}>{c.title}</span>
                    <span
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: color.champagne }}
                    >
                      {c.price}
                    </span>
                  </span>
                  <span style={{ fontSize: 12.5, lineHeight: 1.5, color: color.ink3 }}>
                    {c.detail}
                  </span>
                </span>
              </Link>
            ))}
          </div>
          <Action href={marketHref} quiet>See every car for sale</Action>
        </section>
      ) : null}

      {/* ── THE STUDIO ──────────────────────────────────────────────────
          Where it is, and the three ways to reach it. Last, because a
          customer who needs the address is not the customer this screen is
          designed for - but they must never have to hunt. */}
      <section
        aria-labelledby="home-studio"
        style={{ marginTop: SECTION, display: 'flex', flexDirection: 'column', gap: space.line }}
      >
        <h2 id="home-studio" style={{ margin: 0 }}><Rail>{studio.name}</Rail></h2>
        <Pane style={{ padding: `${space.gap + 2}px ${space.gap + 4}px` }}>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: color.ink2 }}>
            {studio.address}
          </p>
          {/* THREE CONTROLS ON ONE ROW DO NOT FIT A 375px PHONE. `Action` is
              `width: 100%` and shrinks, so the third was pushed past the
              gutter - "WhatsApp" ran off the right edge of the smallest
              display the product supports. They wrap now, which is what a row
              of equals should always have done. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: space.breath, marginTop: space.line }}>
            <Action href={studio.directions} quiet style={{ fontSize: 13.5, flex: '1 1 8rem' }}>Directions</Action>
            <Action href={studio.call} quiet style={{ fontSize: 13.5, flex: '1 1 6rem' }}>Call</Action>
            <Action href={studio.message} quiet style={{ fontSize: 13.5, flex: '1 1 8rem' }}>WhatsApp</Action>
          </div>
        </Pane>
      </section>
    </Screen>
  );
}
