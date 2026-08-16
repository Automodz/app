/**
 * READY · PAY · RATE - design screen 13.
 *
 * The handover is where the product touches money and a car changes hands, so
 * the guarantees are blunt:
 *
 *   the payable figure is the STUDIO's, never the customer's
 *   opening a UPI link is not paying, and is never drawn as if it were
 *   only the studio may settle, because only the studio sees the credit
 *   a duplicate settlement adds nothing
 *   a visit is rated once, by its owner, and only once it is sealed
 */
import { readFileSync } from 'fs';
import { Timestamp } from 'firebase/firestore';
import type { Booking, PaymentStatus, Service, User, Vehicle } from '@/lib/types';
import type { CarPicture, CustomerPicture } from '@/lib/customer/picture';
import { toSettle } from '@/lib/customer/project';
import { settlementOf, canRate, PAYMENT_WORD } from '@/lib/os/settlement';
import { paymentTransition, PAYMENT_TRANSITIONS } from '@/lib/os/lifecycle';

const ts = (iso: string) => Timestamp.fromDate(new Date(iso));

/* ── what is owed ────────────────────────────────────────────────────────── */

describe('what is owed is decided once, from a stated order of authority', () => {
  it('the invoice wins - it is the figure with paper behind it', () => {
    const s = settlementOf({ invoiceTotal: 43622, jobTotal: 40000, bookingTotal: 37622 });
    expect(s).toMatchObject({ total: 43622, source: 'invoice', payable: 43622 });
  });

  it('then the job, which is what a mid-visit approval moved', () => {
    const s = settlementOf({ jobTotal: 43622, bookingTotal: 37622 });
    expect(s).toMatchObject({ total: 43622, source: 'job' });
  });

  it('then the booking, which is what was agreed before the car arrived', () => {
    expect(settlementOf({ bookingTotal: 37622 })).toMatchObject({
      total: 37622, source: 'booking',
    });
  });

  it('nothing on record is nothing owed, and says so rather than guessing', () => {
    expect(settlementOf({})).toMatchObject({ total: 0, payable: 0, source: 'none', settled: true });
  });

  it('what has been received is subtracted', () => {
    expect(settlementOf({ jobTotal: 43622, received: 10000 }).payable).toBe(33622);
  });

  it('an overpayment is never shown as a credit', () => {
    /* "−₹200 to pay" would be the product inventing a refund it cannot make. */
    expect(settlementOf({ jobTotal: 1000, received: 1200 }).payable).toBe(0);
    expect(settlementOf({ jobTotal: 1000, received: 1200 }).settled).toBe(true);
  });

  it('a covered membership wash is settled, not left on a pay screen for ever', () => {
    expect(settlementOf({ jobTotal: 0 }).settled).toBe(true);
  });
});

/* ── the machine ─────────────────────────────────────────────────────────── */

describe('a customer may never write `paid`', () => {
  it('they may start a payment and claim to have made one', () => {
    expect(paymentTransition('unpaid', 'initiated', 'customer').ok).toBe(true);
    expect(paymentTransition('initiated', 'submitted', 'customer').ok).toBe(true);
  });

  it('and only the studio settles, because only the studio sees the money', () => {
    expect(paymentTransition('submitted', 'paid', 'customer'))
      .toMatchObject({ ok: false, reason: 'not-yours-to-make' });
    expect(paymentTransition('initiated', 'paid', 'customer').ok).toBe(false);
    expect(paymentTransition('submitted', 'paid', 'studio').ok).toBe(true);
  });

  it('settled is terminal - a record that can be un-settled is not a record', () => {
    expect(PAYMENT_TRANSITIONS.paid).toEqual([]);
  });

  it('"submitted" is never worded as paid', () => {
    /* There is no gateway. Saying "paid" would be the product confirming
       something only a bank can confirm - and the car is not released on it. */
    expect(PAYMENT_WORD.submitted).toBe('With the studio to confirm');
    expect(PAYMENT_WORD.submitted).not.toMatch(/paid/i);
    expect(PAYMENT_WORD.paid).toBe('Settled');
  });
});

/* ── rating ──────────────────────────────────────────────────────────────── */

