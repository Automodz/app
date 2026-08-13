'use client';
/**
 * ONE CAR FOR SALE.
 *
 * Source: docs/AUTOMODZ-OS.md §5.2, §15.7, §18.1, §21.6 · ARCHITECTURE §5
 *
 * The photograph leads, because that is what a buyer looks at first. The facts
 * follow as a list of label-and-value pairs rather than a table, so they read
 * on a phone without scrolling sideways.
 *
 * §6.4 — the enquiry and the viewing request are ADDRESSABLE (`?ask=inquiry`,
 * `?ask=viewing`) rather than component state. That makes them linkable, lets
 * the back button close them, and means a customer who reloads mid-form lands
 * back where they were rather than at the top of the page.
 *
 * A CAR THAT CANNOT BE BOUGHT IS NOT A DEAD END. Sold and reserved listings
 * keep their address — the link somebody pasted last week still opens — but the
 * form is replaced by a sentence and the rest of the stock.
 */
import Link from 'next/link';
import { Photograph } from '@/components/os/Photograph';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { color, space, INSET, MEASURE, radius, imageSizes, HAIRLINE } from '@/design';
import { Heading, Text, Button, OfflineNote } from '@/components/system';
import { Back } from '@/components/os/RoomHeader';
import type { ListingModel } from '@/lib/customer/market';
import { SaveCar } from '@/components/market/SaveCar';
import { AskAboutCar } from '@/components/market/AskAboutCar';

