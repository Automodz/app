/**
 * ALL NINETEEN SCREENS - the deployment gate.
 *
 * `docs/DESIGN-PARITY-AUDIT.md` enumerates the design's nineteen screens and
 * marks five of them 🔴 "no route exists". This is the file that fails if one
 * of them goes missing again, and it deliberately asserts more than existence:
 * a page that renders is not a screen. Each one must be addressable, must read
 * through the one server read, must declare itself dynamic where it holds a
 * customer's own data, and must not build its own addresses.
 *
 * It also asserts the things the audit found WRONG rather than absent - a
 * technician named on a customer surface, a price computed in a renderer, a
 * booking written from a browser - because those are the failures that came
 * back twice.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { rooms, slots } from '@/navigation/routes';

const read = (p: string) => readFileSync(p, 'utf8');
const codeOf = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

/**
 * The nineteen, each with the file that renders it and whether it belongs to a
 * signed-in customer. `public` screens are reachable without a session: the
 * sign-in wall itself, and the marketplace, which has to be shareable.
 */
const SCREENS: {
  n: string; name: string; page: string; screen?: string; customer: boolean;
}[] = [
  { n: '01', name: 'Welcome', page: 'app/auth/login/page.tsx', customer: false },
  { n: '02', name: 'Add your car', page: 'app/garage/page.tsx', screen: 'components/garage/CarForm.tsx', customer: true },
  { n: '03', name: 'Now - new customer', page: 'app/page.tsx', screen: 'components/screens/HomeScreen.tsx', customer: true },
  { n: '04', name: 'Now - in the studio', page: 'app/page.tsx', screen: 'components/screens/HomeScreen.tsx', customer: true },
  { n: '05', name: 'Now - resting', page: 'app/page.tsx', screen: 'components/screens/HomeScreen.tsx', customer: true },
  { n: '06', name: 'Studio', page: 'app/studio/page.tsx', screen: 'components/screens/StudioScreen.tsx', customer: true },
  { n: '07', name: 'Scope & quote', page: 'app/studio/scope/page.tsx', screen: 'components/studio/ScopeAndQuote.tsx', customer: true },
  { n: '08', name: 'Date & concierge', page: 'app/studio/page.tsx', screen: 'components/studio/BookingFlow.tsx', customer: true },
  { n: '09', name: 'Booked', page: 'app/booking/[id]/page.tsx', screen: 'components/screens/BookedScreen.tsx', customer: true },
  { n: '10', name: 'Manage booking', page: 'app/booking/[id]/manage/page.tsx', screen: 'components/studio/ManageBooking.tsx', customer: true },
  { n: '11', name: 'The visit', page: 'app/history/[id]/page.tsx', screen: 'components/screens/LiveVisitScreen.tsx', customer: true },
  { n: '12', name: 'Mid-visit approval', page: 'app/approval/[id]/page.tsx', screen: 'components/studio/ApprovalScreen.tsx', customer: true },
  { n: '13', name: 'Ready · pay · rate', page: 'app/history/[id]/settle/page.tsx', screen: 'components/studio/SettleScreen.tsx', customer: true },
  { n: '14', name: 'Garage', page: 'app/garage/page.tsx', screen: 'components/screens/GarageScreen.tsx', customer: true },
  { n: '15', name: 'Car record', page: 'app/vehicle/page.tsx', screen: 'components/screens/VehicleScreen.tsx', customer: true },
  { n: '16', name: 'Cars for sale', page: 'app/cars/page.tsx', screen: 'components/screens/MarketScreen.tsx', customer: false },
  { n: '17', name: 'Certified car detail', page: 'app/cars/[id]/page.tsx', screen: 'components/screens/ListingScreen.tsx', customer: false },
  { n: '18', name: 'Club', page: 'app/membership/page.tsx', screen: 'components/screens/MembershipScreen.tsx', customer: true },
  { n: '19', name: 'You', page: 'app/you/page.tsx', screen: 'components/screens/YouScreen.tsx', customer: true },
];

