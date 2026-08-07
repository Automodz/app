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
import { useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { Service, Subscription, Vehicle } from '@/lib/types';
import { BookingFlow } from '@/components/studio/BookingFlow';
import { ManageVisit } from '@/components/studio/ManageVisit';
import type { ManageVisitModel } from '@/components/studio/ManageVisit';
import { Hero, Heading, Text, Button, OfflineNote, Glass } from '@/components/system';

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
  /** The menu, the cars and the standing — everything arranging a visit needs. */
  booking: {
    services: Service[];
    vehicles: Vehicle[];
    membership: Subscription | null;
  };
  /** Visits the customer may still move or cancel. */
  manageable: ManageVisitModel[];
}

export function StudioScreen({ model }: { model: StudioModel }) {
  const {
    place, presence, visitHref, voice, work, does,
    credentials = [], hours, address, directionsHref, photo, booking, manageable,
  } = model;

  /* ARRANGING IS ADDRESSABLE (§6.4). `?arrange=1`, and `?cat=` carries the
     category a proposal named — the same prefill the old `?sheet=arrange&cat=`
     gave, so a "Renew it" from Home lands on the right service. */
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const arranging = params.get('arrange') === '1';
  const managingId = params.get('manage');
  const managing = manageable.find(v => v.id === managingId) ?? null;

  const closeManage = () => {
    const next = new URLSearchParams(params.toString());
    next.delete('manage');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  /* §6.4 — moving or cancelling is addressable, so opening the sheet writes
     the address rather than setting local state. The back button closes it,
     and Home's "Manage the visit" lands on exactly the same URL. */
  const openManage = (id: string) => {
    const next = new URLSearchParams(params.toString());
    next.set('manage', id);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  /** The day a visit falls on, said the way a person would say it. */
  const longDay = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'long',
    });
  const prefillCategory = params.get('cat');

  const setArranging = (on: boolean) => {
    const next = new URLSearchParams(params.toString());
    if (on) next.set('arrange', '1');
    else { next.delete('arrange'); next.delete('cat'); }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  /* A proposal that named a category means the customer arrived to arrange
     that thing — opening straight into it saves a step they did not ask for. */
  useEffect(() => {
    if (prefillCategory && !arranging) setArranging(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillCategory]);

  return (
    <main
      style={{
        /* TRANSPARENT ON PURPOSE. The room stands in the ambient field,
           which is fixed behind everything (components/system/Ambient.tsx).
           Painting `color.paper` here would occlude it completely. The dark
           ground still exists — it is on `body` — so nothing loses contrast. */
        background: 'transparent',
        minHeight: '100svh',
        /* §8.5 — content clears the navigation by arithmetic. */
        paddingBottom: stack.contentFloor,
      }}
    >
      {/* §20.3 — the room was rendered on the server and is still true; only
          what happens NEXT needs a connection. One implementation (§22.2). */}
      <OfflineNote />
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
        {/* Hours and address are the practical facts a customer checks while
            deciding to come, and they were three loose lines on the ground.
            On a card they read as the studio's details rather than as more
            prose in the same column as the studio's voice. */}
        <Glass pad="gap">
          <Text role="body" tone="ink">{hours}</Text>
          <Text role="whisper" tone="ink2" style={{ marginTop: space.line }}>
            {address}
          </Text>
          <div style={{ marginTop: space.gap }}>
            <Button tier="forward" href={directionsHref}>How to find us</Button>
          </div>
        </Glass>
      </section>

      {/* ── 6b · THE VISITS ALREADY ARRANGED ────────────────────────────
          `ManageVisit` has always been able to move or cancel one, and until
          now NOTHING RENDERED A CONTROL THAT OPENED IT: the sheet was reachable
          only by typing `?manage=<id>` into the address bar. A customer could
          make a booking and then had no way in the product to change it — and
          no way to see it at all. `manageable` was already projected and
          already mirrored `firestore.rules`; it simply was not drawn.

          §18.1 — nothing booked, nothing here. The invitation is the primary
          control below, not a second empty card. */}
      {manageable.length > 0 ? (
        <section style={{ ...column, paddingTop: space.movement }}>
          <Text role="whisper" tone="ink3">
            {manageable.length === 1 ? 'Your visit' : 'Your visits'}
          </Text>
          <div style={{ display: 'grid', gap: space.line, marginTop: space.line }}>
            {manageable.map(v => (
              <Glass key={v.id} pad="gap">
                <Text role="body" tone="ink">{v.service}</Text>
                <Text role="whisper" tone="ink3" style={{ marginTop: space.hair }}>
                  {v.vehicleName} &middot; {longDay(v.scheduledDate)}
                  {v.scheduledTime ? ` at ${v.scheduledTime}` : ''}
                </Text>
                {v.changeable ? (
                  <div style={{ marginTop: space.gap }}>
                    <Button tier="forward" onClick={() => openManage(v.id)}>
                      Change or cancel
                    </Button>
                  </div>
                ) : null}
              </Glass>
            ))}
          </div>
        </section>
      ) : null}

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
      <section style={{ ...column, paddingTop: space.rest }}>
        <Button tier="primary" onClick={() => setArranging(true)} full>
          Arrange a visit
        </Button>
      </section>

      {/* THE VISIT ITSELF. Was an outbound WhatsApp link, because there was no
          in-app booking surface — the single most important control in the
          product handed the customer to another application. There is one now. */}
      <BookingFlow
        open={arranging}
        onClose={() => setArranging(false)}
        services={booking.services}
        vehicles={booking.vehicles}
        membership={booking.membership}
        prefillCategory={prefillCategory}
      />

      {/* MOVING OR CANCELLING ONE. Home's "Manage the visit" lands here with
          `?manage=<id>` — the address the resolver already emits. */}
      <ManageVisit open={managing !== null} onClose={closeManage} visit={managing} />
    </main>
  );
}
