'use client';
/**
 * HOME
 *
 * Source: docs/AUTOMODZ-OS.md §1, §2.1, §3.1, §3.2, §3.3, §3.4, §3.5, §4.1,
 *         §4.3, §4.5, §5.3, §5.5, §6.3, §7.1, §7.4, §8.4, §8.6, §9.5,
 *         §11.2, §11.5, §14.2, §14.3, §14.4, §18.1, §21.1, §21.6
 *
 * ── WHAT THIS SCREEN IS FOR ──────────────────────────────────────────────
 * Not to show information. To make one sentence true:
 *
 *     "My car lives here."
 *
 * ── THE FIRST SCREEN IS THE WHOLE CAR ────────────────────────────────────
 * The photograph is 94svh. Not "large" — the screen. §3.1 does not say the
 * photograph is the biggest thing on the page; it says the photograph IS the
 * interface, and anything that leaves room for a paragraph underneath has
 * quietly demoted it to a header.
 *
 * Everything the customer needs on opening sits over that photograph, as one
 * block, like a title card:
 *
 *     their car, by name and by plate
 *     what is happening to it, in the present tense
 *     one sentence of detail
 *     the one way in
 *
 * That block is the reason the screen is complete before any scroll. A state
 * word whose explanation lives 200px below, on different material, is a
 * thought the screen starts and the customer has to finish.
 *
 * ── THE ORDER IS NOT A CHOICE ────────────────────────────────────────────
 * §5.3 fixes the hierarchy of any surface showing a vehicle:
 *
 *     1  the photograph        full-bleed, the largest element
 *     2  current state         one phrase, unmissable
 *     3  what protects it      living states
 *     4  the latest work       the most recent finished visit
 *     5  ways deeper           history
 *
 * 1 and 2 are the first screen. 3 and 4 are the scroll. 5 is the navigation —
 * History is a room in the bar, and a text link to it here would be a second
 * control for one room. §6.3 makes exactly that argument about the Studio;
 * it holds just as well in the other direction.
 *
 * ── WHY THERE ARE ALMOST NO WORDS OF INTERFACE ───────────────────────────
 * There is not one section heading on this screen. §8.6 — "a fact is a line
 * of text" — and a dated photograph of your own car does not need a heading
 * announcing that it is recent, any more than a coating with 'Through March
 * 2029' beside it needs one announcing that it is protection. §3.5: every
 * element removed makes the rest louder. A label that only restates what its
 * content already says is the cheapest thing on any screen to delete.
 *
 * ── WHY THERE ARE NO BOXES ───────────────────────────────────────────────
 * §8.6 — a card is for "one of several comparable things"; a single fact is a
 * line of text. Almost everything here is a single fact about one car. The
 * page alternates full-bleed photography with inset type, and that
 * alternation is the entire layout.
 *
 * ── DATA ─────────────────────────────────────────────────────────────────
 * This component holds none and fetches none. It renders what it is handed.
 */
import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useOpenPalette } from '@/navigation/Palette';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import {
  color, space, MEASURE, HAIRLINE, radius,
  heroMotion, stack, imageSizes, column,
} from '@/design';
import type { StateTone } from '@/design';
import { Hero, Heading, Text, Button, Expansion, Glass, toneColor } from '@/components/system';
import { OfflineNote } from '@/components/system';
import type { Tone } from '@/components/system';

/* ── What Home needs to be true ──────────────────────────────────────────
   Deliberately the smallest shape that satisfies §5.3. Anything a screen
   does not render, it does not ask for. */

export interface HomeVehicle {
  /** The customer's own words for their car. */
  name: string;
  /** §5.5 — the registration is kept: "identity, not jargon". */
  plate: string;
  /** §11.5 — absent until the studio has photographed it. */
  photo?: string;
}

export interface HomeState {
  /**
   * §5.3 — one phrase, unmissable. The single Display on this screen.
   *
   * It names WHAT IS HAPPENING TO THE CAR, in the present tense: "Receiving
   * ceramic coating", "Paint correction underway", "Ready for collection",
   * "Protected". Never a filing category. "In care" could be true for a week
   * and describes the studio's relationship to the car rather than the car,
   * which §2.1 forbids — the car is the subject, not the transaction.
   */
  word: string;
  /** One sentence, in the studio's voice. §13.3 */
  line?: string;
  /**
   * A second, quieter fact: the service name, or why a visit was refused.
   * Ported from the old Home, where six of the nine states carried one.
   */
  note?: string;
  /** One honest line about time while the car is here, from `os/stay`. */
  timing?: string;
  /**
   * §3.3 — colour only where it carries meaning grey cannot. `lapsed` is the
   * neutral tone here: it renders as ink, spending no colour on "nothing is
   * wrong".
   */
  tone: StateTone;
}

