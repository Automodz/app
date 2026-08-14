/**
 * A REQUEST FROM THE BROWSER HAS TO SAY WHO IS MAKING IT.
 *
 * `BookingFlow` once sent no Authorization header at all, so every booking in
 * the product came back 401 and the customer was told "we couldn't arrange
 * that" - indistinguishable from the studio being full, for a request that had
 * simply never identified anybody. It is the one revenue action in the
 * customer application.
 *
 * ── AND THEN THE OPPOSITE FAILURE ────────────────────────────────────────
 * Every caller was then written as `const token = await idToken(); if (!token)
 * return 'session expired'`. The rooms authenticate with the httpOnly cookie
 * and the routes with a token, and those lapse independently - so a customer
 * reached a room that had just rendered their car, their visit and their
 * price, tapped its one control, and was told they were signed out. They were
 * not.
 *
 * `authedFetch` is the one answer to both: it carries the token when there IS
 * one, and otherwise lets the same-origin cookie identify the caller. The
 * sweep below is over that helper rather than over the header, because the
 * helper is now the thing that can be forgotten.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const codeOf = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

/** Every API route that refuses a caller without a Bearer token. */
const bearerRoutes = walk('app/api')
  .filter(f => /authorization'?\)\s*[;\n]|startsWith\('Bearer/.test(codeOf(f)))
  .map(f => f.replace(/^app/, '').replace(/\/route\.tsx?$/, ''));

