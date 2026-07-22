import { termState, daysLeft, termAlive } from '@/lib/os/term';
import { visitPhase, careAct, actIndex } from '@/lib/os/visit';
import { truthOf } from '@/lib/os/truth';
import { proposalFor } from '@/lib/os/proposal';
import { deriveStay } from '@/lib/os/stay';
import { deriveChapter, timeInCare } from '@/lib/os/chapter';
import { papersFor } from '@/lib/os/papers';
import type { Protection } from '@/lib/cx/protection';
import type { Booking } from '@/lib/types';

const NOW = new Date('2026-07-20T10:00:00');
const iso = (d: number) => {
  const t = new Date(NOW);
  t.setDate(t.getDate() + d);
  return t.toISOString().slice(0, 10);
};

describe('term engine', () => {
  it('walks active → waning → expiring → lapsed', () => {
    expect(termState(iso(90), { now: NOW })).toBe('active');
    expect(termState(iso(20), { now: NOW })).toBe('waning');
    expect(termState(iso(3), { now: NOW })).toBe('expiring');
    expect(termState(iso(-1), { now: NOW })).toBe('lapsed');
  });
  it('membership gets grace, protection does not', () => {
    expect(termState(iso(-3), { grace: true, now: NOW })).toBe('grace');
    expect(termState(iso(-3), { now: NOW })).toBe('lapsed');
    expect(termState(iso(-10), { grace: true, now: NOW })).toBe('lapsed');
  });
  it('daysLeft counts to end of day', () => {
    expect(daysLeft(iso(0), NOW)).toBe(1);
    expect(termAlive('grace')).toBe(true);
    expect(termAlive('lapsed')).toBe(false);
  });
});

describe('visit translation boundary', () => {
  it('maps ops statuses to phases', () => {
    expect(visitPhase('pending')).toBe('proposed');
    expect(visitPhase('confirmed')).toBe('agreed');
    expect(visitPhase('in_progress')).toBe('live');
    expect(visitPhase('completed')).toBe('archived');
    expect(visitPhase('cancelled')).toBe('cancelled');
  });
  it('maps live statuses to acts in order', () => {
    expect(careAct('vehicle_received')).toBe('received');
    expect(careAct('quality_check')).toBe('final_checks');
    expect(careAct('ready_for_delivery')).toBe('ready');
    expect(actIndex('in_care')).toBeGreaterThan(actIndex('received'));
  });
});

describe('truthOf priority', () => {
  const visit = (status: Booking['status'], date = iso(3)): Booking =>
    ({ status, scheduledDate: date, scheduledTime: '10:00' } as unknown as Booking);

  it('live beats everything', () => {
    expect(truthOf({
      visits: [visit('in_progress'), visit('confirmed')],
      protections: [{ label: 'Ceramic coat', expiresOn: iso(5) }],
      now: NOW,
    })).toBe('In the studio — in care.');
  });
  it('ready reads as ready', () => {
    expect(truthOf({ visits: [visit('ready_for_delivery')], protections: [], now: NOW }))
      .toBe('Ready for collection.');
  });
  it('agreed beats term edge', () => {
    const t = truthOf({
      visits: [visit('confirmed')],
      protections: [{ label: 'Ceramic coat', expiresOn: iso(5) }],
      now: NOW,
    });
    expect(t).toContain("we're ready for it");
  });
  it('term edge beats care due; protected is the quiet floor', () => {
    expect(truthOf({
      visits: [], protections: [{ label: 'Ceramic coat', expiresOn: iso(5) }],
      lastCaredOn: iso(-60), now: NOW,
    })).toBe('Ceramic coat — 6 days of protection left.');
    expect(truthOf({
      visits: [], protections: [{ label: 'Ceramic coat', expiresOn: iso(200) }], now: NOW,
    })).toBe('All quiet. Protected.');
    expect(truthOf({ visits: [], protections: [], now: NOW })).toBe('All quiet.');
  });
  it('never leaks ops vocabulary', () => {
    for (const s of ['pending', 'in_progress', 'quality_check', 'ready_for_delivery'] as const) {
      expect(truthOf({ visits: [visit(s)], protections: [], now: NOW })).not.toMatch(/_|pending|progress|quality/);
    }
  });
});

