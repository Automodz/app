import { HistoryScreen } from '@/components/screens/HistoryScreen';
import { ChooseCar } from '@/components/screens/ChooseCar';
import { ServerRoom, NoCar } from '@/components/screens/ServerRoom';
import { historyContextOf, toHistory, toGarage } from '@/lib/customer/project';

/**
 * A customer's own room is never static. `cookies()` already forces this, but
 * the declaration is the contract: nothing here may be prerendered or shared
 * between customers, whatever the build environment happens to have.
 */
export const dynamic = 'force-dynamic';

/**
 * `/history` — the album. §18.1: a car with no completed visits shows none.
 *
 * The subject is resolved by `historyContextOf` and nowhere else. This route
 * used to fall back to `leadCar` whenever `?car=` was absent, so a customer
 * with two cars could be shown the wrong one's visits under the right one's
 * name, with nothing on screen to say the subject had changed.
 */
export default async function HistoryPage(
  { searchParams }: { searchParams: Promise<{ car?: string }> },
) {
  const { car } = await searchParams;
  return (
    <ServerRoom>
      {picture => {
        const ctx = historyContextOf(picture, { car });
        if (ctx.kind === 'none') return <NoCar />;
        /* Several cars and nothing naming one: ask (§19.1 — an absence of
           context is a state, not a licence to choose). */
        if (ctx.kind === 'choose') {
          return <ChooseCar model={toGarage(picture)} because="whose record to open" />;
        }
        return <HistoryScreen model={toHistory(ctx.car, picture.invoices)} />;
      }}
    </ServerRoom>
  );
}
