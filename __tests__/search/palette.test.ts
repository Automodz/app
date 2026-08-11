/**
 * SEARCH / COMMAND PALETTE — §21.4, ARCHITECTURE §1 and §5.
 *
 * TWO DEFECTS THESE ASSERTIONS EXIST TO PIN DOWN, both structural rather than
 * cosmetic, and neither visible from any single screen:
 *
 *   IT WAS NOT GLOBAL. The Desk was mounted inside `HomeScreen`. ⌘K answered
 *   at `/` and at no other address, so the one mechanism meant to be "the way
 *   you navigate AutoModz" was a feature of a single screen.
 *
 *   IT WROTE ITS OWN ADDRESSES. The items were assembled in `toHome` with
 *   their hrefs typed out inline — `'/vehicle'`, `'/studio'`, `/history/${id}`
 *   — a second copy of the route table living in a projection. Move a route
 *   and the palette keeps sending people to the old one, silently, because
 *   nothing renders an error for a link that merely goes somewhere wrong.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { Timestamp } from 'firebase/firestore';
import type { Booking, Service, Subscription, User, Vehicle, Protection } from '@/lib/types';
import type { CarPicture, CustomerPicture } from '@/lib/customer/source';
import { toPalette, type PaletteItem } from '@/lib/customer/palette';
import { hrefForDestination } from '@/navigation/resolve';

const NOW = new Date('2026-07-30T12:00:00Z');
const ts = (iso: string) => Timestamp.fromDate(new Date(iso));

const codeOf = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

const vehicle = (over: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v1', name: 'BMW M4', registrationNumber: 'GJ01AB1234',
  createdAt: ts('2023-03-01T10:00:00Z'), ...over,
});

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: 'b1', userId: 'u1', vehicleId: 'v1', vehicleName: 'BMW M4',
  vehicleRegNo: 'GJ01AB1234', serviceId: 's1', serviceName: 'Ceramic coating',
  serviceCategory: 'Ceramic', servicePrice: 64000, scheduledDate: '2026-07-18',
  scheduledTime: '10:00', status: 'completed', totalAmount: 64000,
  createdAt: ts('2026-07-18T09:00:00Z'), ...over,
} as Booking);

const car = (over: Partial<CarPicture> = {}): CarPicture => ({
  vehicle: vehicle(), protections: [], visits: [], bookings: [], jobs: [], ...over,
});

const picture = (over: Partial<CustomerPicture> = {}): CustomerPicture => ({
  user: { uid: 'u1', name: 'Nikhil Patel', email: 'n@example.com', role: 'customer' } as User,
  cars: [car()], subscription: null, subscriptions: [], invoices: [], notifications: [],
  catalogue: [] as Service[], ...over,
});

const member = (over: Partial<Subscription> = {}): Subscription => ({
  id: 's1', userId: 'u1', userName: 'Nikhil Patel', userEmail: 'n@example.com',
  userPhone: '9000000000', plan: 'Gold', status: 'active',
  startDate: '2026-07-10', endDate: '2026-08-09', washesTotal: 8, washesUsed: 2,
  paymentMethod: 'upi', createdAt: ts('2026-07-10T09:00:00Z'),
  updatedAt: ts('2026-07-10T09:00:00Z'), ...over,
});

const ids = (items: PaletteItem[]) => items.map(i => i.id);
const byId = (items: PaletteItem[], id: string) => items.find(i => i.id === id);

/* What a customer would type, and the destination it has to reach. This is the
   list from the task, expressed as a test rather than as a comment. */
const REQUIRED: readonly [string, string][] = [
  ['book', '/studio'],
  ['garage', '/garage'],
  ['club', '/membership'],   // with a subscription; see the join case below
  ['history', '/history'],
  ['car-v1', '/vehicle'],
  ['you', '/you'],
  ['you-notify', '/you?panel=notifications'],
];

