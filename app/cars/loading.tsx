/**
 * §19.1 - loading is a state, not an absence. The showroom reads from
 * Firestore on every request, so the gap is real and has to be furnished.
 * §19.3 forbids a spinner for a whole surface; this is the breath, exactly as
 * the rooms use it.
 */
import { space, INSET, MEASURE, stack } from '@/design';
/* Deep imports, NOT the `components/system` barrel. The barrel re-exports
   every primitive, a dozen of them `'use client'` with Radix and
   framer-motion behind them, and reaching through it from a server
   component pulls all of that into the page's client bundle. Measured on
   the legal pages: 167 kB → 108 kB from this change alone. */
import { Loading } from '@/components/system/Loading';

export default function CarsLoading() {
  return (
    <main style={{
      /* Transparent, like every room. This painted `color.paper`, so each
         navigation flashed an opaque dark page and then revealed the ambient
         field underneath - the one moment in the product where the room
         visibly changed material. */
      background: 'transparent',
      minHeight: '100svh',
        /* The top inset, from the token - see ServerRoom. */
        paddingTop: stack.top,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      paddingInline: INSET,
    }}>
      <div style={{
        maxWidth: MEASURE + INSET * 2,
        marginInline: 'auto',
        width: '100%',
        paddingBlock: space.movement,
      }}>
        <Loading caption="Bringing the cars out" />
      </div>
    </main>
  );
}
