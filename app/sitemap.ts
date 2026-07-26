import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/company';
import { adminDb } from '@/lib/server/firebaseAdmin';

/**
 * The public map of the studio.
 *
 * Only pages a stranger is meant to find: the landing page, the store, and each
 * active car listing. `/cars/[id]` is the one route that genuinely needs to be
 * discoverable, so it is enumerated rather than left to link-following.
 *
 * Listings are read with the Admin SDK because `carListings` is readable only
 * where `active == true`, and a build has no session. If the read fails - no
 * credentials on a preview, Firestore having a moment - the static routes still
 * ship. A sitemap that is smaller than it should be is a bad day; a build that
 * fails because a sitemap could not be generated is a worse one.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/cars`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/store`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
  ];

  if (!adminDb) return staticRoutes;

  try {
    const snap = await adminDb.collection('carListings').where('active', '==', true).get();
    return [
      ...staticRoutes,
      ...snap.docs.map(d => {
        const updated = (d.data().updatedAt as { toDate?: () => Date } | undefined)?.toDate?.();
        return {
          url: `${SITE_URL}/cars/${d.id}`,
          lastModified: updated ?? now,
          changeFrequency: 'weekly' as const,
          priority: 0.7,
        };
      }),
    ];
  } catch {
    return staticRoutes;
  }
}
