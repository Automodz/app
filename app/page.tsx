import { redirect } from 'next/navigation';
import { HomeScreen } from '@/components/screens/HomeScreen';
import { LandingScreen } from '@/components/screens/LandingScreen';
import { ServerRoom, NoCar } from '@/components/screens/ServerRoom';
import { toHome } from '@/lib/customer/project';
import { currentSession } from '@/lib/server/session';
import { loadPriceFloor } from '@/lib/server/publicCatalogue';
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
        return model ? <HomeScreen model={model} /> : <NoCar />;
      }}
    </ServerRoom>
  );
}
