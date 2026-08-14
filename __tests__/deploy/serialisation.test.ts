/**
 * THE BUILD THAT WOULD NOT SHIP.
 *
 *   Error occurred prerendering page "/sitemap.xml"
 *   RangeError: Invalid time value  at Date.toISOString
 *
 * `loadListings` serialised Firestore documents with
 * `JSON.parse(JSON.stringify(...))`. An Admin SDK `Timestamp` survives that as
 * `{"_seconds":…,"_nanoseconds":…}` - an object that looks like data and
 * behaves like nothing. The sitemap did `new Date(c.updatedAt)`, got an
 * Invalid Date, and Next's serialiser called `.toISOString()` on it inside the
 * prerender. The whole production build exited 1.
 *
 * IT PASSED LOCALLY, which is the part worth remembering: there are no Admin
 * credentials on this machine, so `loadListings` returns `[]` and no document
 * was ever serialised. The failure needed real data to appear - so the
 * serialiser now lives in its own module, free of `firebase-admin`, and is
 * exercised here against a document shaped exactly like a real one.
 */

/**
 * A Firestore `Timestamp`, modelled.
 *
 * `firebase-admin` cannot be imported here - it pulls in ESM `jose`, which
 * Jest will not parse. What matters is the shape the real class presents: a
 * `toDate()` method, and `_seconds`/`_nanoseconds` as its only own enumerable
 * fields, which is precisely why a JSON round-trip reduced it to those two
 * numbers and lost the date.
 */
class FakeTimestamp {
  _seconds: number;

  _nanoseconds: number;

  constructor(d: Date) {
    this._seconds = Math.floor(d.getTime() / 1000);
    this._nanoseconds = (d.getTime() % 1000) * 1e6;
  }

  toDate(): Date {
    return new Date(this._seconds * 1000 + this._nanoseconds / 1e6);
  }
}
import { readFileSync } from 'fs';
import { plainValue, plainDoc } from '@/lib/server/plain';
import { toSell } from '@/lib/customer/market';
import type { SellRequest } from '@/lib/types';

const codeOf = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('a Firestore document crosses to the client intact', () => {
  const when = new Date('2026-07-18T09:30:00.000Z');

  it('a Timestamp becomes an ISO string, not an opaque object', () => {
    expect(plainValue(new FakeTimestamp(when))).toBe(when.toISOString());
  });

  it('and that string makes a VALID Date - the whole bug in one line', () => {
    const iso = plainValue(new FakeTimestamp(when)) as string;
    expect(Number.isNaN(new Date(iso).getTime())).toBe(false);

    /* What the old code produced, and what happened next. This is the exact
       value that reached `toISOString()` and exited the build. */
    const broken = JSON.parse(JSON.stringify(new FakeTimestamp(when)));
    expect(broken).toEqual({ _seconds: expect.any(Number), _nanoseconds: expect.any(Number) });
    expect(Number.isNaN(new Date(broken as never).getTime())).toBe(true);
    expect(() => new Date(broken as never).toISOString()).toThrow(RangeError);
  });

  it('a document keeps its id and loses nothing else', () => {
    const out = plainDoc<{ id: string; title: string; updatedAt: string }>(
      'c1', { title: 'A car', updatedAt: new FakeTimestamp(when) },
    );
    expect(out).toEqual({ id: 'c1', title: 'A car', updatedAt: when.toISOString() });
  });

  it('converts Timestamps nested in objects and arrays', () => {
    const out = plainValue({
      id: 'c1',
      updatedAt: new FakeTimestamp(when),
      photos: [{ url: 'u', takenAt: new FakeTimestamp(when) }],
    }) as { updatedAt: string; photos: { takenAt: string }[] };
    expect(out.updatedAt).toBe(when.toISOString());
    expect(out.photos[0].takenAt).toBe(when.toISOString());
  });

  it('drops undefined, which cannot cross to a client component', () => {
    expect(plainValue({ a: 1, b: undefined })).toEqual({ a: 1 });
  });

  it('leaves ordinary values alone', () => {
    expect(plainValue({ n: 3, s: 'x', b: true, z: null }))
      .toEqual({ n: 3, s: 'x', b: true, z: null });
  });

  it('nothing serialises Firestore data by JSON round-trip any more', () => {
    for (const f of ['lib/server/marketplace.ts', 'lib/server/plain.ts']) {
      expect(codeOf(f)).not.toMatch(/JSON\.parse\(JSON\.stringify/);
    }
  });
});

describe('the sitemap can never fail a build over a date', () => {
  it('an unusable date falls back rather than throwing', () => {
    /* `lastModified` is handed to `toISOString()` by Next. A slightly wrong
       date in a sitemap is nothing; a build that will not ship is not. */
    const src = codeOf('app/sitemap.ts');
    expect(src).toMatch(/const dateOr =/);
    expect(src).toMatch(/Number\.isNaN\(d\.getTime\(\)\) \? fallback : d/);
    expect(src).toMatch(/lastModified: dateOr\(c\.updatedAt, now\)/);
  });

  it('the guard it uses actually holds, for every shape a document can carry', () => {
    /* `app/sitemap.ts` cannot be imported here - it reaches `firebase-admin`
       through the loader - so the guard's own logic is exercised directly. */
    const dateOr = (value: unknown, fallback: Date): Date => {
      if (value instanceof Date) return Number.isNaN(value.getTime()) ? fallback : value;
      if (typeof value !== 'string' || value.trim() === '') return fallback;
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? fallback : d;
    };
    const now = new Date('2026-08-05T00:00:00.000Z');
    /* `null` and `''` are the interesting ones: `new Date` turns both into 1
       January 1970 rather than an Invalid Date, so a looser guard would have
       published the epoch as every listing's last-modified. */
    for (const bad of [undefined, null, '', '   ', 'not a date', { _seconds: 1 }, NaN, 0]) {
      expect(() => dateOr(bad, now).toISOString()).not.toThrow();
      expect(dateOr(bad, now)).toEqual(now);
    }
    expect(dateOr('2026-07-18T09:30:00.000Z', now).toISOString())
      .toBe('2026-07-18T09:30:00.000Z');
  });
});

describe('the dates a customer actually reads', () => {
  const offer = (createdAt: unknown): SellRequest => ({
    id: 's1', userId: 'u1', name: 'Nikhil', phone: '9000000000',
    make: 'Honda', model: 'City', year: 2018, kmDriven: 60000,
    photos: [], status: 'new', createdAt, updatedAt: createdAt,
  } as unknown as SellRequest);

  it('an offer shows the day it was made', () => {
    /* This read `typeof createdAt === 'string'` and silently produced an empty
       string for every offer, because the value was an object. */
    expect(toSell([offer('2026-07-18T09:30:00.000Z')]).offers[0].when)
      .toMatch(/18 July 2026/);
  });

  it('and says nothing rather than "Invalid Date" if it ever is not one', () => {
    expect(toSell([offer({ _seconds: 1 })]).offers[0].when).toBe('');
    expect(toSell([offer(undefined)]).offers[0].when).toBe('');
  });
});
