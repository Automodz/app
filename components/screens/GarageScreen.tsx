'use client';
/**
 * GARAGE
 *
 * Source: docs/AUTOMODZ-OS.md §3.1, §3.2, §3.5, §4.3, §5.2, §7.5, §8.4,
 *         §9.5, §11.2, §11.5, §12.1, §12.2, §12.3, §12.4, §18.1, §18.2,
 *         §18.3, §18.4, §21.1
 *
 * ── WHAT THIS SCREEN IS ──────────────────────────────────────────────────
 * §12.1 — "The collection. Every car the customer owns, each present as a
 * photograph with its current state."
 *
 * Not a list of vehicles. The difference is not decorative: a list is a
 * rendering of records, and the feeling it produces is the feeling of
 * browsing stock. What is built here is a continuous vertical strip of
 * full-bleed photographs with no gaps, no containers, and no chrome — closer
 * to turning the pages of a book of one's own things than to reading a table
 * of them. There is nothing on this screen that is not a photograph or a
 * line of type over one.
 *
 * ── DOMINANCE BELONGS TO THE POSITION, NOT TO THE CAR ────────────────────
 * §3.2 — "Each surface has exactly one thing it is about, and that thing is
 * unmistakably dominant." §9.5 — one Display per screen. The first frame is
 * therefore the screen's subject and carries the Display; every frame after
 * it carries a Title.
 *
 * §12.3 — "Cars are equals. No car is 'primary' — that is the studio's
 * convenience, not the owner's feeling about their vehicles."
 *
 * Both hold at once, because the emphasis is attached to the FIRST POSITION
 * IN THE STRIP rather than to whatever car is standing in it. The order is
 * the studio's attention — the car currently with us, or most recently — so
 * a car moves into and out of the lead as its situation changes. Nothing
 * here, and nothing in `GarageModel`, stores a primary flag. There is
 * deliberately no way for this screen to express one.
 *
 * ── WHY EVERY WORD OVER A PHOTOGRAPH IS WHITE ────────────────────────────
 * `scrim.photoFloor` is solved for white on a pure-white image and clears AA
 * by a hair. Neither `over2` nor any of the four state colours survives it —
 * `urgent` measures 1.53:1 against a scrimmed white photograph. So urgency
 * in the collection is carried by WORDS ("Pollution certificate, 6 days"),
 * never by hue, and the strip is monochrome throughout. §21.6 is satisfied
 * the strict way: colour was never a carrier here at all.
 *
 * ── DATA ─────────────────────────────────────────────────────────────────
 * This component holds none and fetches none.
 */
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { CarForm } from '@/components/garage/CarForm';
import {
  color, space, INSET, MEASURE, column, photoSize, stack, imageSizes,
} from '@/design';
import { Hero, Heading, Text, Button, OfflineNote } from '@/components/system';

/* ── What the collection needs to be true ────────────────────────────────
   §12.3 names what a car shows here — "its photograph, its name, its plate,
   and one line of state" — and requirement 12 adds the two facts that make a
   car feel owned rather than filed. Nothing else is asked for, because
   nothing else is rendered. */

export interface GarageVehicle {
  id: string;
  /** The customer's own words for their car. */
  name: string;
  /** §5.5 — the registration is kept: "identity, not jargon". */
  plate: string;
  /** §11.5 — absent until the studio has photographed it. */
  photo?: string;
  /** What is happening to it, in the present tense. §12.3, §5.3 #2 */
  state: string;
  /**
   * What protects it, in one line: the thing that needs attention soonest,
   * or the fact that nothing does. §14.4 — a countdown only when the number
   * is small enough to act on. Never a colour; see the note above.
   */
  protection: string;
  /**
   * The relationship with the studio, expressed in time rather than in
   * counts. "With AutoModz since 2023", not "14 visits" — §2.1, the car is
   * the subject, and a tally is the transaction talking.
   */
  relationship: string;
  href: string;
}

/** The vehicle as the form needs it — enough to correct, nothing more. */
export interface GarageEditable {
  id: string;
  name: string;
  registrationNumber: string;
}

