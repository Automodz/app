/**
 * NOTIFICATIONS — §17, ENFORCED.
 *
 * §17.3: "A notification is a doorway. It opens the exact surface it is about —
 * never the home screen, never a generic list."
 *
 * Every customer notification in the product pointed at `/app`. That was the
 * old customer root, and it stopped existing when the rooms moved to `/` — so a
 * booking confirmation, a car ready to collect and a missed appointment all
 * opened a 404. Nothing caught it, because a push destination is only wrong on
 * the device it is tapped on.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { notificationHref } from '@/navigation/resolve';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

const codeOf = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('§17.1 — there is no inbox', () => {
  it('no surface renders a list of notifications', () => {
    /* "A list of notifications is the same mistake as a list of documents."
       State changes surface as state; the car is the inbox. */
    const readers = [...walk('app'), ...walk('components')]
      .filter(f => !f.includes('node_modules'))
      .filter(f => /getUserNotifications|markAllNotificationsRead/.test(codeOf(f)));
    expect(readers).toEqual([]);
  });
});

describe('§17.3 — every notification lands somewhere real', () => {
  const shipping = [...walk('lib'), ...walk('app'), ...walk('components'), ...walk('navigation')]
    .filter(f => !f.includes('node_modules'));

  it('nothing points at /app, which no longer exists', () => {
    const offenders = shipping.filter(f => /['"]\/app['"]|['"]\/app\?/.test(codeOf(f)));
    expect(offenders).toEqual([]);
  });

  it('a visit notification opens that visit', () => {
    expect(notificationHref({ type: 'booking_update', bookingId: 'b1' })).toBe('/history/b1');
  });

  it('a membership notification opens the membership', () => {
    expect(notificationHref({ type: 'membership' })).toBe('/membership');
  });

  it('a reminder with no object opens the car, not a list', () => {
    expect(notificationHref({ type: 'reminder' })).toBe('/');
    expect(notificationHref({ type: 'promotion' })).toBe('/');
  });

  it('the bookingId wins over the type — the object is more specific', () => {
    expect(notificationHref({ type: 'membership', bookingId: 'b9' })).toBe('/history/b9');
  });

  it('every destination it can produce is an internal address', () => {
    for (const n of [
      { type: 'booking_update', bookingId: 'b' },
      { type: 'membership' },
      { type: 'reminder' },
      { type: 'promotion' },
      {},
    ]) {
      const href = notificationHref(n);
      expect(href.startsWith('/')).toBe(true);
      expect(href.startsWith('//')).toBe(false);
    }
  });
});

describe('the stored record and the push agree', () => {
  const bookings = codeOf('lib/services/bookings.ts');

  it('a notification is written WITH its destination', () => {
    expect(bookings).toMatch(/url: notificationHref\(\{ type, bookingId \}\)/);
  });

  it('every push resolves its destination the same way', () => {
    const pushes = bookings.match(/sendPushToUser\(\{[^}]*\}\)/g) ?? [];
    expect(pushes.length).toBeGreaterThan(0);
    for (const p of pushes) expect(p).toMatch(/notificationHref\(/);
  });

  it('the resolver is the only place a destination is decided', () => {
    const resolve = codeOf('navigation/resolve.ts');
    expect(resolve).toMatch(/export const notificationHref/);
  });
});

describe('§17.2 — push is spent only where it is earned', () => {
  it('the service worker falls back to the car, never to a dead path', () => {
    expect(codeOf('app/firebase-messaging-sw.js/route.ts')).toMatch(/data\.url \|\| '\/'/);
  });

  it('an admin push falls back into admin, not into the customer app', () => {
    expect(codeOf('lib/server/notify.ts')).toMatch(/url \?\? '\/admin'/);
  });

  it('preferences are honoured by the job that would send', () => {
    /* §17.4 — frequency is a budget, and the customer holds it. */
    expect(codeOf('lib/server/retention.ts')).toMatch(/typeAllowed/);
  });
});

describe('crawlers are kept out of the customer rooms', () => {
  it('robots disallows the real signed-in surfaces, not the retired one', () => {
    const robots = codeOf('app/robots.ts');
    for (const room of ['/garage', '/vehicle', '/history', '/studio', '/you', '/membership']) {
      expect(robots).toContain(`'${room}'`);
    }
    /* `/` stays OUT of the disallow list — signed out it is the public
       landing. Asserted against the array itself: a looser pattern ran past
       the preview branch and matched the `allow: '/'` beside it. */
    const list = robots.slice(robots.indexOf('disallow: ['), robots.indexOf('],', robots.indexOf('disallow: [')));
    expect(list).not.toMatch(/'\/'/);
    expect(list).toContain("'/admin'");
  });
});
