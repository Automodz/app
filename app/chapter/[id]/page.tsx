'use client';
/**
 * A CHAPTER, SHARED.
 *
 * Source: reference/customer-old/app/chapter/[id]/page.tsx
 *
 * The one customer surface with NO SESSION. Whoever holds the link sees it, so
 * it reads through `/api/invoice/[id]?view=chapter` — a route that already
 * validates the share token and already strips amounts, the customer's phone
 * and every internal reference before anything reaches the wire. Nothing is
 * re-derived here and no second privacy rule is written; if the endpoint says
 * no, this shows the same nothing it would to a stranger.
 *
 * §16 — immutable. What the endpoint returns is the sealed record, so a
 * forwarded link shows the visit as it was, whatever the price list says today.
 */
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Heading, Text, Loading } from '@/components/system';
import { Back } from '@/components/os';
import { publicParent } from '@/navigation/resolve';
import { color, space, INSET, MEASURE, radius, imageSizes, stack } from '@/design';

interface SharedChapter {
  id: string;
  vehicleName: string;
  vehicleRegNo: string;
  work: string[];
  photos: { url: string; kind: 'before' | 'during' | 'after' }[];
  createdAt: string | null;
}

const longDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

export default function SharedChapterPage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const token = params.get('t');
  /* A CHAPTER IS SENT TO PEOPLE. It is the one screen in the product a
     stranger is most likely to open cold, and it had no way out of any kind —
     no dock, no back, nothing. Same rule as the invoice: the visit they came
     from when the product put them here, the front door otherwise. */
  const parent = publicParent(params.get('from'));

  const [chapter, setChapter] = useState<SharedChapter | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'gone'>('loading');

  useEffect(() => {
    if (!id || !token) { setState('gone'); return; }
    let cancelled = false;
    void fetch(`/api/invoice/${id}?t=${encodeURIComponent(token)}&view=chapter`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('gone'))))
      .then(d => { if (!cancelled) { setChapter(d as SharedChapter); setState('ready'); } })
      .catch(() => { if (!cancelled) setState('gone'); });
    return () => { cancelled = true; };
  }, [id, token]);

  if (state === 'loading') {
    return (
      <main style={{ minHeight: '100svh', background: color.paper, display: 'grid', placeItems: 'center' }}>
        <Loading caption="Opening the chapter" />
      </main>
    );
  }

  if (state === 'gone' || !chapter) {
    /* §20.3 — a bad or expired link is not the reader's fault and not an
       error page. It says what happened and stops. */
    return (
      <main style={{
        minHeight: '100svh', background: color.paper, display: 'flex',
        flexDirection: 'column', justifyContent: 'center', paddingInline: INSET,
      }}>
        <div style={{ maxWidth: MEASURE + INSET * 2, marginInline: 'auto', width: '100%' }}>
          <Heading level="display">This chapter isn&rsquo;t available.</Heading>
          <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
            The link may have expired, or it was never quite right.
          </Text>
        </div>
      </main>
    );
  }

  const after = chapter.photos.filter(p => p.kind === 'after');
  const before = chapter.photos.filter(p => p.kind === 'before');
  const during = chapter.photos.filter(p => p.kind === 'during');
  const hero = after[0] ?? during[0] ?? before[0];

  return (
    <main
      style={{
        background: color.paper, minHeight: '100svh',
        paddingBottom: space.movement,
        paddingTop: stack.top,
        position: 'relative',
      }}
    >
      {/* Over the photograph when there is one, in the gutter when there is
          not — the same two placements every other room uses. */}
      <div
        style={{
          position: hero ? 'absolute' : 'static', zIndex: 2,
          top: `calc(${stack.top} + ${space.line}px)`, left: INSET,
          paddingInline: hero ? 0 : INSET, paddingTop: hero ? 0 : space.line,
        }}
      >
        <Back over={Boolean(hero)} parent={parent} />
      </div>

      {hero ? (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3' }}>
          <Image
            src={hero.url}
            alt={`${chapter.vehicleName}, finished at AutoModz`}
            fill
            priority
            sizes={imageSizes.fullBleed}
            style={{ objectFit: 'cover' }}
          />
        </div>
      ) : null}

      <section style={{
        paddingInline: INSET, maxWidth: MEASURE + INSET * 2,
        marginInline: 'auto', width: '100%', paddingTop: space.rest,
      }}>
        <Text role="data" tone="ink3">{longDate(chapter.createdAt)}</Text>
        <Heading level="display" style={{ marginTop: space.hair }}>{chapter.vehicleName}</Heading>
        <Text role="whisper" tone="ink3" style={{ marginTop: space.hair }}>{chapter.vehicleRegNo}</Text>

        {chapter.work.length > 0 ? (
          <ul style={{ margin: 0, marginTop: space.gap, paddingLeft: INSET }}>
            {chapter.work.map(w => (
              <li key={w} style={{ marginTop: space.breath }}>
                <Text role="body" tone="ink2" as="span">{w}</Text>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* BEFORE AND AFTER, side by side — the pairing is the whole point of
          sharing a chapter. Shown only when both exist; one alone is a
          photograph, not a comparison. */}
      {before.length > 0 && after.length > 0 ? (
        <section style={{
          paddingInline: INSET, maxWidth: MEASURE + INSET * 2,
          marginInline: 'auto', width: '100%', paddingTop: space.movement,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space.breath }}>
            {[{ p: before[0], l: 'Before' }, { p: after[0], l: 'After' }].map(({ p, l }) => (
              <figure key={l} style={{ margin: 0 }}>
                <div style={{
                  position: 'relative', width: '100%', aspectRatio: '1',
                  borderRadius: radius.card, overflow: 'hidden', background: color.surface,
                }}>
                  <Image
                    src={p.url}
                    alt={`${chapter.vehicleName}, ${l.toLowerCase()}`}
                    fill
                    sizes="(max-width: 768px) 50vw, 300px"
                    style={{ objectFit: 'cover' }}
                  />
                </div>
                <figcaption style={{ marginTop: space.breath }}>
                  <Text role="whisper" tone="ink3" as="span">{l}</Text>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      <section style={{
        paddingInline: INSET, maxWidth: MEASURE + INSET * 2,
        marginInline: 'auto', width: '100%', paddingTop: space.movement,
      }}>
        <Text role="whisper" tone="ink3">AutoModz · Maninagar, Ahmedabad</Text>
      </section>
    </main>
  );
}
