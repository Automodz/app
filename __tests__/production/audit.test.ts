/**
 * FINAL PRODUCTION AUDIT - the findings, pinned.
 *
 * Each block corresponds to something this audit actually found in code that
 * was already called finished:
 *
 *   SEVEN PERMANENT REDIRECTS POINTED AT A DELETED ADDRESS. `/dashboard/*`
 *   301'd to `/app*`, which stopped existing when the customer rooms moved to
 *   the root. A 301 is cached by the browser and never asked again, so every
 *   old bookmark went to a 404 - permanently. The earlier integration sweep
 *   missed it because it walked `lib`, `app`, `components` and `navigation`,
 *   and `next.config.js` is none of those.
 *
 *   "ALLOW POP-UPS" IS IMPOSSIBLE ADVICE INSIDE INSTAGRAM. `signInWithPopup`
 *   cannot complete in an in-app webview, and the product told the customer to
 *   change a setting that does not exist there.
 *
 *   A SECOND CLIENT-SIDE BOOKING PATH SURVIVED. `requestBooking` still wrote
 *   bookings straight from the browser, bypassing the pricing authority and
 *   the studio notification that `POST /api/booking/create` exists to
 *   guarantee. Unused - but one import away from recreating the defect that
 *   made new bookings invisible.
 *
 *   UPLOADS HAD NO SIZE CEILING. Everything is re-encoded to JPEG so what is
 *   STORED is bounded, but the decode was not: a 100MB frame was pulled into
 *   an `<img>` and a canvas first, which is how a phone tab dies.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { isInAppBrowser } from '@/lib/browser';
import { authFault } from '@/lib/authError';
import { tooLargeToUpload, MAX_UPLOAD_BYTES } from '@/lib/services/storage';

const codeOf = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

const ALL = [...walk('lib'), ...walk('app'), ...walk('components'), ...walk('navigation')]
  .filter(f => !f.includes('node_modules'));

describe('every redirect lands somewhere that answers', () => {
  const config = readFileSync('next.config.js', 'utf8');
  const redirects = [...config.matchAll(
    /\{ source: '([^']+)', destination: '([^']+)', permanent: (true|false) \}/g,
  )].map(m => ({ source: m[1], destination: m[2], permanent: m[3] === 'true' }));

  const routes = walk('app')
    .filter(f => f.endsWith('page.tsx'))
    .map(f => f.replace(/^app/, '').replace(/\/page\.tsx$/, '') || '/')
    .map(r => new RegExp(`^${r.replace(/\[[^\]]+\]/g, '[^/]+')}$`));

  it('there are redirects to check', () => {
    expect(redirects.length).toBeGreaterThan(10);
  });

  it('none of them points at the deleted /app', () => {
    expect(redirects.filter(r => /^\/app(\/|$|\?)/.test(r.destination))).toEqual([]);
  });

  it.each(redirects.map(r => [r.source, r.destination] as const))(
    '%s → %s is a real route', (_source, destination) => {
      const path = destination.split('?')[0];
      expect({ destination, found: routes.some(r => r.test(path)) })
        .toEqual({ destination, found: true });
    },
  );

  it('the live sell-car route is not shadowed by a /dashboard redirect', () => {
    /* `source: '/dashboard'` matches that path exactly. A wildcard here would
       swallow `/dashboard/sell-car`, which is a real surface. */
    expect(redirects.some(r => /^\/dashboard\/:/.test(r.source))).toBe(false);
    expect(redirects.some(r => r.source === '/dashboard/sell-car')).toBe(false);
  });
});

describe('a failure in an in-app browser says something possible', () => {
  it('recognises the webviews that cannot complete a sign-in pop-up', () => {
    for (const ua of [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Instagram 302.0',
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 [FB_IAB/FB4A;FBAV/450.0]',
      'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 [FBAN/FBIOS;FBAV/449.0]',
      'Mozilla/5.0 (Linux; Android 13) musical_ly_32.5.3 BytedanceWebview',
      'Mozilla/5.0 (iPhone) Snapchat/12.7',
      'Mozilla/5.0 (iPhone) LinkedInApp/9.2',
    ]) {
      expect({ ua: ua.slice(-24), inApp: isInAppBrowser(ua) })
        .toEqual({ ua: ua.slice(-24), inApp: true });
    }
  });

  it('does NOT send real browsers away', () => {
    for (const ua of [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      '', undefined, null,
    ] as (string | undefined | null)[]) {
      expect(isInAppBrowser(ua)).toBe(false);
    }
  });

  it('the door tells them what actually works', () => {
    /* The sentences moved out of the door and into `lib/authError.ts` when the
       generic `else` was replaced - see __tests__/auth/failure.test.ts. What
       this block protects is unchanged and is asserted the better way: on the
       advice itself, not on where the string is typed. The door's remaining
       job is to say WHICH browser it is in, so the map can choose. */
    expect(codeOf('app/auth/login/page.tsx'))
      .toMatch(/authFault\(err, isInAppBrowser\(currentUserAgent\(\)\)\)/);
    expect(authFault({ code: 'auth/popup-blocked' }, true).message)
      .toMatch(/Open this page in Safari or Chrome/);
    /* And still gives the ordinary advice to an ordinary browser. */
    expect(authFault({ code: 'auth/popup-blocked' }, false).message)
      .toMatch(/Allow pop-ups for AutoModz/);
  });
});

