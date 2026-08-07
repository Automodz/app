/**
 * THE ROOM CALLED LIVE HAS TO BE LIVE.
 *
 * Every customer room renders on the SERVER, which is what makes them arrive
 * whole with no loading bar — and it is also what froze this one at the moment
 * it was requested. A customer watching their own car saw the act it was in
 * when the page loaded and nothing after it: new photographs never appeared,
 * the rail never advanced, and the only way to see progress was to know to
 * pull down to refresh.
 *
 * These assertions cover the two halves that make it correct: that the room
 * asks again at all, and that it does not do so behind a customer's back.
 */
import { readFileSync } from 'fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { LiveRefresh } from '@/components/system/LiveRefresh';

const codeOf = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const refresh = codeOf('components/system/LiveRefresh.tsx');
const room = codeOf('components/screens/LiveVisitScreen.tsx');

describe('the live visit keeps itself current', () => {
  it('the room mounts the refresher', () => {
    expect(room).toMatch(/<LiveRefresh\s*\/>/);
  });

  it('asks the server again rather than navigating', () => {
    /* `router.refresh()` re-fetches the current route and reconciles in
       place. A push or a replace would remount the room, lose the scroll
       position and throw away whatever the customer was looking at. */
    expect(refresh).toMatch(/router\.refresh\(\)/);
    expect(refresh).not.toMatch(/router\.(push|replace)\(/);
  });

  it('never polls a screen nobody is looking at', () => {
    /* A phone in a pocket must not spend battery and data on this. */
    expect(refresh).toMatch(/visibilitychange/);
    expect(refresh).toMatch(/document\.visibilityState !== 'visible'/);
    /* And the tick itself re-checks, because a tab can be hidden between the
       listener firing and the interval running. */
    expect(refresh).toMatch(/if \(document\.visibilityState === 'visible'\) router\.refresh\(\)/);
  });

  it('takes a fresh read the moment somebody comes back', () => {
    const onVis = refresh.slice(refresh.indexOf('const onVisibility'), refresh.indexOf('start();\n    document'));
    expect(onVis).toMatch(/router\.refresh\(\)/);
  });

  it('tears the interval down when it unmounts', () => {
    /* The room unmounts as soon as the visit stops being live — the same
       address then renders the record — so this is what actually stops the
       polling. A leaked interval would go on asking forever. */
    expect(refresh).toMatch(/clearInterval\(timer\)/);
    expect(refresh).toMatch(/removeEventListener\('visibilitychange'/);
  });

  it('refuses a cadence fast enough to be a nuisance', () => {
    expect(refresh).toMatch(/Math\.max\(5, everySeconds\)/);
  });

  it('renders nothing at all', () => {
    /* §19.2 — no spinner, no "updating…", no ticking timestamp. The customer
       watches their car, never the machinery. */
    expect(renderToStaticMarkup(<LiveRefresh />)).toBe('');
    expect(refresh).toMatch(/return null;/);
  });
});
