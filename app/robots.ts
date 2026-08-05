import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/company';

/**
 * What a crawler may read.
 *
 * The marketing surface and the car listings are the whole point of being
 * indexed. Everything behind the door is not: the customer rooms are one
 * person's garage, `/admin` is the studio's back office, and `/invoice` and
 * `/chapter` are shared by private link. None of them would rank and all of
 * them would leak a URL shape — so they are excluded rather than left to
 * `noindex` alone.
 *
 * `/` is NOT excluded: signed out it is the public landing, and signed in it is
 * Home. A crawler only ever sees the first.
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
      /* The customer rooms moved to the root, so `/app` no longer exists and
         the real signed-in surfaces were being crawled. `/` itself stays
         allowed — it is the public landing when signed out. */
      disallow: [
        '/admin', '/admin/', '/api/', '/invoice/', '/chapter/', '/offline',
        '/garage', '/vehicle', '/history', '/studio', '/you', '/membership',
        '/welcome',
        /* `/cars` and `/cars/[id]` stay OUT of this list deliberately — they
           are the public showroom. `/dashboard` is the signed-in half of the
           marketplace and belongs here with the other rooms. */
        '/dashboard',
        /* The staff kiosk PIN lock. An auth surface, never a page. */
        '/store',
      ],
    }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
