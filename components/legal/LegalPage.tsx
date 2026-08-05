/**
 * ONE LEGAL PAGE, TWO DOCUMENTS.
 *
 * Privacy and Terms are the same shape — a title, a lead, headed sections and a
 * date — so they are one component reading `lib/legal.ts`. Two near-identical
 * page files would be two places for the design to drift and, worse, two places
 * to forget to update the date.
 *
 * A server component: there is nothing interactive here, so it ships no
 * JavaScript at all.
 */
import Link from 'next/link';
import type { LegalSection } from '@/lib/legal';
import { Heading, Text } from '@/components/system';
import { color, space, INSET, MEASURE, TARGET_MIN, type as typeScale } from '@/design';

export function LegalPage({
  title, lead, sections, updated,
}: {
  title: string;
  lead: string;
  sections: LegalSection[];
  updated: string;
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
