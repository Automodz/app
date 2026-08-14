/**
 * FIRST ARRIVAL - §19, §21.4, §21.6 · ARCHITECTURE §1 · Apple 4.5.4.
 *
 * THE DEFECT THIS SURFACE HAD, and it was not a missing screen:
 *
 *   THE FLAG LIVED ON THE DEVICE. `localStorage['automodz-welcomed']`. The
 *   same customer signing in on a phone after a laptop was welcomed twice;
 *   clearing site data re-triggered it forever; and nobody at the studio could
 *   reset it for someone who asked. It is now a field on the user document.
 *
 *   THERE WERE THREE COPIES OF THE SAME FACT: the localStorage key, the
 *   `onboardingCompleted` boolean in the session store, and - implicitly - a
 *   car in the garage. Two of the three are gone.
 *
 *   THE STEP WAS COMPONENT STATE, so Back left the welcome entirely and a
 *   reload started it over. Every step is an address now.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { Timestamp } from 'firebase/firestore';
import type { Service, User, Vehicle } from '@/lib/types';
import type { CarPicture, CustomerPicture } from '@/lib/customer/source';
import {
  STEPS, stepFrom, stepIndex, nextStep, shouldWelcome, welcomeInterrupts,
} from '@/lib/os/welcome';
import { toWelcome } from '@/lib/customer/welcome';
import { hrefForDestination } from '@/navigation/resolve';

const codeOf = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

const ts = (iso: string) => Timestamp.fromDate(new Date(iso));

const car = (over: Partial<CarPicture> = {}): CarPicture => ({
  vehicle: { id: 'v1', name: 'BMW M4', registrationNumber: 'GJ01AB1234',
    createdAt: ts('2026-01-01T00:00:00Z') } as Vehicle,
  protections: [], declarations: [], visits: [], bookings: [], jobs: [], ...over,
});

const picture = (over: Partial<CustomerPicture> = {}): CustomerPicture => ({
  user: { uid: 'u1', name: 'Nikhil Patel', email: 'n@example.com',
    role: 'customer' } as User,
  cars: [], subscription: null, subscriptions: [], invoices: [], notifications: [],
  catalogue: [] as Service[], ...over,
  addresses: [], approvals: [],
});

describe('FIRST LOGIN - the welcome appears exactly once', () => {
  it('a brand-new customer with no car is welcomed', () => {
    expect(shouldWelcome({ vehicleCount: 0 })).toBe(true);
  });

  it('SECOND LOGIN - a customer who has arrived before is not', () => {
    expect(shouldWelcome({ welcomedAt: ts('2026-07-01T00:00:00Z'), vehicleCount: 0 }))
      .toBe(false);
  });

  it('it cannot appear twice, whatever the device', () => {
    /* The whole point of moving the flag off `localStorage`: the answer is the
       same on a phone, a laptop, and a browser whose data was just cleared,
       because it is read from the user document. */
    const arrived = { welcomedAt: ts('2026-07-01T00:00:00Z'), vehicleCount: 0 };
    for (let device = 0; device < 3; device += 1) {
      expect(shouldWelcome(arrived)).toBe(false);
    }
  });

  it('a customer with a car is never walked through an arrival', () => {
    /* A garage with a car in it is proof of a previous arrival on its own -
       it covers anyone whose flag predates this field. */
    expect(shouldWelcome({ vehicleCount: 1 })).toBe(false);
  });

  it('ADMIN RESET - `?welcome=1` overrides everything', () => {
    expect(shouldWelcome({
      welcomedAt: ts('2026-07-01T00:00:00Z'), vehicleCount: 3, forced: true,
    })).toBe(true);
  });

  it('only Home may interrupt with it', () => {
    /* Sending someone to an arrival while they are reading their own history
       is the application talking over the customer. */
    expect(welcomeInterrupts('/')).toBe(true);
    for (const p of ['/history', '/garage', '/studio', '/you', '/cars']) {
      expect(welcomeInterrupts(p)).toBe(false);
    }
  });
});

