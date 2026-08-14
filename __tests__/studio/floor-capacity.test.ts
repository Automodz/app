/**
 * THE STUDIO'S FLOOR: FOUR BAYS, AND WHAT EACH DISCIPLINE COSTS ONE.
 *
 * The scheduler had NO tests. `computeAvailability` decides which days and
 * hours a customer is offered, and the only coverage it had was two assertions
 * inside `concierge.test.ts` about multi-day spans - nothing at all pinned how
 * much of the floor a service takes, or how many cars can be on it at once.
 *
 * The owner's floor, stated 15 August 2026:
 *
 *   THREE PROTECTION BAYS  PPF, ceramic, detailing and coating share them
 *   TWO WASH BAYS          washing runs alongside, never against them
 *   DURATION IS ELAPSED CLOCK TIME, and the bay is held overnight:
 *     Garware Plus 2880 = 2 days · LLumar Valor 4320 = 3 · Prolong 480 = 1
 *
 * Before this, protection capacity was HARD-CODED to 1 in `availability.ts` -
 * so the second protection bay could not be expressed by any setting, and one
 * ceramic closed the studio to every PPF enquiry for the length of the job.
 */
import {
  computeAvailability, candidateSlots, resourceCapacity, categoryToResource,
  expandIntervals, spanDays, baysOf, RESOURCE_DEFAULTS, DAY_OPEN_MIN, WORK_DAY_MIN,
  type Occupant, type ResourceConfig,
} from '@/lib/availability';
import { readFileSync } from 'fs';
import { CATALOGUE } from '@/lib/catalogue/services';
import { studioDay, studioDayPlus } from '@/lib/os/lifecycle';

const FLOOR: ResourceConfig = RESOURCE_DEFAULTS;

const days = (n: number, from = '2026-09-07') =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(`${from}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });

const inProtection = (durationMin: number, date = '2026-09-07'): Occupant => ({
  resource: 'protection', date, startMin: DAY_OPEN_MIN, durationMin,
} as Occupant);

/* ── THE FLOOR ───────────────────────────────────────────────────────────── */

describe('the studio has five bays - three protection, two wash', () => {
  it('three protection bays, and the number is configurable rather than baked in', () => {
    expect(resourceCapacity('protection', FLOOR)).toBe(3);
    /* The bug this replaces: it returned 1 whatever the configuration said. */
    expect(resourceCapacity('protection', { ...FLOOR, protectionCapacity: 5 })).toBe(5);
  });

  it('five bays in all, each one named', () => {
    expect(baysOf(FLOOR).map(b => b.id))
      .toEqual(['protection-1', 'protection-2', 'protection-3', 'wash-1', 'wash-2']);
  });

  it('a disabled bay is gone by NAME, and the capacity falls with it', () => {
    const down = { ...FLOOR, disabledBays: ['protection-2'] };
    expect(baysOf(down).map(b => b.id)).not.toContain('protection-2');
    expect(resourceCapacity('protection', down)).toBe(2);
  });

  it('two wash bays', () => {
    expect(resourceCapacity('wash', FLOOR)).toBe(2);
  });

  it('PPF, ceramic and coating share the protection bays; washing does not', () => {
    for (const c of ['PPF', 'Ceramic', 'Coating'] as const) {
      expect({ c, r: categoryToResource(c) }).toEqual({ c, r: 'protection' });
    }
    expect(categoryToResource('Washing')).toBe('wash');
  });

  it('a capacity below one is impossible - it would close the studio', () => {
    expect(resourceCapacity('wash', { washCapacity: 0, protectionCapacity: 0 })).toBe(1);
  });
});

/* ── WHAT EACH DISCIPLINE COSTS ──────────────────────────────────────────── */

describe('the catalogue reserves what the owner says it reserves', () => {
  const durationsIn = (category: string) =>
    [...new Set(CATALOGUE.filter(s => s.category === category).map(s => s.duration))];

  it('the films carry the studio’s own elapsed minutes, and they differ', () => {
    expect(durationsIn('PPF').sort((a, b) => a - b)).toEqual([2880, 3600, 4320]);
    /* 2880 elapsed from 09:00 ends 09:00 two days on - two days held. */
    expect(expandIntervals({ date: '2026-09-07', startMin: DAY_OPEN_MIN, durationMin: 2880 })
      .map(d => d.date)).toEqual(['2026-09-07', '2026-09-08']);
    /* 4320 is three. */
    expect(spanDays(DAY_OPEN_MIN, 4320)).toBe(3);
  });

  it('the ceramics rise with the chemistry and all finish inside a day', () => {
    expect(durationsIn('Ceramic').sort((a, b) => a - b)).toEqual([480, 720, 840]);
    for (const d of durationsIn('Ceramic')) {
      expect({ d, days: spanDays(DAY_OPEN_MIN, d) }).toEqual({ d, days: 1 });
    }
  });

  it('a job at or beyond a working day is offered one start, not a menu', () => {
    expect(candidateSlots(600)).toEqual(['09:00']);
    expect(candidateSlots(2880)).toEqual(['09:00']);
  });

  it('the shorter work still spreads across the day', () => {
    expect(candidateSlots(180).length).toBeGreaterThan(10);
    expect(candidateSlots(180)[0]).toBe('09:00');
  });
});

/* ── HOW THE HOURS ACTUALLY DISTRIBUTE ───────────────────────────────────── */

describe('a second car fits, and a third does not', () => {
  it('one ceramic leaves the other two protection bays open', () => {
    const { fullDates } = computeAvailability(days(2), 'Ceramic', 480, [inProtection(480)], FLOOR);
    expect(fullDates).toEqual([]);
  });

  it('three ceramics fill the day, and only that day', () => {
    const all = [inProtection(480), inProtection(480), inProtection(480)];
    const { fullDates } = computeAvailability(days(3), 'Ceramic', 480, all, FLOOR);
    expect(fullDates).toEqual(['2026-09-07']);
  });

  it('one PPF leaves room for a ceramic beside it on both of its days', () => {
    const { fullDates } = computeAvailability(days(3), 'Ceramic', 480, [inProtection(2880)], FLOOR);
    expect(fullDates).toEqual([]);
  });

  it('three PPFs close protection for two days, and release it on the third', () => {
    const all = [inProtection(2880), inProtection(2880), inProtection(2880)];
    const { fullDates } = computeAvailability(days(3), 'PPF', 2880, all, FLOOR);
    expect(fullDates).toEqual(['2026-09-07', '2026-09-08']);
  });

  it('and washing is untouched by any of it - a different pair of bays', () => {
    const both = [inProtection(2880), inProtection(2880), inProtection(2880)];
    const { fullDates } = computeAvailability(days(3), 'Washing', 60, both, FLOOR);
    expect(fullDates).toEqual([]);
  });

  it('two washes still leave the hour open; a third takes it', () => {
    const wash = (startMin: number): Occupant => ({
      resource: 'wash', date: '2026-09-07', startMin, durationMin: 60,
    } as Occupant);
    const at9 = 9 * 60;
    const two = computeAvailability(days(1), 'Washing', 60, [wash(at9), wash(at9)], FLOOR);
    expect(two.fullSlots['2026-09-07']).toContain('09:00');
    const one = computeAvailability(days(1), 'Washing', 60, [wash(at9)], FLOOR);
    expect(one.fullSlots['2026-09-07']).not.toContain('09:00');
  });
});

/* ── WHAT THE CUSTOMER IS TOLD vs WHAT THE BAY IS HELD FOR ───────────────── */

describe('the promise and the reservation are the same number', () => {
  /**
   * `StudioScreen#inTheStudio` called a day 480 minutes while the floor's day
   * is 600, so a 1200-minute PPF was advertised as "3 days in the studio" and
   * reserved for 2. A sentence and a reservation computed from different
   * constants drift apart the moment either is touched, so the sentence is
   * derived from `spanDays` - the function the reservation itself uses.
   */
  const advertised = (minutes: number) => {
    const src = readFileSync('components/screens/StudioScreen.tsx', 'utf8');
    /* The rule, not a copy of it: the screen must reach for the engine's own
       wording rather than dividing minutes by a day-length of its choosing.
       It had 480; the floor's day is 600; the reservation is elapsed. Three
       answers to one question is how "3 days in the studio" got shipped for a
       two-day job. */
    expect(src).toMatch(/readyWords/);
    expect(src).not.toMatch(/minutes \/ 480/);
    expect(src).not.toMatch(/\/ 1440/);
    return spanDays(DAY_OPEN_MIN, minutes);
  };

  it.each([
    ['Garware Plus', 2880, 2],
    ['LLumar Valor', 4320, 3],
    ['Kovalent Prolong', 480, 1],
  ] as const)('%s: %i minutes is %i day(s), told and held', (_c, minutes, days) => {
    expect(advertised(minutes)).toBe(days);
    expect(expandIntervals({ date: '2026-09-07', startMin: DAY_OPEN_MIN, durationMin: minutes }))
      .toHaveLength(days);
  });

  it('every service in the catalogue agrees with its own reservation', () => {
    for (const s of CATALOGUE) {
      const held = expandIntervals({
        date: '2026-09-07', startMin: DAY_OPEN_MIN, durationMin: s.duration,
      }).length;
      expect({ id: s.id, told: spanDays(DAY_OPEN_MIN, s.duration), held })
        .toEqual({ id: s.id, told: held, held });
    }
  });
});