describe('the booking request identifies the customer', () => {
  const flow = codeOf('components/studio/BookingFlow.tsx');

  it('goes through the helper that identifies it', () => {
    expect(flow).toMatch(/authedFetch\('\/api\/booking\/create'/);
  });

  it('and the helper waits for the SDK rather than reading it too early', () => {
    /* `auth.currentUser` is null until the SDK restores the persisted session,
       and a customer room mounts no AuthProvider to make that happen - so
       reading it directly returns "not yet", not "signed out". */
    const session = codeOf('lib/clientSession.ts');
    expect(session).toMatch(/await idToken\(forceFresh\)/);
    expect(session).toMatch(/waitForUser/);
    expect(flow).not.toMatch(/auth\??\.currentUser/);
  });

  it('and it no longer stands down because the SDK is asleep', () => {
    /* THE SECOND FAILURE. A customer signed in enough to SEE the sheet is
       signed in enough to book from it; only a 401 from the server means
       otherwise. */
    expect(flow).not.toMatch(/if \(!token\)/);
    expect(codeOf('lib/clientSession.ts')).toMatch(/credentials: 'same-origin'/);
  });
});

describe('no client caller of a Bearer route forgets the header', () => {
  it('found the Bearer-authenticated routes at all', () => {
    /* If this ever drops to zero the sweep below is vacuous and passes for the
       wrong reason. */
    expect(bearerRoutes.length).toBeGreaterThan(3);
  });

  it('every client call of one goes through authedFetch', () => {
    /* The assertion moved from the HEADER to the HELPER, because the header is
       no longer the whole answer: a token when there is one, the same-origin
       cookie when there is not. A bare `fetch` to one of these routes has
       neither guarantee. */
    const clients = [...walk('components'), ...walk('lib')]
      .filter(f => !f.includes('/server/') && !f.includes('clientSession'));

    const offenders: string[] = [];
    for (const file of clients) {
      const src = codeOf(file);
      for (const route of bearerRoutes) {
        let at = src.indexOf(`'${route}'`);
        while (at !== -1) {
          /* Look BACKWARDS from the address to the call that names it. */
          const opener = src.slice(Math.max(0, at - 60), at);
          if (/\bfetch\($/.test(opener.trimEnd()) && !/authedFetch\($/.test(opener.trimEnd())) {
            offenders.push(`${file} → ${route}`);
          }
          at = src.indexOf(`'${route}'`, at + 1);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * THE KEY THE CLIENT BUILDS MUST BE A KEY THE SERVER ACCEPTS.
 *
 * `createBookingAuthoritative` refuses anything outside `^[A-Za-z0-9_-]+$`,
 * and the client built its key out of the scheduled TIME - which contains a
 * colon. Every appointment booked from the customer application came back
 * `bad-idempotency-key` 400, and the sheet reported it with the same sentence
 * it uses for an outage, so it read as the studio declining work.
 *
 * Both halves of the rule are asserted here because they live in two files
 * that never import each other.
 */
describe('the idempotency key survives the server rule', () => {
  /** The server's rule, transcribed from lib/server/bookingService.ts. */
  const accepts = (k: string) =>
    typeof k === 'string' && k.length >= 8 && k.length <= 128 && !/[^A-Za-z0-9_-]/.test(k);

  /** The client's generator, transcribed from BookingFlow. */
  const keyFor = (vehicleId: string, serviceId: string, date: string, time: string) =>
    `${vehicleId}_${serviceId}_${date}_${time}`.replace(/[^A-Za-z0-9_-]/g, '-');

  it('the server rule still says what this test thinks it says', () => {
    const src = codeOf('lib/server/bookingService.ts');
    expect(src).toMatch(/\/\[\^A-Za-z0-9_-\]\/\.test\(intent\.idempotencyKey\)/);
    expect(src).toMatch(/idempotencyKey\.length < 8/);
  });

  it('a real booking intent produces an acceptable key', () => {
    const k = keyFor('car-nexon', 'svc-ceramic', '2026-08-13', '09:00');
    expect(accepts(k)).toBe(true);
    expect(k).not.toContain(':');
  });

  it('the unsanitised form is exactly what the server refused', () => {
    /* The regression, stated. Without the substitution this is the key that
       went over the wire. */
    expect(accepts('car-nexon_svc-ceramic_2026-08-13_09:00')).toBe(false);
  });

  it('is stable - the same intent yields the same key, so a retry joins', () => {
    const a = keyFor('car-nexon', 'svc-ceramic', '2026-08-13', '09:00');
    const b = keyFor('car-nexon', 'svc-ceramic', '2026-08-13', '09:00');
    expect(a).toBe(b);
  });

  it('different intents do not collide', () => {
    const a = keyFor('car-nexon', 'svc-ceramic', '2026-08-13', '09:00');
    const b = keyFor('car-nexon', 'svc-ceramic', '2026-08-13', '14:00');
    expect(a).not.toBe(b);
  });

  it('and the flow actually sanitises rather than trusting the inputs', () => {
    const flow = codeOf('components/studio/BookingFlow.tsx');
    expect(flow).toMatch(/replace\(\/\[\^A-Za-z0-9_-\]\/g, '-'\)/);
  });
});

/**
 * A BOOKING YOU CANNOT SEE IS A BOOKING YOU CANNOT CHANGE.
 *
 * The sheet that used to move or cancel a visit was reachable only by typing
 * `?manage=<id>` into the address bar: a customer could arrange a visit and
 * then had no way to change it, or even to see that it existed. `manageable`
 * was already projected and simply never drawn.
 *
 * It is drawn now, and it is a DOORWAY rather than a sheet. A booking has two
 * screens of its own (design 09 and 10), so the Studio lists what the customer
 * has arranged and each row opens the booking itself - which is what makes the
 * back button, a shared link and a notification all behave.
 */
describe('an arranged visit is visible and changeable', () => {
  const studio = codeOf('components/screens/StudioScreen.tsx');

  it('the Studio draws the visits it has projected', () => {
    expect(studio).toMatch(/manageable\.map\(/);
  });

  it('every row is a door to that booking, not a control inside a card', () => {
    /* §21.3, §4.3 - the whole row is the target. A small "Change or cancel"
       link inside a pane made the words the target rather than the visit. */
    const list = studio.slice(studio.indexOf('manageable.map('), studio.indexOf('THE WORK'));
    expect(list).toMatch(/href: v\.href/);
    expect(list).toMatch(/v\.standing/);
    expect(list).not.toMatch(/onClick/);
  });

  it('the Studio no longer carries a manage sheet of its own', () => {
    /* Two implementations of one screen is how they drift. The sheet is gone
       and its file with it. */
    expect(studio).not.toMatch(/ManageVisit/);
    expect(() => codeOf('components/studio/ManageVisit.tsx')).toThrow();
  });

  it('the address it opens is built by the resolver, never by the screen', () => {
    const project = codeOf('lib/customer/project.ts');
    expect(project).toMatch(/hrefForDestination\(\{ to: 'booking', bookingId: b\.id \}\)/);
  });

  /* The assertion that stood here matched the literal `?manage=${next.id}` in
     the projection's source. It broke the moment that expression moved into a
     named helper, having proved nothing about what the customer gets - and a
     source-shape check where the model itself can be asked is the string-
     matching this codebase keeps having to unlearn. Asked of the model now, in
     `__tests__/customer/next-visit.test.ts`, where every room's answer is
     compared against every other room's. */
});
