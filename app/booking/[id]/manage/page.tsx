import { notFound } from 'next/navigation';
import { ManageBooking } from '@/components/studio/ManageBooking';
import { ServerRoom } from '@/components/screens/ServerRoom';
import { toManageBooking, findBooking } from '@/lib/customer/project';
import { nextOpenings } from '@/lib/server/openings';
import { currentSession } from '@/lib/server/session';
import { loadCustomerPicture } from '@/lib/server/customerPicture';

export const dynamic = 'force-dynamic';

/**
 * `/booking/[id]/manage` - design screen 10.
 *
 * The openings are loaded HERE and not in the projection, because they depend
 * on every other customer's bookings and a projection may not read a database
 * (ARCHITECTURE §1). They come from the same occupancy the Booking Service
 * accepts against, with this booking excluded so that a two-day job is not
 * told it cannot move by one day on account of itself.
 */
export default async function ManageBookingPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  /* The openings are loaded BEFORE the room rather than inside it, because a
     `ServerRoom` child is a synchronous render function and awaiting inside it
     would put a promise in the children position. Both reads below are
     memoised for the request (`cache`), so asking twice costs nothing. */
  const openings = await openingsForBooking(id);

  return (
    <ServerRoom>
      {picture => {
        const model = toManageBooking(picture, id, openings);
        if (!model) notFound();
        return <ManageBooking model={model} />;
      }}
    </ServerRoom>
  );
}

/**
 * The days the studio could actually take THIS booking's work.
 *
 * Ownership is checked here rather than assumed: this reads the booking with
 * the Admin SDK, which is not subject to rules, so the session's uid must
 * match the booking's owner or nothing is returned. An empty list is also what
 * a stranger gets, which is the same answer as a booking that does not exist.
 */
async function openingsForBooking(id: string) {
  const session = await currentSession();
  if (!session) return [];
  const picture = await loadCustomerPicture(session).catch(() => null);
  const found = picture ? findBooking(picture, id) : null;
  if (!found) return [];
  return nextOpenings({
    category: found.booking.serviceCategory ?? '',
    durationMinutes: found.booking.serviceDurationMinutes ?? 60,
    limit: 8,
    excludeBookingId: id,
  });
}
