import type { Metadata } from 'next';
import { COMPANY } from '@/lib/company';

/**
 * The share card for a Chapter.
 *
 * DELIBERATELY GENERIC. A chapter is readable only with the token in `?t=`, and
 * `generateMetadata` on a layout never sees the query string - so putting the
 * car's name or registration here would mean anyone holding a bare id could
 * read a customer's car out of a preview card without ever holding the token.
 * The card says a visit happened at AutoModz; the page, with the token, says
 * whose and what.
 *
 * `noindex` because these are private links, not pages.
 */
export const metadata: Metadata = {
  title: 'A visit at AutoModz',
  description: `The work, the evidence, and the protection that came out of it - ${COMPANY.name}, ${COMPANY.city}.`,
  robots: { index: false, follow: false },
  openGraph: {
    title: 'A visit at AutoModz',
    description: 'The work, the evidence, and the protection that came out of it.',
    type: 'article', siteName: COMPANY.name,
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: COMPANY.name }],
  },
  twitter: {
    card: 'summary',
    title: 'A visit at AutoModz',
    description: 'The work, the evidence, and the protection that came out of it.',
  },
};

export default function ChapterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
