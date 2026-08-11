/**
 * MEMBERSHIP — ONE SOURCE OF TRUTH, ENFORCED.
 *
 * Membership arithmetic was spread across five files before this: the club
 * engine, the customer projection (twice), the server pricing decision, the
 * retention job and the walk-in kiosk each subtracted `washesUsed` from
 * `washesTotal` themselves. Five subtractions is five chances to disagree, and
 * the kiosk's had no floor at zero — an over-spent membership reported a
 * negative entitlement.
 *
 * These assertions are what stop that coming back.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { clubModel, washesLeftOf, cycleEnd, cycleDaysLeft, CYCLE_DAYS } from '@/lib/os/club';
import type { Subscription, Booking } from '@/lib/types';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

const codeOf = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('the arithmetic exists once', () => {
  const sources = [
    ...walk('lib'), ...walk('components'), ...walk('app'), ...walk('navigation'),
  ].filter(f => !f.includes('node_modules'));

  it('nothing subtracts washesUsed from washesTotal by hand', () => {
    const offenders = sources
      .filter(f => f !== 'lib/os/club.ts')
      .filter(f => /washesTotal\s*[-–]\s*/.test(codeOf(f)) || /washesTotal\s*\?\?\s*0\)\s*-/.test(codeOf(f)));
    expect(offenders).toEqual([]);
  });

  it('the cycle length is written once', () => {
    const offenders = sources
      .filter(f => f !== 'lib/os/club.ts')
      .filter(f => /getDate\(\)\s*\+\s*30/.test(codeOf(f)));
    expect(offenders).toEqual([]);
  });

  it('washesLeftOf never goes negative', () => {
    expect(washesLeftOf({ washesTotal: 4, washesUsed: 9 })).toBe(0);
    expect(washesLeftOf({ washesTotal: 4, washesUsed: 1 })).toBe(3);
    expect(washesLeftOf(null)).toBe(0);
  });

  it('a cycle is CYCLE_DAYS long, from the engine', () => {
    expect(CYCLE_DAYS).toBe(30);
    expect(cycleEnd('2026-01-01')).toBe('2026-01-31');
  });
});

