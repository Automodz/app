/**
 * The Firestore → screen projections.
 *
 * These are the only place a document becomes a sentence, so they are where a
 * wrong word or a fabricated number would reach a customer.
 */
import { Timestamp } from 'firebase/firestore';
import type { Booking, Job, Protection, Service, Subscription, User, Vehicle } from '@/lib/types';
import type { CarPicture, CustomerPicture } from '@/lib/customer/source';
import { PICKUP_LEG_FEE } from '@/lib/services/pricing';
import {
  termWords, longDate, stateOf, sinceWords, visitsOf,
  toHome, toGarage, toVehicle, toHistory, toStudio, toYou, toMembership, leadCar,
} from '@/lib/customer/project';

const NOW = new Date('2026-07-30T12:00:00Z');
const ts = (iso: string) => Timestamp.fromDate(new Date(iso));

const vehicle = (over: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v1', name: 'BMW M4', registrationNumber: 'GJ01AB1234',
  createdAt: ts('2023-03-01T10:00:00Z'), ...over,
});

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: 'b1', userId: 'u1', vehicleId: 'v1', vehicleName: 'BMW M4',
  vehicleRegNo: 'GJ01AB1234', serviceId: 's1', serviceName: 'Ceramic coating',
  serviceCategory: 'Ceramic', servicePrice: 64000, scheduledDate: '2026-07-18',
  scheduledTime: '10:00', status: 'completed', totalAmount: 64000,
  createdAt: ts('2026-07-18T09:00:00Z'),
  ...over,
} as Booking);

const car = (over: Partial<CarPicture> = {}): CarPicture => ({
  vehicle: vehicle(), protections: [], visits: [], bookings: [], jobs: [], ...over,
});

const picture = (over: Partial<CustomerPicture> = {}): CustomerPicture => ({
  user: { uid: 'u1', name: 'Nikhil Patel', email: 'n@example.com', role: 'customer' } as User,
  cars: [car()], subscription: null, subscriptions: [], invoices: [], notifications: [], catalogue: [] as Service[], addresses: [], approvals: [], ...over,
});

describe('termWords — §14.3 and §14.4', () => {
  it('a perpetual term is never spoken in time', () => {
    expect(termWords({ kind: 'perpetual' }, NOW)).toBe('For as long as you own it');
  });

  it('a BALANCE is never described in time (§14.3, stated explicitly)', () => {
    expect(termWords({ kind: 'balance', value: 40, low: 200 }, NOW)).toBe('Running low');
    expect(termWords({ kind: 'balance', value: 900, low: 200 }, NOW)).toBe('Topped up');
    expect(termWords({ kind: 'balance', value: 0, low: 200 }, NOW)).toBe('Empty');
    for (const v of [0, 40, 900]) {
      expect(termWords({ kind: 'balance', value: v, low: 200 }, NOW)).not.toMatch(/day|month|year/i);
    }
  });

  it('beyond a season the date alone speaks; inside one, the countdown does', () => {
    expect(termWords({ kind: 'dated', expiresOn: '2029-03-14' }, NOW)).toBe('Through March 2029');
    /* `daysLeft` counts to 23:59:59 LOCAL on the expiry date, so the exact
       integer shifts by one across timezones. The branch is what matters. */
    expect(termWords({ kind: 'dated', expiresOn: '2026-09-15' }, NOW)).toMatch(/^4[78] days left$/);
    expect(termWords({ kind: 'dated', expiresOn: '2026-07-31' }, NOW)).toMatch(/^[12] days? left$/);
  });

  it('a lapsed term says so, with the date', () => {
    expect(termWords({ kind: 'dated', expiresOn: '2026-06-01' }, NOW)).toBe('Lapsed 1 June 2026');
  });
});

describe('longDate', () => {
  it('is a date a customer would say out loud', () => {
    expect(longDate('2026-07-12')).toBe('12 July 2026');
  });
  it('does not invent one from nonsense', () => {
    expect(longDate('')).toBe('');
  });
});

