import { VisitScreen } from '@/components/screens/VisitScreen';
import { LiveVisitScreen } from '@/components/screens/LiveVisitScreen';
import { BookedScreen } from '@/components/screens/BookedScreen';
import { ServerRoom, NoCar } from '@/components/screens/ServerRoom';
import {
  historyContextOf, toVisit, toLiveVisit, toBooked,
} from '@/lib/customer/project';

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
 *
 * WHICH car it belongs to is now resolved rather than discarded: the room hands
 * it to the screen so the control that leaves this address can carry it, and a
 * customer who walked in from the BMW's record does not leave into the Kia's.
 */
export default async function VisitPage(
  { params, searchParams }: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ car?: string }>;
  },
) {
  const { id } = await params;
  const { car } = await searchParams;
  return (
    <ServerRoom>
      {picture => {
        const ctx = historyContextOf(picture, { visitId: id, car });

        /* A VISIT IN FLIGHT IS A DIFFERENT SURFACE. The record is what a visit
           becomes; while the car is actually here the customer needs where it
           is and when it will be done, not an account of what happened
           (§13.2). Resolved first, because a live visit has no record yet. */
        if (ctx.kind === 'live') {
          const live = toLiveVisit(picture, ctx.car, ctx.bookingId);
          if (live) return <LiveVisitScreen model={live} />;
        }

        if (ctx.kind === 'visit') {
          return (
            <VisitScreen
              visit={toVisit(ctx.visit, ctx.car, picture.invoices)}
              carId={ctx.car.vehicle.id}
            />
          );
        }

        /* A BOOKING THAT HAS NOT BECOME A VISIT YET. Every notification written
           before events existed addresses `/history/<bookingId>` — forty-two of
           them in production — and a booking that is neither live nor sealed has
           no visit under that id. They all landed on the no-car invitation,
           which reads as the customer's garage having been emptied. */
        if (ctx.kind === 'booked') {
          const booked = toBooked(picture, ctx.bookingId);
          if (booked) return <BookedScreen model={booked} />;
        }

        return <NoCar />;
      }}
    </ServerRoom>
  );
}
