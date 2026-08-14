/**
 * FINAL INTEGRATION AUDIT - the product traced end to end.
 *
 * Every assertion here corresponds to something the audit actually found, and
 * exists so the finding cannot come back quietly:
 *
 *   THE LARGEST PROJECTION HELD ITS OWN ROUTE TABLE. `lib/customer/project.ts`
 *   hand-wrote twenty route literals while `palette`, `market` and `welcome`
 *   all resolved through `navigation/resolve`. Two copies of the addresses,
 *   and the second one goes stale in silence.
 *
 *   THE SITEMAP ADVERTISED THE STAFF KIOSK. `/store` is the PIN lock the
 *   studio's tablet sits on. It was in the sitemap at priority 0.6 and absent
 *   from robots, so an auth surface was being offered to search engines.
 *
 *   THREE PUBLIC PAGES CLAIMED THE HOMEPAGE AS THEIR CANONICAL. Metadata is
 *   shallowly merged, so anything not declaring `alternates` inherited the
 *   root layout's `canonical: '/'` - including the privacy policy and terms,
 *   which Apple requires to be findable.
 *
 *   THE LANDING PAGE IGNORED prefers-reduced-motion. The CSS rules silence
 *   three named CSS animations; every animation on that page is
 *   framer-motion, and it is the address every visitor arrives at.
 *
 *   FOUR SCREENS HYDRATED FOR NOTHING - `'use client'` on components with no
 *   state, no handlers and no motion.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { hrefForDestination, hrefFor, type Destination } from '@/navigation/resolve';
import type { NextAction } from '@/lib/os/action';

const codeOf = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

const CUSTOMER = [...walk('lib/customer'), ...walk('lib/os'), ...walk('navigation'),
  ...walk('components/screens'), ...walk('components/market')];

const ALL = [...walk('lib'), ...walk('app'), ...walk('components'), ...walk('navigation')]
  .filter(f => !f.includes('node_modules'));

describe('ONE SOURCE OF TRUTH - addresses', () => {
  it('no projection writes a route of its own', () => {
    /* The whole defect in one assertion. `project.ts` is the biggest
       projection in the product and it held a second route table. */
    const offenders = walk('lib/customer').filter(f => {
      const src = codeOf(f);
      return /['"`]\/[a-z][a-zA-Z0-9/_?=&${}.-]*['"`]/.test(src);
    });
    expect(offenders).toEqual([]);
  });

  it('every customer projection resolves through the one resolver', () => {
    for (const f of ['lib/customer/project.ts', 'lib/customer/palette.ts',
      'lib/customer/market.ts', 'lib/customer/welcome.ts']) {
      expect(codeOf(f)).toMatch(/from '@\/navigation\/resolve'/);
    }
  });

  it('the route table itself lives in exactly one file', () => {
    const tables = ALL.filter(f => /export const hrefForDestination/.test(codeOf(f)));
    expect(tables).toEqual(['navigation/resolve.ts']);
  });

  it('every destination the product can name resolves to a real route', () => {
    /* An address no `page.tsx` answers is a 404 with a nice label on it. The
       resolver is CALLED rather than read, because it returns route constants
       and template literals - reading the source proves nothing. */
    const routes = walk('app')
      .filter(f => f.endsWith('page.tsx'))
      .map(f => f.replace(/^app/, '').replace(/\/page\.tsx$/, '') || '/')
      .map(r => new RegExp(`^${r.replace(/\[[^\]]+\]/g, '[^/]+')}$`));

    const every: Destination[] = [
      { to: 'home' }, { to: 'garage' }, { to: 'garage.add' },
      { to: 'garage.edit', vehicleId: 'v1' }, { to: 'history' },
      { to: 'history.car', vehicleId: 'v1' }, { to: 'studio' },
      { to: 'studio.category', category: 'Ceramic' }, { to: 'membership' },
      { to: 'membership.join' }, { to: 'profile' },
      { to: 'profile.panel', panel: 'profile' },
      { to: 'profile.panel', panel: 'notifications' },
      { to: 'profile.panel', panel: 'referral' },
      { to: 'profile.panel', panel: 'delete' },
      { to: 'vehicle' }, { to: 'vehicle', vehicleId: 'v1' },
      { to: 'visit', visitId: 'b1' }, { to: 'privacy' }, { to: 'terms' },
      { to: 'cars' }, { to: 'cars.filtered', query: 'creta' },
      { to: 'car', listingId: 'c1' }, { to: 'sell' },
      { to: 'invoice', invoiceId: 'i1', token: 't' },
      { to: 'chapter', invoiceId: 'i1', token: 't' },
      { to: 'welcome' }, { to: 'welcome', forced: true },
      { to: 'welcome.step', step: 'rooms' },
    ];

    expect(every.length).toBeGreaterThan(25);
    for (const d of every) {
      const href = hrefForDestination(d);
      const path = href.split('?')[0];
      expect({ d, href }).toEqual({ d, href: expect.stringMatching(/^\//) });
      expect({ d, path, found: routes.some(r => r.test(path)) })
        .toEqual({ d, path, found: true });
    }
  });

  it('every intent an engine can emit resolves too', () => {
    /* §10.5 - nothing is inert. An intent with no address is a dead button. */
    const intents: NextAction['intent'][] = [
      'add_car', 'arrange_visit', 'arrange_again', 'manage_visit',
      'follow_visit', 'see_visit', 'renew_protection', 'renew_membership',
      'rejoin_membership',
    ];
    for (const intent of intents) {
      const href = hrefFor({ intent, label: 'x', params: { visitId: 'b1' } } as NextAction);
      expect({ intent, href }).toEqual({ intent, href: expect.stringMatching(/^\//) });
    }
  });
});

describe('SEO and metadata - what is offered to the world', () => {
  it('the staff kiosk is NOT in the sitemap', () => {
    /* `/store` is the PIN lock the studio tablet sits on. */
    expect(codeOf('app/sitemap.ts')).not.toMatch(/SITE_URL\}\/store/);
  });

  it('the staff kiosk is disallowed, and says so itself', () => {
    expect(codeOf('app/robots.ts')).toMatch(/'\/store'/);
    expect(codeOf('app/store/layout.tsx')).toMatch(/robots: \{ index: false/);
  });

  it('every public page declares its OWN canonical', () => {
    /* Metadata is shallowly merged: a page with no `alternates` inherits the
       root layout's `canonical: '/'` and tells Google it is a duplicate of
       the homepage. */
    for (const p of ['app/privacy/page.tsx', 'app/terms/page.tsx',
      'app/cars/page.tsx', 'app/dashboard/sell-car/page.tsx']) {
      expect(codeOf(p)).toMatch(/alternates: \{ canonical:/);
    }
    expect(codeOf('app/cars/[id]/page.tsx')).toMatch(/alternates: \{ canonical:/);
    expect(codeOf('app/store/layout.tsx')).toMatch(/alternates: \{ canonical: '\/store' \}/);
  });

  it('the sitemap and the showroom read the same source', () => {
    expect(codeOf('app/sitemap.ts')).toMatch(/loadListings/);
    expect(codeOf('app/sitemap.ts')).not.toMatch(/collection\('carListings'\)/);
  });

  it('every signed-in surface is kept out of the index', () => {
    const robots = codeOf('app/robots.ts');
    for (const room of ['/garage', '/vehicle', '/history', '/studio', '/you',
      '/membership', '/welcome', '/dashboard', '/admin', '/store']) {
      expect(robots).toContain(`'${room}'`);
    }
    /* …while the public half stays crawlable. */
    const list = robots.slice(robots.indexOf('disallow: ['),
      robots.indexOf('],', robots.indexOf('disallow: [')));
    expect(list).not.toMatch(/'\/cars'/);
    expect(list).not.toMatch(/'\/privacy'/);
    expect(list).not.toMatch(/'\/terms'/);
  });

  it('a shared listing carries a real preview card', () => {
    const src = codeOf('app/cars/[id]/page.tsx');
    expect(src).toMatch(/openGraph/);
    expect(src).toMatch(/images/);
  });
});

describe('ACCESSIBILITY - motion respects the customer', () => {
  it('every customer surface that animates honours the OS setting', () => {
    /* The CSS `prefers-reduced-motion` rules in globals.css silence three
       NAMED CSS animations. They do nothing to framer-motion, which is what
       every customer surface actually animates with. */
    const animated = [...walk('components/screens'), ...walk('components/market')]
      .filter(f => /framer-motion/.test(codeOf(f)));
    expect(animated.length).toBeGreaterThan(0);
    for (const f of animated) {
      expect({ f, guarded: /useReducedMotion|MotionConfig/.test(codeOf(f)) })
        .toEqual({ f, guarded: true });
    }
  });

  it('the public landing is one of them', () => {
    /* It was the only customer surface animating regardless of the
       preference, and it is the address every visitor arrives at. */
    expect(codeOf('components/screens/LandingScreen.tsx'))
      .toMatch(/<MotionConfig reducedMotion="user">/);
  });

  it('zoom is never taken away (WCAG 1.4.4)', () => {
    const layout = codeOf('app/layout.tsx');
    expect(layout).not.toMatch(/maximumScale/);
    expect(layout).not.toMatch(/userScalable: *false/);
  });

  it('every dismissable layer uses the one Radix-backed implementation', () => {
    /* Focus trap, Escape and scroll lock come from Radix in exactly one
       place, so no layer can ship without them. */
    const layers = ['components/system/Modal.tsx', 'components/system/Desk.tsx',
      'components/system/BottomSheet.tsx', 'components/system/Expansion.tsx'];
    for (const f of layers) {
      if (existsSync(f)) expect(codeOf(f)).toMatch(/@radix-ui/);
    }
  });
});

describe('PERFORMANCE - nothing hydrates that need not', () => {
  it('no screen is a client component without a reason to be', () => {
    const needless = [...walk('components/screens'), ...walk('components/market')]
      .filter(f => readFileSync(f, 'utf8').startsWith("'use client'"))
      .filter(f => !/use(State|Effect|Router|SearchParams|Reducer|Memo|Ref|Transition|Pathname|ReducedMotion|Online)|onClick|onChange|onSubmit|framer-motion/
        .test(codeOf(f)));
    expect(needless).toEqual([]);
  });

  it('the customer read runs once per request, however many components ask', () => {
    expect(codeOf('lib/server/customerPicture.ts')).toMatch(/cache\(_loadCustomerPicture\)/);
  });

  it('every marketplace loader is request-cached', () => {
    const src = codeOf('lib/server/marketplace.ts');
    for (const fn of ['loadListings', 'loadListing', 'loadSavedIds', 'loadMySellRequests']) {
      expect(src).toMatch(new RegExp(`export const ${fn} = cache\\(`));
    }
  });

  it('the per-car reads are parallel, not sequential', () => {
    /* A garage is a handful of cars; a serial loop would be a handful of
       round trips stacked end to end. */
    const src = codeOf('lib/server/customerPicture.ts');
    expect(src).toMatch(/await Promise\.all\(vehicles\.map/);
    expect(src).toMatch(/await Promise\.all\(\[/);
  });
});

describe('NOTHING DEAD, NOTHING TEMPORARY', () => {
  it('there are no TODOs, FIXMEs or parked work', () => {
    const offenders = ALL.filter(f => /\b(TODO|FIXME|XXX|HACK)\b/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('nothing suppresses the type checker', () => {
    const offenders = ALL.filter(f => /@ts-ignore|@ts-expect-error/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('no customer surface uses `any`', () => {
    const offenders = CUSTOMER.filter(f => /:\s*any\b|<any>|as any/.test(codeOf(f)));
    expect(offenders).toEqual([]);
  });

  it('the retired /app address survives in no live code', () => {
    const offenders = ALL.filter(f => /['"`]\/app(\/|['"`])/.test(codeOf(f)));
    expect(offenders).toEqual([]);
  });

  it('every engine has a caller', () => {
    const orphans = readdirSync('lib/os')
      .filter(f => f.endsWith('.ts'))
      .map(f => f.replace(/\.ts$/, ''))
      .filter(name => !ALL.some(f =>
        !f.endsWith(`lib/os/${name}.ts`) && new RegExp(`os/${name}'`).test(codeOf(f))));
    expect(orphans).toEqual([]);
  });

  it('every component has an importer', () => {
    const orphans = walk('components').filter(f => {
      const name = f.split('/').pop()!.replace(/\.tsx?$/, '');
      return !ALL.some(o => o !== f && new RegExp(`\\b${name}\\b`).test(codeOf(o)));
    });
    expect(orphans).toEqual([]);
  });

  it('no customer surface prints to the console', () => {
    const offenders = CUSTOMER.filter(f => /console\.(log|warn|debug)\(/.test(codeOf(f)));
    expect(offenders).toEqual([]);
  });
});

describe('SECURITY - the shape of what a client may do', () => {
  const rules = readFileSync('firestore.rules', 'utf8');

  it('nothing is writable by anyone', () => {
    const open = [...rules.matchAll(/allow (write|create|update|delete)[^:]*: if true/g)];
    expect(open.map(m => m[0])).toEqual([]);
  });

  it('the only public read is the landing page gallery', () => {
    const reads = [...rules.matchAll(/allow read[^:]*: if true/g)];
    expect(reads).toHaveLength(1);
    const at = rules.indexOf('allow read: if true');
    expect(rules.slice(Math.max(0, at - 200), at)).toMatch(/gallery/);
  });

  it('every collection a customer touches is scoped to them or to staff', () => {
    for (const c of ['bookings', 'subscriptions', 'invoices', 'notifications',
      'vehicles', 'protections', 'visits']) {
      const at = rules.indexOf(`match /${c}/`);
      expect(at).toBeGreaterThan(-1);
      const block = rules.slice(at, rules.indexOf('match /', at + 10));
      expect(block).toMatch(/request\.auth != null/);
    }
  });

  it('the writes the server owns are refused to the client outright', () => {
    for (const c of ['carLeads', 'sellRequests']) {
      const at = rules.indexOf(`match /${c}/`);
      expect(rules.slice(at, rules.indexOf('match /', at + 10)))
        .toMatch(/allow create: if false;/);
    }
    expect(rules).toMatch(/match \/savedCars\/\{listingId\} \{[\s\S]{0,200}allow write: if false;/);
  });

  it('a customer cannot promote themselves', () => {
    expect(rules).toMatch(/request\.resource\.data\.role == resource\.data\.role/);
  });

  it('a customer cannot forge their own first arrival', () => {
    expect(rules).toMatch(/welcomedAt/);
  });

  it('every route that writes proves who is calling', () => {
    const writers = walk('app/api')
      .filter(f => f.endsWith('route.ts'))
      .filter(f => /export async function POST|export async function DELETE/.test(codeOf(f)))
      /* The lead form is deliberately open to signed-out callers, and the
         session route is what MINTS the identity. */
      .filter(f => !/cars\/lead|api\/session|notify\/event|whatsapp\/send|report/.test(f));
    expect(writers.length).toBeGreaterThan(5);
    for (const f of writers) {
      expect({ f, verified: /verifyIdToken|CRON_SECRET|verifySession/.test(codeOf(f)) })
        .toEqual({ f, verified: true });
    }
  });

  it('no route trusts a uid from its own body', () => {
    for (const f of walk('app/api').filter(f => f.endsWith('route.ts'))) {
      const src = codeOf(f);
      if (!/verifyIdToken/.test(src)) continue;
      /* `/api/welcome/complete` reads `body.uid` for the ADMIN reset path
         only, and checks the caller's role before honouring it. */
      if (f.includes('welcome/complete')) {
        expect(src).toMatch(/role !== 'admin'/);
        continue;
      }
      expect({ f, trusts: /body\.uid|body\.userId/.test(src) }).toEqual({ f, trusts: false });
    }
  });

  it('media may only be written under a path bound to the uploader', () => {
    expect(codeOf('lib/server/cloudinary.ts')).toMatch(/path\.startsWith\(`vehicles\/\$\{uid\}-`\)/);
    expect(codeOf('lib/server/cloudinary.ts')).toMatch(/path\.startsWith\(`sellRequests\/\$\{uid\}\/`\)/);
  });

  it('there is no Firebase Storage surface left to secure', () => {
    /* Media is Cloudinary behind a signed route, so the absence of
       storage.rules is correct rather than an oversight. */
    expect(existsSync('storage.rules')).toBe(false);
    const users = ALL.filter(f => /from 'firebase\/storage'|getStorage\(/.test(codeOf(f)));
    expect(users).toEqual([]);
  });
});

describe('EVERY COMPOSITE QUERY HAS AN INDEX', () => {
  const declared: { c: string; fields: string[] }[] =
    JSON.parse(readFileSync('firestore.indexes.json', 'utf8')).indexes
      .map((i: { collectionGroup: string; fields: { fieldPath: string }[] }) =>
        ({ c: i.collectionGroup, fields: i.fields.map(f => f.fieldPath) }));

  const covered = (c: string, need: string[]) =>
    declared.some(i => i.c === c && need.every((f, n) => i.fields[n] === f));

  it.each([
    ['subscriptions', ['userId', 'createdAt']],
    ['bookings', ['userId', 'status', 'scheduledDate']],
    ['bookings', ['status', 'createdAt']],
    ['bookings', ['userId', 'createdAt']],
    ['notifications', ['userId', 'createdAt']],
    ['invoices', ['customerId', 'createdAt']],
    ['carLeads', ['status', 'createdAt']],
    ['carListings', ['active', 'createdAt']],
    ['visits', ['vehicleId', 'createdAt']],
  ])('%s(%s) is indexed', (c, fields) => {
    /* A where+orderBy without a composite index throws in production and
       nowhere else - the emulator and a small collection both forgive it. */
    expect({ c, fields, covered: covered(c, fields as string[]) })
      .toEqual({ c, fields, covered: true });
  });

  it('the marketplace read needs no index it does not have', () => {
    /* One equality filter, sorted in memory by the engine - deliberately, so
       every sort the product might want does not become an index. */
    const src = codeOf('lib/server/marketplace.ts');
    expect(src).toMatch(/where\('active', '==', true\)/);
    expect(src).not.toMatch(/orderBy/);
  });
});

describe('THE STUDIO IS TOLD, EVERY TIME IT MATTERS', () => {
  it('a booking, a lead and an offer all reach the studio', () => {
    expect(codeOf('lib/server/bookingNotify.ts')).toMatch(/notifyAdmins\('booking_created'/);
    expect(codeOf('lib/server/marketService.ts')).toMatch(/notifyAdmins\('car_lead'/);
    expect(codeOf('lib/server/marketService.ts')).toMatch(/notifyAdmins\('sell_request'/);
  });

  it('there is ONE WhatsApp sender to the studio', () => {
    const senders = walk('lib').filter(f => {
      const raw = readFileSync(f, 'utf8');
      return raw.includes('graph.facebook.com') && raw.includes('messaging_product');
    });
    expect(senders).toEqual(['lib/server/notify.ts']);
  });

  it('every customer notification lands on a real surface', () => {
    expect(codeOf('navigation/resolve.ts')).toMatch(/export const notificationHref/);
    const senders = ALL.filter(f => /sendPushToUser\(\{/.test(codeOf(f)));
    for (const f of senders) expect(codeOf(f)).toMatch(/notificationHref\(/);
  });
});