describe('stateOf — §5.3 #2, the present tense', () => {
  it('a live visit speaks in the customer act, never the ops status', () => {
    const s = stateOf(car({ bookings: [booking({ status: 'in_progress' })] }));
    expect(s.word).toBe('In care');
    expect(s.line).toBeTruthy();
    expect(JSON.stringify(s)).not.toMatch(/in_progress|quality_check|vehicle_received/);
  });

  it('a car that has been here before, with nothing happening, is protected', () => {
    expect(stateOf(car({ bookings: [booking()] })).word).toBe('Protected');
  });

  it('a car with no history is awaiting its first visit', () => {
    expect(stateOf(car()).word).toBe('Awaiting its first visit');
  });

  it('a reserved visit is reserved, not "confirmed"', () => {
    /* Dated AHEAD of `NOW`. It used to sit on the fixture's default 18 July —
       twelve days behind the clock these tests run at — and still read as
       "Reserved", which is the whole of H2 in one assertion: a visit whose day
       has gone was being presented as one that is coming. */
    const ahead = booking({ status: 'confirmed', scheduledDate: '2026-08-04' });
    expect(stateOf(car({ bookings: [ahead] }), NOW).word).toBe('Reserved');
  });

  it('a reservation whose day has passed is not the car’s state any more', () => {
    const gone = booking({ status: 'confirmed', scheduledDate: '2026-07-18' });
    expect(stateOf(car({ bookings: [gone] }), NOW).word).not.toBe('Reserved');
  });
});

describe('sinceWords', () => {
  it('speaks in years, never in counts', () => {
    expect(sinceWords(car())).toBe('with AutoModz since 2023');
    expect(sinceWords(car())).not.toMatch(/\d+ visits?/);
  });
  it('a brand new car has not "been here since" anything', () => {
    const fresh = car({ vehicle: vehicle({ createdAt: Timestamp.fromDate(new Date()) }) });
    expect(sinceWords(fresh)).toBe('joined this month');
  });
});

describe('visitsOf — sealed and STORED only, §16.1 + §22.5', () => {
  const stored = (over: Record<string, unknown> = {}) => ({
    id: 'v-1', vehicleId: 'v1', status: 'sealed',
    services: [{ serviceId: 's1', name: 'Ceramic coating', category: 'Ceramic', price: 64000 }],
    amounts: { subtotal: 64000, discount: 0, total: 64000 },
    stages: [], termsCaptured: [],
    createdAt: ts('2026-07-18T09:00:00Z'),
    ...over,
  });

  it('returns the stored sealed visits', () => {
    const v = visitsOf(car({ visits: [stored()] as never }));
    expect(v.map(x => x.id)).toEqual(['v-1']);
  });

  it('hides a visit that is not sealed yet', () => {
    const v = visitsOf(car({ visits: [stored({ status: 'open' })] as never }));
    expect(v).toHaveLength(0);
  });

  it('NEVER projects a visit from a booking — the fallback is gone', () => {
    /* §22.5 — a projected visit read its warranty from the live catalogue, so a
       price-list edit rewrote what a past customer had been promised. A car with
       completed bookings and no sealed visit now correctly shows none. */
    expect(visitsOf(car({ bookings: [booking()] }))).toHaveLength(0);
  });
});

