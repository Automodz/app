/**
 * ARRANGING A VISIT HAS TO SAY WHO IS ARRANGING IT.
 *
 * `/api/booking/create` authenticates with a Bearer ID token and reads no
 * cookie — the session cookie exists for SERVER RENDERING and that route never
 * looks at it. `BookingFlow` sent no Authorization header at all, so every
 * booking in the product came back 401 and the customer was told "we couldn't
 * arrange that": indistinguishable from the studio being full, for a request
 * that had simply never identified anybody. It is the one revenue action in
 * the customer application.
 *
 * Written as a sweep over the routes rather than a single assertion, so the
 * next client caller of a Bearer-authenticated route cannot repeat it.
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
  it('sends a Bearer token, not just a body', () => {
    const flow = codeOf('components/studio/BookingFlow.tsx');
    const call = flow.slice(flow.indexOf("fetch('/api/booking/create'"));
    expect(call).toMatch(/Authorization: `Bearer \$\{token\}`/);
  });

  it('gets that token from the signed-in Firebase session', () => {
    const flow = codeOf('components/studio/BookingFlow.tsx');
    expect(flow).toMatch(/auth\?\.currentUser\?\.getIdToken\(\)/);
  });

  it('says so plainly when there is no session, rather than blaming the studio', () => {
    /* "We couldn't arrange that" for an unauthenticated request reads as the
       studio being unable to take the booking. It was ours, and it was fixable
       by the customer. */
    const flow = codeOf('components/studio/BookingFlow.tsx');
    const guard = flow.slice(flow.indexOf('if (!token)'), flow.indexOf("fetch('/api/booking/create'"));
    expect(guard).toMatch(/session has expired/i);
  });
});

describe('no client caller of a Bearer route forgets the header', () => {
  it('found the Bearer-authenticated routes at all', () => {
    /* If this ever drops to zero the sweep below is vacuous and passes for the
       wrong reason. */
    expect(bearerRoutes.length).toBeGreaterThan(3);
  });

  it('every client fetch of one carries an Authorization header', () => {
    const clients = [...walk('components'), ...walk('lib')]
      .filter(f => !f.includes('/server/'));

    const offenders: string[] = [];
    for (const file of clients) {
      const src = codeOf(file);
      for (const route of bearerRoutes) {
        const at = src.indexOf(`'${route}'`);
        if (at === -1) continue;
        /* The options object of that call — generous enough to span a
           multi-line fetch, tight enough not to reach the next one. */
        const call = src.slice(at, at + 400);
        if (!/Authorization/.test(call)) offenders.push(`${file} → ${route}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * THE KEY THE CLIENT BUILDS MUST BE A KEY THE SERVER ACCEPTS.
 *
 * `createBookingAuthoritative` refuses anything outside `^[A-Za-z0-9_-]+$`,
 * and the client built its key out of the scheduled TIME — which contains a
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

  it('is stable — the same intent yields the same key, so a retry joins', () => {
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
 * `ManageVisit` has always been able to move or cancel a visit, and nothing in
 * the product rendered a control that opened it: the sheet was reachable only
 * by typing `?manage=<id>` into the address bar. A customer could arrange a
 * visit and then had no way to change it — or even to see that it existed.
 * `manageable` was already projected, already mirrored `firestore.rules`, and
 * was simply never drawn.
 */
describe('an arranged visit is visible and changeable', () => {
  const studio = codeOf('components/screens/StudioScreen.tsx');

  it('the Studio draws the visits it has projected', () => {
    expect(studio).toMatch(/manageable\.map\(/);
  });

  it('and offers to change only the ones the server would let it', () => {
    /* `changeable` mirrors firestore.rules — pending or confirmed only. */
    const list = studio.slice(studio.indexOf('manageable.map('), studio.indexOf('7 · ARRANGING'));
    expect(list).toMatch(/v\.changeable \?/);
    expect(list).toMatch(/Change or cancel/);
  });

  it('opening it writes the address, so the back button closes it', () => {
    /* §6.4 — moving or cancelling is addressable. Local state would make the
       sheet unlinkable and would leave the back button dismissing the room. */
    expect(studio).toMatch(/const openManage = \(id: string\) => \{/);
    expect(studio).toMatch(/next\.set\('manage', id\)/);
  });

  it('the car points at its OWN visit, not merely at the Studio', () => {
    /* `/studio` alone sent the customer to a room that showed no trace of the
       booking they had come to change. */
    const project = codeOf('lib/customer/project.ts');
    expect(project).toMatch(/\?manage=\$\{next\.id\}/);
  });
});
