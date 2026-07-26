import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/company';

/**
 * What a crawler may read.
 *
 * The marketing surface and the car listings are the whole point of being
 * indexed. Everything behind the door is not: `/app` is one customer's garage,
 * `/admin` is the studio's back office, `/invoice` and `/chapter` are shared by
 * private link. None of them would rank and all of them would leak a URL
 * shape - so they are excluded rather than left to `noindex` alone.
 */
export default function robots(): MetadataRoute.Robots {
  const production = (process.env.VERCEL_ENV ?? 'production') === 'production';

  // a preview deployment must never compete with the real site in an index
  if (!production) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: ['/app', '/app/', '/admin', '/admin/', '/api/', '/invoice/', '/chapter/', '/styleguide', '/offline'],
    }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
