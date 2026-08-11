/**
 * ONE PRODUCT, ENFORCED.
 *
 * A product-wide consistency pass found the same four classes of drift over
 * and over, each one invisible on the screen it was introduced on and obvious
 * the moment two screens were put side by side. These are the invariants that
 * came out of it. Each one is here because something real was found, and the
 * comment says what.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { surfaceKind, isCustomerSurface } from '@/navigation/routes';

const codeOf = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

/** Everything a customer can see. Operations has its own shell and its own kit. */
/**
 * THE LANDING IS MARKETING, NOT A ROOM.
 *
 * `/` signed out is the public page: a marketing composition with its own
 * photography, its own icon set and its own sections, and it paints its own
 * ground rather than standing in the ambient field. Phase 6 of the audit names
 * `auth/marketing` as a surface kind of its own, and this is the one file in
 * it. Holding it to the room's laws would mean redesigning the marketing page,
 * which is a different job from making the product consistent with itself.
 */
const MARKETING = ['components/screens/LandingScreen.tsx'];

const CUSTOMER_FILES = [
  ...walk('components/screens'), ...walk('components/studio'),
  ...walk('components/you'), ...walk('components/os'),
  ...walk('components/market'), ...walk('components/visit'),
  ...walk('navigation'),
  'app/not-found.tsx', 'app/error.tsx', 'app/loading.tsx',
  'app/offline/page.tsx', 'app/cars/loading.tsx',
].filter(f => !f.endsWith('.d.ts') && !MARKETING.includes(f));

/* ── THE VIEWPORT ────────────────────────────────────────────────────────── */

describe('no customer surface measures itself against the large viewport', () => {
  /**
   * `100vh` on a phone is the height WITHOUT the browser's own bars, so the
   * last of the page sits under them. Every hand-written surface had already
   * moved to `100svh` — and the rule was being broken anyway, by TWO screens
   * using Tailwind's `min-h-screen`, which compiles to exactly `100vh`. The
   * previous law grepped for the literal string and saw nothing.
   */
  it.each(CUSTOMER_FILES.map(f => [f] as const))('%s', file => {
    const src = codeOf(file);
    expect({ file, vh: /\b100vh\b/.test(src) }).toEqual({ file, vh: false });
    expect({ file, tw: /\b(min-h-screen|h-screen)\b/.test(src) })
      .toEqual({ file, tw: false });
  });
});

/* ── THE THEME ───────────────────────────────────────────────────────────── */

describe('every surface declares what kind of surface it is', () => {
  /**
   * This began as a LIST of customer addresses, with anything not on the list
   * inheriting whatever theme the browser had stored. That answered the bug in
   * front of it and left the trap open: the default was wrong, so the next
   * address anybody added was light. It was proven within the hour — a harness
   * route added to LOOK at the rooms rendered white-on-white for exactly the
   * reason the rooms had.
   */
  it('an address nobody has classified is a room, not a document', () => {
    for (const unknown of ['/something-new', '/cars/x', '/studio/scope', '/a/b/c']) {
      expect({ unknown, kind: surfaceKind(unknown) }).toEqual({ unknown, kind: 'room' });
    }
  });

  it('the documents are named, and only they keep the stored preference', () => {
    for (const doc of ['/privacy', '/terms', '/invoice/abc']) {
      expect({ doc, kind: surfaceKind(doc) }).toEqual({ doc, kind: 'document' });
    }
  });

  it('operations is left alone entirely', () => {
    for (const ops of ['/admin', '/admin/schedule', '/store', '/store/board']) {
      expect({ ops, kind: surfaceKind(ops) }).toEqual({ ops, kind: 'operations' });
    }
  });

  it('and the room palette follows the classification, not a second list', () => {
    /* One question, one answer — a second predicate is how the two drift. */
    for (const p of ['/', '/cars', '/dashboard/sell-car', '/welcome', '/anything']) {
      expect(isCustomerSurface(p)).toBe(surfaceKind(p) === 'room');
    }
    expect(isCustomerSurface('/privacy')).toBe(false);
  });
});

/* ── THE TYPE ────────────────────────────────────────────────────────────── */