describe('proposal engine', () => {
  const P = (until: number | null, kind: 'Ceramic' | 'PPF' = 'Ceramic') => ({
    kind, applied: iso(-300), until: until === null ? null : new Date(`${iso(until)}T12:00:00`),
    active: true, term: 'active' as const, service: 'x', warranty: '1 Year',
  });
  it('proposes protection renewal when a coat is waning/expiring, citing it', () => {
    const p = proposalFor({ vehicleId: 'v1', protections: [P(5)], now: NOW });
    expect(p).not.toBeNull();
    expect(p!.serviceCategory).toBe('Ceramic');
    expect(p!.reason.toLowerCase()).toContain('ceramic coat');
  });
  it('prefers the sooner-expiring protection', () => {
    const p = proposalFor({ vehicleId: 'v1', protections: [P(20, 'PPF'), P(3, 'Ceramic')], now: NOW });
    expect(p!.serviceCategory).toBe('Ceramic');
  });
  it('falls back to a wash when cadence is exceeded, citing last care', () => {
    const p = proposalFor({ vehicleId: 'v1', protections: [P(200)], lastCaredOn: iso(-45), now: NOW });
    expect(p!.serviceCategory).toBe('Washing');
    expect(p!.reason).toMatch(/\d+ days since the last wash/);
  });
  it('is silent when protected and recently cared for (one-or-none per vehicle)', () => {
    expect(proposalFor({ vehicleId: 'v1', protections: [P(200)], lastCaredOn: iso(-5), now: NOW })).toBeNull();
    expect(proposalFor({ vehicleId: 'v1', protections: [], now: NOW })).toBeNull();
  });
});

describe('the Stay model', () => {
  const ts = (d: Date) => ({ toDate: () => d }) as unknown as import('firebase/firestore').Timestamp;
  const at = (minAgo: number) => ts(new Date(NOW.getTime() - minAgo * 60000));

  const booking = (over: Partial<Booking> = {}) => ({
    id: 'b1', status: 'in_progress', totalAmount: 24000,
    serviceDurationMinutes: 120, scheduledDate: iso(0), scheduledTime: '10:00',
    paymentStatus: 'pending', ...over,
  }) as unknown as Booking;

  const job = (over: Record<string, unknown> = {}) => ({
    id: 'j1', status: 'in_progress',
    assignments: [{ employeeId: 'e1', employeeName: 'Ravi Sharma', role: 'lead', assignedAt: at(60) }],
    statusHistory: [
      { status: 'checked_in', at: at(60), byEmployeeId: 'e1', byEmployeeName: 'Ravi Sharma' },
      { status: 'in_progress', at: at(40), byEmployeeId: 'e1', byEmployeeName: 'Ravi Sharma', note: 'Clay and decontamination done.' },
    ],
    photos: [
      { url: 'a.jpg', path: 'p1', kind: 'before' },
      { url: 'b.jpg', path: 'p2', kind: 'during' },
    ],
    ...over,
  }) as unknown as Parameters<typeof deriveStay>[1];

  it('takes the act from the job and marks earlier acts done', () => {
    const s = deriveStay(booking(), job(), NOW);
    expect(s.act).toBe('in_care');
    expect(s.acts.map(a => a.state)).toEqual(['done', 'done', 'current', 'coming', 'coming']);
    expect(s.acts[0].at).toEqual(new Date(NOW.getTime() - 60 * 60000));
  });

  it('prefers the studio’s own note as the narration', () => {
    const s = deriveStay(booking(), job(), NOW);
    expect(s.narration).toBe('Clay and decontamination done.');
    expect(s.narrationIsStudio).toBe(true);
  });

  it('falls back to the act line when the studio has been quiet', () => {
    const quiet = job({ statusHistory: [{ status: 'checked_in', at: at(10), byEmployeeId: 'e', byEmployeeName: 'R' }], status: 'checked_in' });
    const s = deriveStay(booking({ status: 'vehicle_received' }), quiet, NOW);
    expect(s.narrationIsStudio).toBe(false);
    expect(s.narration).toBe('Your vehicle has arrived safely.');
  });

  it('names the lead and the arrival, and chains the evidence', () => {
    const s = deriveStay(booking(), job(), NOW);
    expect(s.craftsman).toBe('Ravi Sharma');
    expect(s.arrivalPhoto).toBe('a.jpg');
    expect(s.craftPhoto).toBe('b.jpg');
    expect(s.latestPhoto).toBe('b.jpg');
  });

  it('offers a planned finish only while it is still a plan', () => {
    expect(deriveStay(booking(), job(), NOW).timing).toMatch(/^Planned finish around /);
    const late = deriveStay(booking({ serviceDurationMinutes: 30 }), job(), NOW);
    expect(late.timing).toBe('Running longer than planned — the work sets the pace.');
  });

  it('says nothing about time at Ready, or before the car has arrived', () => {
    expect(deriveStay(booking({ status: 'ready_for_delivery' }), job({ status: 'ready_for_delivery' }), NOW).timing).toBeNull();
    expect(deriveStay(booking({ status: 'confirmed' }), null, NOW).timing).toBeNull();
  });

  it('hands a collected visit over as archived', () => {
    const s = deriveStay(booking({ status: 'completed' }), job({ status: 'completed' }), NOW);
    expect(s.archived).toBe(true);
    expect(s.acts.every(a => a.state === 'done')).toBe(true);
  });
});