describe('DEEP LINKS and the BACK BUTTON', () => {
  it('every step is a real address', () => {
    expect(hrefForDestination({ to: 'welcome' })).toBe('/welcome');
    expect(hrefForDestination({ to: 'welcome.step', step: 'rooms' }))
      .toBe('/welcome?step=rooms');
    expect(hrefForDestination({ to: 'welcome.step', step: 'notifications' }))
      .toBe('/welcome?step=notifications');
  });

  it('the first step is the bare address, so there is one canonical URL', () => {
    expect(hrefForDestination({ to: 'welcome.step', step: 'hello' })).toBe('/welcome');
  });

  it('a forced arrival stays forced as the customer moves through it', () => {
    expect(hrefForDestination({ to: 'welcome', forced: true })).toBe('/welcome?welcome=1');
    expect(hrefForDestination({ to: 'welcome.step', step: 'record', forced: true }))
      .toBe('/welcome?welcome=1&step=record');
  });

  it('a nonsense or absent step resolves to the beginning, never to nothing', () => {
    for (const raw of [null, undefined, '', 'banana', '../etc', '5']) {
      expect(stepFrom(raw)).toBe('hello');
    }
  });

  it('a deep link lands on the step it names', () => {
    for (const s of STEPS) expect(stepFrom(s)).toBe(s);
  });

  it('BROWSER REFRESH lands where the customer was, not at the start', () => {
    /* The step is read from the URL on the server, so a reload re-renders the
       same panel. It used to be `useState`, which lost it. */
    const m = toWelcome(picture(), stepFrom('record'));
    expect(m.panel.step).toBe('record');
  });

  it('BACK works because forward is a link, not a state change', () => {
    /* Both controls carry an href, so each step is a history entry. */
    const m = toWelcome(picture(), 'rooms');
    expect(m.panel.forwardHref).toBe('/welcome?step=record');
    expect(m.panel.passHref).toBe('/welcome?step=record');
  });

  it('the steps run in one order, with a real end', () => {
    expect(STEPS).toEqual(['hello', 'rooms', 'record', 'notifications', 'car']);
    expect(nextStep('hello')).toBe('rooms');
    expect(nextStep('car')).toBeNull();
    expect(stepIndex('hello')).toBe(0);
  });

  it('the last step has no forward address - it is an act, not a step', () => {
    expect(toWelcome(picture(), 'car').panel.forwardHref).toBeUndefined();
  });
});

describe('what the arrival actually says', () => {
  it('welcomes the customer', () => {
    const m = toWelcome(picture(), 'hello');
    expect(m.panel.title).toMatch(/Welcome/);
    expect(m.greeting).toBe('Nikhil');
  });

  it('explains AutoModz in one screen', () => {
    expect(toWelcome(picture(), 'hello').panel.line).toBeTruthy();
  });

  it('names the three rooms, and only three', () => {
    const rooms = toWelcome(picture(), 'rooms').panel.rooms ?? [];
    expect(rooms.map(r => r.name)).toEqual(['My Car', 'My Studio', 'My Ownership']);
    for (const r of rooms) expect(r.line.trim()).not.toBe('');
  });

  it('each room points at the room it describes, through the resolver', () => {
    const rooms = toWelcome(picture(), 'rooms').panel.rooms ?? [];
    expect(rooms.map(r => r.href)).toEqual(['/garage', '/studio', '/history']);
  });

  it('says the studio keeps the ownership record alive', () => {
    const line = toWelcome(picture(), 'record').panel.line ?? '';
    expect(line).toMatch(/record|kept/i);
    expect(line).toMatch(/as long as you own/i);
  });

  it('asks whether the customer already has a car - it does not assume', () => {
    const p = toWelcome(picture(), 'car').panel;
    expect(p.title).toMatch(/Do you have a car already\?/);
    expect(p.forward).toMatch(/Yes/);
    expect(p.pass).toMatch(/Not yet/);
  });

  it('a customer who already has one is not asked', () => {
    const p = toWelcome(picture({ cars: [car()] }), 'car').panel;
    expect(p.title).toMatch(/already here/);
    expect(p.pass).toBeUndefined();
  });

  it('says where it is up to, for a screen reader', () => {
    /* §21.6 - position announced, without drawing progress dots at anyone. */
    expect(toWelcome(picture(), 'rooms').position).toEqual({ index: 2, total: 5 });
  });
});

describe('WITHOUT A VEHICLE - adding one is never forced', () => {
  it('every step after the first can be passed over', () => {
    for (const s of ['rooms', 'record', 'notifications', 'car'] as const) {
      expect(toWelcome(picture(), s).panel.pass).toBeTruthy();
    }
  });

  it('the last step offers leaving without a car', () => {
    const m = toWelcome(picture(), 'car');
    expect(m.panel.pass).toBe('Not yet');
    expect(m.homeHref).toBe('/');
  });

  it('WITH A VEHICLE the arrival ends at Home rather than the car form', () => {
    expect(toWelcome(picture({ cars: [car()] }), 'car').hasCar).toBe(true);
    expect(toWelcome(picture(), 'car').addCarHref).toBe('/garage?add=1');
  });

  it('Home greets an empty garage with an invitation, not an error', () => {
    /* A customer who skipped the car lands on `NoCar`, which offers the act
       that resolves it rather than reporting a failure. */
    const room = codeOf('components/screens/ServerRoom.tsx');
    expect(room).toMatch(/export function NoCar/);
    expect(room).toMatch(/Add your car/);
    expect(room).toMatch(/Your car&rsquo;s place is ready\./);
    expect(room).not.toMatch(/NoCar[\s\S]{0,400}(error|Error|failed|wrong)/);
    expect(codeOf('app/page.tsx')).toMatch(/<NoCar \/>/);
  });
});

