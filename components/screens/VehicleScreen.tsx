'use client';
/**
 * VEHICLE
 *
 * Source: docs/AUTOMODZ-OS.md §3.1, §3.2, §3.4, §3.5, §3.6, §4.1, §4.3,
 *         §5.2, §5.3, §5.5, §7.1, §7.4, §7.6, §8.6, §9.5, §11.1, §11.2,
 *         §11.3, §11.4, §11.5, §14.2, §14.3, §14.4, §14.6, §18.1, §18.3,
 *         §18.4, §21.1, §21.3, §21.5, §21.6, §21.7, §21.8, §22.2
 *
 * ── THIS SCREEN DOES NOT SCROLL ──────────────────────────────────────────
 * That is the whole design, stated once. A vehicle screen that scrolls is a
 * details page with a photograph on top, and the photograph stops being the
 * interface the moment there is a document underneath it to get to.
 *
 * The car fills the viewport. Everything else is discovered by touching the
 * car. §11.4 — "regions of the photograph correspond to what protects them.
 * Touching a region reveals the state of that region." That sentence is not a
 * garnish on a details page; it is the navigation model, and this screen
 * implements it as the only one.
 *
 * ── THE INTERACTION ──────────────────────────────────────────────────────
 *   AT REST      the car, whole. Hairline marks where it can be asked. Below
 *                them: its identity, its state, how long it has been ours.
 *
 *   ASKED        touch a mark. Everything but that region recedes, and the
 *                block below becomes the answer for that part of the car.
 *
 *   RELEASED     touch the same mark again, touch the car anywhere else, or
 *                press Escape.
 *
 * It is MODELESS. No sheet, no dialog, no scrim over the subject, no dismiss
 * button. §3.6 — glass never sits on glass, and a sheet would cover the exact
 * thing being asked about. The car is never hidden, because the customer is
 * standing in front of it.
 *
 * ── WHY THE ANSWER LANDS WHERE THE STATE WAS ─────────────────────────────
 * §9.5 — one Display per screen. There is exactly one at every moment, and it
 * always holds the most important phrase right now: the car's state when
 * nothing has been asked, the answer when something has. A second Display for
 * answers would be two subjects (§3.2); a smaller slot for answers would say
 * the car's reply matters less than the car's label.
 *
 * ── WHAT IS NOT HERE, AND WHERE IT WENT ──────────────────────────────────
 * §5.2 lists Vehicle as holding "hero, current state, protection, latest work,
 * media, entry to its history". Four of those six are on this surface. The
 * other two sit at depth one (§4.3), reached through the car rather than laid
 * out beside it:
 *
 *   latest work   through History, which the ownership line opens
 *   media         through each visit's own account (§16.3) — the only place a
 *                 photograph can actually answer "what visit was this?"
 *
 * Laying either of them out here is what would make this the details page the
 * screen exists not to be. It is a real deviation from §5.2, recorded rather
 * than hidden.
 *
 * ── DATA, AND THE MEDIUM ─────────────────────────────────────────────────
 * This component holds no data and fetches none. It also does not know what a
 * photograph is: it is handed a `VehicleRendering` (§11.3) and asks it to draw.
 * There is no image, no URL and no aspect ratio anywhere in this file.
 */
