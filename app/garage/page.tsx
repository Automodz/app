import { GarageScreen } from '@/components/screens/GarageScreen';
import { ServerRoom } from '@/components/screens/ServerRoom';
import { toGarage } from '@/lib/customer/project';

/**
 * A customer's own room is never static. `cookies()` already forces this, but
 * the declaration is the contract: nothing here may be prerendered or shared
 * between customers, whatever the build environment happens to have.
 */
export const dynamic = 'force-dynamic';


/**
 * `/garage` - the collection. §12.4's empty state is the screen's own.
 *
 * `?car=` names the car the collection LEADS with. It is an address rather
 * than local state for the reason Home's `?car=` is: linkable, restorable, and
 * closed by the back button. Without one the studio's own order of attention
 * decides, which is what the room did before a customer could say otherwise.
 */
export default async function GaragePage(
  { searchParams }: { searchParams: Promise<{ car?: string }> },
) {
  const { car } = await searchParams;
  return <ServerRoom>{p => <GarageScreen model={toGarage(p, new Date(), car)} />}</ServerRoom>;
}
