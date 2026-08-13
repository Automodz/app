/**
 * THE LAWS THE WHOLE CUSTOMER PRODUCT KEEPS.
 *
 * Every one of these is a rule the product has learned the hard way, written
 * so it cannot be unlearned by the next screen somebody adds. They are
 * deliberately about the GUARANTEE rather than about the implementation: a
 * test that pins the shape of a workaround keeps the workaround, which is
 * exactly what five membership assertions did until this pass.
 *
 * Where a law is already enforced elsewhere it is not repeated here — this
 * file holds the ones the product had no assertion for.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { hrefForDestination, parentOf, type Destination } from '@/navigation/resolve';
import { slots, surfaceKind, roomFor } from '@/navigation/routes';
import {
  membershipTransition, paymentTransition, approvalTransition, visitTransition,
  declarationTransition, bookingTransition,
} from '@/lib/os/lifecycle';
import { liveProtection } from '@/lib/os/protection';
import type { Protection } from '@/lib/types';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

const codeOf = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/** Every file that draws or shapes something a customer sees. */
const CUSTOMER = [
  ...walk('components/screens'), ...walk('components/studio'), ...walk('components/os'),
  ...walk('components/vehicle'), ...walk('components/visit'), ...walk('components/garage'),
  ...walk('components/protection'), ...walk('components/membership'), ...walk('components/market'),
  ...walk('components/home'), ...walk('components/you'), ...walk('components/system'),
  ...walk('lib/customer'), ...walk('navigation'),
];

/** Every route the customer half of the product answers. */
const CUSTOMER_ROUTES = walk('app')
  .filter(f => f.endsWith('page.tsx'))
  .map(f => f.replace(/^app/, '').replace(/\/page\.tsx$/, '') || '/')
  .filter(r => !r.startsWith('/admin') && !r.startsWith('/store'));

/* ── COMPOSITION ─────────────────────────────────────────────────────────── */

