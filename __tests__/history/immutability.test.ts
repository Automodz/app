/**
 * HISTORY IS PERMANENT - ENFORCED.
 *
 * §16: a past visit must never change because pricing, warranties or the
 * catalogue changed. That is not a property you can check by looking at a
 * screen; it only shows up months later, when someone edits a price and a
 * customer's receipt quietly disagrees with what they paid.
 *
 * So it is asserted structurally: History reads sealed data and nothing else.
 */
import { readFileSync } from 'fs';
import { visitsOf, toVisit } from '@/lib/customer/project';
import type { CarPicture } from '@/lib/customer/source';
import type { Visit, Invoice } from '@/lib/types';

const codeOf = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const project = codeOf('lib/customer/project.ts');

/**
 * The slice of the projection that History owns - `visitsOf` and its helpers,
 * plus `toHistory`/`toVisit`. Bounded on both ends: an unbounded slice ran to
 * end-of-file and swept in Studio and Membership, which legitimately read the
 * catalogue.
 */
const between = (from: string, to: string) => {
  const a = project.indexOf(from);
  const b = project.indexOf(to);
  /* Both markers must be real CODE. Bounding on a comment silently returned
     -1 here, and `slice(start, -1)` swept in almost the whole file. */
  expect(a).toBeGreaterThan(-1);
  expect(b).toBeGreaterThan(a);
  return project.slice(a, b);
};

const historySlice =
  between('export function visitsOf', 'export function toHome')
  /* Bounded at `toLiveVisit`, which is NOT history - a visit in flight
     legitimately reads the catalogue through the ownership engine. Only the
     sealed record is forbidden from consulting the present. */
  + between('export function toHistory', 'export function toLiveVisit');

const sealed = (over: Partial<Visit> = {}): Visit => ({
  id: 'v1',
  vehicleId: 'veh1',
  locationId: 'l1',
  source: 'requested',
  authoredBy: 'studio',
  services: [{ name: 'Ceramic Coating', price: 10000 }],
  amounts: { subtotal: 10000, discount: 0, total: 10000 },
  stages: [{ act: 'in_care', note: 'Two coats, cured overnight.', media: [] }],
  termsCaptured: [{ kind: 'ceramic', term: { kind: 'dated', expiresOn: '2029-04-20' } }],
  status: 'sealed',
  bookingId: 'b1',
  createdAt: { toMillis: () => 1, toDate: () => new Date('2026-04-20') },
  updatedAt: { toMillis: () => 1, toDate: () => new Date('2026-04-20') },
  ...over,
} as unknown as Visit);

const car = (over: Partial<CarPicture> = {}): CarPicture => ({
  vehicle: { id: 'veh1', name: 'Defender 110', registrationNumber: 'GJ 01 KP 4471' },
  protections: [],
  visits: [sealed()],
  bookings: [],
  jobs: [],
  ...over,
} as unknown as CarPicture);

describe('history reads only sealed visits', () => {
  it('an open visit is not history yet', () => {
    expect(visitsOf(car({ visits: [sealed({ status: 'open' })] as never }))).toHaveLength(0);
  });

  it('a sealed visit is', () => {
    expect(visitsOf(car()).map(v => v.id)).toEqual(['v1']);
  });

  it('a completed BOOKING is never projected into a visit', () => {
    /* The fallback that did this read warranties from the live catalogue, so a
       price-list edit rewrote what a past customer had been promised. */
    expect(visitsOf(car({ visits: [], bookings: [{ id: 'b', status: 'completed' }] as never })))
      .toHaveLength(0);
  });
});

