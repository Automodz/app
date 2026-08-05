import { redirect } from 'next/navigation';
import { WelcomeScreen } from '@/components/screens/WelcomeScreen';
import { ServerRoom } from '@/components/screens/ServerRoom';
import { toWelcome } from '@/lib/customer/welcome';
import { stepFrom, shouldWelcome } from '@/lib/os/welcome';
import { hrefForDestination } from '@/navigation/resolve';

/**
 * `/welcome` — the first arrival.
 *
 * SERVER-DECIDED. Whether this customer should be here at all is read from the
 * user document, not from `localStorage`, so it is the same answer on every
 * device they sign in from. Someone who has already arrived is sent home
 * before anything draws, rather than being shown a flash of a welcome and then
 * bounced by an effect.
 *
 * `?step=` selects the moment; `?welcome=1` forces the arrival for a customer
 * who has already had one — the studio's reset, and how it is exercised in
 * development.
 */
export const dynamic = 'force-dynamic';

export default async function WelcomePage(
  { searchParams }: { searchParams: Promise<{ step?: string; welcome?: string }> },
) {
  const { step, welcome } = await searchParams;
  const forced = welcome === '1';

  return (
    <ServerRoom>
      {picture => {
        if (!shouldWelcome({
          welcomedAt: picture.user.welcomedAt,
          vehicleCount: picture.cars.length,
          forced,
        })) {
          redirect(hrefForDestination({ to: 'home' }));
        }
        return (
          <WelcomeScreen model={toWelcome(picture, stepFrom(step), forced)} />
        );
      }}
    </ServerRoom>
  );
}
