import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/company';
import { loadListings } from '@/lib/server/marketplace';

/**
 * The public map of the studio.
 *
 * Only pages a stranger is meant to find: the landing page, the showroom, and
 * each active car listing. `/store` was here and should never have been — it
 * is the staff kiosk PIN lock, and advertising an auth surface to search
 * engines is not a page, it is a doorway. `/cars/[id]` is the one route that genuinely needs to be
 * discoverable, so it is enumerated rather than left to link-following.
 *
 * Listings come from `loadListings` — the ONE reader of `carListings` in the
 * product. This used to run its own `where('active','==',true)` query, which
 * meant the sitemap could advertise a car the showroom would not show. If the
 * read fails - no credentials on a preview, Firestore having a moment - the
 * static routes still ship. A sitemap that is smaller than it should be is a
 * bad day; a build that fails because a sitemap could not be generated is a
 * worse one.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/cars`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
  ];

  try {
    const listings = await loadListings();
    return [
      ...staticRoutes,
      ...listings.map(c => ({
        url: `${SITE_URL}/cars/${c.id}`,
        lastModified: c.updatedAt ? new Date(c.updatedAt as unknown as string) : now,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
    ];
  } catch {
    return staticRoutes;
  }
}
