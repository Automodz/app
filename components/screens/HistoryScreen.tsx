/**
 * A SERVER COMPONENT. It holds no state, no handlers and no motion — it is
 * handed a model and draws it — so marking it `'use client'` shipped its
 * markup to the browser twice and hydrated it for nothing. The interactive
 * pieces it renders carry their own directive.
 */
/**
 * HISTORY — the album.
 *
 * Source: docs/AUTOMODZ-OS.md §5.2, §6.4, §8.4, §8.6, §9.5, §16.1, §16.2,
 *         §18.1, §21.1, §21.6
 *
 * §16.1 — "Every completed visit, newest first, as a series of transformations.
 * Not a log. Not a table. Not a list of invoices."
 *
 * So: a continuous strip of full-bleed photographs, newest first, each with its
 * date, its title and one sentence. The same album grammar as the Garage, for
 * the same reason — there and here the subject is a photograph, and the caption
 * belongs on it.
 *
 * §6.4 + §8.6 + §16.4 — a visit's full account is addressable, full-screen and
 * shareable, so it is a ROUTE (`/history/[id]`) rather than something that
 * unfolds in place. An accordion could satisfy none of the three.
 *
 * §9.5 — the newest visit carries the one Display; every other carries a Title.
 * That is position, not rank: §16.2 makes every completed visit equally
 * permanent.
 */
import Image from 'next/image';
import Link from 'next/link';
import { space, MEASURE, photoSize, stack, imageSizes } from '@/design';
/* Deep imports, NOT the `components/system` barrel. The barrel re-exports
   every primitive, a dozen of them `'use client'` with Radix and
   framer-motion behind them, and reaching through it from a server
   component pulls all of that into the page's client bundle. Measured on
   the legal pages: 167 kB → 108 kB from this change alone. */
import { Hero } from '@/components/system/Hero';
import { Heading } from '@/components/system/Heading';
import { Text } from '@/components/system/Text';
import { OfflineNote } from '@/components/system/OfflineNote';

export interface HistoryPhoto {
  url: string;
  /** §21.6 — an image that carries meaning carries a description. */
  description: string;
  /** "Before", "During", "After" — only inside an account. */
  caption?: string;
}

export interface HistoryDocument {
  label: string;
  href: string;
}

export interface HistoryVisit {
  id: string;
  when: string;
  title: string;
  /** One sentence. What it felt like, not what was billed. */
  line: string;
  /** §16.3 — the car as it was finished. */
  photo?: HistoryPhoto;
  /** §16.3 — what was done, in plain language. */
  did: string;
  /** §16.3 — before, during, after. */
  photos?: readonly HistoryPhoto[];
  /** §16.3 — what it promised, and for how long. */
  promised?: readonly { label: string; term: string }[];
  /** §16.3 — what it cost and how it was settled. One line, never a table. */
  settled?: string;
  /** §14.6 — the file, behind one tap, never on the surface. */
  documents?: readonly HistoryDocument[];
  /**
   * The public address of this chapter, when it has one. Present only where an
   * invoice exists, because the share token is the invoice's — there is no
   * second token and no second privacy rule.
   */
  shareHref?: string;
}

export interface HistoryModel {
  /** Whose life this is. Shown once, on the newest visit. */
  vehicle: string;
  /** §16.1 — newest first. */
  visits: readonly HistoryVisit[];
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
                life this is. §4.4 — it is not repeated after that. */}
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
        {photo ? (
          <Image
            src={photo.url}
            alt={photo.description}
            fill
            priority={newest}
            sizes={imageSizes.fullBleed}
            style={{ objectFit: 'cover' }}
          />
        ) : null}
      </Hero>
    </Link>
  );
}

export function HistoryScreen({ model }: { model: HistoryModel }) {
  const { vehicle, visits } = model;

  return (
    <main
      style={{
        /* TRANSPARENT ON PURPOSE. The room stands in the ambient field,
           which is fixed behind everything (components/system/Ambient.tsx).
           Painting `color.paper` here would occlude it completely. The dark
           ground still exists — it is on `body` — so nothing loses contrast. */
        background: 'transparent',
        minHeight: '100svh',
        paddingBottom: stack.contentFloor,
      }}
    >
      {/* §20.3 — the room was rendered on the server and is still true; only
          what happens NEXT needs a connection. One implementation (§22.2). */}
      <OfflineNote />
      {/* §18.1 — a car with no completed visits has no History section. Not an
          empty one. None. There is nothing here to invite, because a first
          visit is arranged in the Studio, not in a record of the past. */}
      {visits.map((visit, i) => (
        <Visit key={visit.id} visit={visit} newest={i === 0} vehicle={vehicle} />
      ))}
    </main>
  );
}