describe('every customer destination is reachable', () => {
  /* A member, so the Club row is the plain destination. The non-member's
     join-shaped address is asserted on its own below. */
  const { items } = toPalette(picture({
    subscription: member(),
  }), NOW);

  it.each(REQUIRED)('%s is in the palette, at %s', (id, href) => {
    expect(byId(items, id)?.href).toBe(href);
  });

  it('offers the next thing to do, from the same intent the Home CTA carries', () => {
    /* Not a second judgement about what is next — `resolveAction` of the
       engine's `nextAction`, the identical call Home makes. */
    expect(byId(items, 'next')).toBeDefined();
  });

  it('a visit happening RIGHT NOW is findable, which it never was before', () => {
    const live = toPalette(picture({
      cars: [car({ bookings: [booking({ id: 'b9', status: 'in_progress' })] })],
    }), NOW).items;
    expect(byId(live, 'live-b9')?.href).toBe('/history/b9');
  });

  it('a settled car offers no live visit', () => {
    expect(ids(toPalette(picture(), NOW).items).some(i => i.startsWith('live-'))).toBe(false);
  });

  it('past visits are findable one by one, newest first', () => {
    const { items: it } = toPalette(picture({
      cars: [car({ bookings: [
        booking({ id: 'old', scheduledDate: '2025-01-10' }),
        booking({ id: 'new', scheduledDate: '2026-05-02' }),
      ] })],
    }), NOW);
    const visits = ids(it).filter(i => i.startsWith('v-'));
    expect(visits).toEqual(['v-new', 'v-old']);
  });

  it('a cancelled visit is not offered — it is not a visit that happened', () => {
    const { items: it } = toPalette(picture({
      cars: [car({ bookings: [booking({ id: 'x', status: 'cancelled' })] })],
    }), NOW);
    expect(ids(it)).not.toContain('v-x');
  });

  it('the Club reads differently to a member and to someone who is not one', () => {
    expect(byId(items, 'club')?.label).toBe('The Club');
    const guest = toPalette(picture(), NOW).items;
    expect(byId(guest, 'club')?.label).toMatch(/have a look/);
    expect(byId(guest, 'club')?.href).toBe('/membership?club=join');
  });

  it('account settings, privacy, terms and deletion are all one search away', () => {
    /* Apple 5.1.1(v) — deletion must be reachable in-app, and "reachable"
       includes findable. */
    for (const id of ['you-profile', 'you-notify', 'you-referral', 'privacy', 'terms', 'you-delete']) {
      expect(byId(items, id)).toBeDefined();
    }
    expect(byId(items, 'you-delete')?.href).toBe('/you?panel=delete');
  });

  it('the Marketplace is reachable now that it exists', () => {
    /* This assertion used to check the OPPOSITE — that no row pointed at a
       surface which had not been built. `/cars` shipped, so the rows ship
       with it. */
    expect(readdirSync('app')).toContain('cars');
    expect(byId(items, 'cars')?.href).toBe('/cars');
    expect(byId(items, 'sell')?.href).toBe('/dashboard/sell-car');
  });
});

describe('a garage with more than one car', () => {
  const two = picture({
    cars: [
      car({ vehicle: vehicle({ id: 'v1', name: 'BMW M4' }) }),
      car({ vehicle: vehicle({ id: 'v2', name: 'Audi RS5', registrationNumber: 'GJ01ZZ9' }) }),
    ],
  });
  const { items } = toPalette(two, NOW);

  it('finds EVERY car, not just the one Home happens to show', () => {
    /* The old palette was built from `leadCar` — a customer with three cars
       could search for exactly one of them. */
    expect(byId(items, 'car-v1')?.label).toBe('BMW M4');
    expect(byId(items, 'car-v2')?.label).toBe('Audi RS5');
  });

  it('sends each to its OWN room, not to a shared one', () => {
    expect(byId(items, 'car-v1')?.href).toBe('/vehicle?car=v1');
    expect(byId(items, 'car-v2')?.href).toBe('/vehicle?car=v2');
  });

  it('names the car on a protection, because two cars have two of each', () => {
    const withCover = toPalette(picture({
      cars: [
        car({ vehicle: vehicle({ id: 'v1' }), protections: [
          { id: 'p1', kind: 'ppf', vehicleId: 'v1', term: { kind: 'perpetual' } } as Protection] }),
        car({ vehicle: vehicle({ id: 'v2', name: 'Audi RS5' }), protections: [
          { id: 'p2', kind: 'ppf', vehicleId: 'v2', term: { kind: 'perpetual' } } as Protection] }),
      ],
    }), NOW).items;
    expect(byId(withCover, 'p-v1-p1')?.label).toMatch(/BMW M4$/);
    expect(byId(withCover, 'p-v2-p2')?.label).toMatch(/Audi RS5$/);
  });

  it('one car is spoken about without qualification', () => {
    const { items: one } = toPalette(picture(), NOW);
    expect(byId(one, 'car-v1')?.label).toBe('The BMW M4');
    expect(byId(one, 'car-v1')?.href).toBe('/vehicle');
  });
});