export interface GarageModel {
  /**
   * In the studio's order of attention. See the note above: the first
   * position is emphasised, the car in it is not.
   */
  vehicles: GarageVehicle[];
  /** §12.4 — where the invitation leads when there is no car yet. */
  beginHref: string;
  /**
   * Where a car is added. The Garage is where cars live and could not add one:
   * a customer who had just signed in was offered arranging a visit and no way
   * to say what car it was for.
   */
  addHref: string;
  /** The same cars, in the shape the form writes back. */
  editable: GarageEditable[];
}

/**
 * ONE CAR IN THE COLLECTION.
 *
 * The whole photograph is the link. §4.3 — depth of one; and requirement 13,
 * that selecting a car should feel like opening an album rather than
 * following a control. A chevron, a "View" button or a tap target smaller
 * than the image would all put an interface between the owner and their car.
 *
 * §7.5 — "When a photograph appears on two consecutive surfaces, it moves
 * between them." The `viewTransitionName` is what lets the browser carry
 * this exact photograph into the vehicle's own hero instead of crossfading
 * it. It is declared per car so two frames can never claim the same name.
 */
function Vehicle(
  { vehicle, lead, onEdit }:
  { vehicle: GarageVehicle; lead: boolean; onEdit: () => void },
) {
  const { name, plate, photo, state, protection, relationship, href } = vehicle;

  /* The frame is the link and the edit control sits ON it, so the control is a
     sibling of the link rather than a child — a button inside an anchor is
     invalid markup and, worse, gives a keyboard user one target that does two
     things. */
  return (
    <div style={{ position: 'relative' }}>
    <Link href={href} style={{ display: 'block', textDecoration: 'none' }}>
      <Hero
        state={photo ? 'media' : 'awaiting'}
        /* The band follows the type, because the type is what the scrim has
           to hold. The lead speaks at Display and its block measures ~207px
           when the phrase wraps; every other frame speaks at Title and
           measures ~110px. Giving the lead `brief` put the top of its Display
           above the hold band, in the part of the gradient that is already
           fading — measured, not guessed. */
        band={lead ? 'full' : 'brief'}
        /* THE COLLECTION SIZES ONLY ITS PHOTOGRAPHS. A car with no photograph
           keeps `Hero`'s own awaiting height, which §11.5 makes shorter on
           purpose — "never a large empty field with a small plate floating in
           it". Forcing the collection height onto it produced exactly that:
           473px of near-black with a caption at the foot. The frame is
           shorter than its neighbours and that is the point; it reads as
           awaiting rather than as a photograph that failed to load. */
        style={photo ? { height: lead ? photoSize.lead : photoSize.next } : undefined}
        overlay={
          <div style={{ maxWidth: MEASURE }}>
            <Text role="data" tone="over" as="span">
              {name} · {plate}
            </Text>

            {/* §9.5 — the one Display belongs to the first position. Every
                other car speaks at Title: still the subject of its own
                frame, never the subject of the screen. */}
            <Heading
              level={lead ? 'display' : 'title'}
              tone="over"
              as={lead ? 'h1' : 'h2'}
              style={{ marginTop: space.hair }}
            >
              {state}
            </Heading>

            {/* The two facts that make a car feel owned: what is holding, and
                how long it has been ours to look after. One line, quietest
                role, and no numbers to parse. */}
            <Text role="whisper" tone="over" style={{ marginTop: space.breath }}>
              {protection} · {relationship}
            </Text>
          </div>
        }
      >
        {photo ? (
          <Image
            src={photo}
            alt={`${name}, photographed at AutoModz`}
            fill
            /* Only the first photograph is worth blocking the first paint
               for; the rest are below the fold by construction. */
            priority={lead}
            sizes={imageSizes.fullBleed}
            style={{
              objectFit: 'cover',
              viewTransitionName: `vehicle-${vehicle.id}`,
            }}
          />
        ) : (
          /* §11.5 — composed, never a grey box or a silhouette. A car with no
             photograph yet still belongs in the collection at full size; it
             is awaiting its first visit, not missing. */
          null
        )}
      </Hero>
    </Link>

      {/* CORRECT THIS CAR. §21.3 — a real 44pt target, and §21.6 names which
          car it corrects so a screen reader hears "Correct the Defender 110"
          rather than six identical "Edit"s. */}
      <div style={{ position: 'absolute', top: space.gap, right: INSET }}>
        <Button
          tier="quiet"
          onClick={onEdit}
          aria-label={`Correct ${name}`}
          style={{ color: color.over }}
        >
          Edit
        </Button>
      </div>
    </div>
  );
}

