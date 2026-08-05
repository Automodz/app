/**
 * THE LOADING STATE.
 *
 * Source: docs/AUTOMODZ-OS.md §19.1 — "loading is a state, not an absence."
 *
 * A customer navigating between rooms sees the shape of the room arriving, not
 * a blank page and not a spinner. §19.3 permits a spinner only inside a control
 * the customer just pressed; this is a whole surface, so it is the breath.
 */
import { color, space, INSET, MEASURE, stack } from '@/design';
import { Loading } from '@/components/system';

export default function RoomLoading() {
  return (
    <main
      style={{
        background: color.paper,
        minHeight: '100svh',
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
