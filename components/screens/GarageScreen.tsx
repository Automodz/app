'use client';
/**
 * GARAGE
 *
 * Source: docs/AUTOMODZ-OS.md §3.1, §3.2, §3.5, §4.3, §5.2, §7.5, §8.4,
 *         §9.5, §11.2, §11.5, §12.1, §12.2, §12.3, §12.4, §18.1, §18.2,
 *         §18.3, §18.4, §21.1
 *         design "AutoModz App.dc.html" - screen 1h
 *
 * ── WHAT THIS SCREEN IS ──────────────────────────────────────────────────
 * §12.1 - "The collection. Every car the customer owns, each present as a
 * photograph with its current state." And, since the design, the record
 * underneath it: what the studio has done, across every car, most recent
 * first.
 *
 * Those two belong on one screen because they are one question asked in two
 * tenses - what do I have, and what has been done to it. Splitting them was
 * what gave History a tab of its own; screen 1h takes the tab back and puts
 * the answer where the question is (see navigation/routes.ts).
 *
 * ── DOMINANCE BELONGS TO THE POSITION, NOT TO THE CAR ────────────────────
 * §3.2 - one subject per surface; §9.5 - one Display per screen. The first
 * car is therefore the screen's subject and carries the photograph at size;
 * every car after it is a pane.
 *
 * §12.3 - "Cars are equals. No car is 'primary' - that is the studio's
 * convenience, not the owner's feeling about their vehicles." Both hold at
 * once, because the emphasis is attached to the FIRST POSITION IN THE STRIP
 * rather than to whatever car is standing in it. The order is the studio's
 * attention - the car currently with us, or most recently - so a car moves
 * into and out of the lead as its situation changes. Nothing here, and nothing
 * in `GarageModel`, stores a primary flag.
 *
 * ── WHY EVERY WORD OVER A PHOTOGRAPH IS WHITE ────────────────────────────
 * `scrim.photoFloor` is solved for white on a pure-white image and clears AA
 * by a hair. Neither `over2` nor any state colour survives it. So urgency in
 * the collection is carried by WORDS, never by hue - with one exception the
 * design introduces and §21.6 permits: the state line under a lead car is
 * amber ON GLASS, not on the photograph, where the ground is known.
 *
 * ── DATA ─────────────────────────────────────────────────────────────────
 * This component holds none and fetches none.
 */
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { CarForm } from '@/components/garage/CarForm';
import { color, space, radius, imageSizes, TARGET_MIN } from '@/design';
import { OfflineNote } from '@/components/system';
import {
  Screen, Pane, Label, Statement, Rail, Chevron, Action, Value, Photograph,
} from '@/components/os';

/* ── What the collection needs to be true ─────────────────────────────── */

export interface GarageVehicle {
  id: string;
  /** The customer's own words for their car. */
  name: string;
  /** §5.5 - the registration is kept: "identity, not jargon". */
  plate: string;
  /** §11.5 - absent until the studio has photographed it. */
  photo?: string;
  /** What is happening to it, in the present tense. §12.3, §5.3 #2 */
  state: string;
  /** What protects it, in one line: the thing needing attention soonest. */
  protection: string;
  /** The relationship, in time rather than in counts. §2.1 */
  relationship: string;
  /**
   * SOMETHING THE STUDIO SAID ABOUT THIS CAR THAT HAS NOT BEEN SEEN.
   * §17.1 - the car is the inbox. Never a count, never a body, never a list.
   */
  news?: boolean;
  href: string;
}

/** The vehicle as the form needs it - enough to correct, nothing more. */
export interface GarageEditable {
  id: string;
  name: string;
  registrationNumber: string;
  /** Optional facts the car's own room draws (design 1d), so the form
      re-opens on what is already recorded rather than on a blank field. */
  odometer?: number;
  year?: number;
}

/** One sealed visit, across the whole collection. Design 1h. */
export interface GarageRecord {
  id: string;
  title: string;
  when: string;
  vehicle: string;
  /** What was settled, where a figure exists. Never recomputed here. */
  settled?: string;
  href: string;
}

export interface GarageModel {
  vehicles: GarageVehicle[];
  /** §12.4 - where the invitation leads when there is no car yet. */
  beginHref: string;
  addHref: string;
  editable: GarageEditable[];
  record: readonly GarageRecord[];
  /** The full album for the car the collection leads with. */
  historyHref: string;
}

