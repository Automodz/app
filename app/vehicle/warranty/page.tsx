import { notFound } from 'next/navigation';
import { WarrantyScreen } from '@/components/screens/WarrantyScreen';
import { ServerRoom, NoCar } from '@/components/screens/ServerRoom';
import { toWarranty, leadCar } from '@/lib/customer/project';

export const dynamic = 'force-dynamic';

/**
 * `/vehicle/warranty?p=<protectionId>` - the brand's cover on one film or coat.
 *
 * Under the car, like the certificate, because it is a fact ABOUT one car and
 * the address should read as what it is.
 *
 * `?p=` names the protection rather than the kind: a car can hold a film AND a
 * coat, each with its own brand, its own term and its own claim reference, so
 * "the warranty on this car" is not a question with one answer.
 *
 * The id is resolved against THIS CUSTOMER'S OWN car, so a forged one finds
 * nothing rather than somebody else's cover - the same rule `/studio/scope`
 * applies to a service id.
 */
export default async function WarrantyPage(
  { searchParams }: { searchParams: Promise<{ p?: string; car?: string }> },
) {
  const { p, car } = await searchParams;
  if (!p) notFound();

  return (
    <ServerRoom>
      {picture => {
        if (picture.cars.length === 0) return <NoCar />;
        const chosen = (car && picture.cars.find(c => c.vehicle.id === car))
          ?? leadCar(picture);
        if (!chosen) return <NoCar />;
        const model = toWarranty(chosen, picture, p);
        if (!model) notFound();
        return <WarrantyScreen model={model} />;
      }}
    </ServerRoom>
  );
}
