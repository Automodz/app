'use client';
/**
 * STUDIO
 *
 * Source: docs/AUTOMODZ-OS.md §2.1, §2.2, §2.5, §3.1, §3.2, §3.5, §4.1,
 *         §4.3, §4.5, §5.2, §5.4, §6.3, §8.2, §8.3, §8.4, §8.6, §9.5,
 *         §10.4, §18.1, §21.1, §21.6, §21.7, §22.1
 *
 * ── WHAT THIS SCREEN IS ──────────────────────────────────────────────────
 * §5.2 — Studio is about "AutoModz the place", and holds "what the studio is
 * and can do, credentials, services, hours, location, arranging a visit". It
 * never holds "a staff roster, any named individual".
 *
 * So this is a PLACE, entered — not a booking surface with the workshop's name
 * on it. Arranging a visit is one thing you can do once you are inside, and it
 * is the last thing this screen says rather than the first.
 *
 * ── THE FIRST SCREEN ANSWERS THREE QUESTIONS ─────────────────────────────
 *   Where is my car?        the Display. The studio's own report of whether
 *                           your car is with it — nothing more. The live
 *                           account of the work is a takeover reached from the
 *                           car (§5.4), never a second copy of it here.
 *
 *   Who is caring for it?   AutoModz. §2.2 — "work is spoken in the studio's
 *                           voice… no individual is ever named on any customer
 *                           surface." The answer is therefore not a name and
 *                           not a face: it is the studio's own words about how
 *                           it works, unsigned. Which is why those words come
 *                           SECOND, before the practicalities — measured, they
 *                           read without scrolling.
 *
 *   What can I do here?     three actions, at three depths, in three tiers,
 *                           each attached to the thing it follows from. Never
 *                           a row of equals.
 *
 * ── NO PHOTOGRAPH MAY CONTAIN A PERSON ───────────────────────────────────
 * §2.2 forbids naming an individual on a customer surface, and a face names
 * someone more loudly than text does — it also attaches the promise to a
 * person, which is the exact failure that section exists to prevent. The
 * photographs here are of the place and of the work. Never of anyone.
 *
 * ── WHAT IS DELIBERATELY ABSENT ──────────────────────────────────────────
 * No service grid, no tier table, no price anywhere, no calendar, no tiles, no
 * floating control. §22.1 puts money on the server and §5.2 does not list
 * prices among what this room holds; a premium studio's price is a
 * conversation, and a shelf label is what turns craft into a commodity.
 *
 * ── DATA ─────────────────────────────────────────────────────────────────
 * This component holds none and fetches none.
 */
import Image from 'next/image';
import {
  color, space, MEASURE, stack, imageSizes, placeSize, column,
} from '@/design';
import { Hero, Heading, Text, Button } from '@/components/system';

/* ── What the Studio needs to be true ────────────────────────────────────
   One field per thing §5.2 says this room holds, and nothing else. */

export interface StudioPhoto {
  url: string;
  /** §21.6 — an image that carries meaning carries a description. */
  description: string;
}

export interface StudioModel {
  /**
   * Where the place is, short. The identity line — the same slot every other
   * room opens with, so entering the Studio feels like moving to another room
   * in one building rather than arriving in a different product.
   */
  place: string;
  /**
   * WHERE IS MY CAR — the one Display (§9.5). The studio saying whether your
   * car is with it. §4.5: "the absence of news is good news and should look
   * like it", so a car that is not here is a calm sentence, not an empty state.
   */
  presence: string;
  /**
   * §5.4 — while a car is with the studio, that fact "opens as a full-screen
   * takeover". Present only when there is a car here to follow.
   */
  visitHref?: string;
  /**
   * §2.2 — the studio's own words about how it works, unsigned. The answer to
   * "who is caring for my car", and a place rather than a person on purpose.
   */
  voice: string;
  /** The work, mid-flight. No people. */
  work?: StudioPhoto;
  /** §5.2 services — in prose, in the studio's voice. Never a grid, never priced. */
  does: string;
  /**
   * §5.2 credentials. Lines of text, never badges in a row.
   * §18.1 — with none to state, nothing appears.
   */
  credentials?: readonly string[];
  /** §5.2 hours. §8.6 — a fact is a line of text. */
  hours: string;
  /** §5.2 location. */
  address: string;
  directionsHref: string;
  /** The place itself. §3.1's argument is visual. No people (see above). */
  photo?: StudioPhoto;
  /**
   * §6.3 — where arranging a visit happens. §10.5 — optional, because a primary
   * control pointing at the address it is already on is inert, which is what
   * `'/studio'` was.
   */
  arrangeHref?: string;
}

