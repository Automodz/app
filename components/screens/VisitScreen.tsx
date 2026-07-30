'use client';
/**
 * ONE VISIT — the account.
 *
 * Source: docs/AUTOMODZ-OS.md §6.2, §8.4, §8.6, §9.5, §14.6, §16.2, §16.3,
 *         §16.5, §18.1, §21.1, §21.6
 *
 * §8.6 — "a completed visit's account" deserves a full screen. §16.3 fixes what
 * it gives, in this order:
 *
 *     the car as it was finished
 *     what was done, in plain language
 *     the photographs — before, during, after
 *     what it promised, and for how long
 *     what it cost and how it was settled
 *
 * That order is the file. Nothing was added to it.
 *
 * §16.2 — a completed visit is sealed. So the protection here is what was
 * PROMISED at the time, stated flat, with none of the living measure Home draws
 * for a protection that is still running down. A sealed record does not deplete.
 *
 * §14.6 — documents sit behind one tap, labelled plainly, never on the surface.
 *
 * There is no back control. §6.2 — the navigation is persistent and predictable,
 * and `/history/[id]` lights the History slot, which is the way back.
 */
import Image from 'next/image';
import { color, space, INSET, MEASURE, column, stack, imageSizes } from '@/design';
import { Hero, Heading, Text, Button } from '@/components/system';
import type { HistoryVisit } from './HistoryScreen';

export function VisitScreen({ visit }: { visit: HistoryVisit }) {
  const { when, title, photo, did, photos = [], promised = [], settled, documents = [] } = visit;

  return (
    <main
      style={{
        background: color.paper,
        minHeight: '100svh',
        paddingBottom: stack.contentFloor,
      }}
    >
      {/* §16.3 — the car as it was finished. */}
      <Hero
        state={photo ? 'media' : 'awaiting'}
        band="brief"
        overlay={
          <div style={{ maxWidth: MEASURE }}>
            <Text role="data" tone="over" as="span">{when}</Text>
            <Heading level="display" tone="over" style={{ marginTop: space.hair }}>
              {title}
            </Heading>
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

      {/* §16.3 — what was done, in plain language. */}
      <section style={{ ...column, paddingTop: space.rest }}>
        <Text role="body" tone="ink">{did}</Text>
      </section>

      {/* §16.3, §16.5 — the photographs. Full-bleed and sequential, each named
          for the moment it was taken. A sequence, never a grid: a grid of
          thumbnails makes the evidence smaller than the caption. */}
      {photos.map(p => (
        <figure key={p.url} style={{ margin: 0, paddingTop: space.movement }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3' }}>
            <Image
              src={p.url}
              alt={p.description}
              fill
              sizes={imageSizes.fullBleed}
              style={{ objectFit: 'cover' }}
            />
          </div>
          {p.caption ? (
            <figcaption style={{ ...column, marginTop: space.line }}>
              <Text role="whisper" tone="ink2">{p.caption}</Text>
            </figcaption>
          ) : null}
        </figure>
      ))}

      {/* §16.3 — what it promised, and for how long. §8.6 — facts, so lines of
          text. §18.1 — a visit that promised nothing says nothing. */}
      {promised.length > 0 ? (
        <section style={{ ...column, paddingTop: space.movement }}>
          {promised.map((p, i) => (
            <Text
              key={p.label}
              role="body"
              tone="ink"
              style={{ marginTop: i === 0 ? 0 : space.line }}
            >
              {p.label} · <span style={{ color: color.ink2 }}>{p.term}</span>
            </Text>
          ))}
        </section>
      ) : null}

      {/* §16.3 — what it cost and how it was settled. One line. An invoice
          table is what §16.1 means by "not a list of invoices"; the fact
          itself is a line of text and the customer is entitled to it. */}
      {settled ? (
        <section style={{ ...column, paddingTop: space.rest }}>
          <Text role="data" tone="ink2">{settled}</Text>
        </section>
      ) : null}

      {/* §14.6 — "one tap away, never on the surface." One line per file, and
          never the file itself: a PDF rendered inline would make the document
          the primary surface, which is exactly what §2.3 rejects. */}
      {documents.length > 0 ? (
        <section style={{ ...column, paddingTop: space.rest }}>
          {documents.map((d, i) => (
            <div key={d.href} style={{ marginTop: i === 0 ? 0 : space.hair }}>
              <Button tier="forward" href={d.href}>{d.label}</Button>
            </div>
          ))}
        </section>
      ) : null}

      {/* Nothing follows. §16.2 — the account is sealed, so there is nothing
          here to do to it. */}
      <div style={{ height: INSET }} />
    </main>
  );
}