describe('the customer may only do what the rules permit', () => {
  const rules = readFileSync('firestore.rules', 'utf8');
  const flow = codeOf('components/membership/ClubFlow.tsx');

  it('a self-purchase always lands as pending', () => {
    expect(rules).toMatch(/request\.resource\.data\.status == 'pending'/);
    expect(flow).toMatch(/status: 'pending'/);
  });

  it('joining, upgrading and renewing are the SAME write', () => {
    /* The rules allow a customer to change only `status`, and only to
       `cancelled` — so a plan change cannot be an edit. All three create. */
    expect(rules).toMatch(/hasOnly\(\['status', 'updatedAt'\]\)/);
    expect(rules).toMatch(/request\.resource\.data\.status == 'cancelled'/);
    expect((flow.match(/createSubscription/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it('leaving uses the one service call the rules allow', () => {
    expect(flow).toMatch(/updateSubscriptionStatus\(subscriptionId, 'cancelled'\)/);
  });

  it('no membership status is written client-side except cancelled', () => {
    const writes = flow.match(/updateSubscriptionStatus\([^)]*\)/g) ?? [];
    for (const w of writes) expect(w).toContain("'cancelled'");
  });
});

describe('a wash is spent exactly once', () => {
  it('washesUsed has a single writer, inside the booking commit', () => {
    const writers = [...walk('lib'), ...walk('app')]
      .filter(f => !f.includes('node_modules'))
      .filter(f => /washesUsed:\s*\(/.test(codeOf(f)));
    expect(writers).toEqual(['lib/server/bookingService.ts']);
  });

  it('the deduction rides the same commit as the visit that consumes it', () => {
    const svc = codeOf('lib/server/bookingService.ts');
    expect(svc).toMatch(/runTransaction/);
    expect(svc).toMatch(/washesUsed/);
  });
});

describe('the club engine decides the lifecycle', () => {
  const sub = (over: Partial<Subscription> = {}): Subscription => ({
    id: 's1', userId: 'u1', plan: 'Silver', status: 'active',
    startDate: '2026-07-01', endDate: '2026-07-31',
    washesTotal: 4, washesUsed: 1, paymentMethod: 'cash',
    ...over,
  } as unknown as Subscription);

  const NOW = new Date('2026-07-20T10:00:00');

  it('counts what is left from the engine, not from the caller', () => {
    const m = clubModel({ membership: sub(), completed: [] as Booking[], now: NOW });
    expect(m.washesLeft).toBe(3);
    expect(m.washesTotal).toBe(4);
  });

  it('a pending membership is awaiting payment, not active', () => {
    const m = clubModel({ membership: sub({ status: 'pending' }), completed: [], now: NOW });
    expect(m.awaitingPayment).toBe(true);
    expect(m.state).not.toBe('active');
  });

  it('no membership is state none, and offers nothing to cancel', () => {
    const m = clubModel({ membership: null, completed: [], now: NOW });
    expect(m.state).toBe('none');
    expect(m.washesLeft).toBe(0);
  });

  it('the countdown comes from the engine', () => {
    const m = clubModel({ membership: sub(), completed: [], now: NOW });
    /* Inclusive of the closing day — the engine's count, and the test defers
       to it rather than asserting a second definition of "days left". */
    expect(cycleDaysLeft(m, NOW)).toBe(12);
  });
});

describe('a cancelled visit gives back what it consumed', () => {
  const svc = codeOf('lib/server/bookingService.ts');
  const bookings = codeOf('lib/services/bookings.ts');

  /* THE BUG THIS GUARDS. `settleBenefits` spends a membership wash and a promo
     when a booking is created. `cancelBooking` used to write only
     `status: 'cancelled'` — so a customer who cancelled, or whose booking the
     STUDIO refused, permanently lost a wash they had paid for. It could not be
     fixed client-side: the rules let a customer touch neither the subscription
     nor the promo. */

  it('the restore is server-authoritative', () => {
    expect(svc).toMatch(/cancelBookingAuthoritative/);
    expect(bookings).toMatch(/\/api\/booking\/cancel/);
  });

  it('no client writes a cancellation directly any more', () => {
    expect(bookings).not.toMatch(/updateDoc\([^)]*bookings[^)]*\)[\s\S]{0,120}status: 'cancelled'/);
  });

  it('the wash and the booking status move in one commit', () => {
    const fn = svc.slice(svc.indexOf('cancelBookingAuthoritative'));
    expect(fn).toMatch(/runTransaction/);
    expect(fn).toMatch(/washesUsed/);
  });

  it('cancelling twice cannot credit two washes', () => {
    const fn = svc.slice(svc.indexOf('cancelBookingAuthoritative'));
    expect(fn).toMatch(/alreadyCancelled: true, washRestored: false/);
  });

  it('a restore can never drive a membership negative', () => {
    const fn = svc.slice(svc.indexOf('cancelBookingAuthoritative'));
    expect(fn).toMatch(/Math\.max\(0, \(sub\.washesUsed \?\? 0\) - 1\)/);
  });

  it('a no-show forfeits the wash, and the rule is written once', () => {
    const fn = svc.slice(svc.indexOf('cancelBookingAuthoritative'));
    expect(fn).toMatch(/&& !opts\.noShow/);
  });

  it('a promo is only returned when it was actually redeemed', () => {
    const fn = svc.slice(svc.indexOf('cancelBookingAuthoritative'));
    expect(fn).toMatch(/redemptionSnap\.exists/);
    expect(fn).toMatch(/t\.delete\(redemptionRef\)/);
  });

  it('a customer cannot cancel work already under way', () => {
    /* The set used to be a local `CANCELLABLE` array here, a duplicate list in
       firestore.rules and a third in the manage sheet. One table now, asked by
       all three, so they cannot drift apart. */
    const lifecycle = readFileSync('lib/os/lifecycle.ts', 'utf8');
    expect(svc).toMatch(/bookingTransition\(\s*\n?\s*booking\.status, 'cancelled'/);
    expect(lifecycle).toMatch(/CUSTOMER_CANCELLABLE/);
    expect(lifecycle).toMatch(/'too-late'/);
  });

  it('the studio refusing a booking still returns the wash', () => {
    expect(bookings).toMatch(/cancelBooking\(booking\.id, \{ reason \}\)/);
  });
});

describe('membership revenue is its own line, on the payment date', () => {
  const reports = codeOf('app/admin/reports/page.tsx');
  const subs = codeOf('lib/services/subscriptions.ts');
  const types = readFileSync('lib/types.ts', 'utf8');

  it('a subscription records WHEN it was paid and HOW MUCH', () => {
    expect(types).toMatch(/paidAt\?: Timestamp;/);
    expect(types).toMatch(/amountPaid\?: number;/);
  });

  it('the payment stamp is written once, at activation', () => {
    /* Re-activating must not move revenue into a later month. */
    expect(subs).toMatch(/if \(status === 'active'\)/);
    expect(subs).toMatch(/!existing\.paidAt/);
  });

  it('the amount is captured then, not looked up later', () => {
    /* Otherwise changing a plan's price rewrites past months. */
    expect(subs).toMatch(/data\.amountPaid = plan\.price/);
  });

  it('reports query on paidAt, not createdAt or updatedAt', () => {
    expect(reports).toMatch(/where\('paidAt', '>='/);
    expect(reports).toMatch(/where\('paidAt', '<='/);
    expect(reports).not.toMatch(/subscriptions'\),\s*where\('createdAt'/);
  });

  it('membership revenue is never folded into detailing revenue', () => {
    expect(reports).toMatch(/membershipRevenue/);
    /* `revenue` is bookings + jobs only; membership is added alongside it in
       one explicitly-labelled combined tile, never into the base figure. */
    expect(reports).toMatch(/const revenue = \(report\?\.bookingRevenue \?\? 0\) \+ \(report\?\.jobRevenue \?\? 0\)/);
    expect(reports).toMatch(/Detailing revenue/);
  });

  it('there is no amortisation or deferred revenue', () => {
    expect(reports).not.toMatch(/amorti|defer|proRat|prorate/i);
  });

  it('a subscription with no recorded amount contributes nothing', () => {
    expect(reports).toMatch(/typeof sub\.amountPaid === 'number'/);
  });

  it('the query needs no declared index, and must not declare one', () => {
    /* THIS ASSERTED THE OPPOSITE, AND THE FILE COULD NEVER BE DEPLOYED.
       The revenue query is a range on ONE field —
       `where('paidAt','>=').where('paidAt','<=')` — which Firestore serves
       from the automatic single-field index every field already has. Declaring
       it as a composite is not merely redundant: the API refuses it, with
       "this index is not necessary, configure using single field index
       controls", and the refusal aborted the deploy of ALL twenty real
       indexes alongside it.

       So the guarantee is the inverse of what was written here: the query is
       single-field, and the file declares no single-field index. */
    const reportsSrc = readFileSync('app/admin/reports/page.tsx', 'utf8');
    const q = reportsSrc.slice(reportsSrc.indexOf("where('paidAt'"));
    expect(q.slice(0, 300)).toMatch(/where\('paidAt', '>='/);
    expect(q.slice(0, 300)).toMatch(/where\('paidAt', '<='/);
    /* No second field joins it — that is what would need a composite. */
    expect(q.slice(0, 300)).not.toMatch(/where\('(?!paidAt)/);

    const idx = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')) as {
      indexes: { collectionGroup: string; fields: { fieldPath: string }[] }[];
    };
    const singleField = idx.indexes.filter(i => i.fields.length === 1);
    expect(singleField).toEqual([]);
  });
});

describe('the surface offers no dead ends', () => {
  const screen = codeOf('components/screens/MembershipScreen.tsx');
  const project = codeOf('lib/customer/project.ts');
  const resolve = codeOf('navigation/resolve.ts');

  it('joining and leaving happen in-app, not on WhatsApp', () => {
    /* Both were `waLink(...)` — the room handed the customer to another
       application because there was no in-app surface. There is one now. */
    expect(screen).not.toMatch(/waLink/);
    const toMembership = project.slice(project.indexOf('export function toMembership'));
    expect(toMembership.slice(0, toMembership.indexOf('\n}'))).not.toMatch(/waLink/);
  });

  it("Home's membership actions open the right flow", () => {
    expect(resolve).toMatch(/renew_membership[^\n]*club=renew/);
    expect(resolve).toMatch(/rejoin_membership[^\n]*club=join/);
  });

  it('every membership layer is addressable', () => {
    expect(screen).toMatch(/params\.get\('club'\)/);
  });
});