describe('there is one booking path, and it is the server', () => {
  it('the client can no longer write a booking', () => {
    /* `requestBooking` wrote to `bookings` from the browser - no pricing
       authority, no promo ledger, no membership deduction, and nobody told. */
    const bookings = codeOf('lib/services/bookings.ts');
    expect(bookings).not.toMatch(/export const requestBooking/);
    expect(ALL.filter(f => /\brequestBooking\b/.test(codeOf(f)))).toEqual([]);
  });

  it('a status cannot be moved without telling the customer', () => {
    /* The bare `updateBookingStatus` export is gone; the write is inlined in
       the wrapper that sends the notification, so there is no way to do one
       without the other. */
    const bookings = codeOf('lib/services/bookings.ts');
    expect(bookings).not.toMatch(/export const updateBookingStatus\b/);
    expect(bookings).toMatch(/export const updateBookingStatusWithNotification/);
    expect(bookings).toMatch(/updateDoc\(doc\(db, 'bookings', booking\.id\), data\)/);
  });

  it('the one way a visit is created is still the route', () => {
    expect(codeOf('app/api/booking/create/route.ts'))
      .toMatch(/createBookingAuthoritative/);
  });

  it('nothing dead was left behind it', () => {
    for (const dead of ['getUserBookings', 'subscribeUserBookings', 'getAvailability',
      'adminLogin', 'logoutUser', 'resetPassword', 'deleteCarListing', 'reviveTimestamp']) {
      expect({ dead, callers: ALL.filter(f => new RegExp(`\\b${dead}\\b`).test(codeOf(f))) })
        .toEqual({ dead, callers: [] });
    }
  });
});

describe('an upload cannot take the tab down with it', () => {
  it('refuses a file too large to decode', () => {
    expect(tooLargeToUpload(MAX_UPLOAD_BYTES + 1)).toBe(true);
    expect(tooLargeToUpload(MAX_UPLOAD_BYTES)).toBe(false);
    expect(tooLargeToUpload(4 * 1024 * 1024)).toBe(false);
  });

  it('the ceiling still admits an ordinary photograph', () => {
    expect(MAX_UPLOAD_BYTES).toBeGreaterThanOrEqual(10 * 1024 * 1024);
  });

  it('it is checked BEFORE the file is read', () => {
    const src = codeOf('lib/services/storage.ts');
    expect(src.indexOf('tooLargeToUpload(file.size)'))
      .toBeLessThan(src.indexOf('await resizeImage'));
  });

  it('everything is re-encoded, so the stored type is never the uploaded one', () => {
    /* This is what makes an SVG or a renamed script harmless: it is decoded as
       an image or it is refused, and what leaves is always JPEG. */
    const src = codeOf('lib/services/storage.ts');
    expect(src).toMatch(/'image\/jpeg'/);
    expect(src).toMatch(/img\.onerror/);
  });

  it('the customer is told which failure it was', () => {
    expect(codeOf('components/market/SellForm.tsx'))
      .toMatch(/file-too-large[\s\S]{0,120}too large/);
  });
});

describe('the security headers a browser is actually sent', () => {
  const config = readFileSync('next.config.js', 'utf8');

  it.each([
    'Content-Security-Policy', 'X-Frame-Options', 'X-Content-Type-Options',
    'Referrer-Policy', 'Permissions-Policy',
  ])('%s is set', header => {
    expect(config).toContain(header);
  });

  it('the page can never be framed', () => {
    expect(config).toMatch(/frame-ancestors 'none'/);
    expect(config).toMatch(/X-Frame-Options', value: 'DENY'/);
  });

  it('no plugin content, and no base-tag hijack', () => {
    expect(config).toMatch(/object-src 'none'/);
    expect(config).toMatch(/base-uri 'self'/);
    expect(config).toMatch(/form-action 'self'/);
  });

  it('unsafe-eval is development only', () => {
    /* It is needed by Next's dev overlay and by nothing a customer runs. */
    expect(config).toMatch(/dev \? " 'unsafe-eval'" : ''/);
  });

  it('the emulator origins never reach a production build', () => {
    expect(config).toMatch(/\.\.\.\(dev \? \['http:\/\/127\.0\.0\.1:8080'/);
  });
});