describe('there is one Display step and it is the design’s own', () => {
  /**
   * Half the product set its headline through `Heading level="display"` —
   * `clamp(30px, 8.6vw, 46px)` from `design/typography.ts` — and the other half
   * through `Statement size={30}`, a hard-coded copy of that clamp's LOWER
   * BOUND. Same face, same weight, so on a phone they were within two pixels
   * and nobody saw it. At 1280 one was 30px and the other 46px, and the two
   * halves of the product were visibly from different years.
   */
  it('the primitive reads the token rather than a number', () => {
    const parts = codeOf('components/os/parts.tsx');
    expect(parts).toMatch(/fontSize: size \?\? typeScale\.display\.size/);
    expect(parts).not.toMatch(/size = 30/);
  });

  it('no screen hard-codes a Display size any more', () => {
    /* `size={30}` / `size={29}` / `size={28}` — the three that existed. */
    for (const file of CUSTOMER_FILES) {
      expect({ file, hard: /<Statement[^>]*\ssize=\{\d+\}/.test(codeOf(file)) })
        .toEqual({ file, hard: false });
    }
  });

  it('and the header takes those same two steps rather than a copy', () => {
    /* A header with its own private scale is how a third size appears. */
    const rh = codeOf('components/os/RoomHeader.tsx');
    expect(rh).toMatch(/const SIZE = \{ room: DISPLAY\.room, subject: DISPLAY\.nested \}/);
    const parts = codeOf('components/os/parts.tsx');
    expect(parts).toMatch(/room: typeScale\.display\.size/);
    expect(parts).toMatch(/nested: 'clamp\(/);
  });
});

/* ── THE ICONS ───────────────────────────────────────────────────────────── */

describe('the customer product draws its own marks', () => {
  /**
   * Every mark in the customer product is one 1.4px stroke on a 24 grid, drawn
   * inline. `/offline` imported three lucide glyphs — a lightning bolt, a
   * struck-through wifi and a refresh arrow — which is a second icon language
   * on one screen out of nineteen. Operations uses lucide deliberately and is
   * not in this list.
   */
  it.each(CUSTOMER_FILES.map(f => [f] as const))('%s imports no icon set', file => {
    expect({ file, lucide: /from 'lucide-react'/.test(codeOf(file)) })
      .toEqual({ file, lucide: false });
  });
});

/* ── THE PALETTE ─────────────────────────────────────────────────────────── */

describe('colour comes from the palette, not from a literal', () => {
  /**
   * §22.4. `app/not-found.tsx` carried four: `#08090b`, `#fff`, `#0b0c0e` and
   * a white `rgba` — and the first of those is a NEAR MISS of the palette's
   * own `#08090A`, which is the kind of thing nobody ever finds by looking.
   *
   * Scoped to the screens. The primitives in `components/os` compose the
   * material itself and legitimately state alpha values that no token can
   * express (a scrim over an unknown photograph, a glass edge).
   */
  const SCREENS = CUSTOMER_FILES.filter(f => /components\/(screens|studio|you)\//.test(f));

  it.each(SCREENS.map(f => [f] as const))('%s names no hex of its own', file => {
    const hexes = codeOf(file).match(/#[0-9A-Fa-f]{6}\b/g) ?? [];
    expect({ file, hexes }).toEqual({ file, hexes: [] });
  });
});

/* ── THE SYSTEM SCREENS ──────────────────────────────────────────────────── */

describe('the system states are rooms like any other', () => {
  /**
   * `/offline` and `/not-found` were the last two surfaces speaking the
   * pre-rewrite identity — Tailwind utility shells, an 800-weight display, a
   * white filled button, a shouted headline, and copy that called a visit a
   * "job". They are the screens a customer meets when something has already
   * gone wrong, which is the worst moment to look like a different app.
   */
  it.each([
    ['app/not-found.tsx'], ['app/offline/page.tsx'], ['app/error.tsx'],
  ])('%s is built from the room primitives', file => {
    const src = codeOf(file);
    expect(src).toMatch(/from '@\/components\/os'/);
    expect(src).toMatch(/<Screen\b/);
    expect(src).toMatch(/<RoomHeader\b/);
  });

  it('they offer a way on, and it is the one control shape', () => {
    for (const file of ['app/not-found.tsx', 'app/offline/page.tsx', 'app/error.tsx']) {
      expect({ file, action: /<Action\b/.test(codeOf(file)) })
        .toEqual({ file, action: true });
    }
  });

  it('and none of them shouts', () => {
    /* "YOU'RE OFFLINE". The product does not raise its voice at a customer
       whose connection dropped. */
    for (const file of ['app/not-found.tsx', 'app/offline/page.tsx', 'app/error.tsx']) {
      const shouty = (codeOf(file).match(/>[^<>{]*\b[A-Z]{4,}[^<>{]*</g) ?? [])
        .filter(s => !/^>[\s]*</.test(s));
      expect({ file, shouty }).toEqual({ file, shouty: [] });
    }
  });
});

/* ── THE SAFE AREA ───────────────────────────────────────────────────────── */

describe('one safe-area strategy', () => {
  /**
   * `Screen` reserves the top inset and the whole fixed bottom stack for every
   * room. The surfaces that roll their own `<main>` did neither until they were
   * found one at a time — the product is installable, so in standalone the
   * first control sat under the status bar.
   */
  const ROLL_THEIR_OWN = CUSTOMER_FILES.filter(f => {
    const src = codeOf(f);
    return /<main\b/.test(src) && !/<Screen\b/.test(src);
  });

  it.each(ROLL_THEIR_OWN.map(f => [f] as const))('%s reserves the top inset', file => {
    const src = codeOf(file);
    expect({ file, top: /safe-area-inset-top|stack\.top/.test(src) })
      .toEqual({ file, top: true });
  });

  it('the tokens carry the insets so no call site has to remember', () => {
    const grid = codeOf('design/grid.ts');
    expect(grid).toMatch(/contentFloor:[^;]*env\(safe-area-inset-bottom/);
    expect(grid).toMatch(/bottom:[^;]*env\(safe-area-inset-bottom/);
    expect(grid).toMatch(/top: 'env\(safe-area-inset-top/);
  });
});