/* ── THE STUDIO'S CLOCK ──────────────────────────────────────────────────── */

describe('a day is the studio’s day, not the browser’s UTC day', () => {
  /**
   * MEASURED, 02:02 IST on 15 August 2026: the booking sheet offered
   * "TODAY 14 Aug" and "TOMORROW 15 Aug". `toISOString()` is UTC and the studio
   * is UTC+5:30, so for the five and a half hours after midnight every single
   * day the product named YESTERDAY - and a customer tapping Today asked for a
   * date that had already gone.
   *
   * The offset existed, twice, in `puc` and `membership`. The one place a date
   * is actually CHOSEN had neither.
   */
  const IST_EARLY = new Date('2026-08-14T20:32:00Z'); // 02:02 IST on the 15th

  it('names the studio’s date in the hours UTC still calls yesterday', () => {
    expect(IST_EARLY.toISOString().slice(0, 10)).toBe('2026-08-14');
    expect(studioDay(IST_EARLY)).toBe('2026-08-15');
  });

  it('and the day picker starts from it', () => {
    expect(studioDayPlus(0, IST_EARLY)).toBe('2026-08-15');
    expect(studioDayPlus(1, IST_EARLY)).toBe('2026-08-16');
  });

  it('the picker and the scheduler read ONE definition, not two of their own', () => {
    const sheet = readFileSync('components/studio/BookingFlow.tsx', 'utf8');
    const server = readFileSync('lib/server/openings.ts', 'utf8');
    for (const [name, src] of [['sheet', sheet], ['scheduler', server]] as const) {
      expect({ name, importsClock: /studioDay/.test(src) }).toEqual({ name, importsClock: true });
      expect({ name, ownUtcDate: /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/.test(src) })
        .toEqual({ name, ownUtcDate: false });
    }
  });
});
