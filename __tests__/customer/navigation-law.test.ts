/**
 * NO ROOM IS A DEAD END.
 *
 * Reported: "There is no obvious way back from the vehicle detail page to the
 * Cars screen." That was true, and it was not one screen's oversight — it was
 * the absence of a rule. The audit it triggered found:
 *
 *   · THREE back idioms. A `quiet` Action at the very FOOT of the studio's
 *     scope, the approval, manage-a-booking and the live visit; a `quiet`
 *     Button at the TOP of `/cars/<id>` and `/dashboard/sell-car`, set flush
 *     with no glyph so it read as a caption; and nothing at all elsewhere.
 *   · FIVE screens with no way back of any kind — `/history`, `/history/<id>`,
 *     `/history/<id>/settle`, `/vehicle`, `/booking/<id>`.
 *   · TWO of those with no dock either, because they are public on purpose —
 *     `/cars` and `/dashboard/sell-car` were closed rooms with no exit.
 *
 * These are the rules that replaced it, asserted rather than remembered.
 */
import { readFileSync } from 'fs';
import { parentOf } from '@/navigation/resolve';
import { roomFor, isCustomerSurface, slots } from '@/navigation/routes';

const codeOf = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/**
 * Does this screen draw the way out?
 *
 * Two shapes, one control: `<Back />` placed directly, or `<RoomHeader>` with
 * a parent — the header composes the same primitive, which is the point of it
 * existing. A screen that does neither is a screen you cannot leave.
 */
const drawsBack = (file: string) => {
  const src = codeOf(file);
  return /<Back\b/.test(src) || /<RoomHeader\b/.test(src);
};

/**
 * Every customer address, and the file that draws it. Held here so a new room
 * that forgets its way out fails this suite rather than being found on a
 * phone.
 */
const SCREENS: readonly { route: string; file: string; name: string }[] = [
  { route: '/',                      file: 'components/screens/HomeScreen.tsx',      name: 'Now' },
  { route: '/welcome',               file: 'components/screens/WelcomeScreen.tsx',   name: 'Welcome' },
  { route: '/studio',                file: 'components/screens/StudioScreen.tsx',    name: 'Studio' },
  { route: '/studio/scope',          file: 'components/studio/ScopeAndQuote.tsx',    name: 'Scope & Quote' },
  { route: '/booking/b1',            file: 'components/screens/BookedScreen.tsx',    name: 'Booked' },
  { route: '/booking/b1/manage',     file: 'components/studio/ManageBooking.tsx',    name: 'Manage booking' },
  { route: '/approval/a1',           file: 'components/studio/ApprovalScreen.tsx',   name: 'Mid-visit approval' },
  { route: '/history',               file: 'components/screens/HistoryScreen.tsx',   name: 'The record' },
  { route: '/history/v1',            file: 'components/screens/VisitScreen.tsx',     name: 'The visit' },
  { route: '/history/v1/settle',     file: 'components/studio/SettleScreen.tsx',     name: 'Ready / pay / rate' },
  { route: '/garage',                file: 'components/screens/GarageScreen.tsx',    name: 'Garage' },
  { route: '/vehicle',               file: 'components/screens/VehicleScreen.tsx',   name: 'The car' },
  { route: '/membership',            file: 'components/screens/MembershipScreen.tsx', name: 'Club' },
  { route: '/you',                   file: 'components/screens/YouScreen.tsx',       name: 'You' },
  { route: '/cars',                  file: 'components/screens/MarketScreen.tsx',    name: 'Cars for sale' },
  { route: '/cars/c1',               file: 'components/screens/ListingScreen.tsx',   name: 'Certified detail' },
  { route: '/dashboard/sell-car',    file: 'components/screens/SellCarScreen.tsx',   name: 'Sell us your car' },
];

/** The five the dock holds. Back GOES here, so these must not have one. */
const ROOT = new Set(slots as string[]);

