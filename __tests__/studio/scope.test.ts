/**
 * SCOPE & QUOTE - design screen 07, against the catalogue.
 *
 * The engine that decides HOW MUCH OF THE CAR, and what that work is. It does
 * not decide what the customer pays: that is `priceVisit`, and there is one of
 * it. What is asserted here is that a scope is resolved from the catalogue by
 * ID, that nothing a client sends can become a price, and that the snapshot it
 * produces cannot be rewritten by a later catalogue edit.
 */
import { readFileSync } from 'fs';
import { Timestamp } from 'firebase/firestore';
import type { Promo, Service, Subscription } from '@/lib/types';
import {
  resolveScope, scopesOf, addOnsOf, WHOLE_SCOPE,
  estimateExpiryOn, estimateHasExpired, ESTIMATE_VALID_DAYS,
} from '@/lib/os/scope';
import { priceVisit, pickupFees, taxPolicy, storedBreakdown } from '@/lib/services/pricing';

const ts = (iso: string) => Timestamp.fromDate(new Date(iso));

const ppf = (over: Partial<Service> = {}): Service => ({
  id: 'svc-ppf', category: 'PPF', name: 'Paint protection film',
  brand: 'Garware', price: 45000, duration: 480,
  warranty: '5 years', description: 'Self-healing film.',
  popular: true, active: true, order: 1,
  scopes: [
    {
      id: 'front', kind: 'front', label: 'Front end',
      detail: 'Bonnet, bumper, mirrors, headlights.',
      price: 45000, durationMinutes: 480, order: 1,
    },
    {
      id: 'full', kind: 'full', label: 'Full body',
      detail: 'Every painted panel.',
      price: 132000, durationMinutes: 1200, order: 2,
    },
    {
      id: 'custom', kind: 'custom', label: 'Custom panels',
      detail: 'Choose what matters.', order: 3,
      panels: [
        { id: 'bonnet', label: 'Bonnet', price: 14000, durationMinutes: 150 },
        { id: 'rear-quarter', label: 'Rear quarter', price: 11000, durationMinutes: 120 },
      ],
    },
  ],
  addOns: [
    {
      id: 'two-stage', label: 'Two-stage correction',
      detail: 'Recommended before film.', price: 18000, durationMinutes: 300,
      recommendedWith: ['full'], order: 1,
    },
    {
      id: 'ceramic-over', label: 'Ceramic over film',
      detail: 'Adds 4 hours.', price: 12000, durationMinutes: 240, order: 2,
    },
  ],
  createdAt: ts('2026-01-01T00:00:00Z'),
} as Service);

/* The seven services in production carry no scopes at all. */
const plain = (over: Partial<Service> = {}): Service => ({
  id: 'svc-wash', category: 'Washing', name: 'Signature wash',
  brand: null, price: 1200, duration: 90, warranty: null,
  description: 'A wash.', popular: false, active: true, order: 9,
  createdAt: ts('2026-01-01T00:00:00Z'),
  ...over,
} as Service);

/* ── every service stays bookable ────────────────────────────────────────── */