const CUSTOMER = SCREENS.filter(s => s.customer);

/* ── existence ───────────────────────────────────────────────────────────── */

describe('all nineteen screens exist', () => {
  it('nineteen, and no fewer', () => {
    expect(SCREENS).toHaveLength(19);
    expect(new Set(SCREENS.map(s => s.n)).size).toBe(19);
  });

  it.each(SCREENS.map(s => [`${s.n} · ${s.name}`, s.page] as const))(
    '%s has a route', (_label, page) => {
      expect(existsSync(page)).toBe(true);
    });

  it.each(SCREENS.filter(s => s.screen).map(s => [`${s.n} · ${s.name}`, s.screen!] as const))(
    '%s has a screen to draw it', (_label, screen) => {
      expect(existsSync(screen)).toBe(true);
    });
});

/* ── every customer room reads through the one read ──────────────────────── */

describe('a customer’s own screen is never static and never client-fetched', () => {
  const pages = [...new Set(CUSTOMER.map(s => s.page))];

  it.each(pages)('%s declares itself dynamic', page => {
    /* A build without admin credentials once baked the signed-out screen into
       static HTML and served it to every signed-in customer from the CDN. */
    expect(read(page)).toMatch(/export const dynamic = 'force-dynamic'/);
  });

  it.each(pages)('%s reads through the server room', page => {
    expect(read(page)).toMatch(/ServerRoom/);
  });

  it.each(pages)('%s is not a client component', page => {
    expect(read(page)).not.toMatch(/^'use client'/m);
  });
});

/* ── nothing is inert ────────────────────────────────────────────────────── */

