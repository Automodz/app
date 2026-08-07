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
import { useOpenPalette } from '@/navigation/Palette';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import {
  color, space, MEASURE, INSET, HAIRLINE, TARGET_MIN, radius, type as typeScale,
  heroMotion, stack, imageSizes, column,
} from '@/design';
import type { StateTone } from '@/design';
import { Hero, Heading, Text, Button, Glass } from '@/components/system';
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
  /** §5.3 — one phrase, unmissable. The single Display on this screen. */
  word: string;
  /** One sentence beneath it, in the studio's voice. */
  line?: string;
  /** One honest line about time, or nothing at all (§19.2). */
  timing?: string;
  /** A quieter second fact — why a visit was refused, and the like. */
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
  /* The state's own tone, not an arbitrary one — §3.3 keeps colour to
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
  /** Dated ahead of today — a thing coming toward the owner. */
  ahead?: boolean;
}

export interface HomeModel {
  vehicle: HomeVehicle;
  state: HomeState;
  studio: HomeStudio;

  /* THE ENGINE'S OUTPUT, KEPT. Home V1 composes differently — protection is
     a disclosed state, the timeline belongs to the album — but these remain
     the engine's answer and the projection tests guard them as such. What a
     screen chooses to draw is a separate question from what it is told. */
  protections: HomeProtection[];
  liveActivity?: HomeLiveActivity;
  /** The one act, already resolved to an address (ARCHITECTURE §1, §4). */
  nextAction: { label: string; href: string };
  timeline: HomeTimelineEvent[];

  /* ── ONE COMPOSITION, NOT A DASHBOARD ─────────────────────────────────
     Home answers four questions in its first five seconds: what is
     happening to my car, is it all right, what can I do now, what is
     coming. Everything below serves one of those. A section that serves
     none of them does not belong on Home, however much data exists for it.

     The previous shape — protection card, book-in-a-tap list, membership
     card, garage card, record strip, timeline card, market strip — was ten
     independent rectangles of equal weight. Ten equal things have no
     hierarchy, and with no hierarchy the car stopped being the subject. */



  /** The car's protection, as a state rather than a list of balances. */
  protection?: {
    /** "Protected", or what is wrong when something is. */
    headline: string;
    /** The layers, named: PPF · Ceramic · Glass. */
    layers: readonly string[];
    /** "Everything's holding", or the one thing that needs saying. */
    said: string;
    tone: Tone;
    /** Behind a tap. The full terms, only when asked for. */
    items: readonly { id: string; label: string; term: string; tone: Tone }[];
  };

  /**
   * WHILE THE CAR IS HERE, HOME BECOMES THE VISIT.
   *
   * Not a card announcing that something is happening — the stage it is at,
   * the studio's own words, and the photographs as they are taken. This is
   * the thing the product is actually for, and Home used to send the customer
   * to another screen to see any of it.
   */
  live?: {
    acts: readonly { label: string; done: boolean; current: boolean }[];
    timing?: string;
    frames: readonly { id: string; url: string; caption?: string }[];
    href: string;
  };

  /**
   * WORTH CONSIDERING — the proposal engine's own reasoning, never a sell.
   *
   * It names the object it is reasoning from ("your ceramic is six weeks from
   * its end"), and it is suppressed entirely while a visit is booked or in
   * flight. A recommendation that cannot say why is an advertisement.
   */
  suggestion?: { headline: string; reason: string; href: string };

  /** The visit that is coming. Absent when none is — never an empty frame. */
  next?: { service: string; when: string; vehicleName: string; href: string };

  /** Its life here, as one photograph and one fact. Not a transaction log. */
  life?: { photo?: string; count: string; href: string };

  /** The club, quietly, and only for members. */
  membership?: { plan: string; said: string; href: string };

  /**
   * THE OTHER CARS ARE THE NAVIGATION.
   *
   * Not a card saying how many there are — the cars themselves, each with its
   * own state, and tapping one makes Home that car's home. One car and there
   * is no section at all.
   */
  garage?: {
    cars: readonly {
      id: string; name: string; state: string; photo?: string; href: string; current: boolean;
    }[];
  };

  /** What the studio is selling. Last, and visually subordinate. */
  forSale: readonly {
    id: string; title: string; price: string; detail: string; photo?: string; href: string;
  }[];
  marketHref: string;
}




