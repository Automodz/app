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
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import {
  color, space, MEASURE, HAIRLINE, radius,
  heroMotion, stack, imageSizes, column,
} from '@/design';
import type { StateTone } from '@/design';
import { Hero, Heading, Text, Button, toneColor } from '@/components/system';
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
  /** §4.1 — the way to the answer, when there is one. */
  action?: { label: string; href: string };
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

export interface HomeLatest {
  title: string;
  when: string;
  /** One quiet sentence. What it felt like, not what was billed. */
  note?: string;
  photo?: string;
  href: string;
}

export interface HomeModel {
  vehicle: HomeVehicle;
  state: HomeState;
  protections: HomeProtection[];
  latest?: HomeLatest;
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
  const { vehicle, state, protections, latest } = model;
  const still = useReducedMotion();
  const frame = useRef<HTMLDivElement>(null);

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
        background: color.paper,
        minHeight: '100svh',
        /* §8.5 — the stacking contract. Content clears the navigation by
           arithmetic, never by measuring it. */
        paddingBottom: stack.contentFloor,
      }}
    >
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
              <Text role="data" tone="over" as="span">
                {vehicle.name} · {vehicle.plate}
              </Text>

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

              {/* §4.1 — the one way in. A line of type, not a slab: over a
                  photograph a filled control is furniture, and §10.4's
                  `forward` tier is exactly "go deeper". */}
              {state.action ? (
                <div style={{ marginTop: space.breath }}>
                  <Button
                    tier="forward"
                    href={state.action.href}
                    style={{ color: color.over }}
                  >
                    {state.action.label}
                  </Button>
                </div>
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
        <section
          style={{
            ...column,
            paddingTop: space.rest,
            display: 'grid',
            gap: space.rest,
          }}
        >
          {protections.map(p => <Protection key={p.id} {...p} />)}
        </section>
      ) : null}

      {/* ── THE LATEST WORK ─────────────────────────────────────────────
          §5.3 #4. A memory, not a section: one photograph, full width, and
          three lines beneath it. The whole block is the link, so there is no
          control to label — a caption under a photograph of your own car does
          not need a button reading "what we did".

          §8.4 — the photograph is full-bleed while the words stay in the
          gutter. That alternation is what stops the page reading as a column
          of cards. */}
      {latest ? (
        <section style={{ paddingTop: space.movement }}>
          <Link
            href={latest.href}
            style={{ display: 'block', textDecoration: 'none' }}
          >
            {latest.photo ? (
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
                  src={latest.photo}
                  alt={`${latest.title}, finished at AutoModz`}
                  fill
                  sizes={imageSizes.fullBleed}
                  style={{ objectFit: 'cover' }}
                />
              </div>
            ) : null}

            <div style={{ ...column, marginTop: space.gap }}>
              {/* The date first. It is what makes the photograph a memory
                  rather than a picture. */}
              <Text role="data" tone="ink3">{latest.when}</Text>
              <Heading level="title" style={{ marginTop: space.breath }}>
                {latest.title}
              </Heading>
              {latest.note ? (
                <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
                  {latest.note}
                </Text>
              ) : null}
            </div>
          </Link>
        </section>
      ) : null}
    </main>
  );
}
