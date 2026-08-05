import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ListingScreen } from '@/components/screens/ListingScreen';
import { loadListing, loadListings, loadSavedIds } from '@/lib/server/marketplace';
import { toListing } from '@/lib/customer/market';
import { currentSession } from '@/lib/server/session';
import { formatCurrency } from '@/lib/utils';

/**
 * `/cars/[id]` — one car. Public, and the one address in the product that
 * genuinely has to be findable and shareable: a listing with no preview card
 * is a link nobody opens when it is pasted into WhatsApp.
 */
export const dynamic = 'force-dynamic';

/**
 * Share card and canonical for one car.
 *
 * Only a listing the studio is still showing gets real metadata. A withdrawn
 * car falls back to the generic card rather than leaking its details to anyone
 * holding an old id — `loadListing` already returns null for it, so this is
 * one decision made in one place rather than two.
 */
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const car = await loadListing(id);
  if (!car) {
    return { title: 'Car for sale', alternates: { canonical: `/cars/${id}` } };
  }

  const description = [
    formatCurrency(car.price),
    `${car.year}`,
    `${new Intl.NumberFormat('en-IN').format(car.kmDriven)} km`,
  ].join(' · ');

  return {
    title: car.title,
    description,
    alternates: { canonical: `/cars/${id}` },
    openGraph: {
      title: car.title,
      description,
      type: 'website',
      ...(car.photos?.[0]?.url ? { images: [{ url: car.photos[0].url }] } : {}),
    },
  };
}

export default async function CarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await currentSession();

  const [car, all, savedIds] = await Promise.all([
    loadListing(id),
    loadListings(),
    session ? loadSavedIds(session.uid) : Promise.resolve([]),
  ]);

  /* A withdrawn listing and a missing one are the same answer, deliberately:
     neither is for sale, and distinguishing them would tell a stranger which
     ids exist. `not-found` renders the product's own 404, not a blank. */
  if (!car) notFound();

  return (
    <Suspense fallback={null}>
      <ListingScreen model={toListing(car, all, savedIds)} signedIn={Boolean(session)} />
    </Suspense>
  );
}