export function StudioScreen({ model }: { model: StudioModel }) {
  const {
    place, presence, visitHref, voice, work, does,
    credentials = [], hours, address, directionsHref, photo, arrangeHref,
  } = model;

  return (
    <main
      style={{
        background: color.paper,
        minHeight: '100svh',
        /* §8.5 — content clears the navigation by arithmetic. */
        paddingBottom: stack.contentFloor,
      }}
    >
      {/* ── 1 · THE PLACE ───────────────────────────────────────────────
          §3.1's argument — that the emotional case is visual and cannot be
          made in type — applies to a workshop as much as to a car. */}
      <Hero
        state={photo ? 'media' : 'awaiting'}
        band="full"
        /* Sized by `placeSize`, deliberately smaller than a vehicle's; the
           derivation is in design/grid.ts. With no photograph, `Hero`'s own
           awaiting height governs — shorter still, because a composed field
           reads as awaiting where a tall empty one reads as broken (§11.5). */
        style={photo ? { height: placeSize.withPhoto } : undefined}
        overlay={
          <div style={{ maxWidth: MEASURE }}>
            {/* Where the place is. Mono, because it is an address. */}
            <Text role="data" tone="over" as="span">{place}</Text>

            {/* §9.5 — the one Display: where the customer's car is.
                §21.7 — it changes without the customer acting, so it is
                announced politely rather than changing in silence. */}
            <Heading
              level="display"
              tone="over"
              aria-live="polite"
              style={{ marginTop: space.hair }}
            >
              {presence}
            </Heading>

            {/* §5.4, §4.3 — the live account is one tap from here, and exists
                only while there is something to follow. */}
            {visitHref ? (
              <div style={{ marginTop: space.breath }}>
                <Button tier="forward" href={visitHref} style={{ color: color.over }}>
                  Follow the work
                </Button>
              </div>
            ) : null}
          </div>
        }
      >
        {photo ? (
          <Image
            src={photo.url}
            alt={photo.description}
            fill
            priority
            sizes={imageSizes.fullBleed}
            style={{ objectFit: 'cover' }}
          />
        ) : null}
      </Hero>

      {/* ── 2 · WHO IS CARING FOR IT ────────────────────────────────────
          §2.2 — the studio's voice, unsigned. No heading above it, because a
          heading would label the studio's own words as a section, and §3.5
          removes anything that only restates what its content already says.

          This is second rather than last on purpose: it is the whole answer to
          the second of the three questions, and at `rest` it lands inside the
          first screen alongside the photograph and the presence. */}
      <section style={{ ...column, paddingTop: space.rest }}>
        <Text role="body" tone="ink">{voice}</Text>
      </section>

      {/* ── 3 · THE WORK ────────────────────────────────────────────────
          §8.4 — full-bleed, while the words around it stay in the gutter. One
          photograph, not a gallery: what the place does, shown once. The voice
          above describes the craft; this is the craft. §18.1 — with none,
          nothing appears. */}
      {work ? (
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '4 / 3',
            marginTop: space.movement,
          }}
        >
          <Image
            src={work.url}
            alt={work.description}
            fill
            sizes={imageSizes.fullBleed}
            style={{ objectFit: 'cover' }}
          />
        </div>
      ) : null}

      {/* ── 4 · WHAT IT CAN DO ──────────────────────────────────────────
          §5.2 services. In prose, because every alternative is both forbidden
          and wrong: a grid makes craft comparable, a tier table makes it a
          purchase, and a price makes it a commodity. */}
      <section style={{ ...column, paddingTop: space.movement }}>
        <Text role="body" tone="ink2">{does}</Text>
      </section>

      {/* ── 5 · WHAT MAKES IT SO ────────────────────────────────────────
          §5.2 credentials. Stacked lines, never badges in a row — a badge row
          is a grid, and a grid of logos is somebody else's brand doing the
          talking. §18.1 — the studio has stated none, so nothing is shown. */}
      {credentials.length > 0 ? (
        <section style={{ ...column, paddingTop: space.movement }}>
          {credentials.map((line, i) => (
            <Text
              key={line}
              role="body"
              tone="ink2"
              style={{ marginTop: i === 0 ? 0 : space.line }}
            >
              {line}
            </Text>
          ))}
        </section>
      ) : null}

      {/* ── 6 · WHEN IT IS OPEN, AND WHERE ──────────────────────────────
          §8.6 — facts, so lines of text. Placed next to arranging rather than
          at the top, because that is when a customer needs them: the hours and
          the address are what you check while deciding to come, not while
          looking around. The way to the door hangs off the address instead of
          standing alone, which keeps it a consequence of the address rather
          than a button in a row. */}
      <section style={{ ...column, paddingTop: space.movement }}>
        <Text role="body" tone="ink">{hours}</Text>
        <Text role="whisper" tone="ink2" style={{ marginTop: space.line }}>
          {address}
        </Text>
        <div style={{ marginTop: space.breath }}>
          <Button tier="forward" href={directionsHref}>How to find us</Button>
        </div>
      </section>

      {/* ── 7 · ARRANGING A VISIT ───────────────────────────────────────
          §10.4 — "primary: the thing this screen exists to let you do — at
          most one." This is the one, and the only filled control here.

          It is LAST, and that placement is the argument of the whole surface.
          §6.3 makes arranging "the single most frequent deliberate act", which
          pulls it toward the top — but the navigation's own primary control is
          what brought the customer here, so arriving is already the first step
          of arranging. A slab at the top would make this a booking page with a
          photograph on it, which is the one thing a place must not be. The
          studio speaks first; the door is at the end of the room. */}
      {arrangeHref ? (
        <section style={{ ...column, paddingTop: space.rest }}>
          <Button tier="primary" href={arrangeHref} full>
            Arrange a visit
          </Button>
        </section>
      ) : null}
    </main>
  );
}