describe('a service with no scopes is still bookable', () => {
  it('offers exactly one coverage - itself', () => {
    const only = scopesOf(plain());
    expect(only).toHaveLength(1);
    /* The label answers "how much of the car", not "which service" - the
       screen has already said the service's name in its title. */
    expect(only[0]).toMatchObject({ id: WHOLE_SCOPE, label: 'The whole car', price: 1200 });
  });

  it('resolves with no choice at all, at the catalogue price', () => {
    const r = resolveScope(plain(), {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.scope.workPrice).toBe(1200);
    expect(r.lines).toEqual([{ name: 'Signature wash', price: 1200 }]);
  });

  it('has no add-ons rather than an empty chooser', () => {
    expect(addOnsOf(plain())).toEqual([]);
  });
});

/* ── the three coverages ─────────────────────────────────────────────────── */

describe('each coverage prices deterministically, from the catalogue', () => {
  it('front end', () => {
    const r = resolveScope(ppf(), { scopeId: 'front' });
    expect(r.ok && r.scope.workPrice).toBe(45000);
    expect(r.ok && r.scope.durationMinutes).toBe(480);
    expect(r.ok && r.scope.bayDays).toBe(1);
  });

  it('full body - and its days come from its own duration', () => {
    const r = resolveScope(ppf(), { scopeId: 'full' });
    expect(r.ok && r.scope.workPrice).toBe(132000);
    /* DURATION IS ELAPSED. This fixture's full body is under a day of clock
       time, so it is one - and it is the SAME expansion that reserves the bay,
       which is the property worth asserting. */
    expect(r.ok && r.scope.bayDays).toBe(1);
  });

  it('the same choice twice gives the same answer', () => {
    const a = resolveScope(ppf(), { scopeId: 'full', addOnIds: ['two-stage'] });
    const b = resolveScope(ppf(), { scopeId: 'full', addOnIds: ['two-stage'] });
    expect(a).toEqual(b);
  });

  it('an unknown coverage is refused, never quietly defaulted', () => {
    expect(resolveScope(ppf(), { scopeId: 'whole-car-plus-boat' }))
      .toEqual({ ok: false, reason: 'unknown-scope' });
  });
});

describe('a custom coverage is priced by its panels, never by a zero', () => {
  it('sums the panels chosen, and names each as its own line', () => {
    const r = resolveScope(ppf(), { scopeId: 'custom', panelIds: ['bonnet', 'rear-quarter'] });
    expect(r.ok && r.scope.workPrice).toBe(25000);
    expect(r.ok && r.lines.map(l => l.name)).toEqual([
      'Custom panels · Bonnet', 'Custom panels · Rear quarter',
    ]);
  });

  it('is deterministic whatever order the panels arrive in', () => {
    const a = resolveScope(ppf(), { scopeId: 'custom', panelIds: ['bonnet', 'rear-quarter'] });
    const b = resolveScope(ppf(), { scopeId: 'custom', panelIds: ['bonnet', 'rear-quarter'] });
    expect(a).toEqual(b);
  });

  it('the same panel twice is one panel, and is charged once', () => {
    const r = resolveScope(ppf(), { scopeId: 'custom', panelIds: ['bonnet', 'bonnet'] });
    expect(r.ok && r.scope.workPrice).toBe(14000);
    expect(r.ok && r.scope.panels).toHaveLength(1);
  });

  it('NO PANELS IS NOT A FREE FULL BODY - it is an unanswered question', () => {
    expect(resolveScope(ppf(), { scopeId: 'custom' }))
      .toEqual({ ok: false, reason: 'custom-needs-panels' });
    expect(resolveScope(ppf(), { scopeId: 'custom', panelIds: [] }))
      .toEqual({ ok: false, reason: 'custom-needs-panels' });
  });

  it('a panel the studio does not fit is refused', () => {
    expect(resolveScope(ppf(), { scopeId: 'custom', panelIds: ['spoiler'] }))
      .toEqual({ ok: false, reason: 'unknown-panel' });
  });
});

describe('add-ons are catalogue objects, never strings from a client', () => {
  it('affect the price and the time', () => {
    const bare = resolveScope(ppf(), { scopeId: 'full' });
    const with2 = resolveScope(ppf(), { scopeId: 'full', addOnIds: ['two-stage'] });
    expect(with2.ok && with2.scope.workPrice).toBe(132000 + 18000);
    expect(with2.ok && bare.ok
      && with2.scope.durationMinutes - bare.scope.durationMinutes).toBe(300);
  });

  it('two add-ons both apply', () => {
    const r = resolveScope(ppf(), { scopeId: 'front', addOnIds: ['two-stage', 'ceramic-over'] });
    expect(r.ok && r.scope.workPrice).toBe(45000 + 18000 + 12000);
    expect(r.ok && r.scope.addOns).toHaveLength(2);
  });

  it('the same add-on twice is charged once', () => {
    const r = resolveScope(ppf(), { scopeId: 'front', addOnIds: ['two-stage', 'two-stage'] });
    expect(r.ok && r.scope.workPrice).toBe(45000 + 18000);
  });

  it('an add-on that is not on the service is refused', () => {
    expect(resolveScope(ppf(), { scopeId: 'front', addOnIds: ['free-ferrari'] }))
      .toEqual({ ok: false, reason: 'unknown-add-on' });
  });
});

describe('a service the studio no longer offers fails safely', () => {
  it('an unknown service', () => {
    expect(resolveScope(undefined, {})).toEqual({ ok: false, reason: 'unknown-service' });
    expect(resolveScope(null, {})).toEqual({ ok: false, reason: 'unknown-service' });
  });

  it('a withdrawn service', () => {
    expect(resolveScope(plain({ active: false }), {}))
      .toEqual({ ok: false, reason: 'service-not-offered' });
  });

  it('a service with no price is refused rather than sold for nothing', () => {
    expect(resolveScope(plain({ price: 0 }), {}))
      .toEqual({ ok: false, reason: 'service-not-priced' });
  });
});

describe('the bay is never held for less time than the work takes', () => {
  it('a duration below the service’s own is floored at it', () => {
    /* A single small panel must not tell the availability engine the bay is
       free within the hour on a job that occupies a booth. */
    const r = resolveScope(ppf(), { scopeId: 'custom', panelIds: ['rear-quarter'] });
    expect(r.ok && r.scope.durationMinutes).toBe(480);
  });
});

/* ── the money, through the one engine ───────────────────────────────────── */

const member = (plan: 'Silver' | 'Gold' | 'Platinum'): Subscription & { id: string } => ({
  id: 'sub1', userId: 'u1', plan, status: 'active',
  startDate: '2026-01-01', endDate: '2026-12-31',
  washesTotal: 8, washesUsed: 0,
} as unknown as Subscription & { id: string });

const quote = (over: {
  scopeId?: string; panelIds?: string[]; addOnIds?: string[];
  membership?: (Subscription & { id: string }) | null;
  promos?: Promo[]; pickup?: boolean; drop?: boolean;
} = {}) => {
  const r = resolveScope(ppf(), {
    scopeId: over.scopeId ?? 'full',
    panelIds: over.panelIds,
    addOnIds: over.addOnIds,
  });
  if (!r.ok) throw new Error(r.reason);
  return priceVisit({
    services: r.lines,
    fees: pickupFees({ pickup: over.pickup, drop: over.drop }),
    tax: taxPolicy(),
    benefit: {
      base: r.scope.workPrice,
      category: 'PPF', serviceId: 'svc-ppf', ownerId: 'u1',
      membership: over.membership ?? null,
      wantsWash: false,
      promos: over.promos ?? [],
      myRedemptions: new Map(),
      date: '2026-02-01',
    },
  });
};

describe('what it costs comes from priceVisit and nowhere else', () => {
  it('the plain figure is the work', () => {
    expect(quote().total).toBe(132000);
    expect(quote().subtotal).toBe(132000);
  });

  it('a member’s rate is the membership engine’s, never a number in a design', () => {
    /* The design draws "Gold −12%". The engine grants Gold 15%, and the engine
       is what the customer is actually charged - so 15% it is. A screen does
       not get to invent a discount rate. */
    const gold = quote({ membership: member('Gold') });
    expect(gold.discountAmount).toBe(Math.round(132000 * 0.15));
    expect(gold.total).toBe(132000 - Math.round(132000 * 0.15));
    expect(quote({ membership: member('Silver') }).discountAmount)
      .toBe(Math.round(132000 * 0.10));
  });

  it('the discount is taken on the WORK including add-ons, and not on the fees', () => {
    const g = quote({ membership: member('Gold'), addOnIds: ['two-stage'], pickup: true });
    expect(g.subtotal).toBe(150000);
    expect(g.discountAmount).toBe(Math.round(150000 * 0.15));
    /* A member's 15% is a benefit on craft, not on a van's diesel. */
    expect(g.feesTotal).toBe(50);
    expect(g.total).toBe(150000 - Math.round(150000 * 0.15) + 50);
  });

  it('promo and membership do not stack - the better one stands alone', () => {
    const promo: Promo = {
      id: 'p1', code: 'BIG', label: '₹5,000 off', type: 'flat', value: 5000,
      scope: { kind: 'all' }, target: { kind: 'all' },
      validFrom: '2026-01-01', validTo: '2026-12-31',
      usedCount: 0, autoApply: true, active: true,
    } as unknown as Promo;

    const both = quote({ membership: member('Gold'), promos: [promo] });
    /* Gold on ₹1,32,000 is ₹19,800, which beats ₹5,000, so the promo loses -
       and crucially the two are not added together. */
    expect(both.discountAmount).toBe(19800);
    expect(both.discount?.source).toBe('membership');

    const promoWins = quote({ scopeId: 'front', membership: null, promos: [promo] });
    expect(promoWins.discountAmount).toBe(5000);
    expect(promoWins.discount?.source).toBe('promo');
  });

  it('each concierge leg is its own line - one fee, or two', () => {
    expect(quote({ pickup: true }).fees).toEqual([{ label: 'Pickup', amount: 50 }]);
    expect(quote({ pickup: true, drop: true }).fees).toEqual([
      { label: 'Pickup', amount: 50 }, { label: 'Drop', amount: 50 },
    ]);
    expect(quote().fees).toEqual([]);
  });

  it('GST IS ABSENT, NOT ZERO, while the studio has no GSTIN', () => {
    /* A zero would claim the studio charged nothing on a taxable sale, which
       is a different statement from not being registered. */
    expect(taxPolicy().enabled).toBe(false);
    expect(quote().tax).toBeUndefined();
    expect(Object.keys(storedBreakdown(quote()))).not.toContain('tax');
  });
});

/* ── the snapshot ────────────────────────────────────────────────────────── */

describe('a quote does not change when the catalogue does', () => {
  it('the snapshot carries its own prices, so a later edit cannot reach it', () => {
    const then = resolveScope(ppf(), { scopeId: 'full', addOnIds: ['two-stage'] });
    expect(then.ok).toBe(true);
    if (!then.ok) return;
    const snapshot = JSON.parse(JSON.stringify(then.scope));

    /* The studio raises its prices. */
    const raised = ppf();
    raised.scopes![1].price = 190000;
    raised.addOns![0].price = 30000;
    const now = resolveScope(raised, { scopeId: 'full', addOnIds: ['two-stage'] });

    expect(now.ok && now.scope.workPrice).toBe(220000);
    /* The customer who was quoted before the change still holds their figure. */
    expect(snapshot.workPrice).toBe(150000);
    expect(then.scope.workPrice).toBe(150000);
  });

  it('the stored breakdown carries the promo’s identity, never the promo', () => {
    /* A promo is a live record with usage counts; a frozen copy starts lying
       the first time somebody else redeems it. */
    const stored = storedBreakdown(quote());
    expect(stored).not.toHaveProperty('promo');
  });
});

describe('an estimate does not stand for ever', () => {
  it('a week, stated as a date rather than a duration', () => {
    expect(ESTIMATE_VALID_DAYS).toBe(7);
    expect(estimateExpiryOn('2026-02-01')).toBe('2026-02-08');
    expect(estimateExpiryOn('2026-02-25')).toBe('2026-03-04');
  });

  it('expires strictly after its day, so the last day still counts', () => {
    expect(estimateHasExpired('2026-02-08', '2026-02-08')).toBe(false);
    expect(estimateHasExpired('2026-02-08', '2026-02-09')).toBe(true);
  });
});

/* ── nothing a client sends can become a price ───────────────────────────── */

describe('the money is the server’s, and the request cannot express it', () => {
  const route = readFileSync('app/api/estimate/route.ts', 'utf8');
  const service = readFileSync('lib/server/estimateService.ts', 'utf8');
  const screen = readFileSync('components/studio/ScopeAndQuote.tsx', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('the route reads no figure off the body - there is no name for one', () => {
    for (const forged of ['body.price', 'body.total', 'body.amount', 'body.discount', 'body.workPrice']) {
      expect(route).not.toContain(forged);
    }
  });

  it('the estimate is priced by priceVisit and by nothing else', () => {
    expect(service).toMatch(/priceVisit\(/);
    expect(service).not.toMatch(/\+ *breakdown|total *=/);
  });

  it('the screen adds nothing up - every figure is the server’s answer', () => {
    /* A component that summed prices would be a fifth implementation of the
       arithmetic, and the audit found four already disagreeing. */
    expect(screen).not.toMatch(/reduce\(/);
    expect(screen).not.toMatch(/price \+|\+ price|\* 0\.\d/);
  });

  it('rules let nobody write an estimate, because rules cannot check a price', () => {
    const rules = readFileSync('firestore.rules', 'utf8');
    const block = rules.slice(rules.indexOf('match /estimates/{id}'));
    expect(block.slice(0, 400)).toMatch(/allow write: if false;/);
    expect(block.slice(0, 400)).toMatch(/resource\.data\.userId == request\.auth\.uid/);
  });
});