describe('APPLE 4.5.4 - notifications are asked for, never demanded', () => {
  const screen = codeOf('components/screens/WelcomeScreen.tsx');

  it('the permission step can be skipped', () => {
    expect(toWelcome(picture(), 'notifications').panel.pass).toBe('Not now');
  });

  it('nothing is gated on the answer - the arrival continues either way', () => {
    /* The forward move sits in `finally`, so a refusal, an unsupported device
       and an outright throw all continue identically. */
    expect(screen).toMatch(/finally \{[\s\S]{0,220}router\.push\(panel\.forwardHref\)/);
  });

  it('a refusal is not treated as an error', () => {
    expect(screen).toMatch(/turn it on later in You/);
    expect(screen).not.toMatch(/must enable|required|You need to allow/i);
  });

  it('it reuses the one push service rather than calling the browser itself', () => {
    expect(screen).toMatch(/import\('@\/lib\/services\/push'\)/);
    expect(screen).not.toMatch(/Notification\.requestPermission/);
    expect(screen).not.toMatch(/getToken\(/);
  });

  it('a device that cannot be told says so plainly', () => {
    expect(screen).toMatch(/pushSupported\(\)/);
  });

  it('it can still be enabled later from You', () => {
    expect(codeOf('components/you/AccountSettings.tsx')).toMatch(/enablePush/);
  });
});

describe('ONE SOURCE OF TRUTH', () => {
  const sources = [...walk('lib'), ...walk('app'), ...walk('components'), ...walk('navigation')]
    .filter(f => !f.includes('node_modules'));

  it('the device-local flag is gone entirely', () => {
    const holders = sources.filter(f =>
      /localStorage\.(get|set)Item\(\s*['"`]?automodz-welcomed/.test(codeOf(f)));
    expect(holders).toEqual([]);
  });

  it('nothing calls the functions that used to read or write it', () => {
    for (const dead of ['markWelcomed', 'hasBeenWelcomed']) {
      expect(sources.filter(f => new RegExp(`\\b${dead}\\b`).test(codeOf(f)))).toEqual([]);
    }
  });

  it('the duplicate session-store flag is gone', () => {
    /* `onboardingCompleted` was a second boolean for the same fact. */
    expect(sources.filter(f => /onboardingCompleted/.test(codeOf(f)))).toEqual([]);
  });

  it('the abandoned client-side gate is deleted, not merely unused', () => {
    expect(existsSync('navigation/FirstRunGate.tsx')).toBe(false);
    expect(codeOf('navigation/CustomerChrome.tsx')).not.toMatch(/FirstRunGate/);
  });

  it('the old welcome layout is gone - the surface uses ServerRoom now', () => {
    expect(existsSync('app/welcome/layout.tsx')).toBe(false);
    expect(codeOf('app/welcome/page.tsx')).toMatch(/ServerRoom/);
  });

  it('the welcome no longer reads the client store', () => {
    /* It used `useAppStore` for the user, which is a second source of truth
       beside the server picture every other room reads. */
    expect(codeOf('components/screens/WelcomeScreen.tsx')).not.toMatch(/useAppStore/);
    expect(codeOf('app/welcome/page.tsx')).not.toMatch(/useAppStore/);
  });

  it('exactly one module decides whether to welcome', () => {
    const deciders = sources.filter(f => /export const shouldWelcome/.test(codeOf(f)));
    expect(deciders).toEqual(['lib/os/welcome.ts']);
  });

  it('exactly one module records the arrival', () => {
    const writers = sources.filter(f => /welcomedAt: new Date\(\)/.test(codeOf(f)));
    expect(writers).toEqual(['app/api/welcome/complete/route.ts']);
  });

  it('the profile write reuses the existing service, not a second one', () => {
    /* The old welcome wrote name and phone through `updateUserProfile`. That
       edit now lives where it always belonged - the account settings - and
       there is exactly one writer of a profile. */
    const writers = sources.filter(f => /export const updateUserProfile/.test(codeOf(f)));
    expect(writers).toEqual(['lib/services/auth.ts']);
  });
});

describe('ARCHITECTURE §1 - the layers hold', () => {
  it('THE ENGINE IS PURE - no React, no routes, no storage, no Firestore', () => {
    const engine = codeOf('lib/os/welcome.ts');
    expect(engine).not.toMatch(/from 'react'/);
    expect(engine).not.toMatch(/localStorage/);
    expect(engine).not.toMatch(/firebase/);
    expect(engine).not.toMatch(/next\/navigation/);
    expect(engine).not.toMatch(/['"`]\/[a-z]+['"`]/);
  });

  it('THE PROJECTION HAS NO ROUTING - every address comes from the resolver', () => {
    const projection = codeOf('lib/customer/welcome.ts');
    expect([...projection.matchAll(/['"`]\/[a-z][^'"`]*['"`]/g)].map(m => m[0])).toEqual([]);
    expect(projection).toMatch(/hrefForDestination/);
  });

  it('THE RENDERER IMPORTS NO ENGINE', () => {
    const screen = codeOf('components/screens/WelcomeScreen.tsx');
    expect(screen).not.toMatch(/from ['"]@\/lib\/os\//);
  });

  it('THE RENDERER HOLDS NO WORDING - the projection owns it', () => {
    const screen = codeOf('components/screens/WelcomeScreen.tsx');
    for (const words of ['My Car', 'My Studio', 'My Ownership', 'Welcome to']) {
      expect(screen).not.toContain(words);
    }
  });

  it('THE SERVER OWNS THE TRUTH - the decision is made before anything draws', () => {
    /* A client effect used to redirect after mount, so a customer who should
       have been welcomed saw a flash of Home first. */
    const home = codeOf('app/page.tsx');
    expect(home).toMatch(/shouldWelcome\(\{/);
    expect(home).toMatch(/redirect\(hrefForDestination\(\{ to: 'welcome' \}\)\)/);
    expect(codeOf('app/welcome/page.tsx')).toMatch(/redirect\(/);
  });

  it('the surface may not be prerendered or shared between customers', () => {
    expect(codeOf('app/welcome/page.tsx'))
      .toMatch(/export const dynamic = 'force-dynamic'/);
  });
});

describe('SECURITY - the flag cannot be forged', () => {
  const rules = readFileSync('firestore.rules', 'utf8');
  const route = codeOf('app/api/welcome/complete/route.ts');

  it('a customer cannot write their own welcomedAt', () => {
    /* Otherwise anyone could skip their arrival, or clear the field to force
       it back. */
    expect(rules).toMatch(/request\.resource\.data\.get\('welcomedAt', null\) ==\s*\n?\s*resource\.data\.get\('welcomedAt', null\)/);
  });

  it('recording an arrival requires a proven identity', () => {
    expect(route).toMatch(/verifyIdToken/);
    expect(route).toMatch(/error: 'Unauthorized'/);
  });

  it('recording is only ever about the caller - the body cannot name a uid', () => {
    expect(route).toMatch(/db\.collection\('users'\)\.doc\(uid\)\.set\(/);
  });

  it('ADMIN RESET works, and only for an admin', () => {
    expect(route).toMatch(/reset/);
    expect(route).toMatch(/role !== 'admin'/);
    expect(route).toMatch(/error: 'forbidden'/);
  });

  it('a customer cannot reset another customer', () => {
    expect(route).toMatch(/if \(target !== uid\) \{[\s\S]{0,200}role !== 'admin'/);
  });

  it('a customer cannot reset themselves in production', () => {
    /* Development may, which is what makes the flow exercisable without
       hand-editing Firestore. */
    expect(route).toMatch(/process\.env\.NODE_ENV === 'production'/);
  });

  it('a reset DELETES the field rather than writing a second falsy spelling', () => {
    expect(route).toMatch(/FieldValue\.delete\(\)/);
  });

  it('the arrival is not crawled', () => {
    expect(codeOf('app/robots.ts')).toMatch(/'\/welcome'/);
  });
});

describe('the customer cannot be trapped in it', () => {
  const screen = codeOf('components/screens/WelcomeScreen.tsx');

  it('leaving waits for the flag to be written', () => {
    /* Home reads the same flag to decide whether to send someone here, so
       leaving without writing it walks straight back in - a best-effort mark
       would have turned a failed write into an inescapable loop. */
    expect(screen).toMatch(/if \(!res\.ok\) throw new Error\('mark-failed'\)/);
    expect(screen).toMatch(/window\.location\.replace\(href\)/);
  });

  it('a failure says so and can be retried', () => {
    expect(screen).toMatch(/That didn.t save\./);
    expect(screen).toMatch(/setBusy\(false\)/);
  });

  it('the cached server render is discarded, or Home answers from the old flag', () => {
    /* `router.refresh()` was not enough: it clears the client cache for the
       CURRENT route - `/welcome` - while the destination is what has to be
       re-rendered against the flag just written. A document load does it. */
    expect(screen).toMatch(/window\.location\.replace\(href\)/);
    expect(screen).not.toMatch(/router\.refresh\(\)/);
  });
});