export function GarageScreen({ model }: { model: GarageModel }) {
  const { vehicles, beginHref, addHref, editable, record, historyHref } = model;

  /* Correcting a car is addressable (§6.4) - `?edit=<id>` and `?add=1`, so the
     back button closes the sheet and the Vehicle room can link straight into
     it. Kept exactly as it was; the design changed the collection, not the
     way a car is corrected. */
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const editingId = params.get('edit');
  const adding = params.get('add') === '1';
  const editing = editable.find(v => v.id === editingId) ?? null;

  const close = () => {
    const next = new URLSearchParams(params.toString());
    next.delete('edit');
    next.delete('add');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const openEdit = (id: string) => {
    const next = new URLSearchParams(params.toString());
    next.set('edit', id);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  /* §12.4 - the composed absence. A garage with no car is an invitation, not
     an empty list, and it is the whole screen rather than a card on one. */
  if (vehicles.length === 0) {
    return (
      <Screen top={space.rest}>
        <OfflineNote />
        <Statement eyebrow="Your garage">Nothing here yet</Statement>
        <p
          style={{
            marginTop: space.gap, marginBottom: 0,
            fontSize: 15, lineHeight: 1.65, color: color.ink2,
          }}
        >
          The place is ready. Add the car you want looked after, and everything
          the studio does to it will collect here - the work, the papers, the
          photographs.
        </p>
        <div style={{ marginTop: space.rest, display: 'flex', flexDirection: 'column', gap: space.line }}>
          <Action href={addHref}>Add a car</Action>
          <Action href={beginHref} quiet>Arrange a visit</Action>
        </div>
        <CarForm open={adding} onClose={close} />
      </Screen>
    );
  }

  const [lead, ...rest] = vehicles;

  return (
    <Screen top={space.gap}>
      <OfflineNote />

      <Statement eyebrow={`${vehicles.length} car${vehicles.length === 1 ? '' : 's'}`}>
        Garage
      </Statement>

      {/* ── THE LEAD ────────────────────────────────────────────────────
          §11.2 - the photograph at size. The whole frame is the link (§4.3):
          a chevron or a "View" control would put an interface between an owner
          and their own car. */}
      <div style={{ marginTop: space.gap, display: 'flex', flexDirection: 'column', gap: space.line }}>
        <Link
          href={lead.href}
          className="am-tap"
          style={{
            position: 'relative', display: 'block', height: 190,
            borderRadius: radius.sheet, overflow: 'hidden', textDecoration: 'none',
            border: `1px solid ${lead.news ? 'rgba(224,164,92,0.25)' : 'rgba(255,255,255,0.08)'}`,
            /* §7.5 - the photograph moves between this frame and the car's own
               hero rather than crossfading. Declared per car so two frames can
               never claim the same name. */
            viewTransitionName: `car-${lead.id}`,
          }}
        >
          {lead.photo ? (
            /* THROUGH THE PRIMITIVE. The composed absence below is still this
               screen's own - it is the lit field §11.5 asks for - and the
               primitive owns the other two states, including the failure the
               class-only path could not express. */
            <Photograph
              src={lead.photo}
              alt={`${lead.name}, photographed at AutoModz`}
              priority
              sizes={imageSizes.inMeasure}
            />
          ) : (
            /* §11.5 - the composed absence. A field lit from above: enough
               structure to read as awaiting rather than as a failed load. */
            <span
              aria-hidden
              style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(120% 80% at 50% 30%, ${color.surface} 0%, ${color.paper} 70%)',
              }}
            />
          )}
          <span
            aria-hidden
            style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(180deg, rgba(8,9,10,0.1), rgba(8,9,10,0.85))',
            }}
          />
          <span
            style={{
              position: 'absolute', left: space.gap, right: space.gap, bottom: space.line + 2,
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
              gap: space.line,
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span
                style={{ fontSize: 16, color: color.over, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {lead.name}
                {/* §17.1 - one mark on the car, saying only that there is
                    something here the customer has not seen. Never a count,
                    and white rather than amber: nothing coloured survives a
                    scrim solved for a white photograph. */}
                {lead.news ? (
                  <span
                    aria-label="Something new about this car"
                    style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: color.over, flexShrink: 0,
                    }}
                  />
                ) : null}
              </span>
              <span
                className="am-label"
                style={{ fontSize: 10, letterSpacing: '0.14em', color: color.over2 }}
              >
                {lead.plate}
              </span>
            </span>
            {/* The state, over the photograph, in WORDS - and white, because
                nothing coloured survives a scrim solved for a white image. */}
            <span
              className="am-label"
              style={{ fontSize: 10, letterSpacing: '0.16em', color: color.over, textAlign: 'right' }}
            >
              {lead.state}
            </span>
          </span>
        </Link>

        {/* What protects it, and how long it has been here. On glass, below
            the photograph, where colour is allowed because the ground is
            known. §17.1 - the mark for unseen news is on the car itself. */}
        <Pane
          style={{
            padding: `${space.line + 2}px ${space.gap + 2}px`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: space.line,
          }}
        >
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 13.5, color: color.ink }}>{lead.protection}</span>
            <Label style={{ fontSize: 9.5, letterSpacing: '0.14em' }}>{lead.relationship}</Label>
          </span>
          <button
            type="button"
            onClick={() => openEdit(lead.id)}
            className="am-tap am-label"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
              letterSpacing: '0.16em', minHeight: TARGET_MIN,
            }}
          >
            Correct
          </button>
        </Pane>

        {/* ── EVERY OTHER CAR ───────────────────────────────────────────
            §12.3 - equals. A pane each, the same pane, in the studio's order
            of attention and in no other order. */}
        {rest.map(v => (
          <Pane
            key={v.id}
            as={Link}
            {...{ href: v.href }}
            style={{
              padding: `${space.gap}px ${space.gap + 2}px`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: space.line, textDecoration: 'none',
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 15.5, color: color.ink }}>
                {v.name}
                {v.news ? (
                  <>
                    {' '}
                    <span
                      aria-label="Something new about this car"
                      style={{
                        display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                        background: color.amber, verticalAlign: 'middle',
                      }}
                    />
                  </>
                ) : null}
              </span>
              <Label style={{ fontSize: 10, letterSpacing: '0.14em' }}>{v.plate}</Label>
            </span>
            <Value>{v.protection}</Value>
          </Pane>
        ))}

        {/* §12.2's invitation, as a control rather than a card - dashed, so it
            reads as a place for something that is not there yet. */}
        <button
          type="button"
          onClick={() => {
            const next = new URLSearchParams(params.toString());
            next.set('add', '1');
            router.replace(`${pathname}?${next.toString()}`, { scroll: false });
          }}
          className="am-tap"
          style={{
            minHeight: TARGET_MIN, padding: `${space.gap}px ${space.gap + 2}px`,
            borderRadius: radius.pane, border: '1px dashed rgba(255,255,255,0.13)',
            background: 'none', cursor: 'pointer',
            fontSize: 13.5, color: color.ink3, font: 'inherit', textAlign: 'center',
          }}
        >
          Add a car
        </button>
      </div>

      {/* ── THE RECORD ──────────────────────────────────────────────────
          Screen 1h. Rows, not cards: a thing that happened is a line. Each
          one opens the visit it names - §17.3, a doorway to the object. */}
      {record.length > 0 ? (
        <section
          aria-labelledby="garage-record"
          style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line }}
        >
          <h2 id="garage-record" style={{ margin: 0 }}><Rail>History</Rail></h2>
          <div>
            {record.map((r, i) => (
              <Link
                key={r.id}
                href={r.href}
                className="am-tap"
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  gap: space.line, minHeight: TARGET_MIN,
                  padding: `${space.line + 3}px ${space.hair}px`,
                  borderBottom: i === record.length - 1
                    ? undefined
                    : '1px solid rgba(255,255,255,0.06)',
                  textDecoration: 'none',
                }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 14.5, color: color.ink }}>{r.title}</span>
                  <Label style={{ fontSize: 10, letterSpacing: '0.14em' }}>
                    {r.when} · {r.vehicle}
                  </Label>
                </span>
                {r.settled ? <Value>{r.settled}</Value> : <Chevron size={16} />}
              </Link>
            ))}
          </div>
          <Action href={historyHref} quiet>The whole album</Action>
        </section>
      ) : null}

      {/* Correcting a car, and adding one. One form, two addresses. */}
      <CarForm open={adding || editing !== null} onClose={close} editing={editing} />
    </Screen>
  );
}