describe('a visit is rated once, by its owner, once it is sealed', () => {
  const sealed = { id: 'vis1', status: 'sealed', vehicleId: 'v1' };

  it('a sealed visit its owner has not rated', () => {
    expect(canRate({ visit: sealed, ownsVehicle: true, alreadyRated: false, rating: 5 }))
      .toEqual({ ok: true });
  });

  it('an unsealed visit cannot be rated - it has not happened yet', () => {
    expect(canRate({ visit: { ...sealed, status: 'open' }, ownsVehicle: true, alreadyRated: false, rating: 5 }))
      .toEqual({ ok: false, reason: 'not-sealed' });
    expect(canRate({ visit: null, ownsVehicle: true, alreadyRated: false, rating: 5 }))
      .toEqual({ ok: false, reason: 'not-sealed' });
  });

  it('somebody else’s visit cannot be rated', () => {
    /* The old rating hung off the PUBLIC invoice, so anybody holding a shared
       link could rate somebody else's work. */
    expect(canRate({ visit: sealed, ownsVehicle: false, alreadyRated: false, rating: 5 }))
      .toEqual({ ok: false, reason: 'not-yours' });
  });

  it('twice is refused', () => {
    expect(canRate({ visit: sealed, ownsVehicle: true, alreadyRated: true, rating: 5 }))
      .toEqual({ ok: false, reason: 'already-rated' });
  });

  it('the rating is one to five, whole', () => {
    for (const r of [0, 6, -1, 2.5, NaN]) {
      expect(canRate({ visit: sealed, ownsVehicle: true, alreadyRated: false, rating: r }))
        .toEqual({ ok: false, reason: 'out-of-range' });
    }
  });
});

/* ── the screen ──────────────────────────────────────────────────────────── */

const vehicle = { id: 'v1', name: 'BMW M340i', registrationNumber: 'GJ01AB1234', createdAt: ts('2025-01-01T00:00:00Z') } as Vehicle;

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: 'bk1', userId: 'u1', vehicleId: 'v1', vehicleName: 'BMW M340i',
  serviceId: 'svc', serviceName: 'Full-body PPF', serviceCategory: 'PPF',
  scheduledDate: '2026-02-12', scheduledTime: '09:00', status: 'completed',
  totalAmount: 43622,
  breakdown: {
    subtotal: 48662, discount: { source: 'membership', label: 'Gold member 15% off', amount: 5040 },
    discountAmount: 5040, fees: [{ label: 'Pickup', amount: 50 }], feesTotal: 50,
    taxable: 43672, total: 43672, washCovered: false,
  },
  createdAt: ts('2026-01-20T09:00:00Z'), updatedAt: ts('2026-01-20T09:00:00Z'),
  ...over,
} as unknown as Booking);

const picture = (over: Partial<CustomerPicture> = {}): CustomerPicture => ({
  user: { uid: 'u1', name: 'A', email: 'a@x.test', role: 'customer' } as User,
  cars: [{ vehicle, protections: [], declarations: [], visits: [], bookings: [booking()], jobs: [] } as CarPicture],
  subscription: null, subscriptions: [], invoices: [], notifications: [],
  catalogue: [] as Service[], addresses: [], approvals: [],
  ...over,
});

const settle = (over: {
  payable?: number; status?: PaymentStatus; rated?: boolean; upi?: boolean; user?: Partial<User>;
} = {}) => toSettle({
  picture: over.user
    ? picture({ user: { uid: 'u1', name: 'A', email: 'a@x.test', role: 'customer', ...over.user } as User })
    : picture(),
  bookingId: 'bk1',
  visit: { id: 'vis1' } as never,
  money: { total: 43622, received: 43622 - (over.payable ?? 43622), payable: over.payable ?? 43622 },
  payment: over.status ? { status: over.status } : null,
  rated: over.rated,
  upiAvailable: over.upi ?? true,
});

