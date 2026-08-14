import { GarageScreen } from '@/components/screens/GarageScreen';
import { ServerRoom } from '@/components/screens/ServerRoom';
import { toGarage } from '@/lib/customer/project';

/**
 * A customer's own room is never static. `cookies()` already forces this, but
 * the declaration is the contract: nothing here may be prerendered or shared
 * between customers, whatever the build environment happens to have.
 */
export const dynamic = 'force-dynamic';


/** `/garage` - the collection. §12.4's empty state is the screen's own. */
export default function GaragePage() {
  return <ServerRoom>{p => <GarageScreen model={toGarage(p)} />}</ServerRoom>;
}
