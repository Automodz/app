/**
 * NOWHERE IN THE PRODUCT TRAPS THE CUSTOMER.
 *
 * Reported from production: Now → "Follow the visit" → `/history/<id>`, whose
 * Back read "the car" and led to `/vehicle?car=X`, whose Back led straight back
 * to the visit. Two rooms pointing at each other, for ever, with no way out but
 * the dock.
 *
 * The cause was NOT the route table - `parentOf('/history/<id>')` has always
 * answered "Your visits", which is up. It was `LiveVisitScreen` passing an
 * explicit `parent` at the car, and an explicit parent beats both the walk and
 * the table. It named a DESCENDANT as the parent, and a descendant-as-parent is
 * exactly what turns a chain into a cycle.
 *
 * So there are two laws here, because there are two ways to make this bug:
 *
 *   1. THE TABLE TERMINATES. Follow `parentOf` from any address and you reach a
 *      root in a bounded number of steps. No cycles, no wandering.
 *   2. A SCREEN MAY NOT QUIETLY OVERRIDE IT. `<Back parent={...}>` is a real
 *      facility - a listing legitimately knows the filtered list the customer
 *      arrived through - but it is now an ALLOWLIST. A new override cannot be
 *      added without this file being edited, which is the point.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { parentOf } from '@/navigation/resolve';
import { roomFor, slots } from '@/navigation/routes';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

/**
 * Every shape of address the product can put a customer at, including the ones
 * that carry a car - which is the half the original bug lived in.
 */
const ADDRESSES = [
  '/', '/garage', '/history', '/studio', '/membership', '/you', '/cars', '/welcome',
  '/vehicle', '/vehicle?car=v1', '/vehicle/puc', '/vehicle/puc?car=v1',
  '/history?car=v1', '/history/h1', '/history/h1?car=v1', '/history/h1/settle',
  '/studio/scope', '/studio/protection',
  '/booking/b1', '/booking/b1/manage', '/booking/b1/calendar',
  '/approval/a1', '/cars/c1', '/dashboard/sell-car',
  '/invoice/i1', '/chapter/c1', '/privacy', '/terms',
];

describe('the parent of every address leads out, never round', () => {
  it.each(ADDRESSES.map(a => [a] as const))('%s reaches a root', address => {
    const seen: string[] = [address];
    let at: string | null = address;

    for (let step = 0; step < 12; step++) {
      const parent = parentOf(at as string);
      if (!parent) return; // a root: Back is not offered, and that is the exit
      at = parent.href;

      /* The whole bug, stated: an address already on this walk means the
         customer can follow Back for ever without arriving anywhere. */
      expect({ address, cycle: seen.includes(at as string), walk: [...seen, at] })
        .toEqual({ address, cycle: false, walk: [...seen, at] });
      seen.push(at as string);
    }

    /* Twelve steps is far more than the deepest room; needing more means the
       chain does not end even if it never repeats. */
    expect({ address, ended: false, walk: seen }).toEqual({ address, ended: false, walk: seen });
  });

  it('and a root really is a root - no Back to offer', () => {
    /* The DOCK's five, taken from the route table rather than typed again -
       `/history` is not one of them (it activates Garage), and it correctly
       does have a parent. Reading `slots` is what stops this test asserting a
       root set the product does not have. */
    for (const root of slots) {
      expect({ root, parent: parentOf(root) }).toEqual({ root, parent: null });
    }
  });

  it('every address a Back can reach is a real room or document', () => {
    /* A parent nobody can render is a dead end of a different kind. */
    for (const address of ADDRESSES) {
      const parent = parentOf(address);
      if (!parent) continue;
      const [path] = parent.href.split('?');
      const known = Boolean(roomFor(path))
        || ['/cars', '/privacy', '/terms', '/dashboard/sell-car'].includes(path);
      expect({ address, parent: parent.href, known }).toEqual({ address, parent: parent.href, known: true });
    }
  });
});

describe('a screen may not name its own parent without saying why', () => {
  /**
   * The allowlist, and the reason each one is on it. Anything else must let
   * `Back` ask the walk and then the table - which is what it does when no
   * `parent` is passed, and what `LiveVisitScreen` now does.
   */
  const ALLOWED: Record<string, string> = {
    'components/screens/ListingScreen.tsx':
      'a listing knows the FILTERED list the customer arrived through, and '
      + '`parentOf` can only answer with the unfiltered one',
    'components/legal/LegalPage.tsx':
      'privacy and terms are SHARED addresses - the reader may have no session '
      + 'and no history, so `publicParent` reads who sent them (see resolve.ts)',
  };

  /* `RoomHeader` forwards whatever its caller gave it. Passing a prop through
     is not naming a parent, and matching it here would make the law unable to
     tell plumbing from a decision. */
  const FORWARDS = /<Back parent=\{parent/;

  it('only the allowlisted screens pass an explicit parent', () => {
    const offenders = walk('components')
      .filter(f => {
        const src = readFileSync(f, 'utf8');
        return /<Back\s+parent=/.test(src) && !FORWARDS.test(src);
      })
      .filter(f => !(f in ALLOWED));
    expect(offenders).toEqual([]);
  });

  it('and the visit is not one of them - it is where the loop came from', () => {
    const src = readFileSync('components/screens/LiveVisitScreen.tsx', 'utf8');
    expect(src).toMatch(/<Back \/>/);
    expect(src).not.toMatch(/<Back\s+parent=/);
  });
});