describe('history never consults the present', () => {
  it('visitsOf takes no catalogue at all', () => {
    /* It used to take one and never read it (`_catalogue`), threaded through
       four call sites - a parameter that exists but does nothing is an
       invitation to start using it. */
    expect(visitsOf.length).toBe(1);
    expect(project).not.toMatch(/_catalogue/);
  });

  it('the history projection reads no catalogue, price list or live warranty', () => {
    expect(historySlice).not.toMatch(/catalogue/);
    expect(historySlice).not.toMatch(/MEMBERSHIP_PLANS/);
    expect(historySlice).not.toMatch(/protectionsOf/);
    expect(historySlice).not.toMatch(/healthOf/);
  });

  it('the amount comes from the visit, not from a service lookup', () => {
    /* BEHAVIOURAL, not a regex over the source. This matched the literal
       `visit.amounts.total`, which broke the moment that read moved into
       `moneyOfVisits` - while proving nothing about the figure a customer
       sees. The structural guard above already forbids the catalogue; this
       asserts the number itself, which is the fact §16 is about. */
    const sold = sealed({ amounts: { subtotal: 40000, discount: 0, total: 40000 } });
    expect(toVisit(sold, car({ visits: [sold] as never })).settled).toBe('₹40,000');
  });

  it('what was promised comes from termsCaptured', () => {
    expect(historySlice).toMatch(/visit\.termsCaptured/);
  });
});

describe('a chapter carries what the visit sealed', () => {
  const invoice = {
    id: 'i1',
    invoiceNumber: 'AMZ-2026-0001',
    bookingId: 'b1',
    publicToken: 'tok',
    paymentStatus: 'paid',
  } as unknown as Invoice;

  it('the services performed are the visit’s own', () => {
    expect(toVisit(sealed(), car()).title).toBe('Ceramic Coating');
  });

  it('the studio’s note survives as written', () => {
    expect(toVisit(sealed(), car()).did).toContain('Two coats, cured overnight.');
  });

  it('the warranty snapshot is the captured term', () => {
    const promised = toVisit(sealed(), car()).promised ?? [];
    expect(promised).toHaveLength(1);
    expect(promised[0].label).toBe('Ceramic coating');
  });

  it('the settled amount is the sealed total', () => {
    expect(toVisit(sealed(), car()).settled).toBe('₹10,000');
  });

  it('the invoice is matched on the visit’s own ids, never on date or amount', () => {
    const v = toVisit(sealed(), car(), [invoice]);
    expect(v.documents?.[0].label).toContain('AMZ-2026-0001');
    /* The document, with its own share token. It also carries the visit that
       sent them - the paper is a shared address and has no history behind it
       when it arrives in a message, so without this there is no way back. */
    expect(v.documents?.[0].href).toContain('/invoice/i1');
    expect(v.documents?.[0].href).toContain('t=tok');
    expect(v.documents?.[0].href).toContain(`from=${encodeURIComponent('/history/v1')}`);
  });

  it('a paid invoice reads as a receipt', () => {
    expect(toVisit(sealed(), car(), [invoice]).documents?.[0].label).toMatch(/^Receipt/);
  });

  it('an unrelated invoice is not attached', () => {
    const other = { ...invoice, bookingId: 'someone-else' } as Invoice;
    expect(toVisit(sealed(), car(), [other]).documents).toEqual([]);
  });

  it('a visit with no invoice offers no papers and no share link', () => {
    const v = toVisit(sealed(), car());
    expect(v.documents).toEqual([]);
    expect(v.shareHref).toBeUndefined();
  });
});

describe('sharing leaks nothing', () => {
  const route = codeOf('app/api/invoice/[id]/route.ts');
  const page = codeOf('app/chapter/[id]/page.tsx');

  it('the shared view is token-gated', () => {
    expect(route).toMatch(/publicToken !== token/);
  });

  it('the shared payload carries no money and no contact details', () => {
    const chapter = route.slice(route.indexOf("view') === 'chapter'"), );
    const body = chapter.slice(0, chapter.indexOf('}'));
    expect(body).not.toMatch(/total|amount|price|phone|email/i);
  });

  it('the public page writes no privacy rule of its own', () => {
    /* It reads the endpoint and renders what it gets. A second rule here is a
       second place for the first one to be forgotten. */
    expect(page).toMatch(/view=chapter/);
    expect(page).not.toMatch(/firebase|adminDb|firestore/i);
  });
});