export function HomeScreen({ model }: { model: HomeModel }) {
  const {
    vehicle, state, nextAction, live, suggestion, protection, next, life,
    membership, garage, forSale, marketHref, studio,
  } = model;
  const still = useReducedMotion();
  const frame = useRef<HTMLDivElement>(null);

  /* Which protection is open. An id, not an object: the model is the source of
     truth and this only names a row in it. */
  /* THE ADDRESSABLE EXPANSIONS ARE GONE WITH THE CARDS THEY OPENED.
     Home no longer has a layer to link to: protection discloses in place with
     a native `<details>`, and the timeline it used to open belongs to the
     album. What is left needs no router state at all. */
  const openPalette = useOpenPalette();

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

      {/* ── 02 · THE ONE ACTION ─────────────────────────────────────────
          It follows the car directly, with no card between them, so the state
          above and the act below read as one thought. §10.4 gives the filled
          tier to "the thing this screen exists to let you do", and there is
          exactly one on this screen — the engine already chose which. */}
      <section style={{ ...column, paddingTop: space.rest }}>
        <Button tier="primary" href={nextAction.href} full>{nextAction.label}</Button>
      </section>

      {/* ── 02b · WHILE THE CAR IS HERE ─────────────────────────────────
          Home becomes the visit. The stage it is at, the studio's own words,
          and the photographs as they are taken — none of which the customer
          could see without leaving Home before. This is the thing the product
          is for; on the day it applies it outranks everything below it. */}
      {live ? (
        <section style={{ ...column, paddingTop: space.rest }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: space.line }}>
            {live.acts.map(a => (
              <span
                key={a.label}
                style={{
                  fontFamily: typeScale.data.family,
                  fontSize: 12,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: a.current ? color.ink : a.done ? color.ink2 : color.ink3,
                  opacity: a.done || a.current ? 1 : 0.5,
                }}
              >
                {a.label}
              </span>
            ))}
          </div>
          {live.timing ? (
            <Text role="whisper" tone="ink3" aria-live="polite" style={{ marginTop: space.line }}>
              {live.timing}
            </Text>
          ) : null}

          {/* The studio's own photographs, as they arrive. Not a gallery — a
              window onto a bay the customer cannot stand in. */}
          {live.frames.length > 0 ? (
            <div style={{
              display: 'flex', gap: space.line, marginTop: space.gap,
              overflowX: 'auto', scrollbarWidth: 'none',
            }}>
              {live.frames.map(f => (
                <Link key={f.id} href={live.href} style={{ textDecoration: 'none', flex: '0 0 auto', width: 168 }}>
                  <div style={{
                    position: 'relative', width: '100%', aspectRatio: '4 / 3',
                    borderRadius: radius.card, overflow: 'hidden', background: color.surface,
                  }}>
                    <Image src={f.url} alt={f.caption ?? vehicle.name} fill sizes="168px" style={{ objectFit: 'cover' }} />
                  </div>
                  {f.caption ? (
                    <Text role="whisper" tone="ink3" style={{ marginTop: space.breath }}>{f.caption}</Text>
                  ) : null}
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ── 03 · PROTECTION ─────────────────────────────────────────────
          A state, not a stack of balances. The layers are named and the
          verdict is one line; the terms are behind a tap because a customer
          glancing at Home is asking "is my car all right", not "how many days
          of ceramic remain". §14.4 — a countdown only when the number is
          small enough to act on. */}
      {protection ? (
        <section style={{ ...column, paddingTop: space.movement }}>
          {/* Native disclosure. No state, no JavaScript, and it is open-able
              before hydration — progressive disclosure that cannot fail. */}
          <details style={{ borderTop: `${HAIRLINE}px solid ${color.edge}`, paddingTop: space.gap }}>
            <summary style={{ listStyle: 'none', cursor: 'pointer', minHeight: TARGET_MIN }}>
              <Text role="body" tone={protection.tone === 'ink3' ? 'ink' : protection.tone} as="span">
                {protection.headline}
              </Text>
              <Text role="whisper" tone="ink3" style={{ display: 'block', marginTop: space.hair }}>
                {protection.layers.join(' · ')} &middot; {protection.said}
              </Text>
            </summary>
            <div style={{ display: 'grid', gap: space.line, paddingTop: space.gap }}>
              {protection.items.map(p => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'baseline',
                  justifyContent: 'space-between', gap: space.line,
                }}>
                  <Text role="body" tone="ink2">{p.label}</Text>
                  <Text role="whisper" tone={p.tone === 'ink3' ? 'ink3' : p.tone} style={{ textAlign: 'right' }}>
                    {p.term}
                  </Text>
                </div>
              ))}
            </div>
          </details>
        </section>
      ) : null}

      {/* ── 03b · WORTH CONSIDERING ─────────────────────────────────────
          The proposal engine's reasoning, carried whole. It names the object
          it reasons from, so this can never read as an advertisement — and
          the engine suppresses itself entirely when a visit is already booked
          or in flight. Nothing is decided here. */}
      {suggestion ? (
        <section style={{ ...column, paddingTop: space.movement }}>
          <Link href={suggestion.href} style={{ textDecoration: 'none', display: 'block' }}>
            <Text role="data" tone="ink3" as="span">WORTH CONSIDERING</Text>
            <Text role="body" tone="ink" style={{ marginTop: space.breath }}>
              {suggestion.headline}
            </Text>
            <Text role="whisper" tone="ink3" style={{ marginTop: space.hair, maxWidth: MEASURE }}>
              {suggestion.reason}
            </Text>
          </Link>
        </section>
      ) : null}

      {/* ── 04 · WHAT IS COMING ─────────────────────────────────────────
          The one thing a customer opens this screen to check when their car
          is not here. §18.1 — nothing booked, nothing drawn. */}
      {next ? (
        <section style={{ ...column, paddingTop: space.movement }}>
          <Link href={next.href} style={{ textDecoration: 'none', display: 'block' }}>
            <Text role="data" tone="ink3" as="span">NEXT VISIT</Text>
            <Heading level="title" as="h2" style={{ marginTop: space.breath }}>
              {next.service}
            </Heading>
            <Text role="body" tone="ink2" style={{ marginTop: space.hair }}>
              {next.when}
            </Text>
            <Text role="whisper" tone="ink3">{next.vehicleName}</Text>
          </Link>
        </section>
      ) : null}

      {/* ── 05 · ITS LIFE ───────────────────────────────────────────────
          One photograph and one fact. The album is where a life is read;
          this is what makes somebody want to open it. Not a log, not a
          strip of thumbnails, not a timeline in a box. */}
      {life ? (
        <section style={{ paddingTop: space.movement }}>
          <Link href={life.href} style={{ textDecoration: 'none', display: 'block' }}>
            {life.photo ? (
              <div style={{
                position: 'relative', width: '100%', aspectRatio: '3 / 2',
                overflow: 'hidden', background: color.surface,
              }}>
                <Image
                  src={life.photo}
                  alt={`${vehicle.name} at ${studio.name}`}
                  fill
                  sizes={imageSizes.fullBleed}
                  style={{ objectFit: 'cover' }}
                />
              </div>
            ) : null}
            <div style={{ ...column, paddingTop: space.gap }}>
              <Heading level="title" as="h2">Its life at {studio.name}</Heading>
              <Text role="whisper" tone="ink3" style={{ marginTop: space.hair }}>
                {life.count}
              </Text>
            </div>
          </Link>
        </section>
      ) : null}

      {/* ── 06 · THE CLUB ───────────────────────────────────────────────
          Members only. §18.1 — somebody who is not in it is not sold it from
          their own car's screen. */}
      {membership ? (
        <section style={{ ...column, paddingTop: space.movement }}>
          <Link href={membership.href} style={{ textDecoration: 'none', display: 'block' }}>
            <Text role="data" tone="ink3" as="span">{studio.name.toUpperCase()} CLUB</Text>
            <Text role="body" tone="ink" style={{ marginTop: space.breath }}>
              {membership.plan}
            </Text>
            <Text role="whisper" tone="ink3">{membership.said}</Text>
          </Link>
        </section>
      ) : null}

      {/* ── 07 · DISCOVERY ──────────────────────────────────────────────
          Only after the customer's own car is done with. Thumbnails and
          rails, deliberately quieter than everything above — nothing here
          may compete with the car at the top of the screen. */}
      {garage ? (
        <section style={{ paddingTop: space.movement }}>
          <div style={{
            display: 'flex', gap: space.line, overflowX: 'auto',
            paddingInline: INSET, scrollbarWidth: 'none',
          }}>
            {garage.cars.map(c => (
              <Link
                key={c.id}
                href={c.href}
                aria-current={c.current ? 'true' : undefined}
                style={{ textDecoration: 'none', flex: '0 0 auto', width: 132, opacity: c.current ? 1 : 0.72 }}
              >
                <div style={{
                  position: 'relative', width: '100%', aspectRatio: '4 / 3',
                  borderRadius: radius.card, overflow: 'hidden', background: color.surface,
                  outline: c.current ? `${HAIRLINE}px solid ${color.ink2}` : undefined,
                  outlineOffset: 2,
                }}>
                  {c.photo ? (
                    <Image src={c.photo} alt={c.name} fill sizes="132px" style={{ objectFit: 'cover' }} />
                  ) : null}
                </div>
                <Text role="whisper" tone="ink2" style={{ marginTop: space.breath }}>{c.name}</Text>
                <Text role="whisper" tone="ink3">{c.state}</Text>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {forSale.length > 0 ? (
        <section style={{ paddingTop: space.movement }}>
          <div style={{ ...column }}>
            <Link href={marketHref} style={{ textDecoration: 'none' }}>
              <Text role="whisper" tone="ink3">Cars we&rsquo;re selling</Text>
            </Link>
          </div>
          <div style={{
            display: 'flex', gap: space.line, marginTop: space.line,
            overflowX: 'auto', paddingInline: INSET, scrollbarWidth: 'none',
          }}>
            {forSale.map(c => (
              <Link key={c.id} href={c.href} style={{ textDecoration: 'none', flex: '0 0 auto', width: 208 }}>
                <div style={{
                  position: 'relative', width: '100%', aspectRatio: '3 / 2',
                  borderRadius: radius.card, overflow: 'hidden', background: color.surface,
                }}>
                  {c.photo ? (
                    <Image src={c.photo} alt={c.title} fill sizes="208px" style={{ objectFit: 'cover' }} />
                  ) : null}
                </div>
                <Text role="whisper" tone="ink2" style={{ marginTop: space.breath }}>{c.title}</Text>
                <Text role="whisper" tone="ink3">{c.price} &middot; {c.detail}</Text>
              </Link>
            ))}
          </div>
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



    </main>
  );
}

