/**
 * OFFLINE — §20.3, §20.4, §21.7 · §22.2.
 *
 * §20.3 is "distinguish ours from theirs": a customer who has lost signal must
 * never be told the studio failed. Every room is server-rendered, so what is
 * already on the screen stays true when the connection goes — only what
 * happens NEXT is affected, and that is all the note is allowed to say.
 *
 * WHAT THIS FINISHED. The note existed on Home and the three marketplace
 * surfaces. The other eight rooms said nothing at all, and FIVE separate
 * copies had grown inside the sheets — `BookingFlow`, `ManageVisit`,
 * `AccountSettings` and `ClubFlow` (twice) each with `useOnline()` and a
 * hand-written `<Text aria-live>`, in four different wordings. One component
 * now, in two placements.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { OfflineNote } from '@/components/system';

const codeOf = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

/** The rooms a signed-in customer can stand in. */
const ROOMS = [
  'HomeScreen', 'GarageScreen', 'VehicleScreen', 'HistoryScreen', 'VisitScreen',
  'LiveVisitScreen', 'MembershipScreen', 'YouScreen', 'StudioScreen',
] as const;

/** The public surfaces that can also be read without a connection. */
const PUBLIC = ['MarketScreen', 'ListingScreen', 'SellCarScreen'] as const;

const setOnline = (v: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', { value: v, configurable: true });
};

/**
 * Mount for real.
 *
 * `useOnline` starts `true` and corrects in an effect — deliberately, because
 * `navigator` does not exist on the server and rendering "offline" there would
 * be a hydration mismatch. A static render therefore NEVER shows the note, so
 * these assertions mount into jsdom and let the effect run.
 */
let host: HTMLDivElement | null = null;
let root: Root | null = null;

const mount = (el: React.ReactElement) => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => { root!.render(el); });
  return host;
};

const unmount = () => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = null; host = null;
};

/** What the browser fires when the connection comes and goes. */
const connection = (v: boolean) => {
  setOnline(v);
  act(() => { window.dispatchEvent(new Event(v ? 'online' : 'offline')); });
};

describe('every customer room says something when the connection goes', () => {
  it.each([...ROOMS])('%s carries the note', name => {
    expect(codeOf(`components/screens/${name}.tsx`)).toMatch(/<OfflineNote/);
  });

  it.each([...PUBLIC])('%s carries it too', name => {
    expect(codeOf(`components/screens/${name}.tsx`)).toMatch(/<OfflineNote/);
  });

  it('no room was missed', () => {
    /* Read from the directory rather than the list above, so a room added
       later fails here instead of shipping silent. `WelcomeScreen` is exempt
       and says why in its own assertion below. */
    const silent = walk('components/screens')
      .filter(f => /Screen\.tsx$/.test(f))
      .filter(f => !/WelcomeScreen|LandingScreen|ServerRoom/.test(f))
      .filter(f => !/<OfflineNote/.test(codeOf(f)));
    expect(silent).toEqual([]);
  });

  it('the first arrival is exempt, because it already says it better', () => {
    /* Welcome cannot complete offline, and it says exactly that where it
       happens — "That didn't save. Try once more." A generic bar above it
       would be a second offline statement on one screen. */
    const w = codeOf('components/screens/WelcomeScreen.tsx');
    expect(w).not.toMatch(/<OfflineNote/);
    expect(w).toMatch(/That didn.t save\./);
  });
});

