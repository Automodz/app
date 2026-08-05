/**
 * A SERVER COMPONENT. It holds no state, no handlers and no motion — it is
 * handed a model and draws it — so marking it `'use client'` shipped its
 * markup to the browser twice and hydrated it for nothing. The interactive
 * pieces it renders carry their own directive.
 */
/**
 * THE MARKETPLACE — the stock, as photographs.
 *
 * Source: docs/AUTOMODZ-OS.md §5.2, §15.7, §18.1, §21.6
 *
 * The same album grammar as the Garage and History: a car is a photograph, and
 * what it costs belongs on it. A table of specifications is how a classifieds
 * site shows stock, and this is not one — the three facts that decide a
 * shortlist (year, distance, fuel) sit under the title and the rest waits
 * inside.
 *
 * §6.4 — the filters live in the URL, so a shortlist can be sent to whoever is
 * actually paying for the car. The controls are links, not buttons holding
 * state: that makes them work with the back button, survive a reload, and
 * render identically on the server.
 */
import Image from 'next/image';
import Link from 'next/link';
import { color, space, INSET, MEASURE, radius, imageSizes, HAIRLINE } from '@/design';
/* Deep imports, NOT the `components/system` barrel. The barrel re-exports
   every primitive, a dozen of them `'use client'` with Radix and
   framer-motion behind them, and reaching through it from a server
   component pulls all of that into the page's client bundle. Measured on
   the legal pages: 167 kB → 108 kB from this change alone. */
import { Heading } from '@/components/system/Heading';
import { Text } from '@/components/system/Text';
import { Button } from '@/components/system/Button';
import { OfflineNote } from '@/components/system/OfflineNote';
import type { MarketModel, MarketCard, MarketFilter } from '@/lib/customer/market';

export function MarketScreen({ model }: { model: MarketModel }) {
  const { cars, query, stock, filtered, sellHref, fuels, budgets } = model;

  return (
    <main style={{
      paddingInline: INSET,
      paddingBlock: space.rest,
      maxWidth: MEASURE + INSET * 2,
      marginInline: 'auto',
    }}>
      <OfflineNote caption="You’re offline. This is the stock as we last knew it." />

      <Heading level="display">Cars for sale</Heading>
      <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
        Every one of these has been through the studio. Come and look at it
        before you decide.
      </Text>

      {/* §21.6 — a search field is a form, so Enter submits it and a screen
          reader is told what it searches. It is a GET to the same address,
          which is what keeps the result addressable. */}
      <form action="/cars" method="get" role="search" style={{ marginTop: space.gap }}>
        <input
          type="search"
          name="q"
          defaultValue={query.query ?? ''}
          placeholder="Make or model"
          aria-label="Search cars by make or model"
          style={{
            width: '100%',
            minHeight: 48,
            padding: `${space.breath}px 0`,
            border: 'none',
            borderBottom: `${HAIRLINE}px solid ${color.edge}`,
            background: 'transparent',
            color: color.ink,
            fontSize: 17,
            outline: 'none',
          }}
        />
        {/* The other two filters travel with a text search rather than being
            silently dropped when Enter is pressed. */}
        {query.fuel && query.fuel !== 'all'
          ? <input type="hidden" name="fuel" value={query.fuel} /> : null}
        {query.upto ? <input type="hidden" name="upto" value={String(query.upto)} /> : null}
      </form>

      <Filters label="Fuel" options={fuels} />
      <Filters label="Price" options={budgets} />

      {cars.length === 0 ? (
        /* §18.1 — the two empty cases are not the same sentence. Nothing in
           stock is the studio's news; nothing matching is the customer's own
           filter, and it must offer the way back out. */
        <div style={{ paddingBlock: space.rest }}>
          <Text role="body" tone="ink2">
            {stock === 0
              ? 'Nothing in the showroom right now. More arrives most weeks.'
              : 'No car here matches that.'}
          </Text>
          {filtered ? (
            <div style={{ marginTop: space.gap }}>
              <Button tier="forward" href="/cars">Show everything</Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ marginTop: space.rest, display: 'grid', gap: space.rest }}>
          {cars.map(c => <Card key={c.id} car={c} />)}
        </div>
      )}

      <div style={{
        marginTop: space.rest,
        paddingTop: space.rest,
        borderTop: `${HAIRLINE}px solid ${color.edge}`,
      }}>
        <Heading level="title">Selling yours?</Heading>
        <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
          Tell us what you have. We will look at it and come back to you.
        </Text>
        <div style={{ marginTop: space.gap }}>
          <Button tier="forward" href={sellHref}>Offer us your car</Button>
        </div>
      </div>
    </main>
  );
}

function Filters({ label, options }: { label: string; options: MarketFilter[] }) {
  return (
    <nav aria-label={label} style={{ marginTop: space.gap }}>
      <div style={{
        display: 'flex', gap: space.breath, overflowX: 'auto',
        paddingBottom: space.hair, scrollbarWidth: 'none',
      }}>
        {options.map(o => (
          <Link
            key={o.key}
            href={o.href}
            /* §21.6 — the pressed state has to be in the accessibility tree,
               not only in the colour. */
            aria-current={o.on ? 'true' : undefined}
            scroll={false}
            style={{
              flexShrink: 0,
              minHeight: 44,
              display: 'inline-flex',
              alignItems: 'center',
              paddingInline: space.line,
              borderRadius: radius.pill,
              border: `${HAIRLINE}px solid ${o.on ? color.ink : color.edge}`,
              background: o.on ? color.ink : 'transparent',
              color: o.on ? color.paper : color.ink2,
              textDecoration: 'none',
              fontSize: 14,
              whiteSpace: 'nowrap',
            }}
          >
            {o.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function Card({ car }: { car: MarketCard }) {
  return (
    <Link href={car.href} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        position: 'relative',
        aspectRatio: '4 / 3',
        borderRadius: radius.card,
        overflow: 'hidden',
        background: color.surface,
      }}>
        {car.photo ? (
          <Image
            src={car.photo}
            alt={car.title}
            fill
            sizes={imageSizes.inMeasure}
            style={{ objectFit: 'cover' }}
          />
        ) : (
          /* §15.7 — a car with no photograph is silent, not a broken frame. */
          <div style={{
            position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
          }}>
            <Text role="whisper" tone="ink3">No photograph yet</Text>
          </div>
        )}
        {car.badge ? (
          <span style={{
            position: 'absolute', top: space.line, right: space.line,
            paddingInline: space.breath, paddingBlock: space.hair,
            borderRadius: radius.pill,
            background: color.paper,
            color: color.ink,
            fontSize: 12,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>{car.badge}</span>
        ) : null}
      </div>

      <div style={{
        marginTop: space.line, display: 'flex',
        justifyContent: 'space-between', gap: space.line, alignItems: 'baseline',
      }}>
        <Heading level="title" as="h2">{car.title}</Heading>
        <Text role="body" tone="ink" as="span" style={{ whiteSpace: 'nowrap' }}>
          {car.price}
        </Text>
      </div>
      <Text role="data" tone="ink3" style={{ marginTop: space.hair }}>{car.line}</Text>
    </Link>
  );
}