describe('the Chapter model', () => {
  const ts = (d: Date) => ({ toDate: () => d }) as unknown as import('firebase/firestore').Timestamp;

  const booking = (over: Partial<Booking> = {}) => ({
    id: 'b1', status: 'completed', serviceName: 'Ceramic Coating',
    scheduledDate: '2026-04-20', vehicleName: 'BMW M340i', vehicleRegNo: 'GJ01AB1234',
    totalAmount: 12000, paymentMethod: 'upi', paymentStatus: 'pending', ...over,
  }) as unknown as Booking;

  const job = (over: Record<string, unknown> = {}) => ({
    id: 'j1', status: 'completed',
    serviceItems: [{ serviceId: 's1', serviceName: 'Kovalent Graphene', category: 'Ceramic', price: 12000 }],
    assignments: [
      { employeeId: 'e1', employeeName: 'Ravi Sharma', role: 'lead', assignedAt: ts(new Date('2026-04-20T09:00:00')) },
      { employeeId: 'e2', employeeName: 'Karan Patel', role: 'helper', assignedAt: ts(new Date('2026-04-20T09:00:00')) },
    ],
    statusHistory: [
      { status: 'checked_in', at: ts(new Date('2026-04-20T09:00:00')), byEmployeeId: 'e1', byEmployeeName: 'Ravi' },
      { status: 'in_progress', at: ts(new Date('2026-04-20T09:40:00')), byEmployeeId: 'e1', byEmployeeName: 'Ravi', note: 'Two-stage paint correction.' },
      { status: 'completed', at: ts(new Date('2026-04-20T15:20:00')), byEmployeeId: 'e1', byEmployeeName: 'Ravi' },
    ],
    photos: [
      { url: 'after.jpg', path: 'p3', kind: 'after' },
      { url: 'before.jpg', path: 'p1', kind: 'before' },
      { url: 'during.jpg', path: 'p2', kind: 'during' },
    ],
    paymentStatus: 'collected',
    ...over,
  }) as unknown as Parameters<typeof deriveChapter>[0]['job'];

  const invoice = (over: Record<string, unknown> = {}) => ({
    id: 'i1', invoiceNumber: 'AMZ-2026-0001', total: 12000,
    paymentMethod: 'upi', paymentStatus: 'paid', ...over,
  }) as unknown as Parameters<typeof deriveChapter>[0]['invoice'];

  it('orders the evidence arrival → work → finished and leads with the finished car', () => {
    const c = deriveChapter({ booking: booking(), job: job(), invoice: null });
    expect(c.evidence.map(e => e.act)).toEqual(['arrival', 'work', 'finished']);
    expect(c.hero).toBe('after.jpg');
  });

  it('falls back to the first photograph when nothing was shot at the end', () => {
    const c = deriveChapter({
      booking: booking(),
      job: job({ photos: [{ url: 'before.jpg', path: 'p', kind: 'before' }] }),
      invoice: null,
    });
    expect(c.hero).toBe('before.jpg');
  });

  it('tells the work as services plus the studio’s own notes, inventing nothing', () => {
    const c = deriveChapter({ booking: booking(), job: job(), invoice: null });
    expect(c.work).toEqual(['Kovalent Graphene', 'In care — Two-stage paint correction.']);
  });

  it('names the people and measures the time actually recorded', () => {
    const c = deriveChapter({ booking: booking(), job: job(), invoice: null });
    expect(c.lead).toBe('Ravi Sharma');
    expect(c.helpers).toEqual(['Karan Patel']);
    expect(c.minutesInCare).toBe(380);
    expect(timeInCare(380)).toBe('6h 20m in the studio');
    expect(timeInCare(45)).toBe('45 minutes in the studio');
  });

  it('has no time when the studio never recorded an arrival or a finish', () => {
    expect(deriveChapter({ booking: booking(), job: null, invoice: null }).minutesInCare).toBeNull();
  });

  it('offers a receipt when paid, an invoice when not, and nothing without a token', () => {
    const paid = deriveChapter({ booking: booking(), job: job(), invoice: invoice(), invoiceToken: 'tok' });
    expect(paid.documents).toEqual([
      { kind: 'receipt', title: 'Receipt', detail: 'AMZ-2026-0001', href: '/invoice/i1?t=tok' },
    ]);
    const unpaid = deriveChapter({
      booking: booking(), job: job({ paymentStatus: 'pending' }),
      invoice: invoice({ paymentStatus: 'pending' }), invoiceToken: 'tok',
    });
    expect(unpaid.documents[0].kind).toBe('invoice');
    expect(deriveChapter({ booking: booking(), job: job(), invoice: invoice() }).documents).toEqual([]);
  });

  it('falls back to the booking when there is no job at all (a migrated visit)', () => {
    const c = deriveChapter({ booking: booking(), job: null, invoice: null });
    expect(c.work).toEqual(['Ceramic Coating']);
    expect(c.evidence).toEqual([]);
    expect(c.hero).toBeUndefined();
    expect(c.amount).toBe(12000);
  });
});

