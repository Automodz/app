import { redirect } from 'next/navigation';
import { HomeScreen } from '@/components/screens/HomeScreen';
import { LandingScreen } from '@/components/screens/LandingScreen';
import { ServerRoom, NoCar } from '@/components/screens/ServerRoom';
import { toHome } from '@/lib/customer/project';
import { currentSession } from '@/lib/server/session';
import { loadPriceFloor } from '@/lib/server/publicCatalogue';
import { loadListings } from '@/lib/server/marketplace';
import { shouldWelcome } from '@/lib/os/welcome';
import { hrefForDestination } from '@/navigation/resolve';

/**
 * A customer's own room is never static. `cookies()` already forces this, but
 * the declaration is the contract: nothing here may be prerendered or shared
 * between customers, whatever the build environment happens to have.
 */
export const dynamic = 'force-dynamic';


/**
 * `/` — one address, two answers.
 *
 * To a visitor it is the public landing: the studio, the craft, the prices, the
 * proof, and one way in. To an owner it is Home: their car, its state, and what
 * happens next. The old application split these across `/` and `/app`; the two
 * addresses collapsed into one when the customer application moved to the root,
 * and this is where they are told apart again. Neither behaviour was dropped.
 *
 * The landing's prices are read HERE rather than inside the screen. Read on the
 * client they would have pulled the Firebase SDK into the one address every
 * visitor arrives at.
 */
export default async function RootPage() {
  const session = await currentSession();

  if (!session) {
    const prices = await loadPriceFloor();
    return <LandingScreen prices={prices} />;
  }

  return (
    <ServerRoom>
      {picture => {
        /* FIRST ARRIVAL. Decided on the server from the user document, so it
           is the same answer on every device — and decided HERE because Home
           is the only address allowed to interrupt (`welcomeInterrupts`).
           A client effect used to do this after mount, which meant a flash of
           somebody else's Home before the redirect. */
        if (shouldWelcome({
          welcomedAt: picture.user.welcomedAt,
          vehicleCount: picture.cars.length,
        })) {
          redirect(hrefForDestination({ to: 'welcome' }));
        }

        const model = toHome(picture);
        if (!model) return <NoCar />;
        /* THE MARKET, READ HERE. A projection is pure and reads nothing
           (ARCHITECTURE §1), so the listings are fetched at the page and
           handed down. `loadListings` is `cache`d, so the strip costs one
           query however many places ask for it. */
        return <HomeMarket model={model} />;
      }}
    </ServerRoom>
  );
}


/**
 * The market strip, filled.
 *
 * Separate because `ServerRoom`'s children are synchronous — it hands over a
 * picture, not a promise — and this needs one await. Three cars, because Home
 * is a glance and the market itself is one tap away.
 */
async function HomeMarket({ model }: { model: NonNullable<ReturnType<typeof toHome>> }) {
  const listings = await loadListings().catch(() => []);
  const forSale = listings
    .filter(c => c.status === 'available')
    .sort((a, b) => Number(b.featured) - Number(a.featured))
    .slice(0, 3)
    .map(c => ({
      id: c.id,
      title: c.title,
      price: `₹${(c.price / 100000).toFixed(c.price % 100000 === 0 ? 0 : 1)}L`,
      detail: [c.year, `${(c.kmDriven / 1000).toFixed(0)}k km`, c.fuel]
        .filter(Boolean).join(' · '),
      photo: c.photos?.[0]?.url,
      href: hrefForDestination({ to: 'car', listingId: c.id }),
    }));

  return <HomeScreen model={{ ...model, forSale }} />;
}