/**
 * THE ONE EXCEPTION, STATED RATHER THAN FORGOTTEN.
 *
 * The first arrival has no parent because there is nothing behind it — it is
 * the first screen a customer ever sees, reached by being sent there rather
 * than by walking. A back control would point at a room they have not been
 * given yet. It is not a dead end: every step carries a skip and a forward,
 * and both land in the product (asserted below).
 */
const NO_PARENT_BY_DESIGN = new Set(['/welcome']);

describe('every screen answers "how do I go back?"', () => {
  const children = SCREENS.filter(
    s => !ROOT.has(s.route) && !NO_PARENT_BY_DESIGN.has(s.route),
  );

  it('the first arrival is the only screen exempt, and it still lets you out', () => {
    const src = codeOf('components/screens/WelcomeScreen.tsx');
    expect(parentOf('/welcome')).toBeNull();
    /* A forward and a way past it, on every step. */
    expect(src).toMatch(/panel\.forwardHref/);
    expect(src).toMatch(/panel\.passHref \?\? homeHref/);
  });

  it.each(children.map(s => [s.name, s.file, s.route] as const))(
    '%s draws the one back control',
    (_name, file, route) => {
      /* Either it places the control, or it is a root — and it is not. */
      expect({ route, back: drawsBack(file) }).toEqual({ route, back: true });
    },
  );

  it.each([...ROOT].map(r => [r] as const))(
    '%s is a root room and grows no back control',
    route => {
      /* §6.2 — a back control on a dock slot either does nothing or leaves the
         product. `parentOf` returning null is what makes `<Back />` safe to
         place unconditionally. */
      expect(parentOf(route)).toBeNull();
    },
  );
});

describe('the way back is deterministic, never the browser’s history', () => {
  it.each([
    ['/cars/c1',              '/cars'],
    ['/dashboard/sell-car',   '/cars'],
    ['/history/v1',           '/history'],
    ['/history/v1/settle',    '/history/v1'],
    ['/history',              '/'],
    ['/booking/b1',           '/studio'],
    ['/booking/b1/manage',    '/booking/b1'],
    ['/studio/scope',         '/studio'],
    ['/vehicle',              '/garage'],
    ['/cars',                 '/'],
  ])('%s goes to %s', (from, to) => {
    expect(parentOf(from)?.href).toBe(to);
  });

  it('nothing in the product calls history.back() to escape a room', () => {
    /* §17.3 — a notification is a doorway, and an approval, a booking and an
       invoice are all opened cold from a lock screen. `back()` there leaves
       the app or does nothing, and it is indistinguishable from working when
       you happen to have walked in through the front door. */
    for (const { file } of SCREENS) {
      expect({ file, historyBack: /router\.back\(\)|history\.back\(\)/.test(codeOf(file)) })
        .toEqual({ file, historyBack: false });
    }
  });

  it('a parent is named for the customer, never "Back"', () => {
    /* §21.8 — the customer's word. "Back" says nothing about where you land,
       which is the whole thing a screen reader needs to hear. */
    for (const { route } of SCREENS) {
      const p = parentOf(route);
      if (!p) continue;
      expect({ route, name: p.name }).not.toEqual({ route, name: 'Back' });
      expect(p.name.length).toBeGreaterThan(2);
    }
  });

  it('a parent is never the address itself', () => {
    for (const { route } of SCREENS) {
      expect(parentOf(route)?.href).not.toBe(route);
    }
  });
});

