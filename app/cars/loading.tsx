/**
 * §19.1 — loading is a state, not an absence. The showroom reads from
 * Firestore on every request, so the gap is real and has to be furnished.
 * §19.3 forbids a spinner for a whole surface; this is the breath, exactly as
 * the rooms use it.
 */
import { color, space, INSET, MEASURE } from '@/design';
import { Loading } from '@/components/system';

export default function CarsLoading() {
  return (
    <main style={{
      background: color.paper,
      minHeight: '100svh',
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
