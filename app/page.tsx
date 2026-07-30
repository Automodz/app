import { HomeScreen } from '@/components/screens/HomeScreen';
import { ServerRoom, NoCar } from '@/components/screens/ServerRoom';
import { toHome } from '@/lib/customer/project';

/**
 * A customer's own room is never static. `cookies()` already forces this, but
 * the declaration is the contract: nothing here may be prerendered or shared
 * between customers, whatever the build environment happens to have.
 */
export const dynamic = 'force-dynamic';


/** `/` — Home. Read and projected on the server; the screen only renders. */
export default function HomePage() {
  return (
    <ServerRoom>
      {picture => {
        const model = toHome(picture);
        return model ? <HomeScreen model={model} /> : <NoCar />;
      }}
    </ServerRoom>
  );
}