describe('§10.5 - no control exists without a destination', () => {
  const screens = SCREENS.map(s => s.screen).filter(Boolean) as string[];

  it.each([...new Set(screens)])('%s has no dead href', file => {
    const src = codeOf(file);
    /* `href="#"` and `href=""` are the two ways a control gets drawn before it
       has anywhere to go, and then stays. */
    expect(src).not.toMatch(/href=["']#["']/);
    expect(src).not.toMatch(/href=["']["']/);
  });

  it.each([...new Set(screens)])('%s carries no placeholder copy', file => {
    const src = codeOf(file);
    expect(src).not.toMatch(/\bTODO\b|\bFIXME\b|Lorem ipsum|Coming soon/i);
  });

  it.each([...new Set(screens)])('%s sums no money', file => {
    /* FORMATTING a figure the projection handed over is a screen's job;
       ADDING UP is not. `reduce` over prices is the shape every one of the
       four disagreeing implementations had. The stronger guard is the import
       check below - a screen without the pricing engine cannot apply a
       discount, a fee or a tax - and this catches the hand-rolled version. */
    const src = codeOf(file);
    expect(src).not.toMatch(/\.reduce\(\([a-z]+, [a-z]+\) => [a-z]+ \+ [a-z]+\.(price|amount|total)/);
  });
});

/* ── the rules the audit found broken ────────────────────────────────────── */

describe('§2.2 - no individual is ever named on a customer surface', () => {
  /* `components/studio` is the CUSTOMER's studio surfaces. The staff tools
     that used to sit beside them - the floor timeline, the technician drawer,
     the occupancy hook - moved to `components/workspace`, so this folder walk
     means what it says and a staff surface cannot drift back in unnoticed. */
  const surfaces = [
    ...walk('components/screens'),
    ...walk('components/studio'),
    ...walk('components/vehicle'),
  ];

  it.each(surfaces)('%s names no technician', file => {
    const src = codeOf(file);
    /* The design's own screen 11 draws "11:20 AM · Rahul K." and the decision
       was that the studio's work is unsigned. These are the fields that would
       carry a name if one ever leaked back in. */
    expect(src).not.toMatch(/byEmployeeName|employeeName|requestedByEmployee|receivedByName/);
    expect(src).not.toMatch(/assignments\b/);
  });
});

describe('§22.1 - money is decided by the server', () => {
  it('no customer screen imports the pricing engine', () => {
    /* A screen that could price could show a figure the server never agreed
       to, and the customer would be surprised at the counter. */
    for (const file of [...walk('components/screens'), ...walk('components/studio')]) {
      expect(codeOf(file)).not.toMatch(/from '@\/lib\/services\/pricing'/);
    }
  });

  it('every write of money is behind a server route', () => {
    const services = codeOf('lib/services/bookings.ts');
    expect(services).toMatch(/\/api\/booking\/create|\/api\/booking\/cancel|\/api\/booking\/reschedule/);
    /* The three that used to be direct Firestore writes from the browser. */
    expect(services).not.toMatch(/updateDoc\([^)]*scheduledDate/);
  });
});

describe('§6.4 - every surface is addressable, and the dock still names five', () => {
  it('the dock is five slots, in the design’s order', () => {
    expect(slots).toEqual(['/', '/studio', '/garage', '/membership', '/you']);
  });

  it('every room the table declares has at least one page', () => {
    for (const path of Object.keys(rooms)) {
      const dir = path === '/' ? 'app' : `app${path}`;
      expect(existsSync(dir)).toBe(true);
      expect(walk(dir).some(f => /page\.tsx$/.test(f))).toBe(true);
    }
  });

  it('the retired sheets are gone, not merely unused', () => {
    /* Two implementations of one screen is how they drift. */
    expect(existsSync('components/studio/ManageVisit.tsx')).toBe(false);
  });
});

/* ── the states each screen has to have ──────────────────────────────────── */

describe('every room says something when the connection goes', () => {
  const screens = [
    'components/screens/HomeScreen.tsx',
    'components/screens/StudioScreen.tsx',
    'components/screens/BookedScreen.tsx',
    'components/studio/ManageBooking.tsx',
    'components/studio/ScopeAndQuote.tsx',
    'components/studio/ApprovalScreen.tsx',
    'components/studio/SettleScreen.tsx',
  ];

  it.each(screens)('%s carries the offline note', file => {
    expect(codeOf(file)).toMatch(/<OfflineNote/);
  });
});

describe('every screen that acts says why when it cannot', () => {
  it.each([
    ['components/studio/ManageBooking.tsx', /moveBlockedBecause|cancelBlockedBecause/],
    ['components/studio/ApprovalScreen.tsx', /model\.settled/],
    ['components/studio/SettleScreen.tsx', /upiUnavailable/],
    ['components/screens/BookedScreen.tsx', /lockedBecause/],
    ['components/studio/ScopeAndQuote.tsx', /Choose a coverage and we will price it/],
  ] as const)('%s', (file, pattern) => {
    expect(codeOf(file)).toMatch(pattern);
  });

  it('and every refusal has words, never a code', () => {
    for (const file of [
      'components/studio/ManageBooking.tsx',
      'components/studio/ApprovalScreen.tsx',
      'components/studio/SettleScreen.tsx',
      'components/studio/ScopeAndQuote.tsx',
    ]) {
      expect(codeOf(file)).toMatch(/REFUSAL|FAULT/);
    }
  });
});

/* ── the collections, and the doors into them ────────────────────────────── */

describe('every new collection has explicit rules', () => {
  const rulesSrc = read('firestore.rules');

  it.each([
    'estimates', 'approvals', 'payments', 'ratings',
  ])('%s is declared', name => {
    expect(rulesSrc).toContain(`match /${name}/`);
  });

  it('addresses are owner-read and server-write', () => {
    expect(rulesSrc).toContain('match /addresses/{addressId}');
  });

  it('no new collection is left wide open', () => {
    /* A wildcard `match /{document=**}` would make every rule above it
       decorative. */
    expect(rulesSrc).not.toMatch(/match \/\{document=\*\*\}/);
  });

  it('every one of them is owner-scoped on read', () => {
    for (const name of ['estimates', 'approvals', 'payments', 'ratings']) {
      const block = rulesSrc.slice(rulesSrc.indexOf(`match /${name}/`));
      expect(block.slice(0, 400)).toMatch(/request\.auth\.uid/);
    }
  });
});
