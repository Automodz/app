/**
 * Every room renders its projected model without throwing, and no ops
 * vocabulary reaches the markup.
 *
 * The projections are unit-tested next door; this proves the screens actually
 * consume what the projections produce — the seam that a type can describe and
 * still get wrong.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { Timestamp } from 'firebase/firestore';
import type { Booking, Job, Protection, Service, Subscription, User, Vehicle } from '@/lib/types';
import type { CarPicture, CustomerPicture } from '@/lib/customer/source';
import {
  toHome, toGarage, toVehicle, toVehiclePhotograph, toHistory, toVisit,
  toStudio, toYou, toMembership, visitsOf, leadCar,
} from '@/lib/customer/project';
import { HomeScreen } from '@/components/screens/HomeScreen';
import { GarageScreen } from '@/components/screens/GarageScreen';
import { VehicleScreen } from '@/components/screens/VehicleScreen';
import { HistoryScreen } from '@/components/screens/HistoryScreen';
import { VisitScreen } from '@/components/screens/VisitScreen';
import { StudioScreen } from '@/components/screens/StudioScreen';
import { YouScreen } from '@/components/screens/YouScreen';
import { MembershipScreen } from '@/components/screens/MembershipScreen';
import { photograph } from '@/components/vehicle';

const ts = (iso: string) => Timestamp.fromDate(new Date(iso));

const vehicle: Vehicle = {
  id: 'v1', name: 'Skoda Superb', registrationNumber: 'GJ 01 KP 4471',
  photo: 'https://example.test/car.jpg',
  createdAt: ts('2023-03-01T10:00:00Z'),
};

const booking: Booking = {
  id: 'b1', userId: 'u1', vehicleId: 'v1', vehicleName: 'Skoda Superb',
  vehicleRegNo: 'GJ01KP4471', serviceId: 's1', serviceName: 'Ceramic coating',
  serviceCategory: 'Ceramic', servicePrice: 64000, totalAmount: 64000,
  scheduledDate: '2026-07-18', scheduledTime: '10:00', status: 'completed',
  createdAt: ts('2026-07-18T09:00:00Z'),
} as unknown as Booking;

const job = {
  id: 'j1', bookingId: 'b1',
  photos: [
    { url: 'https://example.test/before.jpg', kind: 'before' },
    { url: 'https://example.test/after.jpg', kind: 'after' },
  ],
  statusHistory: [],
  createdAt: ts('2026-07-18T09:00:00Z'),
} as unknown as Job;

const protection: Protection = {
  id: 'p1', vehicleId: 'v1', kind: 'ceramic', since: '2026-07-18',
  term: { kind: 'dated', expiresOn: '2029-03-01' },
  termsSource: 'captured', createdAt: ts('2026-07-18T09:00:00Z'), updatedAt: ts('2026-07-18T09:00:00Z'),
};

const subscription = {
  id: 'sub1', userId: 'u1', plan: 'Gold', status: 'active',
  startDate: '2026-07-01', endDate: '2026-08-14', washesTotal: 8, washesUsed: 6,
} as Subscription;

/* A SEALED visit, because the Booking+Job fallback is gone: §16.1 is "every
   completed visit" and §22.5 forbids recomputing one from a mutable catalogue. */
const sealedVisit = {
  id: 'v-1', vehicleId: 'v1', status: 'sealed', bookingId: 'b1', jobId: 'j1',
  services: [{ serviceId: 's1', name: 'Ceramic coating', category: 'Ceramic', price: 64000 }],
  amounts: { subtotal: 64000, discount: 0, total: 64000 },
  stages: [{
    stage: 'ready', at: ts('2026-07-18T17:00:00Z'),
    note: 'Two-stage correction, then the coat. Cured overnight.', media: [],
  }],
  termsCaptured: [{
    kind: 'ceramic', term: { kind: 'dated', expiresOn: '2029-03-01' }, source: 'captured',
  }],
  createdAt: ts('2026-07-18T09:00:00Z'),
};

const car: CarPicture = {
  vehicle, protections: [protection],
  visits: [sealedVisit] as never, bookings: [booking], jobs: [job],
};

const picture: CustomerPicture = {
  user: { uid: 'u1', name: 'Meera Shah', email: 'meera@example.test', phone: '+91 90000 00000', role: 'customer' } as User,
  cars: [car], subscription, subscriptions: [subscription], invoices: [], catalogue: [] as Service[],
};

/** Ops vocabulary that must never reach a customer surface (§5.5, §21.8, §2.2). */
const FORBIDDEN = [
  'in_progress', 'quality_check', 'vehicle_received', 'ready_for_delivery',
  'checked_in', 'serviceCategory', 'bookingId', 'vehicleRegNo',
  'applied by', 'technician',
];