export interface HomeProtection {
  id: string;
  /** In the customer's words. §14.2 */
  label: string;
  /**
   * The term, already spoken in the unit that suits it (§14.3) and at the
   * precision that is honest (§14.4): a date when it is far off, a countdown
   * only when the number is small enough to act on, an amount when it is a
   * balance — never a balance described in time.
   */
  term: string;
  /**
   * How much of the term is left, 0–1. Omitted for a perpetual protection,
   * which does not deplete and must not be drawn as though it did.
   */
  remaining?: number;
  tone: StateTone;
}

export interface HomeLiveActivity {
  title: string;
  when: string;
  /** One quiet sentence. What it felt like, not what was billed. */
  note?: string;
  photo?: string;
  href: string;
}

/** One line of the ownership record. docs/HOME-STATE-MAP.md § Timeline events */
export interface HomeTimelineEvent {
  id: string;
  title: string;
  line?: string;
  /** Already spoken — "12 March 2026", never a raw ISO string. */
  when: string;
  href?: string;
  /** Dated ahead of today: a booked visit, a warranty about to end. */
  ahead: boolean;
}

/** §5.2 — the studio is a place, reached from the thing it cares for. */
export interface HomeStudio {
  name: string;
  address: string;
  directions: string;
  call: string;
  message: string;
}

export interface HomeModel {
  vehicle: HomeVehicle;
  state: HomeState;
  protections: HomeProtection[];
  /**
   * What is happening to the car now, or most recently. Was "Current Story" —
   * renamed because "story" invited narrative padding and this is a fact with a
   * time on it (ARCHITECTURE §4).
   */
  liveActivity?: HomeLiveActivity;
  /**
   * The one next thing to do, ALREADY RESOLVED. The engine emitted an intent
   * and `navigation/resolve.ts` turned it into an address, so this renderer
   * contains no destination logic (ARCHITECTURE §1, §4).
   */
  nextAction: { label: string; href: string };
  /** Newest first, future events above the present. May be empty. */
  timeline: HomeTimelineEvent[];
  studio: HomeStudio;
}

/**
 * §3.3 — "Colour appears only where it carries meaning that grey cannot: a
 * state that is failing, a state that needs attention."
 *
 * A protection that is simply fine carries no such meaning, so it is drawn in
 * ink. Spending green on "nothing is wrong" is decoration, and it is the
 * reason amber and red stop landing: if every state is coloured, colour has
 * stopped being information. Holding it back is what makes it work.
 *
 * §21.6 is untouched by this — colour was never the carrier here. The term
 * says "6 days left" in words.
 */
const lifeTone = (tone: StateTone): Tone =>
  /* ink3, not ink2. Rendered, ink2 made the one protection that is FINE the
     brightest mark on the screen — a long bar at high contrast next to two
     short dim ones — which is precisely backwards. Its length already says
     there is plenty left; it does not also need weight. */
  tone === 'assent' ? 'ink3' : tone;

/**
 * ONE PROTECTION.
 *
 * §14.2 gives the card its contents; this is the Home reading of it, where a
 * protection is glanced at rather than examined. The full card, with its
 * provider and its file behind one tap (§14.6), belongs to the car's own room.
 *
 * It is not a chip and not a row in a list. It is a line of type with a
 * measure of its own life drawn beneath it: lit for what remains, dark for
 * what has gone. That is what makes it read as something currently HOLDING
 * rather than as a record that exists. A dot beside a label states that a
 * fact was stored; a line that is two-thirds lit shows a coating with two
 * thirds of its life in it.
 *
 * §3.4 — light is the only ornament, and this is the only ornament here.
 *
 * NO ENTRANCE ANIMATION. The instinct on being asked to make something feel
 * alive is to animate it, and here that instinct is wrong twice over. §7.1 —
 * "motion decorates content, it never gates it" — and a bar that grows from
 * zero is invisible until its animation runs, which makes the animation the
 * content. §3.5 — the aliveness is supposed to come from the thing being
 * true, not from it moving. It does.
 */