describe('§22.2 — one implementation, and only one', () => {
  const ALL = [...walk('components'), ...walk('app')].filter(f => !f.includes('node_modules'));

  it('nothing renders its own offline markup', () => {
    /* Five copies of `{!online ? <Text aria-live…>}` used to live in the
       sheets. Anything reading `useOnline` must now be deciding whether a
       CONTROL works, not drawing a second note. */
    const offenders = ALL.filter(f => {
      const src = codeOf(f);
      if (f.endsWith('OfflineNote.tsx')) return false;
      return /You&rsquo;re offline|You’re offline/.test(src)
        && !/<OfflineNote/.test(src);
    });
    expect(offenders).toEqual([]);
  });

  it('every reader of the connection either shows the note or gates a control', () => {
    /* `useOnline` is allowed anywhere — what is NOT allowed is drawing a
       second note with it. Anything reading it must either render the one
       component or use the answer to stop a write that cannot succeed. */
    const readers = ALL.filter(f => /useOnline\(\)/.test(codeOf(f)))
      /* The note is the one allowed to draw with it; the hook's own
         declaration line matches the same pattern. */
      .filter(f => !/OfflineNote\.tsx|useOnline\.ts/.test(f));
    expect(readers.length).toBeGreaterThan(3);
    for (const f of readers) {
      const src = codeOf(f);
      expect({ f, ok: /<OfflineNote/.test(src) && /online/.test(src) })
        .toEqual({ f, ok: true });
    }
  });

  it('the sheets still GATE their controls — that is not duplication', () => {
    /* A note says what is happening; a blocked control stops a write that
       cannot succeed. Both are needed and they are not the same thing. */
    for (const f of ['components/studio/BookingFlow.tsx',
      'components/you/AccountSettings.tsx', 'components/membership/ClubFlow.tsx',
      'app/auth/login/page.tsx']) {
      const src = codeOf(f);
      expect({ f, note: /<OfflineNote inline/.test(src) }).toEqual({ f, note: true });
      /* Either a disabled attribute or a readiness value built from `online`. */
      expect({ f, gated: /disabled=\{[^}]*online|&& online|!online\)/.test(src) })
        .toEqual({ f, gated: true });
    }
  });

  it('there is one hook behind all of it', () => {
    const hooks = ALL.filter(f => /addEventListener\('offline'/.test(codeOf(f)));
    expect(hooks).toEqual(['components/system/useOnline.ts']);
  });

  it('the wording exists in exactly one file', () => {
    const sentence = 'This is the last we knew';
    const holders = ALL.filter(f => codeOf(f).includes(sentence));
    expect(holders).toEqual(['components/system/OfflineNote.tsx']);
  });
});