describe('the papers vault', () => {
  const visit = (over: Partial<Booking> = {}) => ({
    id: 'v1', serviceName: 'Kovalent Graphene', scheduledDate: '2026-04-20',
    status: 'completed', paymentStatus: 'verified', ...over,
  }) as unknown as Booking;

  const layer = (over: Record<string, unknown> = {}) => ({
    kind: 'Ceramic', applied: '2026-04-20', until: new Date('2029-04-20T12:00:00'),
    active: true, term: 'active', service: 'Kovalent Graphene', warranty: '3 Year',
    ...over,
  }) as unknown as Protection;

  it('files a warranty for living protection, pointing at its own chapter', () => {
    const [p] = papersFor({ completed: [visit({ invoiceId: undefined })], protections: [layer()] });
    expect(p).toEqual({
      id: 'warranty-Ceramic', kind: 'warranty',
      title: 'Ceramic coat warranty', detail: 'Until April 2029', bookingId: 'v1',
    });
  });

  it('does not file a warranty that has run its course, or one with no term', () => {
    expect(papersFor({ completed: [visit()], protections: [layer({ active: false })] })
      .filter(p => p.kind === 'warranty')).toEqual([]);
    expect(papersFor({ completed: [visit()], protections: [layer({ warranty: null })] })
      .filter(p => p.kind === 'warranty')).toEqual([]);
  });

  it('files a receipt only when the visit really produced an invoice', () => {
    const withInvoice = papersFor({ completed: [visit({ invoiceId: 'i1' })], protections: [] });
    expect(withInvoice).toEqual([
      { id: 'receipt-v1', kind: 'receipt', title: 'Receipt', detail: '20 April 2026', bookingId: 'v1' },
    ]);
    expect(papersFor({ completed: [visit()], protections: [] })).toEqual([]);
  });

  it('calls it an invoice while payment is still owed', () => {
    const [p] = papersFor({
      completed: [visit({ invoiceId: 'i1', paymentStatus: 'pending' })], protections: [],
    });
    expect(p.title).toBe('Invoice');
  });

  it('is silent for a car that owns nothing yet', () => {
    expect(papersFor({ completed: [], protections: [] })).toEqual([]);
  });
});
