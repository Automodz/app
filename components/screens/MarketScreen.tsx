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
import { Text } from '@/components/system/Text';
import { Button } from '@/components/system/Button';
import { OfflineNote } from '@/components/system/OfflineNote';
import { Back } from '@/components/os/RoomHeader';
import type { MarketModel, MarketCard, MarketFilter } from '@/lib/customer/market';

export function MarketScreen({ model }: { model: MarketModel }) {
  const { cars, query, stock, filtered, sellHref, fuels, budgets } = model;

  return (
    <main style={{
      paddingInline: INSET,
      /* THE TOP SAFE AREA. `Screen` reserves it for every room; these three
         hand-rolled `<main>`s never did, and the product is installable — on
         a notched phone in standalone the first control sat under the status
         bar. §8.5 puts the inset in the token, not at the call site. */
      paddingTop: `calc(${space.rest}px + env(safe-area-inset-top, 0px))`,
      paddingBottom: space.rest,
      maxWidth: MEASURE + INSET * 2,
      marginInline: 'auto',
    }}>
      <OfflineNote caption="You’re offline. This is the stock as we last knew it." />

      {/* THE MARKETPLACE CARRIES NO DOCK — it is public, and four slots that
          all lead to a sign-in wall are four dead ends (see routes.ts). That
          made it a room with no exit for a signed-in customer who arrived
          from Home. The parent is the address itself: `/` is the landing to a
          visitor and Now to an owner, and one control is right for both. */}
      <Back style={{ marginBottom: space.line }} />

      <h1 className="am-display" style={{ margin: 0, fontSize: 30 }}>Cars for sale</h1>
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

      {/* Design 1k's foot — one row, not a section with a heading over it.
          A customer who wants to sell knows they want to sell; the row is a
          door, and a paragraph in front of a door is a queue. */}
      <Link
        href={sellHref}
        className="am-glass am-tap"
        style={{
          marginTop: space.rest,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: space.line, minHeight: 56,
          padding: `${space.gap}px ${space.gap + 2}px`,
          borderRadius: radius.pane,
          textDecoration: 'none',
        }}
      >
        <span style={{ fontSize: 13.5, color: color.ink2 }}>
          List a car from your garage
        </span>
        <svg
          width="17" height="17" viewBox="0 0 24 24" aria-hidden
          fill="none" stroke={color.ink3} strokeWidth={1.4}
          strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>
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
              borderRadius: radius.chip,
              border: `${HAIRLINE}px solid ${o.on ? 'rgba(224,164,92,0.4)' : color.edge}`,
              /* The lit one wears the studio's own light, not an inverted
                 fill — §3.3, colour is information, and "this filter is on"
                 is information. */
              background: o.on
                ? 'linear-gradient(160deg, rgba(224,164,92,0.28), rgba(224,164,92,0.1))'
                : 'rgba(255,255,255,0.04)',
              color: o.on ? color.ink : color.ink2,
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
  /* Design 1k — the photograph, then a pane of glass carrying the title, the
     price and the one line that decides a shortlist. The pane is UNDER the
     image rather than over it, so nothing has to survive a scrim: the price
     is champagne, which it could not be laid over an unknown photograph. */
  return (
    <Link
      href={car.href}
      className="am-tap"
      style={{
        textDecoration: 'none',
        display: 'block',
        borderRadius: radius.sheet,
        overflow: 'hidden',
        border: `${HAIRLINE}px solid ${color.edge}`,
        boxShadow: '0 24px 50px -26px rgba(0,0,0,0.9)',
      }}
    >
      <div style={{ position: 'relative', aspectRatio: '16 / 10' }}>
        {car.photo ? (
          <Image
            src={car.photo}
            alt={car.title}
            fill
            sizes={imageSizes.inMeasure}
            style={{ objectFit: 'cover' }}
          />
        ) : (
          /* §15.7 — a car with no photograph is silent, not a broken frame.
             §11.5's composed absence: a field lit from above, never a grey box. */
          <div
            style={{
              position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
              background: 'radial-gradient(120% 80% at 50% 30%, ${color.surface} 0%, ${color.paper} 70%)',
            }}
          >
            <Text role="whisper" tone="ink3">No photograph yet</Text>
          </div>
        )}
        {car.badge ? (
          /* What the studio itself vouches for. Champagne on smoked glass:
             a fact already in force, never an advertisement. */
          <span
            className="am-glass am-label"
            style={{
              position: 'absolute', top: space.line, left: space.line,
              paddingInline: space.breath + 2, paddingBlock: space.hair + 1,
              borderRadius: radius.chip,
              borderColor: 'rgba(232,217,190,0.3)',
              color: color.champagne,
              fontSize: 9,
              letterSpacing: '0.18em',
            }}
          >
            {car.badge}
          </span>
        ) : null}
      </div>

      <div
        className="am-glass"
        style={{
          borderRadius: 0,
          border: 'none',
          padding: `${space.gap}px ${space.gap + 2}px`,
          display: 'flex', flexDirection: 'column', gap: space.breath,
        }}
      >
        <div
          style={{
            display: 'flex', justifyContent: 'space-between',
            gap: space.line, alignItems: 'baseline',
          }}
        >
          <h2 className="am-display" style={{ margin: 0, fontSize: 16, fontWeight: 300 }}>
            {car.title}
          </h2>
          <span
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 13,
              color: color.champagne, whiteSpace: 'nowrap',
            }}
          >
            {car.price}
          </span>
        </div>
        <span style={{ fontSize: 12.5, lineHeight: 1.5, color: color.ink3 }}>{car.line}</span>
      </div>
    </Link>
  );
}
