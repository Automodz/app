import { VisitScreen } from '@/components/screens/VisitScreen';
import { LiveVisitScreen } from '@/components/screens/LiveVisitScreen';
import { ServerRoom, NoCar } from '@/components/screens/ServerRoom';
import { visitsOf, toVisit, toLiveVisit } from '@/lib/customer/project';

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
        /* A VISIT IN FLIGHT IS A DIFFERENT SURFACE. The record is what a visit
           becomes; while the car is actually here the customer needs where it
           is and when it will be done, not an account of what happened
           (§13.2). Checked first, because a live visit has no record yet. */
        for (const car of picture.cars) {
          const live = toLiveVisit(picture, car, id);
          if (live) return <LiveVisitScreen model={live} />;
        }

        for (const car of picture.cars) {
          const visit = visitsOf(car).find(v => v.id === id);
          if (visit) return <VisitScreen visit={toVisit(visit, car, picture.invoices)} />;
        }
        return <NoCar />;
      }}
    </ServerRoom>
  );
}
