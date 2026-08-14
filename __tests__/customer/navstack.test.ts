/**
 * BACK GOES WHERE THE CUSTOMER CAME FROM.
 *
 * Reported from production: Garage → the BMW → its history → Back landed on
 * Now, a room the customer had never been in. `/history?car=v1` resolved to
 * `/history`, which resolves to `/`, and the context that said WHICH car was
 * dropped on the way - so the generic record then showed whichever vehicle the
 * product picks by default. Back could hand somebody a different car's history
 * than the one they were reading.
 *
 * These are the rules of the walk. The parent map is the other half and has
 * its own suite; this one is about what actually happened.
 */
import {
  pushRoute, previousRoute, canonical, isInternalHref, sanitiseStack, STACK_LIMIT,
} from '@/lib/os/navstack';

/** The walk the owner described, as addresses. */
const GARAGE = '/garage';
const CAR = '/vehicle?car=v1';
const RECORD = '/history?car=v1';
const VISIT = '/history/vs1';

const walk = (...hrefs: string[]) => hrefs.reduce(pushRoute, [] as string[]);

describe('the walk is remembered, with the car it was about', () => {
  it('Garage → Vehicle → History goes back the way it came', () => {
    let stack = walk(GARAGE, CAR, RECORD);

    const first = previousRoute(stack, RECORD)!;
    expect(first.href).toBe(CAR);
    stack = first.stack;

    const second = previousRoute([...stack, CAR], CAR)!;
    expect(second.href).toBe(GARAGE);
  });

  it('and the car survives every step', () => {
    /* The defect in one line: this is what was being thrown away. */
    const stack = walk(GARAGE, CAR, RECORD, VISIT);
    expect(previousRoute(stack, VISIT)!.href).toBe(RECORD);
    expect(previousRoute(stack, VISIT)!.href).toContain('car=v1');
  });

  it('a second Back from the visit reaches the car, not the generic record', () => {
    let stack = walk(GARAGE, CAR, RECORD, VISIT);
    const one = previousRoute(stack, VISIT)!;
    stack = one.stack;
    expect(previousRoute([...stack, RECORD], RECORD)!.href).toBe(CAR);
  });

  it('one car is never swapped for another', () => {
    /* Two vehicles in one session. Back from the Kia's record must not reach
       the BMW's, whatever order they were opened in. */
    const stack = walk(GARAGE, '/vehicle?car=bmw', GARAGE, '/vehicle?car=kia', '/history?car=kia');
    const back = previousRoute(stack, '/history?car=kia')!;
    expect(back.href).toBe('/vehicle?car=kia');
    expect(back.href).not.toContain('bmw');
  });
});

describe('a cold arrival has no walk, and says so', () => {
  it('a notification lands with nothing behind it', () => {
    expect(previousRoute([], '/history/vs1')).toBeNull();
  });

  it('and so does the first screen of a session', () => {
    expect(previousRoute(walk('/'), '/')).toBeNull();
  });

  it('null is the signal to use the parent map - never a guess', () => {
    /* The caller falls back to `parentOf`; this must not invent a step. */
    expect(previousRoute(['/garage'], '/garage')).toBeNull();
  });
});

describe('nothing outside the product can become a Back destination', () => {
  it.each([
    'https://evil.example.com',
    '//evil.example.com',
    'javascript:alert(1)',
    'http://localhost:3000/garage',
    '/api/session',
    '',
    'garage',
  ])('%s is refused', href => {
    expect(isInternalHref(href)).toBe(false);
    expect(pushRoute(['/garage'], href)).toEqual(['/garage']);
  });

  it('and one that got into storage is dropped on the way out', () => {
    expect(sanitiseStack(['/garage', 'https://evil.example.com', '/you']))
      .toEqual(['/garage', '/you']);
    expect(previousRoute(['https://evil.example.com', '/garage'], '/garage')).toBeNull();
  });

  it('a referrer is never consulted at all', () => {
    /* The engine takes only what the product itself recorded. There is no
       input here that a page could set from outside. */
    /* Comments stripped: the file NAMES `history.back()` to explain why it is
       never called, and a law that cannot tell a mention from a call is a law
       that punishes documentation. */
    const src = require('fs').readFileSync('lib/os/navstack.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(src).not.toMatch(/document\.referrer|history\.back|window\.history/);
  });
});

describe('the stack stays a walk rather than a log', () => {
  it('standing still does not grow it', () => {
    expect(walk(GARAGE, GARAGE, GARAGE)).toEqual([GARAGE]);
  });

  it('an opened sheet is the same room', () => {
    /* `?panel=`, `?ask=`, `?club=` describe what is open, not where you are -
       and reopening a sheet is not going back. */
    expect(walk('/you', '/you?panel=profile', '/you')).toEqual(['/you']);
    expect(canonical('/you?panel=profile')).toBe('/you');
    expect(canonical('/cars/c1?ask=viewing')).toBe('/cars/c1');
  });

  it('but the car is kept, because it says WHICH room', () => {
    expect(canonical('/history?car=v1')).toBe('/history?car=v1');
    expect(canonical('/history?car=v1&panel=x')).toBe('/history?car=v1');
  });

  it('stepping back unwinds instead of appending', () => {
    /* Garage → Car → Garage leaves one entry, so Back does not bounce the
       customer between two rooms for ever. */
    expect(walk(GARAGE, CAR, GARAGE)).toEqual([GARAGE]);
  });

  it('it is capped, and the oldest step is the one that goes', () => {
    const many = Array.from({ length: STACK_LIMIT + 6 }, (_, i) => `/vehicle?car=v${i}`);
    const stack = walk(...many);
    expect(stack).toHaveLength(STACK_LIMIT);
    expect(stack[stack.length - 1]).toBe(many[many.length - 1]);
    expect(stack).not.toContain(many[0]);
  });

  it('and taking a step back shortens it', () => {
    const stack = walk(GARAGE, CAR, RECORD);
    expect(previousRoute(stack, RECORD)!.stack).toEqual([GARAGE]);
  });
});
