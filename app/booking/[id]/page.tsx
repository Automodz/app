import { notFound } from 'next/navigation';
import { BookedScreen } from '@/components/screens/BookedScreen';
import { ServerRoom } from '@/components/screens/ServerRoom';
import { toBooked } from '@/lib/customer/project';

/**
 * A customer's own room is never static. `cookies()` already forces this, but
 * the declaration is the contract: nothing here may be prerendered or shared
 * between customers, whatever the build environment happens to have.
 */
export const dynamic = 'force-dynamic';

/**
 * `/booking/[id]` — design screen 09.
 *
 * OWNERSHIP IS STRUCTURAL. `CustomerPicture` was built by querying `bookings`
 * where `userId` equals the verified session's uid, so another customer's
 * booking is not in the picture to be found and `toBooked` returns null. The
 * 404 is therefore the truth from this customer's side, and it leaks nothing:
 * a booking that is not theirs and a booking that does not exist are the same
 * answer.
 */
export default async function BookingPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return (
    <ServerRoom>
      {picture => {
        const model = toBooked(picture, id);
        if (!model) notFound();
        return <BookedScreen model={model} />;
      }}
    </ServerRoom>
  );
}