function Protection({ label, term, remaining, tone }: HomeProtection) {
  const life = lifeTone(tone);
  /* Perpetual: §14.3 — "for as long as you own it". It has no proportion to
     draw, so the measure is drawn whole. Anything less would say it is
     running out. */
  const share = remaining === undefined ? 1 : Math.max(0, Math.min(1, remaining));

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: space.gap,
        }}
      >
        <Text role="body" tone="ink">{label}</Text>
        {/* The term is the second carrier of the state, in words (§21.6). */}
        <Text role="data" tone={life} style={{ textAlign: 'right', flexShrink: 0 }}>
          {term}
        </Text>
      </div>

      {/* The measure. `edge` is the unlit remainder — the same hairline the
          rest of the product separates things with, so an empty protection
          reads as a rule rather than as a broken component. */}
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
            background: toneColor(life),
            borderRadius: radius.pill,
          }}
        />
      </div>
    </div>
  );
}

export function HomeScreen({ model }: { model: HomeModel }) {
  const { vehicle, state, protections, liveActivity, nextAction, timeline, studio } = model;
  const still = useReducedMotion();
  const frame = useRef<HTMLDivElement>(null);

  /* Which protection is open. An id, not an object: the model is the source of
     truth and this only names a row in it. */
  /* EVERY EXPANSION IS ADDRESSABLE (§6.4, ARCHITECTURE §5). The old Home put
     each sheet in the URL (`?sheet=…`) so it could be linked, shared and
     restored on reload; an expansion that lived only in component state would
     lose all three. `?open=protection:p2` is that address, and the back button
     closes the layer because it is a real history entry. */
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const open = params.get('open');
  const openPalette = useOpenPalette();

  const setOpen = (value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set('open', value);
    else next.delete('open');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const openProtection = open?.startsWith('protection:') ? open.slice(11) : null;
  const opened = protections.find(p => p.id === openProtection);

  const openEvent = open?.startsWith('event:') ? open.slice(6) : null;
  const openedEvent = timeline.find(e => e.id === openEvent);

  /* §7.4 — parallax is one of the four motions the photograph is allowed.
     The lag is the token: at 0.82 the image travels at 82% of scroll speed,
     so it falls 18% behind the page, and the overscan is that same 18% so no
     edge is ever revealed. Both numbers come from one place. */
  const lag = 1 - heroMotion.parallaxRate;

  /* A `y` PERCENTAGE RESOLVES AGAINST THE ELEMENT, NOT THE FRAME — and the
     element is deliberately taller than the frame, by exactly `lag`. Writing
     `${lag * 100}%` therefore moved the photograph 18% of 118%, which
     measured 21.2% of scroll: a real rate of 0.788, not the 0.82 the token
     states. Dividing by the overscan converts the travel back into frame
     units, and the measured rate lands on 18.0%. */
  const travel = (lag / (1 + lag)) * 100;
  const { scrollYProgress } = useScroll({
    target: frame,
    offset: ['start start', 'end start'],
  });
  /* §7.6 — with motion reduced the RANGE collapses rather than the binding
     being swapped for a constant. At scroll zero both branches output '0%', so
     the server and the client agree on the first paint; a branch on the style
     itself would emit `translateY(0%)` on one and `none` on the other, which
     is the hydration mismatch this component and `Hero` both used to have. */
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    ['0%', still ? '0%' : `${travel}%`],
  );

  return (
    <main
      style={{
        /* TRANSPARENT ON PURPOSE. The room stands in the ambient field,
           which is fixed behind everything (components/system/Ambient.tsx).
           Painting `color.paper` here would occlude it completely. The dark
           ground still exists — it is on `body` — so nothing loses contrast. */
        background: 'transparent',
        minHeight: '100svh',
        /* §8.5 — the stacking contract. Content clears the navigation by
           arithmetic, never by measuring it. */
        paddingBottom: stack.contentFloor,
      }}
    >
      {/* ── OFFLINE ────────────────────────────────────────────────────
          §20.3 — ours or theirs. Everything on this page was rendered on the
          server and is still true; only what happens NEXT is affected, so this
          says exactly that and nothing more alarming. §21.7 — announced
          politely, because the customer did not act to cause it. */}
      <OfflineNote />

      {/* ── THE FIRST SCREEN ────────────────────────────────────────────
          §3.1, §3.2, §11.2, §5.3 (1 and 2). The photograph at the size of
          the screen, and over it, everything that is true right now. */}
      {/* framer-motion logs "ensure that the container has a non-static
          position" here in development. It is about the SCROLL CONTAINER,
          which for a page-scrolled route is `document.scrollingElement` —
          `<html>`, static on every site. It is not about this element and
          there is nothing to fix; the warning is compiled out of production
          builds. Parallax was measured against scroll to confirm it: linear,
          and at the rate the token states. */}
      <div ref={frame}>
        <Hero
          state={vehicle.photo ? 'media' : 'awaiting'}
          overlay={
            <>
              {/* Identity. Mono, because a plate is a plate. §5.5

                  EVERY TONE OVER THE PHOTOGRAPH IS `over`, NEVER `over2` —
                  see the note in Hero. Hierarchy here comes from the type
                  scale, which is where §9.5 puts it. Two of these lines were
                  `over2` when this screen was first built, and both failed AA
                  against the worst-case image. */}
              <div style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: space.gap,
              }}>
                <Text role="data" tone="over" as="span">
                  {vehicle.name} · {vehicle.plate}
                </Text>
                {/* The Desk's own control. It names the act, not the mechanism —
                    §21.8, the customer's word. */}
                <Button
                  tier="quiet"
                  onClick={openPalette}
                  style={{ color: color.over, paddingInline: 0 }}
                >
                  Find
                </Button>
              </div>

              {/* §5.3 #2 and §9.5 — the one Display on this screen. */}
              <Heading
                level="display"
                tone="over"
                style={{ marginTop: space.hair }}
              >
                {state.word}
              </Heading>

              {/* The sentence belongs WITH the state — they are one thought,
                  and splitting them across the fold was what made the first
                  screen read as a header. §21.7: the state changes without
                  the customer acting, so it is announced politely. */}
              {state.line ? (
                <Text
                  role="body"
                  tone="over"
                  aria-live="polite"
                  style={{ marginTop: space.line, maxWidth: MEASURE }}
                >
                  {state.line}
                </Text>
              ) : null}

              {/* The second, quieter fact: the service name, or why a visit
                  was refused. Six of the nine ownership states carry one, and
                  none of them could be shown before the engine was reconnected.

                  THE ACTION IS NOT HERE. It follows the protection status, so
                  the owner learns the position of the car before being offered
                  a way to change it. During a live visit the protection region
                  is suppressed (one subject at a time), so the action lands
                  immediately under the state anyway — the order resolves
                  itself rather than needing a special case. */}
              {state.timing ? (
                <Text
                  role="data"
                  tone="over"
                  aria-live="polite"
                  style={{ marginTop: space.line }}
                >
                  {state.timing}
                </Text>
              ) : null}

              {state.note ? (
                <Text
                  role="whisper"
                  tone="over"
                  style={{ marginTop: space.breath, maxWidth: MEASURE, opacity: 0.85 }}
                >
                  {state.note}
                </Text>
              ) : null}
            </>
          }
        >
          {vehicle.photo ? (
            /* §7.1 — the wrapper moves; the photograph itself never does, so
               it renders whether or not the animation runs. */
            <motion.div
              style={{
                position: 'absolute',
                insetInline: 0,
                top: `-${(lag * 100) / 2}%`,
                height: `${100 + lag * 100}%`,
                y,
              }}
            >
              <Image
                src={vehicle.photo}
                alt={`${vehicle.name}, photographed at AutoModz`}
                fill
                priority
                sizes={imageSizes.fullBleed}
                style={{ objectFit: 'cover' }}
              />
            </motion.div>
          ) : (
            /* §11.5 — the composed absence, and `Hero` owns it (§22.2). Passing
               nothing is what asks for it. */
            null
          )}
        </Hero>
      </div>

      {/* ── LIVE ACTIVITY ─────────────────────────────────────────────
          §5.3 #4. A memory, not a section: one photograph, full width, and
          three lines beneath it. The whole block is the link, so there is no
          control to label — a caption under a photograph of your own car does
          not need a button reading "what we did".

          §8.4 — the photograph is full-bleed while the words stay in the
          gutter. That alternation is what stops the page reading as a column
          of cards. */}
      {liveActivity ? (
        <section style={{ paddingTop: space.movement }}>
          <Link
            href={liveActivity.href}
            style={{ display: 'block', textDecoration: 'none' }}
          >
            {liveActivity.photo ? (
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  /* Photographic, and deliberately not the 16:10 it was: a
                     wide crop reads as a banner across the page, and a banner
                     is an advertisement rather than a memory. */
                  aspectRatio: '4 / 3',
                }}
              >
                <Image
                  src={liveActivity.photo}
                  alt={`${liveActivity.title}, finished at AutoModz`}
                  fill
                  sizes={imageSizes.fullBleed}
                  style={{ objectFit: 'cover' }}
                />
              </div>
            ) : null}

            <div style={{ ...column, marginTop: space.gap }}>
              {/* The date first. It is what makes the photograph a memory
                  rather than a picture. */}
              <Text role="data" tone="ink3">{liveActivity.when}</Text>
              <Heading level="title" style={{ marginTop: space.breath }}>
                {liveActivity.title}
              </Heading>
              {liveActivity.note ? (
                <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
                  {liveActivity.note}
                </Text>
              ) : null}
            </div>
          </Link>
        </section>
      ) : null}

      {/* ── WHAT IS PROTECTING IT ───────────────────────────────────────
          §5.3 #3, §14. No heading: each line says what it is and how much of
          it is left, which is the whole of what a heading would have claimed.
          §18.1 — with nothing to say, nothing appears.

          The air between protections is `rest`, the step §8.3 gives for
          "between groups", because each of these IS a group: a different
          thing, from a different provider, running out at its own rate. At
          `gap` they read as one list of four; at `rest` they read as four
          separate things that happen to be true at once. */}
      {protections.length > 0 ? (
        <section style={{ ...column, paddingTop: space.rest }}>
          {/* ONE CARD OF LAYERS, not four naked rows on the ground.
              Protection is a single subject — what is covering this car — and
              four separate rows read as four unrelated facts. Inside the glass
              they read as a stack, which is what they are. §10.2: this is the
              one material; there is no second card nested in it. */}
          <Glass pad="gap" style={{ display: 'grid', gap: space.gap }}>
            <Text role="whisper" tone="ink3">Protecting this car</Text>
          {/* ARCHITECTURE §5 — a protection is an object already on this
              screen, so it OPENS rather than routing. The row and the layer
              share a `layoutId`, which is what makes the layer read as this
              row growing rather than a panel arriving from nowhere. */}
          {protections.map(p => (
            <motion.button
              key={p.id}
              type="button"
              layoutId={`protection-${p.id}`}
              onClick={() => setOpen(`protection:${p.id}`)}
              style={{
                appearance: 'none',
                background: 'transparent',
                border: 0,
                padding: 0,
                textAlign: 'left',
                width: '100%',
                cursor: 'pointer',
                display: 'block',
              }}
            >
              <Protection {...p} />
            </motion.button>
          ))}
          </Glass>
        </section>
      ) : null}

      {/* ── NEXT BEST ACTION ────────────────────────────────────────────
          §4.1 — the one way in, and it sits HERE rather than in the hero so
          the owner reads the position of the car first: what is happening,
          what protects it, and only then what they might do about it.

          `primary` rather than `forward`: off the photograph there is no
          competing subject, and §10.4 reserves the filled tier for "the thing
          this screen exists to let you do". There is at most one. */}
      <section style={{ ...column, paddingTop: space.movement }}>
        <Button tier="primary" href={nextAction.href}>
          {nextAction.label}
        </Button>
      </section>

      {/* ── THE TIMELINE ────────────────────────────────────────────────
          docs/HOME-STATE-MAP.md § Timeline events. One living record of
          ownership, and it runs FORWARD as well as back: a booked visit and a
          warranty about to end are both dated ahead of today and sort above
          the present. §18.1 — with nothing to say, nothing appears. */}
      {timeline.length > 0 ? (
        <section style={{ ...column, paddingTop: space.movement }}>
          <Glass pad="gap">
            <Text role="whisper" tone="ink3">Its life</Text>
            <div style={{ marginTop: space.gap }}>
            {timeline.slice(0, TIMELINE_ON_HOME).map((e, i) => (
              <TimelineRow
                key={e.id}
                event={e}
                first={i === 0}
                onOpen={() => setOpen(`event:${e.id}`)}
              />
            ))}
            </div>
          </Glass>
        </section>
      ) : null}

      {/* ── THE STUDIO ──────────────────────────────────────────────────
          §5.2 — the studio is a place, reached from the thing it cares for.
          Three ways to reach it, all of them leaving the application, so all
          three are plain anchors (`Button` handles that itself). */}
      <section style={{ ...column, paddingTop: space.movement }}>
        {/* The studio, as a card rather than three loose links on the ground.
            The address is the subject and the three ways to reach it sit
            beneath it — before, they were the same visual weight as the place
            itself, so the block read as a toolbar. */}
        <Glass pad="gap">
          <Text role="whisper" tone="ink3">{studio.name}</Text>
          <Text role="body" tone="ink" style={{ marginTop: space.breath, maxWidth: MEASURE }}>
            {studio.address}
          </Text>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: space.line,
              marginTop: space.gap,
            }}
          >
            <Button tier="forward" href={studio.directions}>Directions</Button>
            <Button tier="forward" href={studio.call}>Call</Button>
            <Button tier="forward" href={studio.message}>WhatsApp</Button>
          </div>
        </Glass>
      </section>

      {/* THE EXPANSION. Radix owns focus, dismissal and the scroll lock;
          every visual value is ours (ARCHITECTURE §6). */}
      <Expansion
        open={openProtection !== null}
        onOpenChange={o => { if (!o) setOpen(null); }}
        title={opened?.label ?? 'Protection'}
        layoutId={opened ? `protection-${opened.id}` : undefined}
      >
        {opened ? (
          <>
            <Text role="body" tone="ink2">{opened.term}</Text>
            {opened.remaining !== undefined ? (
              <Text role="whisper" tone="ink3" style={{ marginTop: space.line }}>
                {Math.round(opened.remaining * 100)}% of the term remains.
              </Text>
            ) : (
              <Text role="whisper" tone="ink3" style={{ marginTop: space.line }}>
                This one does not run out.
              </Text>
            )}
          </>
        ) : null}
      </Expansion>

      {/* A timeline event opens as itself, then offers the room it belongs to
          — the object first, the address second. */}
      <Expansion
        open={openEvent !== null}
        onOpenChange={o => { if (!o) setOpen(null); }}
        title={openedEvent?.title ?? 'Timeline'}
        layoutId={openedEvent ? `event-${openedEvent.id}` : undefined}
      >
        {openedEvent ? (
          <>
            <Text role="data" tone="ink3">
              {openedEvent.when}{openedEvent.ahead ? ' · still to come' : ''}
            </Text>
            {openedEvent.line ? (
              <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
                {openedEvent.line}
              </Text>
            ) : null}
            {openedEvent.href ? (
              <div style={{ marginTop: space.gap }}>
                <Button tier="forward" href={openedEvent.href}>Open it</Button>
              </div>
            ) : null}
          </>
        ) : null}
      </Expansion>

    </main>
  );
}

