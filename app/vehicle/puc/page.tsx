import { PucScreen } from '@/components/screens/PucScreen';
import { ServerRoom, NoCar } from '@/components/screens/ServerRoom';
import { toPuc, leadCar } from '@/lib/customer/project';
import { canAcceptPhotographs } from '@/lib/server/cloudinary';

/**
 * A customer's own room is never static. `cookies()` already forces this, but
 * the declaration is the contract: nothing here may be prerendered or shared
 * between customers, whatever the build environment happens to have.
 */
export const dynamic = 'force-dynamic';

/**
 * `/vehicle/puc` — one car's pollution certificate.
 *
 * `?car=` selects which, exactly as `/vehicle` does, and for the same reason:
 * the search param is read on the server, so there is no Suspense bail-out and
 * no client fetch. It is also what `parentOf` carries upward, so Back returns
 * to the car this was about rather than to whichever car the product leads
 * with.
 *
 * With no `car=` at all — a bare deep link — it leads with the same car
 * `/vehicle` would, so the screen and its parent agree.
 */
export default async function VehiclePucPage(
  { searchParams }: { searchParams: Promise<{ car?: string }> },
) {
  const { car: wanted } = await searchParams;
  return (
    <ServerRoom>
      {picture => {
        const car = (wanted && picture.cars.find(c => c.vehicle.id === wanted))
          || leadCar(picture);
        if (!car) return <NoCar />;
        /* §10.5 — the photograph is offered only where it can actually be
           sent. A deployment with no media keys answers 503 to every upload,
           and a control that always fails is not a control. */
        return <PucScreen model={toPuc(car, picture)} canAttach={canAcceptPhotographs()} />;
      }}
    </ServerRoom>
  );
}
