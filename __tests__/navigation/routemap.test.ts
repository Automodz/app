import { roomFor, activeSlotFor, chromeFor, slots, primaryAction, STUDIO } from '@/navigation/routes';

const CASES: [string, string | undefined][] = [
  ['/', '/'],
  ['/garage', '/garage'],
  ['/vehicle', '/garage'],
  ['/vehicle/anything', '/garage'],
  ['/history', '/history'],
  ['/history/ceramic-2026-07', '/history'],
  ['/studio', STUDIO],
  ['/studio/arrange', STUDIO],
  ['/studio/arrange/step-2', STUDIO],
  ['/membership', STUDIO],
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

  it('the Studio is reached by the primary action, never by a slot', () => {
    expect(slots).not.toContain(STUDIO);
    expect(primaryAction.path).toBe(STUDIO);
  });

  it('every slot maps to itself', () => {
    for (const s of slots) expect(activeSlotFor(s)).toBe(s);
  });

  it('chrome defaults to nav only for addresses that are rooms', () => {
    expect(chromeFor('/')).toBe('nav');
    expect(roomFor('/admin')).toBeUndefined();
  });
});
