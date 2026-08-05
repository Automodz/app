import { SellCarScreen } from '@/components/screens/SellCarScreen';
import { ServerRoom } from '@/components/screens/ServerRoom';
import { loadMySellRequests } from '@/lib/server/marketplace';
import { toSell } from '@/lib/customer/market';

/**
 * `/dashboard/sell-car` — offering your car to the studio.
 *
 * Signed in, unlike the rest of the marketplace. An offer is the start of a
 * relationship the studio has to be able to come back to, and what the
 * customer has already offered is shown here — so there has to be someone to
 * show it to. `ServerRoom` supplies the sign-in wall and the picture.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sell us your car',
  alternates: { canonical: '/dashboard/sell-car' },
};

export default function SellCarPage() {
  return (
    <ServerRoom>
      {picture => (
        <SellCarPanel uid={picture.user.uid} garage={picture.cars.map(c => ({
          id: c.vehicle.id, name: c.vehicle.name,
        }))} />
      )}
    </ServerRoom>
  );
}

/** Split out so the request read is awaited inside the room, not above it. */
async function SellCarPanel(
  { uid, garage }: { uid: string; garage: { id: string; name: string }[] },
) {
  const requests = await loadMySellRequests(uid);
  return <SellCarScreen model={toSell(requests, garage)} />;
}
