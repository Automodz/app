/**
 * THE RECORD KNOWS WHICH CAR IT IS ABOUT.
 *
 * Three addresses showed the record - `/history`, `/history?car=<id>` and
 * `/history/<visitId>` - and each resolved the subject for itself. The answers
 * did not agree:
 *
 *   · the album fell back to `leadCar` whenever the query was absent, so a
 *     customer who had been reading the BMW's visits saw the Kia's under the
 *     same heading, with nothing on screen to say the subject had changed
 *   · a visit page never learned which car it belonged to at all, so it had no
 *     context to hand to the control that leaves it
 *
 * One resolver now answers for all three. Ownership is `vehicleId` - never a
 * registration number, which is a label a customer retypes and two people can
 * share.
 */
import { Timestamp } from 'firebase/firestore';
import type { Booking, Protection, Service, User, Vehicle, Visit } from '@/lib/types';
import type { CarPicture, CustomerPicture } from '@/lib/customer/source';
import { historyContextOf, carOfContext } from '@/lib/customer/project';

const ts = (iso: string) => Timestamp.fromDate(new Date(iso));
const NOW = new Date('2026-02-12T08:00:00+05:30');

const vehicle = (id: string, name: string, reg: string) => ({
  id, name, registrationNumber: reg, createdAt: ts('2024-03-04T00:00:00Z'),
} as unknown as Vehicle);

const visit = (id: string, vehicleId: string, on: string) => ({
  id, vehicleId, userId: 'u1', bookingId: `bk-${id}`, status: 'sealed',
  servicedOn: on, serviceName: 'Ceramic coating',
  services: [{ serviceId: 'svc-cer', name: 'Ceramic coating', price: 32000 }],
  stages: [{ stage: 'ready', at: ts(`${on}T12:00:00Z`) }],
  sealedAt: ts(`${on}T12:30:00Z`), amounts: { total: 32000 },
} as unknown as Visit);

const booking = (id: string, vehicleId: string, status: string) => ({
  id, userId: 'u1', vehicleId, vehicleName: 'x', serviceId: 'svc-cer',
  serviceName: 'Ceramic coating', serviceCategory: 'Ceramic',
  serviceBasePrice: 32000, serviceDurationMinutes: 300, totalAmount: 32000,
  scheduledDate: '2026-02-12', scheduledTime: '09:00', status,
  createdAt: ts('2026-01-20T09:00:00Z'),
} as unknown as Booking);

const car = (v: Vehicle, over: Partial<CarPicture> = {}): CarPicture => ({
  vehicle: v, protections: [] as Protection[], declarations: [], visits: [], bookings: [], jobs: [], ...over,
} as CarPicture);

const BMW = vehicle('v-bmw', 'BMW M340i', 'GJ01AB1234');
const KIA = vehicle('v-kia', 'Kia Seltos', 'GJ01AB8539');

const picture = (cars: CarPicture[]): CustomerPicture => ({
  user: { uid: 'u1', name: 'Aarav', role: 'customer' } as unknown as User,
  cars, subscription: null, subscriptions: [], invoices: [], notifications: [],
  catalogue: [] as Service[], addresses: [], approvals: [],
} as CustomerPicture);

const TWO = picture([
  car(BMW, { visits: [visit('vs-bmw-1', 'v-bmw', '2025-11-04')] }),
  car(KIA, { visits: [visit('vs-kia-1', 'v-kia', '2025-06-02'), visit('vs-kia-2', 'v-kia', '2024-09-14')] }),
]);

describe('the address names the car, and the car is found by id', () => {
  it('?car= selects exactly that car', () => {
    const ctx = historyContextOf(TWO, { car: 'v-kia' }, NOW);
    expect(ctx.kind).toBe('album');
    expect(carOfContext(ctx)!.vehicle.id).toBe('v-kia');
  });

  it('a visit id resolves the car that owns it', () => {
    const ctx = historyContextOf(TWO, { visitId: 'vs-bmw-1' }, NOW);
    expect(ctx.kind).toBe('visit');
    expect(carOfContext(ctx)!.vehicle.id).toBe('v-bmw');
  });

  it('and the visit wins over a query that disagrees with it', () => {
    /* The visit is the harder fact: it is the thing being shown. */
    const ctx = historyContextOf(TWO, { visitId: 'vs-bmw-1', car: 'v-kia' }, NOW);
    expect(carOfContext(ctx)!.vehicle.id).toBe('v-bmw');
  });

  it('a registration number is never a key', () => {
    /* It is a label a customer retypes and two people can share. */
    expect(historyContextOf(TWO, { car: 'GJ01AB1234' }, NOW).kind).toBe('choose');
  });

  it('a car id that is not the customer’s finds nothing of theirs', () => {
    expect(historyContextOf(TWO, { car: 'v-somebody-else' }, NOW).kind).toBe('choose');
  });

  it('a visit id that is not theirs is not found', () => {
    expect(historyContextOf(TWO, { visitId: 'vs-not-mine' }, NOW).kind).toBe('choose');
  });
});

