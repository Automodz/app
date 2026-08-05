import { VehicleRoom } from '@/components/screens/VehicleRoom';
import { ServerRoom, NoCar } from '@/components/screens/ServerRoom';
import { toVehicle, toVehiclePhotograph, leadCar } from '@/lib/customer/project';

/**
 * A customer's own room is never static. `cookies()` already forces this, but
 * the declaration is the contract: nothing here may be prerendered or shared
 * between customers, whatever the build environment happens to have.
 */
export const dynamic = 'force-dynamic';


/**
 * `/vehicle` — one car. `?car=` selects which; the search param is read on the
 * server, so no Suspense bail-out and no client fetch.
 */
export default async function VehiclePage(
  { searchParams }: { searchParams: Promise<{ car?: string }> },
) {
  const { car: wanted } = await searchParams;
  return (
    <ServerRoom>
      {picture => {
        const car = (wanted && picture.cars.find(c => c.vehicle.id === wanted))
          || leadCar(picture);
        if (!car) return <NoCar />;
        return (
          <VehicleRoom
            model={toVehicle(car, picture)}
            source={toVehiclePhotograph(car)}
          />
        );
      }}
    </ServerRoom>
  );
}