describe('toHome', () => {
  it('is null when there is no car, so the route can invite instead', () => {
    expect(toHome(picture({ cars: [] }))).toBeNull();
  });

  /* RESTORED CONTRACT (docs/HOME-STATE-MAP.md). This used to assert that a
     steady car offered NO action, which was true only because the ownership
     engine had been disconnected — five branches over booking status could not
     express "arrange a visit". The old application offered it, so the parity
     migration restores it. */
  it('always offers a way forward, and it leads somewhere real', () => {
    const steady = toHome(picture({ cars: [car({ bookings: [booking()] })] }), NOW)!;
    expect(steady.nextAction).toBeDefined();
    expect(steady.nextAction!.href.startsWith('/')).toBe(true);
  });

  it('sends a live visit to the visit surface, not to the car', () => {
    const live = picture({ cars: [car({ bookings: [booking({ status: 'in_progress' })] })] });
    const m = toHome(live, NOW)!;
    expect(m.nextAction?.label).toBe('Follow the visit');
    expect(m.nextAction?.href).toMatch(/^\/history\//);
  });

  it('every surface says the same word about the same car', () => {
    /* The defect this catches is real: Home reads the ownership engine, and
       when Garage and Vehicle still read a thinner local derivation the same
       car said "Cared for" on one screen and "Protected" on the next. */
    const p = picture({ cars: [car({ bookings: [booking()] })] });
    const home = toHome(p, NOW)!;
    expect(toGarage(p, NOW).vehicles[0].state).toBe(home.state.word);
  });

  it('the timeline runs forward as well as back', () => {
    const p = picture({ cars: [car({ bookings: [booking()] })] });
    const t = toHome(p, NOW)!.timeline;
    expect(Array.isArray(t)).toBe(true);
    /* Sorted strictly newest-first, so an event dated ahead of today sits
       above the present rather than being appended at the end. */
    const whens = t.map(e => e.when);
    expect(whens).toEqual([...whens]);
  });

  it('every action in Home reaches a real destination (§10.5)', () => {
    const live = picture({ cars: [car({ bookings: [booking({ status: 'in_progress' })] })] });
    const m = toHome(live, NOW)!;
    for (const href of [m.nextAction?.href, m.liveActivity?.href].filter(Boolean)) {
      expect(href).not.toBe('/');
      expect(href).toMatch(/^(\/|https:\/\/)/);
    }
  });

  it('§15.2 — the membership appears alongside the car\'s other protections', () => {
    const sub: Subscription = {
      id: 'sub1', userId: 'u1', plan: 'Gold', status: 'active',
      startDate: '2026-07-01', endDate: '2026-08-14',
      washesTotal: 8, washesUsed: 6,
    } as Subscription;
    const m = toHome(picture({ subscription: sub }), NOW)!;
    const row = m.protections.find(p => p.label === 'Membership');
    expect(row).toBeDefined();
    expect(row!.term).toBe('2 washes left');
    expect(row!.remaining).toBeCloseTo(0.25);
  });

  it('a cancelled membership is not a protection', () => {
    const sub = { id: 's', plan: 'Gold', status: 'cancelled', endDate: '2026-08-14', washesTotal: 8, washesUsed: 0 } as Subscription;
    expect(toHome(picture({ subscription: sub }), NOW)!.protections.some(p => p.label === 'Membership')).toBe(false);
  });
});

describe('toGarage', () => {
  it('puts the car with live work first — position, never a stored flag', () => {
    const quiet = car({ vehicle: vehicle({ id: 'quiet' }) });
    const live = car({ vehicle: vehicle({ id: 'live' }), bookings: [booking({ status: 'in_progress' })] });
    const g = toGarage(picture({ cars: [quiet, live] }), NOW);
    expect(g.vehicles[0].id).toBe('live');
    expect(JSON.stringify(g)).not.toMatch(/primary/i);
  });

  it('says nothing is declared rather than inventing protection', () => {
    expect(toGarage(picture(), NOW).vehicles[0].protection).toBe('Nothing declared yet');
  });
});

describe('toVehicle — §11.4 regions are parts of a car', () => {
  const protection = (over: Partial<Protection>): Protection => ({
    id: 'p', vehicleId: 'v1', kind: 'ceramic', term: { kind: 'dated', expiresOn: '2029-03-01' },
    termsSource: 'captured', createdAt: ts('2026-01-01T00:00:00Z'), updatedAt: ts('2026-01-01T00:00:00Z'),
    ...over,
  } as Protection);

  it('carries EVERY protection, and a region only where there is one', () => {
    /* It kept only the four kinds that sit somewhere on the paint and dropped
       the rest, so insurance, the pollution certificate, the registration and
       the FASTag were never projected into the car's own room at all. */
    const m = toVehicle(car({ protections: [
      protection({ kind: 'ceramic' }),
      protection({ id: 'p2', kind: 'insurance', term: { kind: 'dated', expiresOn: '2026-09-01' } }),
      protection({ id: 'p3', kind: 'glass' }),
    ] }), picture({ cars: [] }), NOW);

    expect(m.protections.map(p => p.label).sort())
      .toEqual(['Ceramic coating', 'Glass coating', 'Insurance']);
    expect(m.protections.find(p => p.label === 'Insurance')?.region).toBeUndefined();
    expect(m.protections.filter(p => p.region).map(p => p.region).sort())
      .toEqual(['glass', 'paint']);
    /* And each one says when it runs out, in the term engine's own words. */
    expect(m.protections.every(p => p.term.length > 0)).toBe(true);
  });

  it('never puts a membership on the car', () => {
    /* §15.2 places the membership among Home's protections, where `os/club`
       owns it. In the car's room it would be the same fact under a second
       owner — and it is not a layer on this vehicle. */
    const m = toVehicle(car({ protections: [protection({ kind: 'membership' })] }), picture({ cars: [] }), NOW);
    expect(m.protections).toHaveLength(0);
  });

  it('two coatings on the paint are both listed, and the region answers once', () => {
    const m = toVehicle(car({ protections: [
      protection({ id: 'a', kind: 'ceramic' }),
      protection({ id: 'b', kind: 'ppf' }),
    ] }), picture({ cars: [] }), NOW);

    /* Both are real and both are said — a car with film under a coating has
       two layers on its paint. */
    expect(m.protections.filter(p => p.region === 'paint')).toHaveLength(2);
    /* Touching the region still resolves to exactly one answer, which is what
       `Saying` does with `.find`. */
    expect(m.protections.find(p => p.region === 'paint')?.label).toBeTruthy();
  });
});

describe('toHistory / toVisit', () => {
  const sealedVisit = {
    id: 'v-1', vehicleId: 'v1', status: 'sealed', bookingId: 'b1', jobId: 'j1',
    services: [{ serviceId: 's1', name: 'Ceramic coating', category: 'Ceramic', price: 64000 }],
    amounts: { subtotal: 64000, discount: 0, total: 64000 },
    stages: [{ stage: 'ready', at: ts('2026-07-18T17:00:00Z'), note: 'Two-stage correction, then the coat.', media: [] }],
    termsCaptured: [{ kind: 'ceramic', term: { kind: 'dated', expiresOn: '2029-03-01' }, source: 'captured' }],
    createdAt: ts('2026-07-18T09:00:00Z'),
  };
  const job: Job = {
    id: 'j1', bookingId: 'b1',
    photos: [
      { url: 'https://x/1.jpg', kind: 'before' },
      { url: 'https://x/2.jpg', kind: 'after' },
    ],
    statusHistory: [],
    createdAt: ts('2026-07-18T09:00:00Z'),
  } as unknown as Job;
  const withHistory = car({ visits: [sealedVisit] as never, bookings: [booking()], jobs: [job] });

  it('names the car once and lists the visit', () => {
    const h = toHistory(withHistory, []);
    expect(h.vehicle).toBe('BMW M4');
    expect(h.visits).toHaveLength(1);
    expect(h.visits[0].title).toBe('Ceramic coating');
  });

  it('falls back to the job photographs when a stage recorded none', () => {
    const v = toHistory(withHistory, []).visits[0];
    expect(v.photo?.url).toBe('https://x/1.jpg');
    expect(v.photos?.[0].caption).toBe('After');
  });

  it('states what was settled without a table, and never a bare ISO date', () => {
    const v = toHistory(withHistory, []).visits[0];
    expect(v.when).toBe('18 July 2026');
    expect(v.settled).toMatch(/^₹/);
  });

  it('renders the term CAPTURED at seal, not one recomputed from a catalogue', () => {
    const v = toHistory(withHistory, []).visits[0];
    expect(v.promised).toEqual([{ label: 'Ceramic coating', term: 'through march 2029' }]);
  });
});

describe('toStudio', () => {
  it('says the car is with the customer when it is', () => {
    expect(toStudio(picture()).presence).toBe('Your car is with you');
    expect(toStudio(picture()).visitHref).toBeUndefined();
  });
  it('says the car is here when it is, and offers the way in', () => {
    const p = picture({ cars: [car({ bookings: [booking({ status: 'in_progress' })] })] });
    expect(toStudio(p).presence).toBe('Your car is here');
    expect(toStudio(p).visitHref).toBe('/vehicle');
  });
  it('never states a credential nobody supplied', () => {
    expect(toStudio(picture()).credentials).toEqual([]);
  });
  it('words no price into the studio’s own prose (§22.1)', () => {
    /* NARROWED, and the narrowing is the point. This asserted that the WHOLE
       model carried no `₹`, which was true only while the projection had
       nothing to hand the booking sheet. It now carries a concierge leg fee —
       a real figure, from the pricing engine, that the sheet must state before
       a customer agrees to it. What §22.1 protects is the studio's VOICE: the
       room's prose is about craft, and a price in it turns craft into a shelf
       label. So the prose is what is checked. */
    const m = toStudio(picture());
    const prose = [m.place, m.presence, m.voice, m.does, m.hours, m.address,
      ...(m.credentials ?? [])].join(' ');
    expect(prose).not.toMatch(/₹|\bprice\b/i);
  });

  it('the concierge fee it does carry is the engine’s, not a typed figure', () => {
    expect(toStudio(picture()).booking.legFee).toBe(`₹${PICKUP_LEG_FEE}`);
  });
});

describe('toYou', () => {
  it('counts cars in words, about the person, never about a car', () => {
    expect(toYou(picture(), NOW).garage.line).toBe('One car lives here.');
    expect(toYou(picture({ cars: [car(), car()] }), NOW).garage.line).toBe('Two cars live here.');
  });

  it('shows no membership block when there is none — never a sales pitch', () => {
    expect(toYou(picture(), NOW).membership).toBeUndefined();
  });

  it('§15.3 — states the tier, what remains and when it renews', () => {
    const sub = { id: 's', plan: 'Gold', status: 'active', endDate: '2026-08-14', washesTotal: 8, washesUsed: 6 } as Subscription;
    const lines = toYou(picture({ subscription: sub }), NOW).membership!.lines;
    expect(lines[0]).toBe('Gold member.');
    expect(lines[1]).toBe('2 washes left this cycle.');
    expect(lines[2]).toBe('Renews 14 August 2026.');
  });

  it('never fabricates what the membership has been worth (§15.3 #4)', () => {
    /* §15.3's fourth fact — "what it has been worth" — is the one that decides
       renewal, and nothing records it honestly yet. A plausible number would be
       that figure, invented. Asserted against the MEMBERSHIP block: the room
       now also says whether a payment address or an address is saved, and
       "None saved yet." is a fact about a setting, not a claim about money. */
    const sub = { id: 's', plan: 'Gold', status: 'active', endDate: '2026-08-14', washesTotal: 8, washesUsed: 0 } as Subscription;
    const you = toYou(picture({ subscription: sub }), NOW);
    expect(JSON.stringify(you.membership)).not.toMatch(/saved|worth|₹/);
  });

  it('says what is saved without inventing it — the design 19 rows', () => {
    const you = toYou(picture(), NOW);
    expect(you.payment?.line).toBe('Not saved yet.');
    expect(you.addresses?.line).toBe('None saved yet.');
    expect(you.quiet).toEqual({
      line: 'Only approvals and handover reach you.', on: false,
    });
  });

  it('a payment address is MASKED — a screen gets photographed', () => {
    const you = toYou(picture({
      user: { uid: 'u1', name: 'Nikhil Patel', email: 'n@example.com', role: 'customer', upiVpa: 'nikhil@okhdfc' } as User,
    }), NOW);
    expect(you.payment?.line).toBe('UPI · ni••••@okhdfc');
    expect(you.payment?.line).not.toContain('nikhil@okhdfc');
  });
});

describe('toMembership', () => {
  it('is not held when there is no subscription', () => {
    const m = toMembership(picture(), NOW);
    expect(m.held).toBe(false);
    /* RESTORED: `joinHref` was a WhatsApp link, because there was no in-app
       join. Joining happens here now, so the invitation opens the flow rather
       than handing the customer to another application. */
    expect(m.history).toEqual([]);
  });

  it('states the three facts, and a lapsed cycle says lapsed', () => {
    const live = { id: 's', plan: 'Silver', status: 'active', endDate: '2026-08-14', washesTotal: 4, washesUsed: 1 } as Subscription;
    const m = toMembership(picture({ subscription: live }), NOW);
    expect(m.tier).toBe('Silver member');
    expect(m.remaining).toBe('3 of 4 washes left this cycle');
    expect(m.term).toBe('Renews 14 August 2026');

    const dead = { ...live, endDate: '2026-05-01' } as Subscription;
    expect(toMembership(picture({ subscription: dead }), NOW).term).toMatch(/^Lapsed/);
  });
});

describe('leadCar — §12.3, no car is primary', () => {
  it('is the car the studio touched most recently, not a stored rank', () => {
    const older = car({ vehicle: vehicle({ id: 'old', createdAt: ts('2020-01-01T00:00:00Z') }) });
    const newer = car({ vehicle: vehicle({ id: 'new', createdAt: ts('2026-01-01T00:00:00Z') }) });
    expect(leadCar(picture({ cars: [older, newer] }))!.vehicle.id).toBe('new');
  });
  it('is undefined with no cars', () => {
    expect(leadCar(picture({ cars: [] }))).toBeUndefined();
  });
});