import { useCallback, useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import {
  HAIRLINE, INSET, MEASURE, TARGET_MIN, color, column, duration, easing, imageSizes, radius, scrim, space, stack,
} from '@/design';
import type { StateTone } from '@/design';
import Image from 'next/image';
import { Hero, Heading, Text, Button, Modal, OfflineNote, Glass } from '@/components/system';
import { REGION_NAME } from '@/components/vehicle';
import type { RegionId, RenderedRegion, VehicleRendering } from '@/components/vehicle';

/* ── What the Vehicle needs to be true ───────────────────────────────────
   No photograph, no URL, no aspect ratio — all of that belongs to the
   rendering (§11.3). This is the car as facts. */

export interface VehicleProtection {
  id: string;
  /**
   * Which part of the car it protects — §11.4 — WHEN it protects a part.
   *
   * This was required, and the list was filtered to the four kinds that map to
   * a region: film, ceramic, glass and interior. The other six protect the car
   * without being anywhere on it. A customer's insurance, PUC, registration
   * and FASTag were therefore not merely unreachable in this room; they were
   * never projected into it.
   */
  region?: RegionId;
  /** In the customer's words. §14.2 */
  label: string;
  /** §9.2's four states — the same tone Home gives the same protection. */
  tone: StateTone;
  /**
   * The term, spoken in the unit that suits it (§14.3) at the precision that
   * is honest (§14.4): a date when it is far off, a countdown only when the
   * number is small enough to act on, an amount when it is a balance.
   */
  term: string;
  /** §14.6 — the file, behind one tap, never on the surface. */
  documentHref?: string;
}

/** One photograph of this car, from a visit that produced it. */
export interface VehicleFrame {
  id: string;
  url: string;
  caption?: string;
  /** The visit that produced it, when it came from one. */
  visitHref?: string;
}

/** The car's media, grouped the way a life is remembered: by month. */
export interface VehicleMediaMonth {
  month: string;
  frames: VehicleFrame[];
}

export interface VehicleModel {
  /** The customer's own words for their car. */
  name: string;
  /** §5.5 — the registration is kept: "identity, not jargon". */
  plate: string;
  /**
   * What is happening to it, in the present tense. §5.3 #2 — the one phrase,
   * unmissable, and the Display when nothing has been asked.
   */
  state: string;
  /**
   * How long it has been ours to look after, in time rather than in counts.
   * §2.1 — a tally is the transaction talking.
   */
  since: string;
  /** §5.2 — the entry to its history. Opened by the ownership line. */
  historyHref: string;
  /** §11.1 — protection belongs to the car. Keyed to the part it protects. */
  protections: readonly VehicleProtection[];
  /** Every photograph of this car, newest month first. May be empty. */
  media: readonly VehicleMediaMonth[];
  /** Where the car is corrected. */
  editHref: string;
  /**
   * §18.4 — "no protection declared → invitation, one line, one action."
   * Optional: §10.5 forbids a control with no destination, and this pointed at
   * `/studio`, which has no declare flow.
   */
  declareHref?: string;
  /**
   * THE VISIT THIS CAR HAS COMING.
   *
   * The room named the car's state — "Booked in" — and then said nothing about
   * when, what for, or how to change it. Absent while the car is actually here:
   * a visit in flight is a takeover of its own (§5.4) and must not be reduced
   * to a line on another screen.
   */
  next?: {
    service: string;
    when: string;
    /** Confirmed by the studio, rather than still pending its answer. */
    settled: boolean;
    /** Present only while the customer may still change or cancel it. */
    manageHref?: string;
  };
  /**
   * Present only while the car is actually at the studio. §5.4 — the live
   * account is a takeover reached from the car, and inviting a new booking
   * under the word "In care" is the room contradicting itself.
   */
  followHref?: string;
  /** Arranging a visit for THIS car, from its own room. */
  arrangeHref: string;
}

/**
 * A REGION MARK.
 *
 * §11.4 — "this is discovered, never explained: no coach marks, no tutorial,
 * no pulsing dots demanding a tap." A hairline ring is none of those three: it
 * does not instruct, it does not animate, and it does not ask. It is part of
 * the composition, the way a seam between panels is. Read the other way —
 * nothing drawn at all — the mechanism §11.4 exists to create would be
 * undiscoverable, which is the worse of the two failures.
 *
 * NO ENTRANCE ANIMATION, deliberately. §7.1 — motion never gates content, and
 * a mark that fades in after the car settles is a mark that never appears at
 * all if the animation does not run.
 *
 * §21.1 / WCAG 1.4.11 — one white stroke cannot hold 3:1 against an unknown
 * photograph, so the ring is drawn twice: white over a ring of the same black
 * the scrim floor is built from. Whatever is behind it, one of the two reads.
 *
 * §21.3 — the ring is 12pt, the target is 44. §21.5 — a real button, so it is
 * tabbable and takes the GLOBAL focus ring; this component carried its own for
 * as long as the global one failed 1.4.11, and no longer needs to. §21.8 — its
 * name is the customer's word for that part of their car.
 */
function Mark({
  region, asked, onAsk,
}: {
  region: RenderedRegion;
  asked: boolean;
  onAsk: (id: RegionId) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={asked}
      aria-label={REGION_NAME[region.id]}
      onClick={(e: MouseEvent) => {
        /* The car behind releases on click; a mark must not be read as one. */
        e.stopPropagation();
        onAsk(region.id);
      }}
      style={{
        width: TARGET_MIN,
        height: TARGET_MIN,
        display: 'grid',
        placeItems: 'center',
        background: 'transparent',
        border: 0,
        padding: 0,
        cursor: 'pointer',
        borderRadius: radius.pill,
      }}
    >
      <span
        aria-hidden
        style={{
          width: space.line,
          height: space.line,
          borderRadius: radius.pill,
          border: `${HAIRLINE}px solid ${color.over}`,
          boxShadow: `0 0 0 ${HAIRLINE}px rgba(0,0,0,${scrim.photoFloor})`,
          /* Asked: filled. The only difference between the two states, and it
             is deliberately not a hue — over a photograph no state colour
             survives the scrim (`urgent` measures 1.53:1 against a white
             image). The marks carry no urgency; the words below carry it. */
          background: asked ? color.over : 'transparent',
          transition: `background ${duration.tick}ms ${easing.ease}`,
        }}
      />
    </button>
  );
}

/**
 * WHAT THE CAR IS SAYING.
 *
 * One block, two contents, always in the same place: the car's identity and
 * state when nothing has been asked, the answer for a region when something
 * has. Extracted because both compositions below need it and §22.2 wants one
 * implementation — not because it is reusable anywhere else.
 */
function Saying({
  model, asked, answer,
}: {
  model: VehicleModel;
  asked: RegionId | null;
  answer: VehicleProtection | undefined;
}) {
  const { name, plate, state, since, historyHref, declareHref } = model;

  if (asked) {
    return (
      <>
        {/* §21.8 — the customer's word for the part of their car. */}
        <Text role="data" tone="over" as="span">{REGION_NAME[asked]}</Text>
        {answer ? (
          <>
            <Heading level="display" tone="over" style={{ marginTop: space.hair }}>
              {answer.label}
            </Heading>
            <Text role="body" tone="over" style={{ marginTop: space.line }}>
              {answer.term}
            </Text>
            {/* §14.6 — "every protection may carry its file. It sits behind one
                tap, labelled plainly. It is never the primary surface." One
                line of type, and only when there is a file. */}
            {answer.documentHref ? (
              <div style={{ marginTop: space.breath }}>
                <Button tier="forward" href={answer.documentHref} style={{ color: color.over }}>
                  The original
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          /* §18.4 — "no protection declared → invitation, one line, one
             action." §18.3 — the tone is calm. Nothing has gone wrong; this
             part of the car simply has nothing on it yet. */
          <>
            <Heading level="display" tone="over" style={{ marginTop: space.hair }}>
              Nothing on it yet
            </Heading>
            <div style={{ marginTop: space.gap }}>
              <Button tier="forward" href={declareHref} style={{ color: color.over }}>
                Tell us what protects it
              </Button>
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <>
      {/* Identity. Mono, because a plate is a plate. §5.5 */}
      <Text role="data" tone="over" as="span">{name} · {plate}</Text>
      {/* §5.3 #2, §9.5 — the one Display, when nothing is asked. */}
      <Heading level="display" tone="over" style={{ marginTop: space.hair }}>
        {state}
      </Heading>
      {/* Ownership, and the way into everything that has happened. §5.2 puts
          "entry to its history" on this surface; hanging it on how long the car
          has been ours keeps it a fact about the car rather than a menu item
          beside one. */}
      <div style={{ marginTop: space.breath }}>
        <Button tier="forward" href={historyHref} style={{ color: color.over }}>
          {since}
        </Button>
      </div>
    </>
  );
}

/**
 * WHAT THE ROOM CARRIES BENEATH THE CAR.
 *
 * Extracted because a car with NO PHOTOGRAPH used to lose all of it. §11.5's
 * composed absence is the right treatment for the portrait — "never a grey
 * box, never a placeholder silhouette" — but it was an early return, so the
 * whole room went with the picture: a customer whose car had not been
 * photographed yet could not book a visit, reach its history, or correct its
 * details from its own room. A new customer's first car is exactly that car,
 * so the room was a dead end at the moment it mattered most.
 *
 * The absence keeps the first screenful. Everything the car can DO lives
 * beneath it either way.
 */
function Acts({ model }: { model: VehicleModel }) {
  return (
    <>
      {/* ── WHAT IT HAS COMING ──────────────────────────────────────────
          The room named the car's state and then said nothing about when. A
          customer looking at their own car had to go to the Studio and find
          this visit among every other car's to learn the date, or to change
          it. §18.1 — a car with nothing booked shows an invitation instead,
          and the invitation is the act, not a description of it. */}
      <section style={{ ...column, paddingTop: space.rest }}>
        <Glass pad="gap">
          {model.followHref ? (
            <>
              <Text role="whisper" tone="ink3">With us now</Text>
              <Text role="body" tone="ink2" style={{ marginTop: space.hair }}>
                Your car is at the studio. You can watch the work as it happens.
              </Text>
              <div style={{ marginTop: space.gap }}>
                <Button tier="forward" href={model.followHref}>Follow the work</Button>
              </div>
            </>
          ) : model.next ? (
            <>
              <Text role="whisper" tone="ink3">
                {model.next.settled ? 'Booked in' : 'Waiting on the studio'}
              </Text>
              <Heading level="title" as="h2" style={{ marginTop: space.hair }}>
                {model.next.service}
              </Heading>
              <Text role="body" tone="ink2" style={{ marginTop: space.hair }}>
                {model.next.when}
                {model.next.settled ? '' : ' — we’ll confirm shortly.'}
              </Text>
              <div style={{
                marginTop: space.gap, display: 'flex', gap: space.line, flexWrap: 'wrap',
              }}>
                {model.next.manageHref ? (
                  <Button tier="forward" href={model.next.manageHref}>
                    Change or cancel
                  </Button>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <Text role="whisper" tone="ink3">Nothing booked</Text>
              <Text role="body" tone="ink2" style={{ marginTop: space.hair }}>
                Whenever it needs us, its place is ready.
              </Text>
              <div style={{ marginTop: space.gap }}>
                <Button tier="forward" href={model.arrangeHref}>Arrange a visit</Button>
              </div>
            </>
          )}
        </Glass>
      </section>

      {/* ── WHAT PROTECTS IT ────────────────────────────────────────────
          §11.1 — protection belongs to the car, and this is the car's room.

          It was projected only as marks on the photograph, positioned by
          `regionsFor()`, which has never returned a region because nobody has
          authored one. So the whole layer was unreachable here: a Kia with
          seven live protections — one of them a pollution certificate
          nineteen days from lapsing — showed a name, a plate, one state word
          and two links. Home summarised it; the car itself said nothing.

          Every layer, with its term at the precision `termWords` decided and
          the tone `os/term` gave it. The marks stay: when the studio starts
          locating regions on a photograph they light up, and this list is
          what the room says either way. */}
      {model.protections.length > 0 ? (
        <section style={{ ...column, paddingTop: space.rest }}>
          <Glass pad="gap">
            <Text role="whisper" tone="ink3">What protects it</Text>
            <div style={{ display: 'grid', gap: space.line, marginTop: space.gap }}>
              {model.protections.map(p => (
                <div key={p.id}>
                  <div style={{
                    display: 'flex', alignItems: 'baseline',
                    justifyContent: 'space-between', gap: space.line,
                  }}>
                    <Text role="body" tone="ink2">{p.label}</Text>
                    <Text role="whisper" tone={p.tone} style={{ textAlign: 'right' }}>
                      {p.term}
                    </Text>
                  </div>
                  {/* §14.6 — "every protection may carry its file. It sits
                      behind one tap, labelled plainly." Only where there IS a
                      file: nothing in the product writes one yet, so today
                      this draws nothing rather than a control that lies. */}
                  {p.documentHref ? (
                    <Button tier="quiet" href={p.documentHref} style={{ paddingInline: 0 }}>
                      The original
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </Glass>
        </section>
      ) : model.declareHref ? (
        /* §18.4 — "no protection declared → invitation, one line, one action."
           It existed only behind a region tap, which nothing could perform. */
        <section style={{ ...column, paddingTop: space.rest }}>
          <Glass pad="gap">
            <Text role="whisper" tone="ink3">Nothing declared yet</Text>
            <Text role="body" tone="ink2" style={{ marginTop: space.hair }}>
              Tell us what already protects it and it will live here.
            </Text>
            <div style={{ marginTop: space.gap }}>
              <Button tier="forward" href={model.declareHref}>
                Tell us what protects it
              </Button>
            </div>
          </Glass>
        </section>
      ) : null}

      {/* ── THE CAR'S OWN ACTS ──────────────────────────────────────────
          Correcting it and reading its life. Both were on the old Garage's
          "The car" section; they belong to the car's own room. */}
      <section style={{ ...column, paddingTop: space.rest }}>
        <Glass pad="gap" style={{ display: 'flex', gap: space.line, flexWrap: 'wrap' }}>
          <Button tier="forward" href={model.historyHref}>Its history</Button>
          <Button tier="quiet" href={model.editHref}>Correct the car</Button>
        </Glass>
      </section>

    </>
  );
}

export function VehicleScreen({
  model, rendering,
}: {
  model: VehicleModel;
  rendering: VehicleRendering;
}) {
  const { protections } = model;
  const [asked, setAsked] = useState<RegionId | null>(null);

  /* Which photograph is open. An id, so the model stays the source of truth. */
  const [viewing, setViewing] = useState<string | null>(null);
  const viewed = model.media
    .flatMap(g => g.frames)
    .find(f => f.id === viewing);

  /** Touching a mark asks; touching the one already asked releases it. */
  const ask = useCallback((id: RegionId) => {
    setAsked(current => (current === id ? null : id));
  }, []);

  /* §21.5 — a modeless reveal still needs a keyboard way out, and Escape is
     the one every customer already knows. Bound at the document so it works
     wherever focus is, including on the mark that opened the answer. */
  useEffect(() => {
    if (!asked) return;
    const release = (e: KeyboardEvent) => { if (e.key === 'Escape') setAsked(null); };
    document.addEventListener('keydown', release);
    return () => document.removeEventListener('keydown', release);
  }, [asked]);

  const answer = asked ? protections.find(p => p.region === asked) : undefined;

  /* §11.5 — THE CAR WITH NO RENDERING IS A DIFFERENT COMPOSITION, NOT THE
     SAME ONE WITH THE PHOTOGRAPH MISSING.

     "It is never a grey box, never a placeholder silhouette, NEVER A LARGE
     EMPTY FIELD WITH A SMALL PLATE FLOATING IN IT." Rendered at full height
     with the block anchored to the foot, that last clause is exactly what
     appeared: 700px of near-black with a caption under it, which reads as a
     photograph that failed to load rather than as a car awaiting its first
     visit. The difference between broken and awaiting is composition, so the
     block is centred in the field instead — the same treatment §12.4 gives an
     empty garage, and for the same reason.

     Nothing can be asked here: no photograph means no located regions, so no
     marks are drawn and nothing explains their absence (§18.1). */
  if (!rendering.present) {
    return (
      /* THE ROOM STILL SCROLLS. This used to be `height: 100svh` with
         `overflow: hidden` and an early return, so a car awaiting its first
         photograph lost every act the room offers — booking, its history,
         correcting its details. The absence keeps the first screenful, which
         is what §11.5 is about; it does not get to keep the whole room. */
      <main style={{ background: color.paper, paddingBottom: stack.contentFloor }}>
        <section style={{ position: 'relative', height: '100svh', overflow: 'hidden' }}>
          <rendering.Surface focus={null} priority />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              ...column,
              paddingBottom: stack.bottom,
            }}
          >
            {/* Inline here: the photograph's surface is `inset: 0` and would
                cover a rule across the top. §22.2 — the same component. */}
            <OfflineNote inline />
            <Saying model={model} asked={null} answer={undefined} />
          </div>
        </section>

        <Acts model={model} />
      </main>
    );
  }

  return (
    <main style={{ background: color.paper, paddingBottom: stack.contentFloor }}>
      {/* §20.3 — the car and its record were rendered on the server and are
          still true; only what happens NEXT needs a connection. */}
      <OfflineNote />
    {/* §22.2 — one implementation of anything. The scrim, the entrance settle
       and the overlay's gutter all belong to `Hero`, so this screen composes it
       rather than growing a second copy of a contrast guarantee. The height is
       overridden to the viewport because here the subject IS the screen; `svh`
       rather than `vh` so a collapsing mobile chrome cannot push the answer
       under a fold there is no scroll to recover it from.

       THE SCREEN SCROLLS NOW. The car still owns the first viewport whole —
       that has not changed — but its media and its acts live beneath it, as
       they did on the old Garage. The car is still the subject; it is simply
       no longer the only thing in the room. */}
    <Hero
      state="media"
      band="full"
      style={{ height: '100svh' }}
      overlay={
        /* §21.7 — announced politely when it changes, so the answer reaches
           someone who cannot see the car recede.

           §8.5 — the block clears the navigation by arithmetic. `Hero` insets
           it to the gutter; the stack is this screen's business. */
        <div
          aria-live="polite"
          style={{ maxWidth: MEASURE, paddingBottom: stack.bottom }}
        >
          <Saying model={model} asked={asked} answer={answer} />
        </div>
      }
    >
      {/* ── THE CAR ─────────────────────────────────────────────────────
          §11.3 — the screen asks for the hero for this vehicle and receives
          one. It does not know, and must never learn, what medium answered.

          The release-on-touch-elsewhere handler sits on this wrapper rather
          than on a transparent overlay, so nothing is ever laid over the car.
          It is a convenience and not the accessible path — pressing the mark
          again and Escape both do the same job and are both reachable by
          keyboard — which is why it takes no role and no tab stop.

          §18.1 — when the rendering can locate no region, no mark is drawn and
          nothing explains the absence. The car simply cannot be asked about
          itself yet, and the screen is whole without the interaction. */}
      <div
        style={{ position: 'absolute', inset: 0 }}
        onClick={() => setAsked(null)}
      >
        <rendering.Surface
          focus={asked}
          priority
          mark={region => (
            <Mark region={region} asked={asked === region.id} onAsk={ask} />
          )}
        />
      </div>
    </Hero>

      <Acts model={model} />

      {/* ── MEDIA ───────────────────────────────────────────────────────
          `os/moment` groups by month, never by job — a life is remembered in
          months. §18.1: a car with no photographs shows nothing here, because
          there is nothing to say yet. */}
      {model.media.length > 0 ? (
        <section style={{ ...column, paddingTop: space.movement }}>
          <Glass pad="gap">
          <Text role="whisper" tone="ink3">Its photographs</Text>
          {model.media.map(group => (
            <div key={group.month} style={{ marginTop: space.gap }}>
              <Text role="whisper" tone="ink3">{group.month}</Text>
              <div
                style={{
                  marginTop: space.breath,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
                  gap: space.breath,
                }}
              >
                {group.frames.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setViewing(f.id)}
                    aria-label={f.caption ?? 'Open the photograph'}
                    style={{
                      appearance: 'none',
                      border: 0,
                      padding: 0,
                      background: color.surface,
                      borderRadius: radius.card,
                      overflow: 'hidden',
                      aspectRatio: '1',
                      position: 'relative',
                      cursor: 'pointer',
                    }}
                  >
                    <Image
                      src={f.url}
                      alt={f.caption ?? `${model.name}, photographed at AutoModz`}
                      fill
                      sizes="(max-width: 768px) 33vw, 160px"
                      style={{ objectFit: 'cover' }}
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
          </Glass>
        </section>
      ) : null}

      {/* THE VIEWER — a photograph deserves the whole surface (§13.2). */}
      <Modal
        open={viewed !== undefined}
        onClose={() => setViewing(null)}
        label={viewed?.caption ?? 'Photograph'}
      >
        {viewed ? (
          <div style={{
            minHeight: '100svh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            paddingInline: INSET,
          }}>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3' }}>
              <Image
                src={viewed.url}
                alt={viewed.caption ?? `${model.name}, photographed at AutoModz`}
                fill
                sizes={imageSizes.fullBleed}
                style={{ objectFit: 'contain' }}
              />
            </div>
            {viewed.caption ? (
              <Text role="body" tone="ink2" style={{ marginTop: space.gap }}>
                {viewed.caption}
              </Text>
            ) : null}
            <div style={{ marginTop: space.gap, display: 'flex', gap: space.gap, flexWrap: 'wrap' }}>
              {viewed.visitHref ? (
                <Button tier="forward" href={viewed.visitHref}>The visit it came from</Button>
              ) : null}
              <Button tier="quiet" onClick={() => setViewing(null)}>Close</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </main>
  );
}
