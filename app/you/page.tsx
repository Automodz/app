import { YouRoom } from '@/components/screens/YouRoom';
import { ServerRoom } from '@/components/screens/ServerRoom';
import { toYou } from '@/lib/customer/project';

/**
 * A customer's own room is never static. `cookies()` already forces this, but
 * the declaration is the contract: nothing here may be prerendered or shared
 * between customers, whatever the build environment happens to have.
 */
export const dynamic = 'force-dynamic';


/**
 * `/you` - the person. The path matches the room's own name in
 * `navigation/routes.ts`; `/profile` was a word from §5.2's internal table, and
 * §21.8 applies to addresses too.
 */
export default function YouPage() {
  return <ServerRoom>{p => <YouRoom model={toYou(p)} />}</ServerRoom>;
}
