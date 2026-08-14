/**
 * A SERVER COMPONENT. It holds no state, no handlers and no motion - it is
 * handed a model and draws it - so marking it `'use client'` shipped its
 * markup to the browser twice and hydrated it for nothing. The interactive
 * pieces it renders carry their own directive.
 */
/**
 * HISTORY - the album.
 *
 * Source: docs/AUTOMODZ-OS.md §5.2, §6.4, §8.4, §8.6, §9.5, §16.1, §16.2,
 *         §18.1, §21.1, §21.6
 *
 * §16.1 - "Every completed visit, newest first, as a series of transformations.
 * Not a log. Not a table. Not a list of invoices."
 *
 * So: a continuous strip of full-bleed photographs, newest first, each with its
 * date, its title and one sentence. The same album grammar as the Garage, for
 * the same reason - there and here the subject is a photograph, and the caption
 * belongs on it.
 *
 * §6.4 + §8.6 + §16.4 - a visit's full account is addressable, full-screen and
 * shareable, so it is a ROUTE (`/history/[id]`) rather than something that
 * unfolds in place. An accordion could satisfy none of the three.
 *
 * §9.5 - the newest visit carries the one Display; every other carries a Title.
 * That is position, not rank: §16.2 makes every completed visit equally
 * permanent.
 */
import Link from 'next/link';
import { Photograph } from '@/components/os/Photograph';
import { space, MEASURE, photoSize, stack, imageSizes } from '@/design';
/* Deep imports, NOT the `components/system` barrel. The barrel re-exports
   every primitive, a dozen of them `'use client'` with Radix and
   framer-motion behind them, and reaching through it from a server
   component pulls all of that into the page's client bundle. Measured on
   the legal pages: 167 kB → 108 kB from this change alone. */
import { Hero } from '@/components/system/Hero';
import { Heading } from '@/components/system/Heading';
import { Back } from '@/components/os/RoomHeader';
import { Text } from '@/components/system/Text';
import { Button } from '@/components/system/Button';
import { OfflineNote } from '@/components/system/OfflineNote';
import { color, INSET, HAIRLINE } from '@/design';

export interface HistoryPhoto {
  url: string;
  /** §21.6 - an image that carries meaning carries a description. */
  description: string;
  /** "Before", "During", "After" - only inside an account. */
  caption?: string;
}

export interface HistoryDocument {
  label: string;
  href: string;
}

export interface HistoryVisit {
  id: string;
  when: string;
  /** `2026` - the album puts a divider between one year and the next. */
  year?: string;
  title: string;
  /** One sentence. What it felt like, not what was billed. */
  line: string;
  /** §16.3 - the car as it was finished. */
  photo?: HistoryPhoto;
  /** §16.3 - what was done, in plain language. */
  did: string;
  /** §16.3 - before, during, after. */
  photos?: readonly HistoryPhoto[];
  /** §16.3 - what it promised, and for how long. */
  promised?: readonly { label: string; term: string }[];
  /** §16.3 - what it cost and how it was settled. One line, never a table.
      The ALBUM's reading of the money; the Visit screen shows the receipt. */
  settled?: string;

  /**
   * BEFORE AND AFTER, when the job recorded both.
   *
   * Present only when both sides exist - a comparison missing one half is not
   * a comparison, and filling it from an unrelated frame would be a lie about
   * the customer's own car.
   */
  comparison?: { before: string; after: string };

  /**
   * THE RECEIPT, carried verbatim from the invoice.
   *
   * These figures existed and lived one tap away at `/invoice/[id]`, so the
   * customer had to leave the record of the work to learn what the work cost.
   * Nothing here recomputes a total; the paper is still reachable for whoever
   * wants the document itself.
   */
  receipt?: {
    number: string;
    lineItems: readonly { name: string; qty: number; unitPrice: string; amount: string }[];
    subtotal: string;
    discount?: { label: string; amount: string };
    gst?: { rate: string; amount: string };
    total: string;
    paid: boolean;
    method?: string;
  };
  /** §14.6 - the file, behind one tap, never on the surface. */
  documents?: readonly HistoryDocument[];
  /**
   * The public address of this chapter, when it has one. Present only where an
   * invoice exists, because the share token is the invoice's - there is no
   * second token and no second privacy rule.
   */
  shareHref?: string;
}

export interface HistoryModel {
  /** Whose life this is. Shown once, on the newest visit. */
  vehicle: string;
  /** §16.1 - newest first. */
  visits: readonly HistoryVisit[];
  /** How many transformations there have been. */
  count: number;
  /** The day the record starts - the oldest visit. Absent when there is none. */
  since?: string;
  /** What the record adds up to, as SEALED (§16.2). Absent when nothing was. */
  settledTotal?: string;
}

function Visit({ visit, newest, vehicle }: {
  visit: HistoryVisit;
  newest: boolean;
  vehicle: string;
}) {
  const { id, when, title, line, photo } = visit;

  return (
    <Link href={`/history/${id}`} style={{ display: 'block', textDecoration: 'none' }}>
      <Hero
        state={photo ? 'media' : 'awaiting'}
        band="brief"
        style={photo ? { height: photoSize.next } : undefined}
        overlay={
          <div style={{ maxWidth: MEASURE }}>
            {/* The car is named once, on the newest visit, so a customer who
                arrived from the navigation rather than from a car knows whose
                life this is. §4.4 - it is not repeated after that. */}
            <Text role="data" tone="over" as="span">
              {newest ? `${vehicle} · ${when}` : when}
            </Text>
            <Heading
              level={newest ? 'display' : 'title'}
              tone="over"
              as={newest ? 'h1' : 'h2'}
              style={{ marginTop: space.hair }}
            >
              {title}
            </Heading>
            <Text role="whisper" tone="over" style={{ marginTop: space.breath }}>
              {line}
            </Text>
          </div>
        }
      >
        {/* THROUGH THE PRIMITIVE - absent, ready and failed are three states
            and the class-only path could only express two. */}
        <Photograph
          src={photo?.url}
          alt={photo?.description ?? ''}
          priority={newest}
          sizes={imageSizes.fullBleed}
        />
      </Hero>
    </Link>
  );
}

