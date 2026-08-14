import { roomFor, activeSlotFor, chromeFor, slots, primaryAction, STUDIO } from '@/navigation/routes';

const CASES: [string, string | undefined][] = [
  ['/', '/'],
  ['/garage', '/garage'],
  ['/vehicle', '/garage'],
  ['/vehicle/anything', '/garage'],
  ['/history', '/garage'],
  ['/history/ceramic-2026-07', '/garage'],
  ['/studio', STUDIO],
  ['/studio/arrange', STUDIO],
  ['/studio/arrange/step-2', STUDIO],
  ['/membership', '/membership'],
  ['/you', '/you'],
  ['/admin', undefined],
  ['/admin/bookings', undefined],
  ['/auth/login', undefined],
  ['/api/booking/create', undefined],
  ['/nonsense', undefined],
];

describe('route mapping', () => {
  it.each(CASES)('%s activates %s', (path, expected) => {
    expect(activeSlotFor(path)).toBe(expected);
  });

  it('every non-room address resolves to no room at all', () => {
    for (const p of ['/admin', '/admin/x/y', '/auth/login', '/api/x', '/nonsense']) {
      expect(roomFor(p)).toBeUndefined();
    }
  });

  it('the Studio activates from any depth, including routes that do not exist yet', () => {
    for (const p of ['/studio', '/studio/a', '/studio/a/b/c', '/studio?x=1'.split('?')[0]]) {
      expect(activeSlotFor(p)).toBe(primaryAction.path);
    }
  });

  /* The design draws the dock on all twelve screens and it is five equal
     slots every time, the Studio among them - see the header of routes.ts for
     why that honours §6.3 rather than dropping it. What the clause actually
     protects is that arranging a visit is never buried, so THAT is what is
     asserted here: the studio is permanently reachable in one tap, and the
     primary action still points at it. */
  it('the Studio is a permanent slot, and the primary action still names it', () => {
    expect(slots).toContain(STUDIO);
    expect(primaryAction.path).toBe(STUDIO);
  });

  it('the dock is five slots, in the design\'s order', () => {
    expect(slots).toEqual(['/', '/studio', '/garage', '/membership', '/you']);
  });

  it('the car is reached through the Garage, not a slot of its own', () => {
    /* A dock slot for "the car" has to answer WHICH car in the navigation,
       and choosing between cars is the collection's question. */
    expect(slots).not.toContain('/vehicle');
    expect(activeSlotFor('/vehicle')).toBe('/garage');
    expect(activeSlotFor('/vehicle?car=abc'.split('?')[0])).toBe('/garage');
  });

  it('the Club is its own slot and lights itself', () => {
    expect(slots).toContain('/membership');
    expect(activeSlotFor('/membership')).toBe('/membership');
  });

  it('the record is reached from the collection, not from a slot of its own', () => {
    expect(slots).not.toContain('/history');
    expect(activeSlotFor('/history')).toBe('/garage');
  });

  it('every slot maps to itself', () => {
    for (const s of slots) expect(activeSlotFor(s)).toBe(s);
  });

  it('chrome defaults to nav only for addresses that are rooms', () => {
    expect(chromeFor('/')).toBe('nav');
    expect(roomFor('/admin')).toBeUndefined();
  });
});