function assertClean(html: string, label: string) {
  for (const word of FORBIDDEN) {
    expect(html.toLowerCase()).not.toContain(word.toLowerCase());
  }
  /* `undefined` and `NaN` are checked case-SENSITIVELY and word-bounded: those
     are the exact spellings JS coercion produces, and lowercasing them matches
     ordinary words — "maninagar" contains "nan". */
  expect(html).not.toMatch(/\bundefined\b/);
  expect(html).not.toMatch(/\bNaN\b/);
  expect(html.length).toBeGreaterThan(200);
  expect(html).not.toContain('[object Object]');
  // exactly one Display per screen (§9.5)
  expect((html.match(/<h1/g) ?? []).length).toBeLessThanOrEqual(1);
  void label;
}

it('Home renders the projected model', () => {
  const html = renderToStaticMarkup(<HomeScreen model={toHome(picture)!} />);
  assertClean(html, 'home');
  expect(html).toContain('Skoda Superb');
  expect(html).toContain('GJ 01 KP 4471');
  expect(html).toContain('Ceramic coating');
  expect(html).toContain('Membership');
});

it('Garage renders every car', () => {
  const html = renderToStaticMarkup(<GarageScreen model={toGarage(picture)} />);
  assertClean(html, 'garage');
  expect(html).toContain('Skoda Superb');
  expect(html).toContain('with AutoModz since 2023');
});

it('Garage with no cars renders the invitation, not an empty strip', () => {
  const html = renderToStaticMarkup(<GarageScreen model={toGarage({ ...picture, cars: [] })} />);
  expect(html).toContain('place is ready');
});

it('Vehicle renders through the renderer boundary', () => {
  const rendering = photograph(toVehiclePhotograph(car));
  const html = renderToStaticMarkup(
    <VehicleScreen model={toVehicle(car, picture)} rendering={rendering} />,
  );
  assertClean(html, 'vehicle');
  expect(html).toContain('GJ 01 KP 4471');
  /* No regions are authored yet, so the car cannot be asked about itself and no
     mark is drawn (§18.1). */
  expect(html).not.toContain('aria-pressed');
});

/**
 * NO ROOM SHIPS A DEAD CONTROL.
 *
 * §10.5 — "if there is no destination yet, there is no control yet" — is
 * guarded at runtime in `Button`, and the guard only writes to the console in
 * development, where a dozen identical lines across seven rooms is a warning
 * nobody can act on. Rendering every screen here turns it into a failing test
 * that names the control.
 */
it('no screen renders a button that does nothing', () => {
  const rendering = photograph(toVehiclePhotograph(car));
  const screens: [string, React.ReactElement][] = [
    ['Home', <HomeScreen model={toHome(picture)!} />],
    ['Garage', <GarageScreen model={toGarage(picture)} />],
    ['Vehicle', <VehicleScreen model={toVehicle(car, picture)} rendering={rendering} />],
    ['History', <HistoryScreen model={toHistory(car, picture.invoices)} />],
    ['Visit', <VisitScreen visit={toVisit(visitsOf(car)[0], car)} />],
    ['Studio', <StudioScreen model={toStudio(picture)} />],
    /* `onSignOut` is how the room actually receives it — see YouRoom. Rendered
       without it, the guard would fire on the harness rather than on the
       product. */
    ['You', <YouScreen model={toYou(picture)} onSignOut={() => {}} />],
    ['Membership', <MembershipScreen model={toMembership(picture)} />],
  ];

  const inert: string[] = [];
  const real = console.error;
  console.error = (...args: unknown[]) => {
    const first = String(args[0] ?? '');
    if (first.includes('[Button]')) inert.push(first);
  };
  try {
    for (const [, node] of screens) renderToStaticMarkup(node);
  } finally {
    console.error = real;
  }

  expect(inert).toEqual([]);
});

it('Vehicle says what the car has coming, and how to change it', () => {
  /* The room named the car's STATE — "Booked in" — and then said nothing about
     when, what for, or how to change it. A customer looking at their own car
     had to go to the Studio and find this visit among every other car's. */
  const model = toVehicle(car, picture);
  const html = renderToStaticMarkup(
    <VehicleScreen model={model} rendering={photograph(toVehiclePhotograph(car))} />,
  );
  assertClean(html, 'vehicle-next');
  if (model.next) {
    expect(html).toContain(model.next.service);
    expect(html).toContain(model.next.when);
  } else {
    /* §18.1 — nothing booked is an invitation, and the invitation is the act. */
    expect(html).toContain('Nothing booked');
    expect(html).toContain(model.arrangeHref);
  }
});

it('Vehicle never offers an act the server would refuse', () => {
  /* `manageHref` mirrors firestore.rules — pending or confirmed only — the
     same rule `toStudio`'s `manageable` uses. A car whose visit has started
     must not be offered "change or cancel". */
  const model = toVehicle(car, picture);
  const html = renderToStaticMarkup(
    <VehicleScreen model={model} rendering={photograph(toVehiclePhotograph(car))} />,
  );
  if (model.next && !model.next.manageHref) {
    expect(html).not.toContain('Change or cancel');
  }
});

it('History renders the album', () => {
  const html = renderToStaticMarkup(<HistoryScreen model={toHistory(car, picture.invoices)} />);
  assertClean(html, 'history');
  expect(html).toContain('18 July 2026');
  expect(html).toContain('Ceramic coating');
});

