/**
 * HOW THE CUSTOMER ACTUALLY GOT HERE.
 *
 * Source: docs/AUTOMODZ-OS.md §6.5, §6.6, §17.3
 *
 * ── THE TWO ANSWERS TO "BACK", AND WHY BOTH ARE NEEDED ───────────────────
 * `parentOf` answers "what is this screen UNDER" — a property of the address,
 * true whether the customer walked here or was sent by a notification. It is
 * the only safe answer for a cold entry, and it is why it exists.
 *
 * It is the wrong answer when they DID walk. Reported from production:
 *
 *     Garage → the BMW → its history → Back landed on Now
 *
 * because `/history?car=v1` resolved to `/history`, which resolves to `/`. The
 * customer had never been to Now. Worse, the generic record then showed
 * whichever car the product picks by default, so Back could hand somebody a
 * different vehicle's history than the one they were reading.
 *
 * So: the walked path when there is one, the parent when there is not. This
 * file is the first half — the walk — and it is pure, so the rules below are
 * asserted directly rather than by driving a browser.
 *
 * ── WHAT IT WILL NOT DO ──────────────────────────────────────────────────
 * NEVER the browser's history. `history.back()` from an address opened by a
 * notification leaves the application entirely, and from a shared link it does
 * nothing at all — and the two are indistinguishable from working when you
 * happen to have arrived through the front door (§17.3).
 *
 * NEVER an address that is not ours. An entry is kept only if it is a rooted,
 * single-slash internal path; anything carrying a scheme, a host or a
 * protocol-relative prefix is dropped rather than sanitised, because a
 * "cleaned" external URL is still an external URL that got this far.
 */

/** How many steps back the product remembers. Deep enough for any real walk. */
export const STACK_LIMIT = 12;

/**
 * The query keys that are part of WHERE the customer is, rather than of what
 * they were doing there.
 *
 * `?car=` is the whole point: the record, the car and the garage are one room
 * per vehicle, and a Back that drops it is a Back that changes the subject.
 * Everything else — `?panel=`, `?ask=`, `?club=`, `?add=` — describes an open
 * sheet, and reopening a sheet is not going back.
 */
export const CONTEXT_KEYS: readonly string[] = ['car', 'visit'];

/**
 * Is this an address inside the customer product, expressed as a path we can
 * navigate to directly?
 *
 * Deliberately strict. `//evil.example.com` is a protocol-relative URL that
 * `startsWith('/')` accepts and a browser treats as another origin — the same
 * shape the sign-in redirect guard refuses, for the same reason.
 */
export const isInternalHref = (href: unknown): href is string =>
  typeof href === 'string'
  && href.startsWith('/')
  && !href.startsWith('//')
  && !href.includes('://')
  && !href.startsWith('/api/');

/**
 * An address reduced to what identifies the ROOM: its path plus the context
 * that says which car or visit it is about. Two entries that differ only by an
 * open sheet are the same place, so the stack does not grow while a customer
 * opens and closes one.
 */
export function canonical(href: string): string {
  const [path, query = ''] = href.split('?');
  const keep = new URLSearchParams();
  for (const [k, v] of new URLSearchParams(query)) {
    if (CONTEXT_KEYS.includes(k) && v) keep.set(k, v);
  }
  const qs = keep.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * Record an arrival.
 *
 * Returns a NEW stack — the caller decides where to keep it, which is what
 * lets the same rules run in a test, in a provider and against a persisted
 * session without three copies of them.
 */
export function pushRoute(stack: readonly string[], href: string): string[] {
  if (!isInternalHref(href)) return [...stack];
  const here = canonical(href);
  const next = [...stack];

  /* Already standing here — a re-render, a replaced query, a sheet closing. */
  if (next[next.length - 1] === here) return next;

  /* GOING BACK IS NOT GOING SOMEWHERE NEW. If the customer has stepped to the
     address directly behind them, the walk unwinds rather than growing — so
     Garage → Car → Garage leaves the stack at Garage, and a second Back does
     not bounce them between the two for ever. */
  if (next[next.length - 2] === here) {
    next.pop();
    return next;
  }

  next.push(here);
  while (next.length > STACK_LIMIT) next.shift();
  return next;
}

/**
 * Where Back goes, and the stack that remains after taking it.
 *
 * `null` means the customer did not walk here — they were sent, or this is the
 * first screen of the session — and the caller must fall back to `parentOf`.
 */
export function previousRoute(
  stack: readonly string[], here: string,
): { href: string; stack: string[] } | null {
  const at = canonical(here);
  const clean = stack.filter(isInternalHref);

  /* Find where we are, and take the entry before it. Searching rather than
     assuming the top is the current address keeps this correct when a render
     happens before the push, which is the ordinary case on a fresh mount. */
  const i = clean.lastIndexOf(at);
  const idx = i === -1 ? clean.length : i;
  const previous = clean[idx - 1];
  if (!previous || canonical(previous) === at) return null;

  return { href: previous, stack: clean.slice(0, idx - 1) };
}

/**
 * The stack as it survives a cold launch: internal entries only, capped, and
 * with no two consecutive duplicates. Applied on read as well as on write,
 * because what is in storage was written by an older build of this file.
 */
export function sanitiseStack(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const raw of input) {
    if (!isInternalHref(raw)) continue;
    const here = canonical(raw);
    if (out[out.length - 1] === here) continue;
    out.push(here);
  }
  return out.slice(-STACK_LIMIT);
}
