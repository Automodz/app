import type { Metadata } from 'next';
import { TERMS, LEGAL_UPDATED } from '@/lib/legal';
import { LegalPage } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'The terms on which AutoModz takes a visit, a membership and a warranty.',
  /* Its OWN canonical. Metadata is shallowly merged, so a page that does not
     declare `alternates` inherits the root layout's `canonical: '/'` — which
     told search engines this page was a duplicate of the homepage and should
     not be indexed on its own. Apple requires this one at a stable, findable
     URL. */
  alternates: { canonical: '/terms' },
};

/** Public and static — same reasoning as the privacy policy. */
export default async function TermsPage(
  { searchParams }: { searchParams: Promise<{ from?: string }> },
) {
  const { from } = await searchParams;
  return (
    <LegalPage
      from={from}
      title="Terms"
      lead="How we arrange visits, take payment, and hold a warranty."
      sections={TERMS}
      updated={LEGAL_UPDATED}
    />
  );
}
