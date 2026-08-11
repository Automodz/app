import { StudioScreen } from '@/components/screens/StudioScreen';
import { ServerRoom } from '@/components/screens/ServerRoom';
import { toStudio } from '@/lib/customer/project';
import { currentSession } from '@/lib/server/session';
import { readEstimate } from '@/lib/server/estimateService';
import type { Estimate } from '@/lib/types';

/**
 * A customer's own room is never static. `cookies()` already forces this, but
 * the declaration is the contract: nothing here may be prerendered or shared
 * between customers, whatever the build environment happens to have.
 */
export const dynamic = 'force-dynamic';


/**
 * `/studio` — the place, and where a visit is arranged (design 06 and 08).
 *
 * `?estimate=` arrives from the scope screen. It is READ HERE, from the
 * estimate's own document, rather than rebuilt from the address: a figure a
 * browser could put in a query string is a figure a browser could change, and
 * a price the customer can edit is not a price. The id is all that travels.
 */
export default async function StudioPage(
  { searchParams }: { searchParams: Promise<{ estimate?: string }> },
) {
  const { estimate: estimateId } = await searchParams;
  const estimate = estimateId ? await loadEstimate(estimateId) : null;

  return (
    <ServerRoom>{p => <StudioScreen model={toStudio(p, new Date(), estimate)} />}</ServerRoom>
  );
}

/**
 * Ownership is checked inside `readEstimate`, against the verified session.
 *
 * An estimate that is not the caller's — or has been spent, or has run out —
 * simply does not arrive, and the sheet falls back to arranging from the
 * catalogue. A stale link therefore costs a customer a re-quote and never a
 * wrong price.
 */
async function loadEstimate(id: string): Promise<Estimate | null> {
  const session = await currentSession();
  if (!session) return null;
  try {
    return await readEstimate(session.uid, id, { forSpending: true });
  } catch {
    return null;
  }
}
