import { MembershipScreen } from '@/components/screens/MembershipScreen';
import { ServerRoom } from '@/components/screens/ServerRoom';
import { toMembership } from '@/lib/customer/project';

/**
 * A customer's own room is never static. `cookies()` already forces this, but
 * the declaration is the contract: nothing here may be prerendered or shared
 * between customers, whatever the build environment happens to have.
 */
export const dynamic = 'force-dynamic';


/** `/membership` — the club. §15.2 places it with the car's protections too. */
export default function MembershipPage() {
  return <ServerRoom>{p => <MembershipScreen model={toMembership(p)} />}</ServerRoom>;
}
