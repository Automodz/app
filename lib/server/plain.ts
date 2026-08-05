/**
 * FIRESTORE DATA, MADE PLAIN.
 *
 * A document read with the Admin SDK cannot be handed to a client component as
 * it comes: `Timestamp` is a class instance, and `undefined` is not
 * serialisable across the boundary at all.
 *
 * THIS USED TO BE `JSON.parse(JSON.stringify(doc))`, and that broke the
 * production build. A `Timestamp` survives a JSON round-trip as
 * `{"_seconds":…,"_nanoseconds":…}` — an object that looks like data and
 * behaves like nothing. `new Date(...)` on it is an Invalid Date, so the
 * sitemap's `lastModified` threw `RangeError: Invalid time value` inside
 * Next's prerender and the deploy exited 1. It also silently emptied every
 * date the offer list showed, because that code tests for a string.
 *
 * It lives in its own file, free of `firebase-admin`, so it can be tested
 * without pulling that package's ESM dependencies through Jest — the failure
 * only ever appeared with real documents, which no local run has.
 */

/** Anything with a `toDate()` — the Admin and client `Timestamp` both qualify. */
const isTimestamp = (v: unknown): v is { toDate: () => Date } =>
  typeof v === 'object' && v !== null
  && typeof (v as { toDate?: unknown }).toDate === 'function';

/**
 * One value, made plain. Timestamps become ISO strings, `undefined` is
 * dropped, and everything else is carried through as it is.
 */
export const plainValue = (v: unknown): unknown => {
  if (isTimestamp(v)) {
    const d = v.toDate();
    /* A Timestamp can hold a date no `Date` can represent. Better a missing
       field than one that throws the moment anything formats it. */
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  if (Array.isArray(v)) return v.map(plainValue);
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? undefined : v.toISOString();
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .map(([k, x]) => [k, plainValue(x)])
        .filter(([, x]) => x !== undefined),
    );
  }
  return v;
};

/** One document, with its id, made plain. */
export const plainDoc = <T,>(id: string, data: Record<string, unknown>): T =>
  plainValue({ id, ...data }) as T;
