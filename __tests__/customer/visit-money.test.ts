/**
 * WHAT A VISIT COST - the album and the record must add up to each other.
 *
 * Two numbers exist for one visit and they are different kinds of fact.
 * `visit.amounts.total` is what the visit was SEALED at, from the services it
 * carried. The invoice is what the studio actually billed, line by line, and it
 * is the document the customer holds.
 *
 * They disagreed in production and nothing could see it. `/history?car=…`
 * printed "₹2,12,640 settled in all" by summing the sealed amounts; opening the
 * one visit that had an invoice showed ₹1,250, because the Visit screen prefers
 * the receipt. The album's total was ₹11,990 higher than the sum of everything
 * the customer could actually open.
 *
 * The rule: the invoice wins where one exists - it is the money that changed
 * hands and the only figure with a document behind it. The sealed amount is the
 * fallback, which is most visits. Never both, and never the same invoice twice.
 */
import type { Invoice, Visit } from '@/lib/types';
import type { CarPicture } from '@/lib/customer/source';
import { toHistory, toVisit, moneyOfVisits, visitsOf } from '@/lib/customer/project';

const stamp = (iso: string) => ({
  toMillis: () => new Date(iso).getTime(),
  toDate: () => new Date(iso),
});

const sealed = (over: Partial<Visit> = {}): Visit => ({
  id: 'v1', vehicleId: 'veh1', locationId: 'l1', source: 'requested',
  authoredBy: 'studio',
  services: [{ name: 'Glass coating', price: 12000 }],
  amounts: { subtotal: 12000, discount: 0, total: 13240 },
  stages: [{ act: 'in_care', note: 'Glass polished, then sealed.', media: [] }],
  termsCaptured: [],
  status: 'sealed', bookingId: 'b1',
  createdAt: stamp('2026-07-20'), updatedAt: stamp('2026-07-20'),
  ...over,
} as unknown as Visit);

const invoice = (over: Partial<Invoice> = {}): Invoice => ({
  id: 'i1', invoiceNumber: 'AMZ-2026-0001', bookingId: 'b1', customerId: 'u1',
  customerName: 'Meet Sheth', customerPhone: '', vehicleName: 'Kia Seltos',
  vehicleRegNo: 'GJ01AB8539',
  lineItems: [
    { name: 'Glass Coating', qty: 1, unitPrice: 1200, amount: 1200 },
    { name: 'Pickup & Drop', qty: 1, unitPrice: 50, amount: 50 },
  ],
  subtotal: 1250, total: 1250,
  paymentMethod: 'cash', paymentStatus: 'paid', publicToken: 'tok',
  createdAt: stamp('2026-07-16'),
  ...over,
} as unknown as Invoice);

const car = (visits: Visit[]): CarPicture => ({
  vehicle: { id: 'veh1', name: 'Kia Seltos', registrationNumber: 'GJ01AB8539' },
  protections: [], visits, bookings: [], jobs: [],
} as unknown as CarPicture);

/** The figure the album prints, and the figures the records show. */
const reconcile = (visits: Visit[], invoices: Invoice[]) => {
  const c = car(visits);
  const album = toHistory(c, invoices);
  const each = visitsOf(c).map(v => {
    const r = toVisit(v, c, invoices);
    return { id: v.id, settled: r.settled, receiptTotal: r.receipt?.total };
  });
  const shown = each.map(v => v.settled ?? v.receiptTotal);
  const sum = shown.reduce(
    (n, s) => n + Number(String(s ?? '0').replace(/[₹,]/g, '')), 0,
  );
  return { albumTotal: album.settledTotal, each, sumOfRecords: sum };
};