export function ListingScreen(
  { model, signedIn }: { model: ListingModel; signedIn: boolean },
) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const ask = params.get('ask');
  const open = ask === 'inquiry' || ask === 'viewing' ? ask : null;

  const setAsk = (value: 'inquiry' | 'viewing' | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set('ask', value);
    else next.delete('ask');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <main style={{
      paddingBottom: space.rest,
      maxWidth: MEASURE + INSET * 2,
      marginInline: 'auto',
    }}>
      {/* The car can still be read offline; asking about it cannot be sent. */}
      <OfflineNote caption="You’re offline. You can look, but nothing will send." />

      {/* REPORTED AS "no obvious way back". It was a `quiet` Button set flush
          with no glyph, which reads as a caption and not as a control — and
          this screen has no dock behind it either. Same shape as every other
          room's now: a chevron, the parent's name, its own 44px target. The
          model still decides WHERE, since a listing knows which filter the
          customer arrived through. */}
      <div style={{
        paddingInline: INSET,
        paddingTop: `calc(${space.gap}px + env(safe-area-inset-top, 0px))`,
      }}>
        <Back parent={{ href: model.backHref, name: 'All cars' }} />
      </div>

      {/* THE PHOTOGRAPHS. A horizontal strip that snaps, rather than a carousel
          with chrome: the swipe is the control every phone already has. */}
      {model.photos.length > 0 ? (
        <div
          style={{
            display: 'flex',
            gap: space.breath,
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            paddingInline: INSET,
            marginTop: space.gap,
          }}
        >
          {model.photos.map(p => (
            <div
              key={p.url}
              style={{
                position: 'relative',
                flex: '0 0 88%',
                aspectRatio: '4 / 3',
                scrollSnapAlign: 'center',
                borderRadius: radius.card,
                overflow: 'hidden',
                background: color.surface,
              }}
            >
              {/* Through the primitive — a listing photograph that 404s is a
                  fault a buyer must not be shown as a browser glyph. */}
              <Photograph src={p.url} alt={p.alt} sizes={imageSizes.inMeasure} />
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ paddingInline: INSET, marginTop: space.rest }}>
        {model.badge ? (
          <Text role="whisper" tone="ink3" style={{ letterSpacing: '0.08em' }}>
            {model.badge.toUpperCase()}
          </Text>
        ) : null}

        <Heading level="display">{model.title}</Heading>
        {/* The price carries a Title's weight but is not a heading — it is the
            car's single most important fact, so it takes the type without
            taking a place in the document outline. */}
        <Heading level="title" as="p" style={{ marginTop: space.breath }}>
          {model.price}
        </Heading>

        <SaveCar listingId={model.id} saved={model.saved} signedIn={signedIn} />

        {/* THE FACTS. Rows, not a table — a table cannot wrap on a phone. */}
        <dl style={{ marginTop: space.rest }}>
          {model.facts.map(f => (
            <div
              key={f.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: space.gap,
                paddingBlock: space.line,
                borderTop: `${HAIRLINE}px solid ${color.edge}`,
              }}
            >
              <dt><Text role="body" tone="ink3" as="span">{f.label}</Text></dt>
              <dd style={{ margin: 0 }}>
                <Text role="body" tone="ink" as="span">{f.value}</Text>
              </dd>
            </div>
          ))}
        </dl>

        {/* ── ITS RECORD WITH US ─────────────────────────────────────────
            Design screen 17, and the one place a private record crosses into
            public. `history` is `null` unless the car's OWNER has explicitly
            consented — the decision is `publicHistoryOf`'s, made where the
            data is shaped, so this screen cannot leak a count it was never
            given. Absent is the ordinary case and draws nothing at all.

            Every value here is a COUNT or a WORDED FACT. There is no price, no
            invoice, no document and no customer: a buyer learns the car was
            looked after, never what the owner paid or who they are. */}
        {model.history ? (
          <section
            aria-labelledby="listing-record"
            style={{ marginTop: space.rest }}
          >
            <Heading level="title" id="listing-record">Its record with us</Heading>
            <dl style={{ marginTop: space.line }}>
              <RecordRow label="Detailed here since" value={model.history.since} />
              <RecordRow
                label="Visits on record"
                value={String(model.history.visits)}
              />
              <RecordRow
                label="Photographs"
                value={String(model.history.photographs)}
              />
              {model.history.protections.map(p => (
                <RecordRow key={p.label} label={p.label} value={p.detail} />
              ))}
            </dl>
            <Text role="whisper" tone="ink3" style={{ marginTop: space.line }}>
              Shown with the owner&rsquo;s permission. Nothing here identifies
              them, and nothing here is what they paid.
            </Text>
          </section>
        ) : null}

        {/* §15.7 — no description means no heading, not an empty one. */}
        {model.description ? (
          <div style={{ marginTop: space.rest }}>
            <Text role="body" tone="ink2" style={{ whiteSpace: 'pre-wrap' }}>
              {model.description}
            </Text>
          </div>
        ) : null}

        <div style={{ marginTop: space.rest }}>
          {model.buyable ? (
            <>
              <Heading level="title">Interested?</Heading>
              <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
                Ask us anything about it, or come and see it at the studio.
              </Text>
              <div style={{
                display: 'flex', gap: space.line, marginTop: space.gap, flexWrap: 'wrap',
              }}>
                <Button tier="forward" onClick={() => setAsk('inquiry')}>
                  Ask about this car
                </Button>
                <Button tier="quiet" onClick={() => setAsk('viewing')}>
                  Book a viewing
                </Button>
              </div>
            </>
          ) : (
            /* §18.1 — say plainly what happened, then offer the way on. */
            <Text role="body" tone="ink2">{model.closedLine}</Text>
          )}
        </div>

        <div style={{
          marginTop: space.rest,
          paddingTop: space.gap,
          borderTop: `${HAIRLINE}px solid ${color.edge}`,
        }}>
          <Text role="body" tone="ink2">
            Come and look at it at {model.studio.address}.
          </Text>
          <div style={{
            display: 'flex', gap: space.line, marginTop: space.gap, flexWrap: 'wrap',
          }}>
            <Button tier="quiet" href={model.studio.call}>Call the studio</Button>
            <Button tier="quiet" href={model.studio.message}>Message us</Button>
          </div>
        </div>

        {model.alsoHere.length > 0 ? (
          <div style={{ marginTop: space.movement }}>
            <Heading level="title">Also here</Heading>
            <div style={{ marginTop: space.gap, display: 'grid', gap: space.gap }}>
              {model.alsoHere.map(c => (
                <Link
                  key={c.id}
                  href={c.href}
                  style={{
                    display: 'flex',
                    gap: space.gap,
                    alignItems: 'center',
                    textDecoration: 'none',
                    paddingBlock: space.line,
                    borderTop: `${HAIRLINE}px solid ${color.edge}`,
                  }}
                >
                  <div style={{
                    position: 'relative',
                    width: 88,
                    aspectRatio: '4 / 3',
                    flexShrink: 0,
                    borderRadius: radius.chip,
                    overflow: 'hidden',
                    background: color.surface,
                  }}>
                    {c.photo ? (
                      <Photograph src={c.photo} alt="" sizes="88px" />
                    ) : null}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <Text role="body" tone="ink">{c.title}</Text>
                    <Text role="data" tone="ink3" style={{ marginTop: space.hair }}>
                      {c.price} · {c.line}
                    </Text>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <AskAboutCar
        listingId={model.id}
        title={model.title}
        kind={open}
        onClose={() => setAsk(null)}
      />
    </main>
  );
}

/** One line of the car's record. The same shape as a fact, said once. */
function RecordRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: space.gap,
        paddingBlock: space.line,
        borderTop: `${HAIRLINE}px solid ${color.edge}`,
      }}
    >
      <dt><Text role="body" tone="ink3" as="span">{label}</Text></dt>
      <dd style={{ margin: 0 }}>
        <Text role="body" tone="ink" as="span">{value}</Text>
      </dd>
    </div>
  );
}
