import { MarketScreen } from '@/components/screens/MarketScreen';
import { loadListings, loadSavedIds } from '@/lib/server/marketplace';
import { toMarket } from '@/lib/customer/market';
import { currentSession } from '@/lib/server/session';

/**
 * `/cars` - the showroom. PUBLIC, unlike every room in the customer
 * application: a listing a stranger cannot open is a listing nobody buys.
 *
 * Dynamic because the filters arrive as search params and the saved list is
 * per-customer. It renders its content on the server, so the stock is in the
 * HTML for anyone - or anything - that reads the page without running it.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Cars for sale',
  description: 'Used cars sold and prepared by AutoModz.',
  alternates: { canonical: '/cars' },
};

export default async function CarsPage(
  { searchParams }: {
    searchParams: Promise<{ q?: string; fuel?: string; upto?: string }>;
  },
) {
  const { q, fuel, upto } = await searchParams;
  const session = await currentSession();

  const [listings, savedIds] = await Promise.all([
    loadListings(),
    session ? loadSavedIds(session.uid) : Promise.resolve([]),
  ]);

  const model = toMarket(
    listings,
    { query: q, fuel, upto: Number(upto) || undefined },
    savedIds,
  );

  /* No Suspense boundary: `MarketScreen` is a server component with no state,
     no effects and no `useSearchParams`, so it cannot suspend. A boundary with
     a null fallback around something that never suspends is one more tree for
     React to walk and nothing for the customer. */
  return <MarketScreen model={model} />;
}
