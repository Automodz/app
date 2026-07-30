import { VisitScreen } from '@/components/screens/VisitScreen';
import { ServerRoom, NoCar } from '@/components/screens/ServerRoom';
import { visitsOf, toVisit } from '@/lib/customer/project';

/**
 * A customer's own room is never static. `cookies()` already forces this, but
 * the declaration is the contract: nothing here may be prerendered or shared
 * between customers, whatever the build environment happens to have.
 */
export const dynamic = 'force-dynamic';


/**
 * `/history/[id]` — one visit's account. §6.4 — addressable, which §16.4 also
 * needs. The id is searched across every car the customer owns, because a visit
 * id is unique across them and a shared link carries no car.
 */
export default async function VisitPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return (
    <ServerRoom>
      {picture => {
        for (const car of picture.cars) {
          const visit = visitsOf(car, picture.catalogue).find(v => v.id === id);
          if (visit) return <VisitScreen visit={toVisit(visit, car)} />;
        }
        return <NoCar />;
      }}
    </ServerRoom>
  );
}
