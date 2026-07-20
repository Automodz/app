import { termState, daysLeft, termAlive } from '@/lib/os/term';
import { visitPhase, careAct, actIndex } from '@/lib/os/visit';
import { truthOf } from '@/lib/os/truth';
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
