import { notFound } from 'next/navigation';
import { SettleScreen } from '@/components/studio/SettleScreen';
import { ServerRoom } from '@/components/screens/ServerRoom';
import { toSettle, visitsOf } from '@/lib/customer/project';
import { currentSession } from '@/lib/server/session';
import { payableFor, paymentsForCustomer, studioVpa } from '@/lib/server/paymentService';
import { ratingsForCustomer } from '@/lib/server/ratingService';
import type { PaymentStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * `/history/[id]/settle` — design screen 13.
 *
 * Under the visit rather than beside it, because settling is something you do
 * TO a visit: the address reads as what it is, the back button lands on the
 * record, and nothing new appears in the dock.
 *
 * The money is resolved on the server, by the same function the payment route
 * uses. Reading it here rather than out of the customer picture matters: what
 * is owed changes when the studio settles a credit or a mid-visit approval is
 * granted, and a customer standing on this screen is standing on the figure.
 */
export default async function SettlePage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await currentSession();

  /* Ownership is checked inside `payableFor`, against the verified session. A
     booking that is not the caller's throws, and the catch makes that the same
     404 as one that does not exist. */
  const money = session ? await payableFor(session.uid, id).catch(() => null) : null;
  const [payments, ratings] = session
    ? await Promise.all([paymentsForCustomer(session.uid), ratingsForCustomer(session.uid)])
    : [[], []];

  return (
    <ServerRoom>
      {picture => {
        if (!money) notFound();

        /* The sealed record, when the visit has produced one. A visit that has
           not been sealed cannot be rated — there is nothing permanent to
           attach an opinion to yet. */
        const visit = picture.cars
          .flatMap(car => visitsOf(car))
          .find(v => v.bookingId === id) ?? null;

        const live = payments.find(p =>
          p.bookingId === id && p.status !== 'paid' && p.status !== 'expired');

        const model = toSettle({
          picture,
          bookingId: id,
          visit,
          money: { total: money.total, received: money.received, payable: money.payable },
          payment: live ? { status: live.status as PaymentStatus } : null,
          rated: !!visit && ratings.some(r => r.visitId === visit.id),
          upiAvailable: studioVpa() !== null,
        });
        if (!model) notFound();
        return <SettleScreen model={model} />;
      }}
    </ServerRoom>
  );
}
