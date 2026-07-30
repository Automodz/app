import { HistoryScreen } from '@/components/screens/HistoryScreen';
import { ServerRoom, NoCar } from '@/components/screens/ServerRoom';
import { toHistory, leadCar } from '@/lib/customer/project';

/**
 * A customer's own room is never static. `cookies()` already forces this, but
 * the declaration is the contract: nothing here may be prerendered or shared
 * between customers, whatever the build environment happens to have.
 */
export const dynamic = 'force-dynamic';


/** `/history` — the album. §18.1: a car with no completed visits shows none. */
export default async function HistoryPage(
  { searchParams }: { searchParams: Promise<{ car?: string }> },
) {
  const { car: wanted } = await searchParams;
  return (
    <ServerRoom>
      {picture => {
        const car = (wanted && picture.cars.find(c => c.vehicle.id === wanted))
          || leadCar(picture);
        return car
          ? <HistoryScreen model={toHistory(car, picture.catalogue)} />
          : <NoCar />;
      }}
    </ServerRoom>
  );
}
