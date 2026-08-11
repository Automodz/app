import { notFound } from 'next/navigation';
import { ScopeAndQuote } from '@/components/studio/ScopeAndQuote';
import { ServerRoom, NoCar } from '@/components/screens/ServerRoom';
import { toScopeQuote } from '@/lib/customer/project';

export const dynamic = 'force-dynamic';

/**
 * `/studio/scope` — design screen 07.
 *
 * Reached by choosing a service in the Studio (design 06 → 07), and it leaves
 * for the date screen carrying an estimate id.
 *
 * `?car=` is optional: with one car there is nothing to disambiguate, and with
 * several the Garage's own lead car is the one the rest of the product already
 * treats as "yours". A car that is not the customer's simply is not in the
 * picture, so a forged id resolves to no car rather than to somebody else's.
 */
export default async function ScopePage(
  { searchParams }: { searchParams: Promise<{ service?: string; car?: string }> },
) {
  const { service, car } = await searchParams;
  if (!service) notFound();

  return (
    <ServerRoom>
      {picture => {
        /* No car at all is not an error — it is the one thing a customer can
           do something about, and `NoCar` offers exactly that (§10.5). */
        if (picture.cars.length === 0) return <NoCar />;
        const model = toScopeQuote(picture, service, car);
        if (!model) notFound();
        return <ScopeAndQuote model={model} />;
      }}
    </ServerRoom>
  );
}
