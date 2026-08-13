/**
 * ONE LEGAL PAGE, TWO DOCUMENTS.
 *
 * Privacy and Terms are the same shape — a title, a lead, headed sections and a
 * date — so they are one component reading `lib/legal.ts`. Two near-identical
 * page files would be two places for the design to drift and, worse, two places
 * to forget to update the date.
 *
 * ── AND IT IS NOT A DEAD END ─────────────────────────────────────────────
 * It had three links at the FOOT — Privacy, Terms, AutoModz — which is the
 * exact idiom the navigation law suite condemned everywhere else: "a control
 * you reach by scrolling past everything is not an escape route, it is a
 * footer." A customer who opened Terms from You had to use the browser's own
 * back button, and a stranger sent the link had nothing at all.
 *
 * So it carries the ONE back control, with an explicit parent — the same
 * `publicParent` rule an invoice and a chapter already use, because these
 * three surfaces share the same problem: they are read by people who may have
 * no session, no history and no room to return to. `?from=` when the product
 * itself put it there; `/` otherwise, which answers for both readers.
 *
 * That costs one small client island on two otherwise static pages. A dead end
 * costs more.
 */
import Link from 'next/link';
import type { LegalSection } from '@/lib/legal';
/* Imported from their own modules, NOT the `components/system` barrel. The
   barrel re-exports every primitive, and a dozen of them are `'use client'`
   with Radix and framer-motion behind them. Reaching through it from a server
   component pulled all of that into this page's client bundle — 167 kB of
   JavaScript for two pages that are pure text and have no interactivity at
   all. */
import { Heading } from '@/components/system/Heading';
import { Text } from '@/components/system/Text';
import { Back } from '@/components/os/RoomHeader';
import { publicParent } from '@/navigation/resolve';
import { color, space, INSET, MEASURE, TARGET_MIN, type as typeScale } from '@/design';

export function LegalPage({
  title, lead, sections, updated, from,
}: {
  title: string;
  lead: string;
  sections: LegalSection[];
  updated: string;
  /** Where the product sent them from, when the product sent them. */
  from?: string;
}) {
  return (
    <main
      style={{
        background: color.paper,
        minHeight: '100svh',
        paddingInline: INSET,
        paddingTop: `calc(env(safe-area-inset-top, 0px) + ${space.movement}px)`,
        paddingBottom: space.movement,
      }}
    >
      <article style={{ maxWidth: MEASURE + INSET * 2, marginInline: 'auto', width: '100%' }}>
        <Back parent={publicParent(from)} style={{ marginBottom: space.line }} />
        <Heading level="display">{title}</Heading>
        <Text role="body" tone="ink2" style={{ marginTop: space.line, maxWidth: MEASURE }}>
          {lead}
        </Text>

        {sections.map(s => (
          <section key={s.heading} style={{ marginTop: space.movement }}>
            <Heading level="title" as="h2">{s.heading}</Heading>
            {s.body.map(p => (
              <Text key={p} role="body" tone="ink2" style={{ marginTop: space.gap, maxWidth: MEASURE }}>
                {p}
              </Text>
            ))}
          </section>
        ))}

        <section style={{ marginTop: space.movement }}>
          <Text role="whisper" tone="ink3">Last updated {updated}.</Text>
          <div style={{ marginTop: space.gap, display: 'flex', gap: space.rest, flexWrap: 'wrap' }}>
            {[
              { href: '/privacy', label: 'Privacy' },
              { href: '/terms', label: 'Terms' },
              { href: '/', label: 'AutoModz' },
            ]
              .filter(l => l.label.toLowerCase() !== title.toLowerCase())
              .map(l => (
                <Link
                  key={l.href}
                  href={l.href}
                  style={{
                    fontFamily: typeScale.body.family,
                    fontSize: typeScale.data.size,
                    color: color.ink2,
                    textDecoration: 'none',
                    minHeight: TARGET_MIN,
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  {l.label}
                </Link>
              ))}
          </div>
        </section>
      </article>
    </main>
  );
}