/** How much of the record Home shows. The rest lives in History. */
const TIMELINE_ON_HOME = 6;

/**
 * ONE TIMELINE EVENT.
 *
 * A rule above each row rather than a card around it: the timeline is one
 * continuous record, and boxing each entry would make six separate objects out
 * of one story. An event dated ahead of today is dimmer, not louder — it has
 * not happened yet, and drawing it at full weight would let a warranty that
 * expires in March outshout a visit that actually took place.
 */
function TimelineRow(
  { event, first, onOpen }: { event: HomeTimelineEvent; first: boolean; onOpen: () => void },
) {
  const body = (
    <>
      <Text role="data" tone="ink3">
        {event.when}{event.ahead ? ' · ahead' : ''}
      </Text>
      <Text role="body" tone={event.ahead ? 'ink3' : 'ink'} style={{ marginTop: space.hair }}>
        {event.title}
      </Text>
      {event.line ? (
        <Text role="whisper" tone="ink3" style={{ marginTop: space.hair }}>
          {event.line}
        </Text>
      ) : null}
    </>
  );

  const style = {
    paddingBlock: space.gap,
    borderTop: first ? undefined : `${HAIRLINE}px solid ${color.edge}`,
    display: 'block',
    textDecoration: 'none',
  } as const;

  /* ARCHITECTURE §5 — it OPENS. The address still exists and the expansion
     offers it, but tapping the row does not leave the page. */
  return (
    <motion.button
      type="button"
      layoutId={`event-${event.id}`}
      onClick={onOpen}
      style={{
        ...style,
        appearance: 'none',
        background: 'transparent',
        border: 0,
        borderTop: style.borderTop,
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      {body}
    </motion.button>
  );
}
