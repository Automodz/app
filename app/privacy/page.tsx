import type { Metadata } from 'next';
import { PRIVACY, LEGAL_UPDATED } from '@/lib/legal';
import { LegalPage } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What AutoModz holds about you, why, and how to delete it.',
  /* Its OWN canonical. Metadata is shallowly merged, so a page that does not
     declare `alternates` inherits the root layout's `canonical: '/'` — which
     told search engines this page was a duplicate of the homepage and should
     not be indexed on its own. Apple requires this one at a stable, findable
     URL. */
  alternates: { canonical: '/privacy' },
};

/**
 * PUBLIC AND STATIC. Apple requires a privacy policy reachable at a stable URL
 * without signing in, and so does anyone deciding whether to sign up. No
 * session, no `force-dynamic` — it prerenders.
 */
export default async function PrivacyPage(
  { searchParams }: { searchParams: Promise<{ from?: string }> },
) {
  const { from } = await searchParams;
  return (
    <LegalPage
      from={from}
      title="Privacy"
      lead="What we hold about you, why we hold it, and how to remove it."
      sections={PRIVACY}
      updated={LEGAL_UPDATED}
    />
  );
}