describe('there is ONE back idiom', () => {
  it('the footer back-links are gone', () => {
    /* A control you reach by scrolling past the whole screen is a footer, not
       an escape route. All four moved to the top. */
    for (const { file } of SCREENS) {
      expect({ file, footer: /<Action[^>]*>\s*Back to/.test(codeOf(file)) })
        .toEqual({ file, footer: false });
    }
  });

  it('and so are the caption-shaped ones', () => {
    /* `<Button tier="quiet" … style={{ paddingInline: 0 }}>All cars</Button>`
       — the reported "no obvious way back". */
    for (const file of [
      'components/screens/ListingScreen.tsx', 'components/screens/SellCarScreen.tsx',
    ]) {
      expect(codeOf(file)).not.toMatch(/<Button[^>]*tier="quiet"[^>]*>\s*(All cars|Cars for sale)/);
    }
  });

  it('every screen that draws one uses the primitive, not its own', () => {
    for (const { file } of SCREENS) {
      const src = codeOf(file);
      if (!/<Back\b/.test(src)) continue;
      expect({ file, imported: /import \{[^}]*\bBack\b[^}]*\} from '@\/components\/os/.test(src) })
        .toEqual({ file, imported: true });
      expect({ file, own: /marginLeft: -space\.breath/.test(src) }).toEqual({ file, own: false });
    }
  });

  it('the header composes the same primitive rather than its own', () => {
    /* Five screens moved to `RoomHeader`; it must not grow a second back. */
    const src = codeOf('components/os/RoomHeader.tsx');
    /* Unconditionally — a header must not be able to lose the exit by having
       a prop left off. `Back` is the one that knows when to draw nothing. */
    expect(src).toMatch(/<Back parent=\{parent \?\? undefined\}/);
    expect(src).not.toMatch(/\{parent \? <Back/);
  });

  it('it is a link with an accessible destination, not an icon', () => {
    const src = codeOf('components/os/RoomHeader.tsx');
    expect(src).toMatch(/aria-label=\{`Back to \$\{to\.name\}`\}/);
    expect(src).toMatch(/minHeight: TARGET_MIN/);
  });
});

describe('a renderer still builds no addresses (ARCHITECTURE §1)', () => {
  it('the back control locates itself rather than being told where it is', () => {
    /* The first cut of this had `parentOf('/history')` inside the renderer,
       which is a renderer naming a route — the architecture suite caught it.
       The control reads its own address and asks the one route table. */
    const src = codeOf('components/os/RoomHeader.tsx');
    expect(src).toMatch(/const here = usePathname\(\)/);
    expect(src).toMatch(/parent \?\? parentOf\(here\)/);
  });

  it('the screens that override it do so from the MODEL', () => {
    /* An approval knows its own visit and the path does not. That href comes
       from the projection, like every other href a screen receives. */
    for (const [file, expr] of [
      ['components/studio/ApprovalScreen.tsx', 'model.visitHref'],
      ['components/studio/ManageBooking.tsx', 'model.backHref'],
      ['components/studio/ScopeAndQuote.tsx', 'model.backHref'],
      ['components/studio/SettleScreen.tsx', 'model.recordHref'],
      ['components/screens/ListingScreen.tsx', 'model.backHref'],
    ]) {
      expect(codeOf(file)).toContain(`href: ${expr}`);
    }
  });
});

describe('the light and the dock are two questions, from one table', () => {
  it('every customer surface is themed, whether or not it is a room', () => {
    for (const { route } of SCREENS) {
      expect({ route, themed: isCustomerSurface(route) }).toEqual({ route, themed: true });
    }
  });

  it('the two that carry no dock still carry the light', () => {
    /* Public on purpose — four slots leading to a sign-in wall are four dead
       ends — but still drawn in the room's one dark palette. */
    for (const route of ['/cars', '/cars/c1', '/dashboard/sell-car']) {
      expect({ route, dock: Boolean(roomFor(route)) }).toEqual({ route, dock: false });
      expect({ route, light: isCustomerSurface(route) }).toEqual({ route, light: true });
    }
  });

  it('and a surface with no dock always has a back, or it is a closed room', () => {
    /* The rule that makes "dead end" impossible to reintroduce: no dock and
       no back is a screen a customer cannot leave. */
    for (const { route, file } of SCREENS) {
      if (roomFor(route) || NO_PARENT_BY_DESIGN.has(route)) continue;
      expect({ route, exit: drawsBack(file) }).toEqual({ route, exit: true });
    }
  });
});
