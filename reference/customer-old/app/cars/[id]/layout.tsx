import type { Metadata } from 'next';
import { adminDb } from '@/lib/server/firebaseAdmin';
import { COMPANY } from '@/lib/company';

/**
 * Share cards and canonical for one car.
 *
 * The page itself is a client component, so its metadata lives here - the
 * standard split, and it means the page did not have to change. This is the one
 * route that genuinely needs to be found: a listing with no preview card is a
 * link nobody clicks when it is pasted into WhatsApp.
 *
 * Only ACTIVE listings get real metadata. A withdrawn or sold car falls back to
 * the generic card rather than leaking its details to anyone holding an old id.
 */
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const fallback: Metadata = {
    title: 'Car for sale',
    alternates: { canonical: `/cars/${id}` },
  };
  if (!adminDb) return fallback;

  try {
    const snap = await adminDb.collection('carListings').doc(id).get();
    const c = snap.data() as {
      title?: string; price?: number; year?: number; kmDriven?: number;
      fuel?: string; transmission?: string; active?: boolean;
      photos?: { url: string }[];
    } | undefined;
    if (!snap.exists || !c || c.active !== true) return fallback;

    const price = typeof c.price === 'number'
      ? new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR', maximumFractionDigits: 0,
      }).format(c.price)
      : undefined;

    const title = c.title ?? 'Car for sale';
    const description = [
      price, c.kmDriven != null ? `${c.kmDriven.toLocaleString('en-IN')} km` : null,
      c.fuel, c.transmission,
    ].filter(Boolean).join(' · ') + ` - inspected and detailed at ${COMPANY.name}, ${COMPANY.city}.`;
    const image = c.photos?.[0]?.url;

    return {
      title,
      description,
      alternates: { canonical: `/cars/${id}` },
      openGraph: {
        title, description, type: 'website', siteName: COMPANY.name,
        url: `/cars/${id}`,
        ...(image ? { images: [{ url: image, alt: title }] } : {}),
      },
      twitter: {
        card: image ? 'summary_large_image' : 'summary',
        title, description, ...(image ? { images: [image] } : {}),
      },
    };
  } catch {
    return fallback;
  }
}

export default function CarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