describe('with nothing named, the room asks rather than guessing', () => {
  it('several cars and no context is a choice, not a default', () => {
    /* THE REPORTED DEFECT. `leadCar` used to answer here, so the album showed
       whichever car the sort happened to lift and called it the record. */
    const ctx = historyContextOf(TWO, {}, NOW);
    expect(ctx.kind).toBe('choose');
    expect(ctx.kind === 'choose' && ctx.cars).toHaveLength(2);
  });

  it('one car needs no question', () => {
    const one = picture([car(BMW, { visits: [visit('vs-bmw-1', 'v-bmw', '2025-11-04')] })]);
    const ctx = historyContextOf(one, {}, NOW);
    expect(ctx.kind).toBe('album');
    expect(carOfContext(ctx)!.vehicle.id).toBe('v-bmw');
  });

  it('no car at all is its own state', () => {
    expect(historyContextOf(picture([]), {}, NOW).kind).toBe('none');
  });
});

describe('a record with nothing in it is still that car’s record', () => {
  it('an empty album keeps its subject', () => {
    const empty = picture([car(BMW), car(KIA)]);
    const ctx = historyContextOf(empty, { car: 'v-bmw' }, NOW);
    expect(ctx.kind).toBe('album');
    expect(carOfContext(ctx)!.vehicle.id).toBe('v-bmw');
  });
});

describe('an id in the address may be a booking, and it still has a car', () => {
  it('a booking that never became a visit resolves its car', () => {
    /* Every notification written before events existed addresses a booking id
       at `/history/<id>`. */
    const p = picture([car(BMW, { bookings: [booking('bk-9', 'v-bmw', 'confirmed')] }), car(KIA)]);
    const ctx = historyContextOf(p, { visitId: 'bk-9' }, NOW);
    expect(ctx.kind).toBe('booked');
    expect(carOfContext(ctx)!.vehicle.id).toBe('v-bmw');
  });
});

describe('legacy and malformed records do not take the room down', () => {
  it('a visit with no stages and no media still resolves', () => {
    const bare = { id: 'vs-bare', vehicleId: 'v-bmw', userId: 'u1', status: 'sealed' } as unknown as Visit;
    const p = picture([car(BMW, { visits: [bare] }), car(KIA)]);
    const ctx = historyContextOf(p, { visitId: 'vs-bare' }, NOW);
    expect(ctx.kind).toBe('visit');
    expect(carOfContext(ctx)!.vehicle.id).toBe('v-bmw');
  });

  it('a car with a malformed visits field is skipped, not fatal', () => {
    const broken = { vehicle: KIA, protections: [], declarations: [], visits: [], bookings: [], jobs: [] } as CarPicture;
    const p = picture([car(BMW, { visits: [visit('vs-bmw-1', 'v-bmw', '2025-11-04')] }), broken]);
    expect(historyContextOf(p, { visitId: 'vs-bmw-1' }, NOW).kind).toBe('visit');
  });

  it('an empty or absent route resolves without throwing', () => {
    expect(() => historyContextOf(TWO, {}, NOW)).not.toThrow();
    expect(() => historyContextOf(TWO, { car: '' }, NOW)).not.toThrow();
    expect(() => historyContextOf(TWO, { visitId: '' }, NOW)).not.toThrow();
  });
});

describe('one resolver, not three', () => {
  it('the routes do not each resolve the car for themselves', () => {
    const codeOf = (p: string) =>
      require('fs').readFileSync(p, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const f of ['app/history/page.tsx', 'app/history/[id]/page.tsx']) {
      expect({ f, own: /leadCar\(|picture\.cars\.find\(/.test(codeOf(f)) })
        .toEqual({ f, own: false });
      expect(codeOf(f)).toMatch(/historyContextOf/);
    }
  });
});
