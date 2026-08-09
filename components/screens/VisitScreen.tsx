/**
 * A SERVER COMPONENT. It holds no state, no handlers and no motion — it is
 * handed a model and draws it — so marking it `'use client'` shipped its
 * markup to the browser twice and hydrated it for nothing. The interactive
 * pieces it renders carry their own directive.
 */
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
import {
  color, space, INSET, MEASURE, column, stack, imageSizes,
} from '@/design';
/* Deep imports, NOT the `components/system` barrel. The barrel re-exports
   every primitive, a dozen of them `'use client'` with Radix and
   framer-motion behind them, and reaching through it from a server
   component pulls all of that into the page's client bundle. Measured on
   the legal pages: 167 kB → 108 kB from this change alone. */
import { Hero } from '@/components/system/Hero';
import { Heading } from '@/components/system/Heading';
import { Text } from '@/components/system/Text';
import { Button } from '@/components/system/Button';
import { OfflineNote } from '@/components/system/OfflineNote';
import { BeforeAfter } from '@/components/visit/BeforeAfter';
import type { HistoryVisit } from './HistoryScreen';
/* Deep import — this is a SERVER component and the barrel pulls a dozen
   client modules with it. See the note at the top of this file. */
import type { Tone } from '@/components/system/tone';

/** One line of the breakdown. A receipt is columns of facts, not cards. */
function Row({ label, value, tone = 'ink3' }: { label: string; value: string; tone?: Tone }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline',
      justifyContent: 'space-between', gap: space.line,
    }}>
      <Text role="whisper" tone={tone}>{label}</Text>
      <Text role="whisper" tone={tone}>{value}</Text>
    </div>
  );
}

export function VisitScreen({ visit }: { visit: HistoryVisit }) {
  const {
    when, title, photo, did, photos = [], promised = [],
    comparison, receipt, settled, documents = [], shareHref,
  } = visit;

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

      {/* ── BEFORE ← drag → AFTER ────────────────────────────────────────
          The one part of the record that argues for itself; everything else
          here is the studio's account of the work, and this is the work. Only
          when the job recorded both sides — a comparison missing a half is not
          a comparison, and filling it from another frame would be a lie about
          the customer's own car. */}
      {comparison ? (
        <section style={{ paddingTop: space.movement }}>
          <BeforeAfter before={comparison.before} after={comparison.after} subject={title} />
        </section>
      ) : null}

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

      {/* ── WHAT IT CAME TO ──────────────────────────────────────────────
          The figures existed and lived one tap away at `/invoice/[id]`, so a
          customer had to LEAVE the record of the work to learn what the work
          cost. The total and how it was settled are stated plainly; the
          breakdown is behind a tap, because §16.1's "not a list of invoices"
          is about what a record LEADS with, not about withholding the
          arithmetic from the person who paid it.

          One fact, one place: the bare `settled` line this replaces said the
          same total, and the album still uses it — there, a visit is a line
          rather than an account. */}
      {!receipt && settled ? (
        /* A SEALED VISIT KNOWS ITS TOTAL EVEN WITHOUT AN INVOICE DOCUMENT.
           §16 — the amount as sealed. Losing this when the receipt was added
           would have hidden the money on every visit the studio never raised
           paper for, which is most of them. */
        <section style={{ ...column, paddingTop: space.rest }}>
          <Text role="data" tone="ink2">{settled}</Text>
        </section>
      ) : null}

      {/* ── WHAT IT COST — design screen 1j ─────────────────────────────
          THE BREAKDOWN IS NO LONGER BEHIND A TAP. It sat inside a `<details>`
          summarised by the invoice number, so the one question a receipt
          exists to answer — what am I being charged for — took a tap, and the
          control that revealed it was labelled with a reference code. The
          design states the whole account on one pane and puts the total at
          the foot of it, which is what a receipt is.

          Every figure is carried verbatim from the invoice. Nothing here
          computes, and nothing re-derives a total (§22.1, §16.2). */}
      {receipt ? (
        <section style={{ ...column, paddingTop: space.rest }}>
          <div
            className="am-glass"
            style={{
              padding: space.gap + 6,
              borderRadius: 24,
              display: 'grid',
              gap: space.line + 2,
            }}
          >
            {receipt.lineItems.map(li => (
              <div key={li.name} style={{
                display: 'flex', alignItems: 'baseline',
                justifyContent: 'space-between', gap: space.line,
              }}>
                <Text role="body" tone="ink2">
                  {li.name}{li.qty > 1 ? ` × ${li.qty}` : ''}
                </Text>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, color: color.ink }}>
                  {li.amount}
                </span>
              </div>
            ))}

            <Row label="Subtotal" value={receipt.subtotal} />
            {receipt.discount ? (
              <Row label={receipt.discount.label} value={`− ${receipt.discount.amount}`} tone="assent" />
            ) : null}
            {receipt.gst ? (
              <Row label={`GST ${receipt.gst.rate}`} value={receipt.gst.amount} />
            ) : null}

            <span aria-hidden style={{ height: 1, background: color.edge }} />

            <div style={{
              display: 'flex', alignItems: 'baseline',
              justifyContent: 'space-between', gap: space.line,
            }}>
              <Text role="body" tone="ink">
                {receipt.gst ? 'Total incl. GST' : 'Total'}
              </Text>
              <span className="am-display" style={{ fontSize: 26, fontWeight: 300 }}>
                {receipt.total}
              </span>
            </div>

            <div style={{
              display: 'flex', alignItems: 'baseline',
              justifyContent: 'space-between', gap: space.line,
            }}>
              <span className="am-label" style={{ letterSpacing: '0.2em', fontSize: 9.5 }}>
                {receipt.number}
              </span>
              <Text role="whisper" tone={receipt.paid ? 'assent' : 'caution'}>
                {receipt.paid
                  ? `Paid${receipt.method ? ` · ${receipt.method.toUpperCase()}` : ''}`
                  : 'Payable at the studio'}
              </Text>
            </div>
          </div>
        </section>
      ) : null}

      {/* §14.6 — "one tap away, never on the surface." One line per file, and
          never the file itself: a PDF rendered inline would make the document
          the primary surface, which is exactly what §2.3 rejects. */}
      {documents.length > 0 ? (
        <section style={{ ...column, paddingTop: space.rest }}>
          {documents.map((d, i) => (
            <div key={d.href} style={{ marginTop: i === 0 ? 0 : space.line }}>
              {/* Design 1j gives the paper the screen's filled control. The
                  design's own label is "Pay & download invoice"; ours says
                  only what the control actually does, because nothing in this
                  product takes a payment — the studio settles at the counter,
                  which the line above has just said. A button that promises
                  to take money and then opens a PDF is a lie in a control. */}
              <Button tier={i === 0 ? 'primary' : 'forward'} href={d.href} full={i === 0}>
                {d.label}
              </Button>
            </div>
          ))}
        </section>
      ) : null}

      {/* SHARE THIS CHAPTER. The one act a sealed record permits — it does not
          change the visit, it lets someone else read it. `quiet`, because the
          record is the point and passing it on is a secondary path (§10.4).
          The address carries the invoice's own share token, and the endpoint
          behind it strips amounts and contact details before anything leaves
          the server, so a forwarded link cannot leak what a stranger must not
          see. */}
      {shareHref ? (
        <section style={{ ...column, paddingTop: space.rest }}>
          <Button tier="quiet" href={shareHref}>Share this chapter</Button>
        </section>
      ) : null}

      {/* Nothing else follows. §16.2 — the account is sealed, so there is
          nothing here to do to it. */}
      <div style={{ height: INSET }} />
    </main>
  );
}