/** A quiet marker between one year and the next. Never a heading - the
    photographs are the content and a year is only where you are in them. */
function Year({ label }: { label: string }) {
  return (
    <div
      style={{
        paddingInline: INSET,
        paddingBlock: space.rest,
        display: 'flex',
        alignItems: 'center',
        gap: space.gap,
      }}
    >
      <Text role="data" tone="ink3" as="span">{label}</Text>
      <span
        aria-hidden
        style={{ flex: 1, height: HAIRLINE, background: color.edge }}
      />
    </div>
  );
}

/**
 * THE STANDING - what the record adds up to.
 *
 * §16.1 calls this "a series of transformations", and a series has a shape the
 * room was not showing: a customer scrolled photographs with no idea how many
 * visits there had been, how long their car had been cared for here, or what
 * the record came to. Every one of those facts was already in the model.
 *
 * It is a sentence, not a dashboard (§8.6 - a fact is a line of text). No
 * tiles, no counters, no chart.
 */
function Standing({ vehicle, count, since, settledTotal }: {
  vehicle: string;
  count: number;
  since?: string;
  settledTotal?: string;
}) {
  return (
    <header
      style={{
        paddingInline: INSET,
        paddingTop: stack.top,
        paddingBottom: space.rest,
        maxWidth: MEASURE + INSET * 2,
        marginInline: 'auto',
        width: '100%',
      }}
    >
      {/* The record is reached from Now and from the car; the dock does not
          hold a slot for it, so without this the only way out was a slot that
          is not where you came from. */}
      <Back style={{ marginBottom: space.line }} />

      {/* NOT A HEADING. §9.5 gives the room exactly one Display and the album
          has already spent it on the newest photograph - which is right, because
          the photographs are the content and this is only context for them.
          §8.6 - a fact is a line of text, so that is what this is. */}
      <Text role="data" tone="ink3" as="span">{vehicle}</Text>
      <Text role="body" tone="ink" style={{ marginTop: space.hair }}>
        {count === 1 ? 'One visit' : `${count} visits`}
        {since ? `, cared for here since ${since}` : ''}.
      </Text>
      {settledTotal ? (
        <Text role="whisper" tone="ink3" style={{ marginTop: space.hair }}>
          {settledTotal} settled in all.
        </Text>
      ) : null}
    </header>
  );
}

/**
 * A CAR WITH NO RECORD YET.
 *
 * §18.1 says a car with no completed visits has no History SECTION - and that
 * is right for a section inside another room. This is a ROOM, and it has its
 * own address in the navigation bar: a customer who taps History before their
 * first visit was handed a blank black screen with nothing on it at all. An
 * absence is not a state (§19.1). The record is genuinely empty, so this says
 * that plainly and offers the act that begins one, which is a visit.
 */
function NoRecord({ vehicle }: { vehicle: string }) {
  return (
    <section
      style={{
        paddingInline: INSET,
        maxWidth: MEASURE + INSET * 2,
        marginInline: 'auto',
        width: '100%',
        minHeight: '60svh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <Back style={{ marginBottom: space.line }} />
      <Text role="data" tone="ink3" as="span">{vehicle}</Text>
      <Heading level="display" as="h1" style={{ marginTop: space.hair }}>
        Nothing written yet.
      </Heading>
      <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
        Every visit your car makes is kept here &mdash; what was done, how it
        looked, and what it was promised. The first one starts the record.
      </Text>
      <div style={{ marginTop: space.rest }}>
        <Button tier="primary" href="/studio?arrange=1">Arrange a visit</Button>
      </div>
    </section>
  );
}

export function HistoryScreen({ model }: { model: HistoryModel }) {
  const { vehicle, visits, count, since, settledTotal } = model;

  return (
    <main
      style={{
        /* TRANSPARENT ON PURPOSE. The room stands in the ambient field,
           which is fixed behind everything (components/system/Ambient.tsx).
           Painting `color.paper` here would occlude it completely. The dark
           ground still exists - it is on `body` - so nothing loses contrast. */
        background: 'transparent',
        minHeight: '100svh',
        paddingBottom: stack.contentFloor,
      }}
    >
      {/* §20.3 - the room was rendered on the server and is still true; only
          what happens NEXT needs a connection. One implementation (§22.2). */}
      <OfflineNote />

      {visits.length === 0 ? (
        <NoRecord vehicle={vehicle} />
      ) : (
        <>
          <Standing
            vehicle={vehicle}
            count={count}
            since={since}
            settledTotal={settledTotal}
          />
          {visits.map((visit, i) => (
            <div key={visit.id}>
              {/* The divider falls where the year changes, never above the
                  first visit - the standing has just named the car and a
                  year immediately under it reads as a subtitle. */}
              {i > 0 && visit.year && visit.year !== visits[i - 1].year ? (
                <Year label={visit.year} />
              ) : null}
              <Visit visit={visit} newest={i === 0} vehicle={vehicle} />
            </div>
          ))}
        </>
      )}
    </main>
  );
}