describe('screen 13 states the working, never a bare total', () => {
  it('the lines come from the stored breakdown, including the benefit', () => {
    const m = settle()!;
    expect(m.lines.map(l => l.label)).toEqual([
      'Full-body PPF', 'Gold member 15% off', 'Pickup',
    ]);
    expect(m.lines[1].value).toBe('−₹5,040');
    expect(m.total).toBe('₹43,622');
  });

  it('NO GST LINE while the studio is not registered', () => {
    /* Absent, not zero. A zero claims the studio charged nothing on a taxable
       sale, which is a different statement from not being registered. */
    expect(settle()!.lines.some(l => /gst/i.test(l.label))).toBe(false);
  });

  it('offers to pay what is outstanding, and says so as a figure', () => {
    const m = settle({ payable: 43622 })!;
    expect(m.payable).toBe('₹43,622');
    expect(m.payable_now).toBe(true);
  });

  it('a settled visit offers no payment and says it is settled', () => {
    const m = settle({ payable: 0 })!;
    expect(m.payable).toBeUndefined();
    expect(m.payable_now).toBe(false);
    expect(m.paymentWord).toBe('Settled');
    expect(m.headline).toBe('All settled.');
  });

  it('while the studio is confirming, it offers no SECOND link', () => {
    /* Two payments against one credit is how a visit ends up unreleased with
       the money already in the account. */
    const m = settle({ status: 'submitted' })!;
    expect(m.payable_now).toBe(false);
    expect(m.awaitingConfirmation).toBe(true);
    expect(m.paymentWord).toBe('With the studio to confirm');
  });

  it('the payment address is MASKED, and absent when none is saved', () => {
    expect(settle()!.method).toBe('No payment address saved');
    expect(settle({ user: { upiVpa: 'aarav@okhdfc' } })!.method).toBe('UPI · aa•••@okhdfc');
  });

  it('says plainly when the studio cannot take UPI in the app at all', () => {
    /* Rather than building a link to nowhere. */
    expect(settle({ upi: false })!.upiUnavailable).toMatch(/settle at the counter/);
  });

  it('a rated visit says thank you instead of asking again', () => {
    expect(settle({ rated: true })!.rated).toMatch(/Thank you/);
  });

  it('every address it carries is built by the resolver', () => {
    const m = settle()!;
    expect(m.methodHref).toBe('/you?panel=payment');
    expect(m.recordHref).toBe('/history/vis1');
  });

  it('a booking with no stored breakdown states the one figure it has', () => {
    /* Rather than inventing a decomposition of a total nobody itemised. */
    const m = toSettle({
      picture: picture({
        cars: [{ vehicle, protections: [], declarations: [], visits: [], jobs: [], bookings: [booking({ breakdown: undefined })] } as CarPicture],
      }),
      bookingId: 'bk1', visit: null,
      money: { total: 43622, received: 0, payable: 43622 },
      upiAvailable: true,
    })!;
    expect(m.lines).toHaveLength(1);
    expect(m.lines[0].value).toBe('₹43,622');
    expect(m.visitId).toBeUndefined();
  });
});

/* ── the doors ───────────────────────────────────────────────────────────── */

describe('the money is the server’s, and the request cannot express it', () => {
  const route = readFileSync('app/api/payment/route.ts', 'utf8');
  const service = readFileSync('lib/server/paymentService.ts', 'utf8');
  const rating = readFileSync('lib/server/ratingService.ts', 'utf8');
  const rules = readFileSync('firestore.rules', 'utf8');
  const screen = readFileSync('components/studio/SettleScreen.tsx', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('no route reads an amount off the customer’s body', () => {
    expect(route).not.toMatch(/body\.amount|body\?\.amount/);
    /* The only figure a caller may send is what STAFF believe they received,
       and it is compared rather than trusted. */
    expect(route).toMatch(/expectedAmount/);
    expect(service).toMatch(/amount-mismatch/);
  });

  it('the payable figure comes from settlementOf, over the studio’s records', () => {
    expect(service).toMatch(/settlementOf\(\{/);
    expect(service).toMatch(/amount: payable/);
  });

  it('the UPI link is built from that figure', () => {
    expect(service).toMatch(/buildUpiIntent\(\{[\s\S]{0,200}amount: payable/);
  });

  it('the screen sends a booking id and nothing else', () => {
    expect(screen).toMatch(/JSON\.stringify\(\{ bookingId: model\.bookingId \}\)/);
    expect(screen).not.toMatch(/amount:/);
  });

  it('one open intent per visit - a second tap re-uses the first', () => {
    expect(service).toMatch(/where\('status', 'in', \['initiated', 'submitted'\]\)/);
  });

  it('a duplicate settlement adds nothing, and the ledger is keyed by the payment', () => {
    expect(service).toMatch(/replayed: true/);
    expect(service).toMatch(/\(job\.payments \?\? \[\]\)\.some\(p => p\.id === paymentId\)/);
  });

  it('settling is staff-only, proven from the caller’s own profile', () => {
    expect(route).toMatch(/\['admin', 'employee'\]\.includes\(role\)/);
  });

  it('rating once is structural - a create, on an id that IS the visit', () => {
    expect(rating).toMatch(/collection\('ratings'\)\.doc\(visitId\)\.create\(/);
  });

  it('a rating never touches the sealed visit', () => {
    expect(rating).not.toMatch(/collection\('visits'\)\.doc\([\s\S]{0,40}\.(update|set)\(/);
  });

  it('no client writes a payment or a rating', () => {
    for (const name of ['payments', 'ratings']) {
      const block = rules.slice(rules.indexOf(`match /${name}/`));
      expect(block.slice(0, 400)).toMatch(/allow write: if false;/);
      expect(block.slice(0, 400)).toMatch(/customerId == request\.auth\.uid/);
    }
  });
});