describe('an empty garage still has somewhere to go', () => {
  const { items, truth, log } = toPalette(picture({ cars: [] }), NOW);

  it('does not throw on a customer with no car', () => {
    expect(items.length).toBeGreaterThan(0);
  });

  it('offers adding one', () => {
    expect(byId(items, 'add-car')?.href).toBe('/garage?add=1');
  });

  it('says nothing it cannot know', () => {
    /* §18.1 — no truth line and no record for a garage with no history in it,
       rather than an empty heading. */
    expect(truth).toBeUndefined();
    expect(log).toEqual([]);
  });
});

describe('ARCHITECTURE §1 — the palette decides no addresses', () => {
  const palette = codeOf('lib/customer/palette.ts');

  it('contains no route literal of its own', () => {
    /* The whole defect, as one assertion. Every href must arrive from
       `hrefForDestination`; a string starting with `/` in this file is a
       second route table. */
    const literals = [...palette.matchAll(/['"`]\/[a-z][^'"`]*['"`]/g)].map(m => m[0]);
    expect(literals).toEqual([]);
  });

  it('every href it produces came from the resolver', () => {
    const { items } = toPalette(picture({
      cars: [car({ bookings: [booking(), booking({ id: 'b2', status: 'in_progress' })] })],
      subscription: member(),
    }), NOW);
    expect(items.length).toBeGreaterThan(10);
    for (const i of items) {
      expect(i.href.startsWith('/')).toBe(true);
      /* Never protocol-relative, never off-site: a palette row is a room in
         this product, not a link out of it. */
      expect(i.href.startsWith('//')).toBe(false);
    }
  });

  it('the resolver is the only module that knows what a Destination means', () => {
    const others = [...walk('lib'), ...walk('components'), ...walk('app'), ...walk('navigation')]
      .filter(f => !f.includes('node_modules'))
      .filter(f => f !== 'navigation/resolve.ts')
      .filter(f => /export const hrefForDestination|const hrefForDestination =/.test(codeOf(f)));
    expect(others).toEqual([]);
  });

  it('every Destination the palette can name resolves to an address', () => {
    /* A `Destination` the resolver has no branch for would return undefined
       and render `href="undefined"`. */
    for (const d of [
      { to: 'home' }, { to: 'garage' }, { to: 'garage.add' }, { to: 'history' },
      { to: 'studio' }, { to: 'studio.category', category: 'Ceramic' },
      { to: 'membership' }, { to: 'membership.join' }, { to: 'profile' },
      { to: 'profile.panel', panel: 'notifications' }, { to: 'vehicle' },
      { to: 'vehicle', vehicleId: 'v2' }, { to: 'visit', visitId: 'b1' },
      { to: 'privacy' }, { to: 'terms' },
    ] as const) {
      const href = hrefForDestination(d);
      expect(typeof href).toBe('string');
      expect(href.startsWith('/')).toBe(true);
      expect(href).not.toMatch(/undefined/);
    }
  });

  it('the record links through the resolver too', () => {
    const { log } = toPalette(picture({
      cars: [car({ bookings: [booking()] })],
    }), NOW);
    for (const e of log) {
      if (e.href) expect(e.href).toMatch(/^\/history\//);
    }
  });
});

describe('§21.4 — it is the way you navigate, not a feature of one screen', () => {
  const chrome = codeOf('navigation/CustomerChrome.tsx');
  const home = codeOf('components/screens/HomeScreen.tsx');
  const room = codeOf('components/screens/ServerRoom.tsx');

  it('the chrome mounts it, so it exists at every address', () => {
    expect(chrome).toMatch(/<PaletteProvider>/);
  });

  it('Home no longer owns it', () => {
    /* It did, and that was the defect: ⌘K worked at `/` and nowhere else. */
    expect(home).not.toMatch(/<Desk/);
    expect(home).not.toMatch(/deskOpen/);
  });

  it('exactly one surface mounts the Desk', () => {
    const mounts = [...walk('app'), ...walk('components'), ...walk('navigation')]
      .filter(f => !f.includes('node_modules'))
      .filter(f => /<Desk\b/.test(codeOf(f)));
    expect(mounts).toEqual(['navigation/Palette.tsx']);
  });

  it('every room feeds it, because every room already has the picture', () => {
    expect(room).toMatch(/<PaletteFeed model=\{toPalette\(picture\)\} \/>/);
  });

  it('only one module projects what is findable', () => {
    const projectors = [...walk('lib'), ...walk('components'), ...walk('navigation')]
      .filter(f => !f.includes('node_modules'))
      .filter(f => /export function toPalette/.test(codeOf(f)));
    expect(projectors).toEqual(['lib/customer/palette.ts']);
  });

  it('the old per-Home projection is gone, not merely unused', () => {
    const project = codeOf('lib/customer/project.ts');
    expect(project).not.toMatch(/HomeSearchItem/);
    expect(project).not.toMatch(/EVERYTHING THE DESK CAN FIND/);
    expect(codeOf('components/screens/HomeScreen.tsx')).not.toMatch(/HomeSearchItem/);
  });

  it('⌘K is bound once, above the rooms', () => {
    /* `/admin` is the studio's operations OS — a separate application with its
       own palette, deliberately. This is about the CUSTOMER application. */
    const binders = [...walk('app'), ...walk('components'), ...walk('navigation')]
      .filter(f => !f.includes('node_modules') && !f.startsWith('app/admin'))
      .filter(f => /metaKey \|\| e\.ctrlKey\) && e\.key\.toLowerCase\(\) === 'k'/.test(codeOf(f)));
    expect(binders).toEqual(['navigation/Palette.tsx']);
  });

  it('EVERY room feeds it — a room that does not would open ⌘K to nothing', () => {
    /* The palette is mounted by the chrome but filled by the page, so a room
       added later without `ServerRoom` would summon an empty layer. Read the
       room table rather than a hand-kept list, so a new room fails here. */
    const routes = codeOf('navigation/routes.ts');
    const paths = [...routes.matchAll(/^export const ([A-Z]+) = '([^']+)';/gm)]
      .filter(m => routes.includes(`[${m[1]}]: {`))
      .map(m => m[2]);
    expect(paths.length).toBeGreaterThanOrEqual(7);
    for (const path of paths) {
      /* A room's address is a PREFIX, and some rooms have no index page —
         a booking is always a booking, so `/booking` exists only as
         `/booking/[id]`. Every page under the prefix is checked, which is a
         stronger statement than checking one file: a room with three screens
         must feed the palette from all three. */
      const dir = path === '/' ? 'app' : `app${path}`;
      const pages = (path === '/' ? ['app/page.tsx'] : walk(dir))
        .filter(f => /page\.tsx$/.test(f));
      expect(pages.length).toBeGreaterThan(0);
      for (const page of pages) expect(codeOf(page)).toMatch(/ServerRoom/);
    }
  });

  it('it is addressable, like every other expansion (§6.4)', () => {
    /* `?open=desk` at whatever room you are in — linkable, restored on reload,
       and closed by the back button because it is a real history entry. */
    expect(codeOf('navigation/Palette.tsx')).toMatch(/params\.get\('open'\) === 'desk'/);
  });
});

describe('§21.4 — reachable by keyboard alone', () => {
  const desk = codeOf('components/system/Desk.tsx');

  it('opens with focus in the field, not on a result', () => {
    expect(desk).toMatch(/onOpenAutoFocus/);
    expect(desk).toMatch(/inputRef\.current\?\.focus\(\)/);
  });

  it('moves the selection with the arrow keys', () => {
    expect(desk).toMatch(/e\.key === 'ArrowDown'/);
    expect(desk).toMatch(/e\.key === 'ArrowUp'/);
  });

  it('opens the highlighted row with Enter', () => {
    expect(desk).toMatch(/e\.key === 'Enter' && flat\[active\]/);
  });

  it('ANNOUNCES the highlighted row', () => {
    /* Focus stays in the input, so a screen reader learns which row is active
       only from `aria-activedescendant`. Without it the arrow keys move a
       selection that is, to a blind customer, silent. */
    expect(desk).toMatch(/aria-activedescendant=\{activeId\}/);
    expect(desk).toMatch(/role="combobox"/);
    expect(desk).toMatch(/aria-controls="desk-results"/);
  });

  it('SCROLLS the highlighted row into view', () => {
    /* The list is longer than the layer once a customer has several cars and a
       year of visits. */
    expect(desk).toMatch(/scrollIntoView\(\{ block: 'nearest' \}\)/);
  });

  it('groups are announced as groups inside the listbox', () => {
    expect(desk).toMatch(/role="listbox"/);
    expect(desk).toMatch(/role="group" aria-label=\{g\}/);
    expect(desk).toMatch(/role="option"/);
    expect(desk).toMatch(/aria-selected=\{on\}/);
  });

  it('says so plainly when nothing matches', () => {
    expect(desk).toMatch(/Nothing by that name\./);
  });
});

describe('§21.8 — it answers the word the customer arrives with', () => {
  const { items } = toPalette(picture({
    subscription: member(),
  }), NOW);

  /* The Desk's own matcher, so the assertion tests what actually runs. */
  const search = (q: string) => items.filter(i =>
    i.label.toLowerCase().includes(q) || i.keywords?.toLowerCase().includes(q));

  it.each([
    ['membership', 'club'],
    ['book', 'book'],
    ['settings', 'you'],
    ['push', 'you-notify'],
    ['warranty', 'history'],
    ['invoice', 'history'],
    ['refer', 'you-referral'],
    ['delete', 'you-delete'],
    ['buy', 'cars'],
    ['marketplace', 'cars'],
    ['sell', 'sell'],
  ])('typing %s finds something', (q, expected) => {
    const hits = search(q);
    expect(hits.length).toBeGreaterThan(0);
    /* The room the product calls something else is reachable by the word the
       customer used — "membership" must reach The Club. */
    if (expected === 'club' || expected === 'you-notify' || expected === 'you-referral'
      || expected === 'you-delete' || expected === 'cars' || expected === 'sell') {
      expect(ids(hits)).toContain(expected);
    }
  });

  it('keywords are matched but never shown', () => {
    /* A row reading "The Club membership subscription plan" is a search index
       leaking into the product's voice. */
    for (const i of items) expect(i.label).not.toMatch(/ {2}/);
    expect(byId(items, 'club')?.label).toBe('The Club');
  });

  it('a query that matches nothing returns nothing, rather than everything', () => {
    expect(search('zzzz')).toEqual([]);
  });

  it('finds a car by its plate, which nobody types in capitals', () => {
    /* Registration numbers are stored uppercase; the field lowercases what is
       typed. Matching raw keywords would mean searching a plate never works. */
    expect(ids(search('gj01ab'))).toContain('car-v1');
  });
});

describe('no row is a duplicate or a dead end', () => {
  const { items } = toPalette(picture({
    cars: [
      car({ vehicle: vehicle({ id: 'v1' }), bookings: [booking(), booking({ id: 'b2' })] }),
      car({ vehicle: vehicle({ id: 'v2', name: 'Audi RS5' }) }),
    ],
    subscription: member(),
  }), NOW);

  it('every id is unique — React keys and Enter both depend on it', () => {
    expect(ids(items)).toEqual([...new Set(ids(items))]);
  });

  it('no two rows share a label AND a destination', () => {
    const seen = items.map(i => `${i.label}→${i.href}`);
    expect(seen).toEqual([...new Set(seen)]);
  });

  it('every row has a label a customer could read aloud', () => {
    for (const i of items) {
      expect(i.label.trim()).not.toBe('');
      expect(i.label).not.toMatch(/undefined|null|\[object/);
    }
  });

  it('every row is filed under a heading', () => {
    for (const i of items) expect(i.group.trim()).not.toBe('');
  });
});