describe('what a visit cost', () => {
  it('THE INVOICE WINS where one exists, and the album agrees with the record', () => {
    const r = reconcile([sealed()], [invoice()]);

    expect(r.each[0].receiptTotal).toBe('₹1,250');
    /* Not both. The sealed ₹13,240 is not carried alongside the receipt. */
    expect(r.each[0].settled).toBeUndefined();
    expect(r.albumTotal).toBe('₹1,250');
    expect(r.sumOfRecords).toBe(1250);
  });

  it('THE SEALED AMOUNT stands when there is no invoice - most visits', () => {
    const r = reconcile([sealed()], []);

    expect(r.each[0].settled).toBe('₹13,240');
    expect(r.each[0].receiptTotal).toBeUndefined();
    expect(r.albumTotal).toBe('₹13,240');
    expect(r.sumOfRecords).toBe(13240);
  });

  it('MIXED - invoiced and uninvoiced visits total to exactly what they show', () => {
    /* This is the production shape: one visit with the studio's paper, two
       sealed from services alone. The album summed all three sealed amounts
       and was ₹11,990 out. */
    const visits = [
      sealed({ id: 'glass', bookingId: 'b1', amounts: { subtotal: 12000, discount: 0, total: 13240 } }),
      sealed({ id: 'ppf', bookingId: '', amounts: { subtotal: 145000, discount: 0, total: 145000 } }),
      sealed({ id: 'ceramic', bookingId: '', amounts: { subtotal: 64000, discount: 9600, total: 54400 } }),
    ] as Visit[];
    const r = reconcile(visits, [invoice()]);

    expect(r.albumTotal).toBe('₹2,00,650');
    expect(r.sumOfRecords).toBe(200650);
    expect(String(r.albumTotal)).not.toBe('₹2,12,640');
  });

  it('an empty bookingId never claims an invoice that simply has none', () => {
    /* Three of the four sealed visits in production carry `bookingId: ''`. */
    const orphan = sealed({ id: 'orphan', bookingId: '' });
    const paperWithNoBooking = invoice({ id: 'i2', bookingId: undefined });
    const money = moneyOfVisits([orphan], [paperWithNoBooking]);

    expect(money.get('orphan')?.source).toBe('sealed');
    expect(money.get('orphan')?.total).toBe(13240);
  });

  it('ONE INVOICE IS COUNTED ONCE, however many visits share its booking', () => {
    /* Two sealed visits against one booking is a data condition the model
       allows. Both matching the same invoice would add its money to the album
       twice - the album would read ₹2,500 for ₹1,250 that changed hands. */
    const a = sealed({ id: 'a', bookingId: 'b1' });
    const b = sealed({ id: 'b', bookingId: 'b1' });
    const money = moneyOfVisits([a, b], [invoice()]);

    expect(money.get('a')).toMatchObject({ source: 'invoice', total: 1250 });
    expect(money.get('b')).toMatchObject({ source: 'sealed', total: 13240 });
    expect(toHistory(car([a, b]), [invoice()]).settledTotal).toBe('₹14,490');
  });

  it('a visit opened on its own is paired with the same invoice the album counted', () => {
    /* `toVisit` used to match the invoice privately, so the record and the
       album could pair differently and neither would know. */
    const a = sealed({ id: 'a', bookingId: 'b1' });
    const b = sealed({ id: 'b', bookingId: 'b1' });
    const c = car([a, b]);

    expect(toVisit(a, c, [invoice()]).receipt?.number).toBe('AMZ-2026-0001');
    expect(toVisit(b, c, [invoice()]).receipt).toBeUndefined();
    expect(toVisit(b, c, [invoice()]).settled).toBe('₹13,240');
  });

  it('MISMATCHED DATA is presented from the authoritative side, not averaged or added', () => {
    /* The sealed figure and the invoice describe different work here - 13,240
       against 1,250. Nothing reconciles them silently: the invoice is what the
       customer was billed, so that is what both surfaces say, and the sealed
       figure is simply not shown. Correcting the underlying records is the
       studio's, not the projection's. */
    const r = reconcile([sealed()], [invoice()]);
    expect(r.albumTotal).toBe('₹1,250');
    expect(JSON.stringify(r.each)).not.toContain('13,240');
    expect(r.sumOfRecords).not.toBe(1250 + 13240);
  });

  it('no money at all is no money anywhere', () => {
    const free = sealed({ amounts: { subtotal: 0, discount: 0, total: 0 } });
    const r = reconcile([free], []);
    expect(r.each[0].settled).toBeUndefined();
    expect(r.albumTotal).toBeUndefined();
  });
});
