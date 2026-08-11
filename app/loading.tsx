/**
 * THE LOADING STATE.
 *
 * Source: docs/AUTOMODZ-OS.md §19.1 — "loading is a state, not an absence."
 *
 * A customer navigating between rooms sees the shape of the room arriving, not
 * a blank page and not a spinner. §19.3 permits a spinner only inside a control
 * the customer just pressed; this is a whole surface, so it is the breath.
 */
import { space, INSET, MEASURE, stack } from '@/design';
/* Deep imports, NOT the `components/system` barrel. The barrel re-exports
   every primitive, a dozen of them `'use client'` with Radix and
   framer-motion behind them, and reaching through it from a server
   component pulls all of that into the page's client bundle. Measured on
   the legal pages: 167 kB → 108 kB from this change alone. */
import { Loading } from '@/components/system/Loading';

export default function RoomLoading() {
  return (
    <main
      style={{
        /* Transparent, like every room. This painted `color.paper`, so each
         navigation flashed an opaque dark page and then revealed the ambient
         field underneath — the one moment in the product where the room
         visibly changed material. */
      background: 'transparent',
        minHeight: '100svh',
        /* The top inset, from the token — see ServerRoom. */
        paddingTop: stack.top,
        paddingBottom: stack.contentFloor,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        paddingInline: INSET,
      }}
    >
      <div
        style={{
          maxWidth: MEASURE + INSET * 2,
          marginInline: 'auto',
          width: '100%',
          paddingBlock: space.movement,
        }}
      >
        <Loading caption="Opening your studio" />
      </div>
    </main>
  );
}
