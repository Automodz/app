import { StudioScreen } from '@/components/screens/StudioScreen';
import { ServerRoom } from '@/components/screens/ServerRoom';
import { toStudio } from '@/lib/customer/project';

/**
 * A customer's own room is never static. `cookies()` already forces this, but
 * the declaration is the contract: nothing here may be prerendered or shared
 * between customers, whatever the build environment happens to have.
 */
export const dynamic = 'force-dynamic';


/** `/studio` — the place. */
export default function StudioPage() {
  return <ServerRoom>{p => <StudioScreen model={toStudio(p)} />}</ServerRoom>;
}