it('History states what the record adds up to', () => {
  /* §16.1 calls this "a series of transformations", and a series has a shape.
     The room used to show none of it — a customer scrolled photographs with no
     idea how many visits there had been or how long their car had been cared
     for here, though every one of those facts was already in the model. */
  const model = toHistory(car, picture.invoices);
  const html = renderToStaticMarkup(<HistoryScreen model={model} />);
  expect(model.count).toBe(model.visits.length);
  expect(html).toContain(model.count === 1 ? 'One visit' : `${model.count} visits`);
  expect(html).toContain('cared for here since');
});

it('History is never a blank screen', () => {
  /* THE HOLE THIS CLOSES. §18.1 says a car with no completed visits has no
     History SECTION, which is right for a section inside another room. This is
     a ROOM with its own address in the navigation bar: a customer who tapped
     History before their first visit was handed an empty black screen with
     nothing on it whatsoever. §19.1 — an absence is not a state. */
  const empty = { ...toHistory(car, picture.invoices), visits: [], count: 0, since: undefined, settledTotal: undefined };
  const html = renderToStaticMarkup(<HistoryScreen model={empty} />);
  assertClean(html, 'history-empty');
  expect(html).toContain('Nothing written yet');
  /* And it offers the act that begins a record, rather than describing it. */
  expect(html).toContain('/studio?arrange=1');
  /* The empty room keeps the one Display it is now allowed to spend. */
  expect((html.match(/<h1/g) ?? []).length).toBe(1);
});

it('one visit renders its account with the money as one line', () => {
  const visit = visitsOf(car)[0];
  const html = renderToStaticMarkup(<VisitScreen visit={toVisit(visit, car)} />);
  assertClean(html, 'visit');
  expect(html).toContain('64,000');
  expect(html).not.toContain('<table');
});

it('Studio renders the place with no price and no named person', () => {
  const html = renderToStaticMarkup(<StudioScreen model={toStudio(picture)} />);
  assertClean(html, 'studio');
  expect(html).toContain('Maninagar');
  expect(html).not.toMatch(/₹/);
  /* §10.5 — the primary action must not point at the Studio's own address. */
  expect(html).not.toContain('href="/studio"');
  /* RESTORED: this used to assert `wa.me`, which pinned a WORKAROUND — the
     studio had no in-app booking surface, so the most important control in the
     product handed the customer to another application. Arranging a visit now
     happens here, so the control is a real button and not a link out. */
  expect(html).not.toContain('wa.me');
  expect(html).toContain('Arrange a visit');
  /* Matched on the ELEMENT, not on attribute adjacency. This read
     `<button type="button"` and broke the moment `Button` gained a class for
     its press feedback — the attribute order changed, the meaning did not. */
  expect(html).toMatch(/<button[^>]*type="button"/);
});

it('You renders identity with no avatar and no form', () => {
  const html = renderToStaticMarkup(<YouScreen model={toYou(picture)} onSignOut={() => {}} />);
  assertClean(html, 'you');
  expect(html).toContain('Meera Shah');
  expect(html).toContain('One car lives here.');
  expect(html).not.toContain('<input');
  expect(html).not.toContain('<img');
  /* Sign out is an ACTION, never a link to the sign-in page. */
  expect(html).toContain('Sign out');
  expect(html).not.toContain('href="/auth/login"');
  /* §10.5 — no control may point at the address it is already on. */
  expect(html).not.toContain('href="/you"');
});

it('Membership renders the three facts, and the invitation when unheld', () => {
  const held = renderToStaticMarkup(<MembershipScreen model={toMembership(picture)} />);
  assertClean(held, 'membership');
  expect(held).toContain('Gold member');
  expect(held).toContain('2 of 8 washes left this cycle');

  const none = renderToStaticMarkup(
    <MembershipScreen model={toMembership({ ...picture, subscription: null })} />,
  );
  expect(none).toContain('not a member');
});

it('a brand-new customer with one unphotographed car renders every room', () => {
  const bare: CustomerPicture = {
    ...picture,
    subscription: null, subscriptions: [], invoices: [],
    cars: [{
      vehicle: { id: 'v9', name: 'Tata Nexon', registrationNumber: 'GJ 01 ZZ 9999', createdAt: ts('2026-07-29T10:00:00Z') },
      protections: [], visits: [], bookings: [], jobs: [],
    }],
  };
  const one = leadCar(bare)!;
  for (const html of [
    renderToStaticMarkup(<HomeScreen model={toHome(bare)!} />),
    renderToStaticMarkup(<GarageScreen model={toGarage(bare)} />),
    renderToStaticMarkup(<VehicleScreen model={toVehicle(one, bare)} rendering={photograph(toVehiclePhotograph(one))} />),
    renderToStaticMarkup(<HistoryScreen model={toHistory(one, [])} />),
    renderToStaticMarkup(<StudioScreen model={toStudio(bare)} />),
    renderToStaticMarkup(<YouScreen model={toYou(bare)} onSignOut={() => {}} />),
    renderToStaticMarkup(<MembershipScreen model={toMembership(bare)} />),
  ]) {
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('[object Object]');
  }
});