describe('the viewport is never assumed', () => {
  it('NO CUSTOMER SURFACE USES 100vh', () => {
    /* `100vh` is the height of the viewport WITHOUT the browser's own bars on
       a phone, so a screen sized to it puts its last element under Safari's
       toolbar. `100svh` is the small viewport and is what the product uses. */
    const offenders = CUSTOMER
      .filter(f => /\b100vh\b/.test(codeOf(f)))
      .concat(existsSync('app/globals.css') && /\b100vh\b/.test(readFileSync('app/globals.css', 'utf8'))
        ? ['app/globals.css'] : []);
    expect(offenders).toEqual([]);
  });

  it('and the small viewport is what it uses instead', () => {
    const users = CUSTOMER.filter(f => /100svh/.test(codeOf(f)));
    expect(users.length).toBeGreaterThan(2);
  });

  it('the safe areas are carried by the tokens, never remembered per screen', () => {
    const grid = codeOf('design/grid.ts');
    expect(grid).toMatch(/env\(safe-area-inset-bottom/);
    expect(grid).toMatch(/env\(safe-area-inset-top/);
    /* A screen may reach for the inset, but the stacking arithmetic — the
       floor that clears the dock — is the token's and only the token's. */
    const offenders = walk('components/screens')
      .filter(f => /contentFloor|navHeight/.test(codeOf(f)))
      .filter(f => /calc\([^)]*\d+px[^)]*env\(safe-area/.test(codeOf(f)));
    expect(offenders).toEqual([]);
  });
});

describe('the 44px floor has no discounts', () => {
  it('nothing subtracts from TARGET_MIN', () => {
    /* The landing's BOOK control was `minHeight: TARGET_MIN - space.hair`,
       which is 40px — the floor, shaved, on the first screen anybody sees.
       §21.3 does not have an exception for a header. */
    const offenders = [...CUSTOMER, ...walk('components/invoice'), ...walk('components/legal')]
      .filter(f => /TARGET_MIN\s*[-–]\s*/.test(codeOf(f)));
    expect(offenders).toEqual([]);
  });

  it('and the token itself is 44', () => {
    const grid = codeOf('design/grid.ts');
    expect(grid).toMatch(/TARGET_MIN\s*=\s*44/);
  });
});

describe('one design language', () => {
  it('THE SIGNED-IN ROOMS DRAW THEIR OWN MARKS, and import no icon set at all', () => {
    /* Every room a customer lives in — the car, the record, the Club, the
       studio, the settlement — draws its glyphs inline. An icon library
       arriving in one of them is a second visual vocabulary arriving one
       import at a time. */
    const rooms = CUSTOMER
      .filter(f => f.startsWith('components/screens/') || f.startsWith('components/os/')
        || f.startsWith('components/studio/') || f.startsWith('components/protection/')
        || f.startsWith('components/membership/') || f.startsWith('components/garage/'))
      /* The marketing landing is the one exception, and it is stated rather
         than hidden: it is the public page, not a room, and it uses the SAME
         set the studio does at the SAME token sizes. What the law forbids is a
         SECOND set, and the assertion below is what actually enforces that. */
      .filter(f => f !== 'components/screens/LandingScreen.tsx');
    const offenders = rooms.filter(f => /from ['"][a-z@][^'"]*(icons?|lucide|heroicons|feather|phosphor)[^'"]*['"]/.test(codeOf(f)));
    expect(offenders).toEqual([]);
  });

  it('and the whole product has exactly ONE icon set, never a second', () => {
    const libs = new Set<string>();
    for (const f of [...CUSTOMER, ...walk('components/ui'), ...walk('components/invoice')]) {
      for (const m of codeOf(f).matchAll(/from ['"]((?:[^'"]*)?(?:lucide|heroicons|feather|phosphor|react-icons)(?:[^'"]*)?)['"]/g)) {
        libs.add(m[1]);
      }
    }
    expect([...libs]).toEqual(['lucide-react']);
  });

  it('no customer surface hard-codes a palette value', () => {
    /* §22.4 — no raw colour outside `design/`. The two ramps that fill an
       `Action` used to live inside the primitive itself; they are
       `design/colors.fill` now.

       A BRAND MARK IS NOT OUR PALETTE. Google's four colours inside its own
       logo are that brand's, and re-tinting them would be wrong — so an
       element carrying a literal INSIDE an <svg> path is exempt, and only
       there. */
    const offenders = CUSTOMER
      .filter(f => !f.startsWith('design/'))
      .filter(f => {
        const src = codeOf(f).replace(/<path[\s\S]*?\/>/g, '');
        return /#[0-9a-fA-F]{6}\b/.test(src);
      });
    expect(offenders).toEqual([]);
  });

  it('and NO SIGNED-IN ROOM is styled by the studio’s stylesheet', () => {
    /* The rooms are token-styled from `design/`. A `className="p-4 text-sm"`
       in one is the operations stylesheet leaking into the customer product,
       and it is how two spacing systems start.

       The landing composes with responsive utilities (`hidden md:flex`) over
       the same tokens, which is a different thing from being STYLED by them —
       the pattern below is the styling half only, and the landing is held to
       it too. */
    const offenders = CUSTOMER
      .filter(f => /className="[^"]*\b(p-\d|px-\d|py-\d|mt-\d|mb-\d|text-(xs|sm|base|lg|xl)|rounded-(xl|2xl)|btn-|card-)/.test(codeOf(f)));
    expect(offenders).toEqual([]);
  });
});

/* ── NAVIGATION ──────────────────────────────────────────────────────────── */

describe('no customer screen is a dead end', () => {
  const ROOT = new Set(slots as string[]);

  it('every customer route is either a dock slot or has a parent', () => {
    /* `/welcome` is the one exception and it is stated in the navigation law
       suite: it is the first screen anybody sees, reached by being sent there,
       and every step of it carries a skip and a forward. */
    const orphans = CUSTOMER_ROUTES
      .map(r => r.replace(/\[[^\]]+\]/g, 'x'))
      .filter(r => !ROOT.has(r))
      .filter(r => r !== '/welcome' && r !== '/offline' && r !== '/auth/login')
      /* The four surfaces read by people with no session and no history —
         `publicParent` answers for them, asserted next. */
      .filter(r => !r.startsWith('/invoice') && !r.startsWith('/chapter')
        && r !== '/privacy' && r !== '/terms')
      .filter(r => parentOf(r) === null);
    expect(orphans).toEqual([]);
  });

  it('the shared papers have their own way out, because they leave the product', () => {
    /* An invoice and a chapter are opened by people with no session at all, so
       `parentOf` cannot answer for them and `publicParent` does. */
    const resolve = codeOf('navigation/resolve.ts');
    expect(resolve).toMatch(/export const publicParent/);
    for (const f of ['app/invoice/[id]/page.tsx', 'app/chapter/[id]/page.tsx',
      'components/legal/LegalPage.tsx']) {
      expect({ f, uses: /publicParent/.test(readFileSync(f, 'utf8')) }).toEqual({ f, uses: true });
    }
  });

  it('and the legal pages carry the ONE back control, not a footer of links', () => {
    /* They had three links at the FOOT — the exact idiom the navigation law
       suite condemned everywhere else. A control you reach by scrolling past
       everything is not an escape route. */
    const legal = readFileSync('components/legal/LegalPage.tsx', 'utf8');
    expect(legal).toMatch(/<Back parent=\{publicParent\(from\)\}/);
  });

  it('BACK IS NEVER `router.back()`, anywhere in the customer product', () => {
    const offenders = CUSTOMER.filter(f => /router\.back\(\)|history\.back\(\)/.test(codeOf(f)));
    expect(offenders).toEqual([]);
  });

  it('and it carries the car it was about, on every address that names one', () => {
    for (const [path, expected] of [
      ['/vehicle/puc?car=v2', '/vehicle?car=v2'],
      ['/history?car=v2', '/vehicle?car=v2'],
      ['/history/b1?car=v2', '/history?car=v2'],
    ] as const) {
      expect({ path, to: parentOf(path)?.href }).toEqual({ path, to: expected });
    }
  });

  it('a deep link with no context still lands somewhere real, never nowhere', () => {
    for (const path of ['/vehicle/puc', '/history', '/history/b1', '/booking/b1', '/approval/a1']) {
      const p = parentOf(path);
      expect({ path, href: p?.href }).toEqual({ path, href: expect.stringMatching(/^\//) });
    }
  });

  it('the five dock slots have no parent, and must not grow one', () => {
    for (const s of slots) expect({ s, parent: parentOf(s) }).toEqual({ s, parent: null });
  });

  it('every destination the product can name answers at a real route', () => {
    const routes = CUSTOMER_ROUTES
      .concat(walk('app').filter(f => f.endsWith('page.tsx'))
        .map(f => f.replace(/^app/, '').replace(/\/page\.tsx$/, '') || '/'))
      .map(r => new RegExp(`^${r.replace(/\[[^\]]+\]/g, '[^/]+')}$`));
    const every: Destination[] = [
      { to: 'home' }, { to: 'garage' }, { to: 'garage.add' },
      { to: 'garage.edit', vehicleId: 'v1' }, { to: 'history' },
      { to: 'history.car', vehicleId: 'v1' }, { to: 'studio' },
      { to: 'studio.arrange' }, { to: 'studio.category', category: 'Ceramic' },
      { to: 'studio.scope', serviceId: 's1', vehicleId: 'v1' },
      { to: 'membership' }, { to: 'membership.join' }, { to: 'profile' },
      { to: 'profile.panel', panel: 'notifications' },
      { to: 'vehicle' }, { to: 'vehicle', vehicleId: 'v1' },
      { to: 'vehicle.puc' }, { to: 'vehicle.puc', vehicleId: 'v1' },
      { to: 'visit', visitId: 'b1' }, { to: 'booking', bookingId: 'b1' },
      { to: 'booking.manage', bookingId: 'b1' }, { to: 'approval', approvalId: 'a1' },
      { to: 'settle', bookingId: 'b1' }, { to: 'privacy' }, { to: 'terms' },
      { to: 'cars' }, { to: 'car', listingId: 'c1' }, { to: 'sell' },
      { to: 'invoice', invoiceId: 'i1', token: 't' },
      { to: 'chapter', invoiceId: 'i1', token: 't' },
      { to: 'welcome' }, { to: 'welcome.step', step: 'rooms' },
    ];
    for (const d of every) {
      const path = hrefForDestination(d).split('?')[0];
      expect({ d, path, found: routes.some(r => r.test(path)) })
        .toEqual({ d, path, found: true });
    }
  });
});

describe('every customer address is a room unless it is named otherwise', () => {
  it('and a room is dark by classification, not by a list of exceptions', () => {
    for (const r of CUSTOMER_ROUTES.map(x => x.replace(/\[[^\]]+\]/g, 'x'))) {
      const kind = surfaceKind(r);
      const expected = r.startsWith('/privacy') || r.startsWith('/terms') || r.startsWith('/invoice')
        ? 'document' : 'room';
      expect({ r, kind }).toEqual({ r, kind: expected });
    }
  });

  it('a room the dock does not name still lights the slot it belongs to', () => {
    for (const r of ['/vehicle/puc', '/history/b1', '/booking/b1', '/approval/a1']) {
      expect({ r, lit: roomFor(r)?.activates }).toEqual({ r, lit: expect.stringMatching(/^\//) });
    }
  });
});

/* ── THE TRUST BOUNDARY ──────────────────────────────────────────────────── */

describe('the customer never writes authoritative state', () => {
  const rules = readFileSync('firestore.rules', 'utf8');
  const blockOf = (c: string) => {
    const at = rules.indexOf(`match /${c}/`);
    expect({ c, found: at > -1 }).toEqual({ c, found: true });
    return rules.slice(at, rules.indexOf('match /', at + 10));
  };

  /**
   * THE COLLECTIONS THAT CARRY A PROMISE, A PRICE OR AN ENTITLEMENT.
   *
   * For each: who may write it from a browser. `false` means nobody — the
   * server is the only writer, through a named route.
   */
  const SEALED: readonly [string, 'nobody' | 'staff'][] = [
    ['bookings', 'staff'],       // admin console may correct; create is nobody's
    ['payments', 'nobody'],
    ['approvals', 'nobody'],
    ['estimates', 'nobody'],
    ['ratings', 'nobody'],
    ['subscriptions', 'nobody'],
    ['declarations', 'nobody'],
    ['protections', 'staff'],    // the seal runs as staff from the kiosk
  ];

  it.each(SEALED)('%s is never created by a customer', (c) => {
    const block = blockOf(c);
    expect(block).toMatch(/allow (create|write)[^:]*: if (false|request\.auth != null && (isStaff|isAdmin)\(\))/);
    /* And in no case is the condition merely "it is mine". */
    expect(block).not.toMatch(/allow create: if request\.auth != null &&\s*\(?\s*request\.resource\.data\.userId == request\.auth\.uid/);
  });

  it.each(SEALED)('%s is never updated by a customer either', (c, who) => {
    const block = blockOf(c);
    if (who === 'nobody') {
      expect(block).toMatch(/allow (update|write)[^:]*: if false;/);
    } else {
      expect(block).toMatch(/allow (create, )?update: if request\.auth != null && is(Staff|Admin)\(\);/);
    }
  });

  it('A VEHICLE ID IS NOT AN OWNERSHIP CLAIM ANYBODY MAY STAKE', () => {
    /* `ownsVehicle()` asks whether a document EXISTS at
       `users/{me}/vehicles/{thatId}`, and protections, visits and declarations
       all read it. While a browser could CHOOSE that id, squatting another
       customer's was a claim over their car's whole record — and vehicle ids
       travel in the customer's own addresses.

       `allow create: if false` is the line that closes it. An UPDATE cannot
       squat: Firestore only calls a write an update when the document already
       exists, which means the server put it there. */
    const at = rules.indexOf('match /vehicles/{vehicleId}');
    expect(at).toBeGreaterThan(-1);
    const block = rules.slice(at, rules.indexOf('match /', at + 10));
    expect(block).toMatch(/allow create: if false;/);
    expect(block).toMatch(/allow delete: if request\.auth != null && isAdmin\(\);/);
  });

  it('but CONSENT stays the owner’s, because it cannot be anyone else’s', () => {
    /* `lib/os/consent.ts` is explicit that the studio has no way in — an admin
       who could consent on a customer's behalf would defeat the point of
       asking. So the one owner-writable field is named, and only that one. */
    const at = rules.indexOf('match /vehicles/{vehicleId}');
    const block = rules.slice(at, rules.indexOf('match /', at + 10));
    expect(block).toMatch(/hasOnly\(\['publicHistoryConsent', 'updatedAt'\]\)/);
    expect(codeOf('lib/services/vehicles.ts')).toMatch(/export const setPublicHistoryConsent/);
  });

  it('the money words appear in no client-writable rule', () => {
    /* `amount`, `total`, `paid` — a rule that mentions one is a rule trying to
       validate arithmetic, which rules cannot do. */
    for (const c of ['payments', 'estimates', 'subscriptions', 'bookings']) {
      const block = blockOf(c);
      const writable = block.split('\n').filter(l => /allow (create|update|write)/.test(l) && !/if false/.test(l));
      for (const line of writable) {
        expect({ c, line, names: /amount|total|price|paid/.test(line) })
          .toEqual({ c, line, names: false });
      }
    }
  });

  it('every server route that writes proves who is calling, and trusts no body uid', () => {
    const writers = walk('app/api')
      .filter(f => f.endsWith('route.ts'))
      .filter(f => /export async function (POST|PUT|PATCH|DELETE)/.test(codeOf(f)))
      .filter(f => !/cars\/lead|api\/session|notify\/event|whatsapp\/send|report/.test(f));
    expect(writers.length).toBeGreaterThan(8);
    for (const f of writers) {
      const src = codeOf(f);
      expect({ f, verified: /verifyIdToken|CRON_SECRET|verifySession/.test(src) })
        .toEqual({ f, verified: true });
      if (f.includes('welcome/complete')) continue;
      expect({ f, trusts: /body\.uid|body\.userId\b/.test(src) && !/isStudio|isStaff|role/.test(src) })
        .toEqual({ f, trusts: false });
    }
  });
});

describe('the three writes a browser must never reach', () => {
  it('a customer cannot mark a payment PAID', () => {
    expect(paymentTransition('submitted', 'paid', 'customer'))
      .toEqual({ ok: false, reason: 'not-yours-to-make' });
    expect(paymentTransition('unpaid', 'paid', 'customer'))
      .toEqual({ ok: false, reason: 'not-yours-to-make' });
  });

  it('a customer cannot VERIFY their own declaration', () => {
    expect(declarationTransition('submitted', 'verified', 'customer'))
      .toEqual({ ok: false, reason: 'not-yours-to-make' });
  });

  it('a customer cannot ACTIVATE their own membership', () => {
    expect(membershipTransition('pending', 'active', 'customer'))
      .toEqual({ ok: false, reason: 'not-yours-to-make' });
  });

  it('and the STUDIO cannot answer an approval for the customer', () => {
    /* The mirror image, and the reason the actor table exists at all. */
    expect(approvalTransition('requested', 'approved', 'studio'))
      .toEqual({ ok: false, reason: 'not-yours-to-make' });
    expect(approvalTransition('requested', 'declined', 'studio'))
      .toEqual({ ok: false, reason: 'not-yours-to-make' });
    expect(approvalTransition('requested', 'approved', 'customer').ok).toBe(true);
  });

  it('every one of those transitions is asked by the service that performs it', () => {
    for (const [f, fn] of [
      ['lib/server/paymentService.ts', 'paymentTransition'],
      ['lib/server/pucService.ts', 'declarationTransition'],
      ['lib/server/membershipService.ts', 'membershipTransition'],
      ['lib/server/approvalService.ts', 'approvalTransition'],
      ['lib/server/bookingService.ts', 'bookingTransition'],
    ] as const) {
      expect({ f, asks: codeOf(f).includes(fn) }).toEqual({ f, asks: true });
    }
  });
});

describe('history cannot be rewritten', () => {
  it('a SEALED visit is terminal for everyone, including the studio', () => {
    expect(visitTransition('sealed', 'open', 'studio')).toEqual({ ok: false, reason: 'already-sealed' });
    expect(visitTransition('sealed', 'cancelled', 'studio')).toEqual({ ok: false, reason: 'already-sealed' });
  });

  it('a COMPLETED booking is terminal, and `expired` is not `cancelled`', () => {
    expect(bookingTransition('completed', 'in_progress', 'studio'))
      .toEqual({ ok: false, reason: 'already-completed' });
    expect(bookingTransition('expired', 'confirmed', 'studio'))
      .toEqual({ ok: false, reason: 'already-expired' });
  });

  it('a PAID payment is terminal — a refund is its own event, not a reversal', () => {
    expect(paymentTransition('paid', 'unpaid', 'studio')).toEqual({ ok: false, reason: 'already-paid' });
  });

  it('an EXPIRED membership is never revived — rejoining is a new record', () => {
    expect(membershipTransition('expired', 'active', 'studio'))
      .toEqual({ ok: false, reason: 'already-expired' });
    expect(membershipTransition('cancelled', 'active', 'studio'))
      .toEqual({ ok: false, reason: 'already-cancelled' });
  });

  it('a VERIFIED certificate is superseded, never edited', () => {
    expect(declarationTransition('verified', 'rejected', 'studio'))
      .toEqual({ ok: false, reason: 'illegal-transition' });
    expect(declarationTransition('verified', 'superseded', 'studio').ok).toBe(true);
  });

  it('and no warranty is ever re-derived from today’s catalogue on a read', () => {
    /* The whole reason `termsCaptured` exists. Editing a warranty string in
       admin must not rewrite what a past customer was promised. */
    const engine = codeOf('lib/os/protection.ts');
    expect(engine).toMatch(/export function captureTerms/);
    /* The only two callers are the seal and the documented migration path. */
    const callers = [...walk('lib'), ...walk('app'), ...walk('components')]
      .filter(f => /captureTerms\(/.test(codeOf(f)) && f !== 'lib/os/protection.ts')
      .sort();
    /* THE SEAL, and the documented migration read path. No screen, no
       projection, no route — and never on a read of a sealed record. */
    expect(callers).toEqual(['lib/server/sealVisit.ts', 'lib/services/visits.ts']);
  });
});

describe('an expired promise is never dressed as a live one', () => {
  const prot = (expiresOn: string): Protection => ({
    id: 'p', vehicleId: 'v1', kind: 'ceramic', since: '2026-01-01',
    term: { kind: 'dated', expiresOn }, termsSource: 'captured',
  } as unknown as Protection);
  const NOW = new Date('2026-08-12T09:00:00Z');

  it('the engine calls a term that has gone `lapsed`, and says so', () => {
    expect(liveProtection(prot('2026-07-30'), NOW).health).toBe('lapsed');
    expect(liveProtection(prot('2027-07-30'), NOW).health).not.toBe('lapsed');
  });

  it('and the car’s warranty tile counts only what still holds', () => {
    /* The tile reads "Active to <month>". It used to take the furthest dated
       term including LAPSED ones, so a car whose only protection had run out
       on 30 July was given "Active to July 2026" — under a ledger row saying
       "Lapsed 30 July 2026", on the same screen. */
    const project = codeOf('lib/customer/project.ts');
    const furthest = project.slice(project.indexOf('const furthest = protections'));
    expect(furthest.slice(0, 300)).toMatch(/p\.health !== 'lapsed'/);
  });
});

/* ── NOTHING FAKE ────────────────────────────────────────────────────────── */

describe('every control the customer is offered actually does something', () => {
  it('no customer surface hands the product off to WhatsApp as its only act', () => {
    /* A `wa.me` link is a legitimate SECONDARY way to reach a person. It is
       never the flow: the certificate, the Club and the record each had one
       standing in for a feature that did not exist. */
    const primary = [
      'components/screens/MembershipScreen.tsx',
      'components/screens/VehicleScreen.tsx',
      'components/screens/GarageScreen.tsx',
      'components/screens/HomeScreen.tsx',
      'components/screens/StudioScreen.tsx',
    ];
    for (const f of primary) {
      expect({ f, wa: /wa\.me|waLink/.test(codeOf(f)) }).toEqual({ f, wa: false });
    }
  });

  it('nothing is parked, and nothing is a placeholder', () => {
    /* Word boundaries, or `setOdometer` reports itself as a TODO. */
    const offenders = CUSTOMER.filter(f => /\bTODO\b|\bFIXME\b|\bXXX\b|coming soon|not implemented/i.test(codeOf(f)));
    expect(offenders).toEqual([]);
  });

  it('no customer surface prints to the console', () => {
    /* `console.error` is allowed and used deliberately: a read that failed and
       a control with no destination are things that must be visible. What is
       forbidden is the debugging residue — `log`, `warn`, `debug`. */
    const offenders = CUSTOMER.filter(f => /console\.(log|warn|debug|info)\(/.test(codeOf(f)));
    expect(offenders).toEqual([]);
  });

  it('and every service the customer product calls exists as a route', () => {
    const called = new Set<string>();
    for (const f of [...CUSTOMER, ...walk('lib/services')]) {
      for (const m of codeOf(f).matchAll(/['"`](\/api\/[a-z0-9/[\]-]+)['"`]/g)) called.add(m[1]);
    }
    expect(called.size).toBeGreaterThan(5);
    for (const path of called) {
      const file = `app${path}/route.ts`;
      expect({ path, exists: existsSync(file) }).toEqual({ path, exists: true });
    }
  });
});