describe('the note itself', () => {
  afterEach(() => { unmount(); setOnline(true); });

  it('is ABSENT when connected — not hidden', () => {
    /* A hidden element still sits in the accessibility tree and is still
       read out. Absent is the only thing that is actually silent. */
    setOnline(true);
    expect(mount(<OfflineNote />).innerHTML).toBe('');
  });

  it('appears when the connection goes', () => {
    setOnline(false);
    expect(mount(<OfflineNote />).textContent).toContain('offline');
  });

  it('RECONNECT removes it again', () => {
    /* The real sequence: mounted online, connection drops, connection
       returns. Both browser events are exercised, not just the initial read. */
    setOnline(true);
    const el = mount(<OfflineNote />);
    expect(el.innerHTML).toBe('');

    connection(false);
    expect(el.textContent).toContain('offline');

    connection(true);
    expect(el.innerHTML).toBe('');
  });

  it('listens for BOTH edges, so recovery is noticed', () => {
    const hook = codeOf('components/system/useOnline.ts');
    expect(hook).toMatch(/addEventListener\('online'/);
    expect(hook).toMatch(/addEventListener\('offline'/);
    /* And stops listening, or every navigation leaks a listener. */
    expect(hook).toMatch(/removeEventListener\('online'/);
    expect(hook).toMatch(/removeEventListener\('offline'/);
  });

  it('is ANNOUNCED politely, never assertively', () => {
    /* §21.7 — the customer did not act to cause this, so it must not
       interrupt whatever a screen reader is already saying. */
    setOnline(false);
    const note = mount(<OfflineNote />).firstElementChild!;
    expect(note.getAttribute('role')).toBe('status');
    expect(note.getAttribute('aria-live')).toBe('polite');
  });

  it('never claims the studio failed', () => {
    /* §20.3 — ours or theirs. This is theirs, and saying "something went
       wrong" would blame the wrong party and frighten the customer about
       their car. */
    setOnline(false);
    const text = (mount(<OfflineNote />).textContent ?? '').toLowerCase();
    expect(text).not.toBe('');
    for (const word of ['error', 'failed', 'wrong', 'unable', 'problem', 'sorry']) {
      expect(text).not.toContain(word);
    }
  });

  it('says the data on screen is STALE, not missing', () => {
    setOnline(false);
    expect(mount(<OfflineNote />).textContent).toContain('the last we knew');
  });

  it('takes a caption when a surface needs to be more specific', () => {
    setOnline(false);
    const text = mount(
      <OfflineNote caption="You’re offline. Changes need a connection." />,
    ).textContent;
    expect(text).toContain('Changes need a connection');
    expect(text).not.toContain('the last we knew');
  });

  it('renders inline without the rule, for a sheet', () => {
    setOnline(false);
    const inline = mount(<OfflineNote inline />).firstElementChild as HTMLElement;
    expect(inline.getAttribute('role')).toBe('status');
    expect(inline.getAttribute('aria-live')).toBe('polite');
    /* The layer already supplies its own material; the bar's border and
       background would draw a second edge inside it. */
    expect(inline.style.borderBottom).toBe('');
    expect(inline.style.background).toBe('');
    unmount();

    setOnline(false);
    const bar = mount(<OfflineNote />).firstElementChild as HTMLElement;
    expect(bar.style.borderBottom).not.toBe('');
  });

  it('carries no motion at all, so there is nothing to reduce', () => {
    /* It appears the instant the connection drops. An entrance animation on
       a status message is decoration on news (§ motion communicates state),
       and it would need a `prefers-reduced-motion` guard it now does not. */
    const src = codeOf('components/system/OfflineNote.tsx');
    expect(src).not.toMatch(/framer-motion|motion\.|transition|animate/);
  });
});

describe('offline alongside the other states', () => {
  it('LOADING is still its own state, not replaced by the note', () => {
    /* §19.1 — loading is a state, not an absence, and losing the connection
       does not make a room that is still fetching into a room that failed. */
    expect(codeOf('app/loading.tsx')).toMatch(/<Loading caption=/);
    expect(codeOf('app/cars/loading.tsx')).toMatch(/<Loading caption=/);
    expect(codeOf('app/loading.tsx')).not.toMatch(/OfflineNote/);
  });

  it('EMPTY is still its own state — an empty garage offline is still empty', () => {
    /* The note sits above the room's own content; it does not replace an
       invitation with an apology. */
    const room = codeOf('components/screens/ServerRoom.tsx');
    expect(room).toMatch(/export function NoCar/);
    expect(room).toMatch(/Add your car/);
    expect(codeOf('components/screens/MarketScreen.tsx'))
      .toMatch(/Nothing in the showroom right now/);
  });

  it('FAILED is still distinguishable from offline', () => {
    /* §20.4 — a read that throws is OURS and says so, and it says the car is
       safe. That is a different sentence from "you are offline". */
    const room = codeOf('components/screens/ServerRoom.tsx');
    expect(room).toMatch(/We could not reach your garage\./);
    expect(room).toMatch(/Your car and its records are safe\./);
  });

  it('the note is the FIRST thing in the room, above its content', () => {
    /* Below the fold it is not a status, it is a surprise. */
    for (const name of ['GarageScreen', 'HistoryScreen', 'MembershipScreen',
      'YouScreen', 'StudioScreen', 'VisitScreen']) {
      const src = codeOf(`components/screens/${name}.tsx`);
      const main = src.indexOf('<main');
      const note = src.indexOf('<OfflineNote', main);
      const heading = src.indexOf('<Heading', main);
      expect({ name, first: note > -1 && (heading === -1 || note < heading) })
        .toEqual({ name, first: true });
    }
  });
});