/**
 * §12.4 — "An empty garage is the most important screen a new customer will
 * ever see, and it is an invitation, not an error. One sentence, one action.
 * It never apologises, never explains what a garage is, and never shows an
 * empty container."
 *
 * So: no dashed rectangle, no illustration, no plus (§18.2). The screen holds
 * one line and one way to begin, and the line is about the car rather than
 * about the software's emptiness — §18.3, "emptiness is not failure."
 */
function Invitation({ href, addHref }: { href: string; addHref: string }) {
  return (
    <div
      style={{
        minHeight: `calc(100svh - ${stack.navHeight}px)`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        ...column,
      }}
    >
      <Heading level="display">Your car&rsquo;s place is ready.</Heading>
      <Text role="body" tone="ink2" style={{ marginTop: space.line, maxWidth: MEASURE }}>
        Add it and everything else follows &mdash; its protection, its visits,
        its record.
      </Text>
      {/* THE GARAGE IS WHERE CARS LIVE, AND IT COULD NOT ADD ONE.
          A customer who had just signed in was offered exactly one act here —
          arranging a visit — with no way to tell us what car it was for. §18.4
          gives an empty room "one line and one action", and the action has to
          be the one that resolves the emptiness: this room is empty because
          there is no car in it. Arranging stays, one tier down, because a
          first visit is still worth offering. */}
      <div style={{
        marginTop: space.rest, display: 'flex', gap: space.gap, flexWrap: 'wrap',
      }}>
        <Button tier="primary" href={addHref}>Add your car</Button>
        <Button tier="quiet" href={href}>Arrange its first visit</Button>
      </div>
    </div>
  );
}

export function GarageScreen({ model }: { model: GarageModel }) {
  const { vehicles, beginHref, addHref, editable } = model;

  /* THE FORM IS ADDRESSABLE (§6.4). `?add=1` opens a new car, `?edit=<id>`
     corrects one — so both are linkable, restorable on reload, and closed by
     the back button. The old Garage used `?sheet=car-form&car-id=`; the same
     idea, in this application's vocabulary. */
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const adding = params.get('add') === '1';
  const editingId = params.get('edit');
  const editing = editable.find(v => v.id === editingId) ?? null;

  const close = () => {
    const next = new URLSearchParams(params.toString());
    next.delete('add');
    next.delete('edit');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const openEdit = (id: string) => {
    const next = new URLSearchParams(params.toString());
    next.set('edit', id);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const openAdd = () => {
    const next = new URLSearchParams(params.toString());
    next.set('add', '1');
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

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
      {/* §20.3 — the room was rendered on the server and is still true; only
          what happens NEXT needs a connection. One implementation (§22.2). */}
      <OfflineNote />
      {vehicles.length === 0 ? (
        <Invitation href={beginHref} addHref={addHref} />
      ) : (
        /* No gaps, no dividers, no padding between frames. The strip is
           continuous on purpose: each photograph's own scrim darkens toward
           its foot and the next begins bright, so the seam is made of light
           rather than of a rule. §3.4 — light is the only ornament.

           §12.2 — "With a single vehicle, the Garage does not exist as a
           meaningful place." A collection of one therefore renders as that
           one car and nothing else: no count, no header, no framing that
           would announce a collection that isn't there. Going straight to
           the car instead of showing this at all is a routing decision, and
           it belongs to whoever owns the shell — this screen has no business
           redirecting anyone. */
        vehicles.map((vehicle, i) => (
          <Vehicle
            key={vehicle.id}
            vehicle={vehicle}
            lead={i === 0}
            onEdit={() => openEdit(vehicle.id)}
          />
        ))
      )}

      {/* ADD A CAR. Present whenever there is already a collection — the empty
          state has its own invitation and does not need a second control. */}
      {vehicles.length > 0 ? (
        <section style={{ ...column, paddingTop: space.movement }}>
          <Button tier="primary" onClick={openAdd}>Add a car</Button>
        </section>
      ) : null}

      <CarForm
        open={adding || editing !== null}
        onClose={close}
        editing={editing ? ({
          id: editing.id,
          name: editing.name,
          registrationNumber: editing.registrationNumber,
        } as never) : null}
      />
    </main>
  );
}
