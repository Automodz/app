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
import { publicParent } from '@/navigation/resolve';
import { DOT, dotted } from '@/design';
import { ownerWord } from '@/lib/os/market';
import { longDate } from '@/lib/customer/project';

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
   * moved to `100svh` - and the rule was being broken anyway, by TWO screens
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
   * address anybody added was light. It was proven within the hour - a harness
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
    /* One question, one answer - a second predicate is how the two drift. */
    for (const p of ['/', '/cars', '/dashboard/sell-car', '/welcome', '/anything']) {
      expect(isCustomerSurface(p)).toBe(surfaceKind(p) === 'room');
    }
    expect(isCustomerSurface('/privacy')).toBe(false);
  });
});

/* ── THE TYPE ────────────────────────────────────────────────────────────── */

describe('there is one Display step and it is the design’s own', () => {
  /**
   * Half the product set its headline through `Heading level="display"` -
   * `clamp(30px, 8.6vw, 46px)` from `design/typography.ts` - and the other half
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
    /* `size={30}` / `size={29}` / `size={28}` - the three that existed. */
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
   * inline. `/offline` imported three lucide glyphs - a lightning bolt, a
   * struck-through wifi and a refresh arrow - which is a second icon language
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
   * a white `rgba` - and the first of those is a NEAR MISS of the palette's
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
   * pre-rewrite identity - Tailwind utility shells, an 800-weight display, a
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
   * found one at a time - the product is installable, so in standalone the
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

/* ── WHAT THE VISUAL PASS FOUND ──────────────────────────────────────────── */

describe('a line of two facts survives a real car name', () => {
  /**
   * Thirteen call sites joined `A · B` with a plain `' · '`, and at 390px with
   * "BMW M340i xDrive Sport" three screens broke the same way at once - Now,
   * the live visit and settling - each stranding the separator at the end of a
   * line:
   *
   *     BMW M340i xDrive Sport ·
   *     GJ01AB1234
   *
   * One convention, no implementation, so every site typed it itself.
   */
  it('the separator binds forward, so it can never end a line', () => {
    /* A normal space before it keeps the break opportunity; a non-breaking
       space after it stops the dot being orphaned from what it introduces. */
    expect(DOT).toBe(' · ');
    expect(DOT.startsWith(' ')).toBe(true);
    expect(DOT.endsWith(' ')).toBe(true);
  });

  it('and it drops absent facts rather than punctuating nothing', () => {
    expect(dotted('BMW M340i', 'GJ01AB1234')).toBe(`BMW M340i${DOT}GJ01AB1234`);
    expect(dotted('BMW M340i', undefined)).toBe('BMW M340i');
    expect(dotted(undefined, 'GJ01AB1234')).toBe('GJ01AB1234');
    expect(dotted(null, false, '')).toBe('');
  });

  it('nothing composes its own separator any more', () => {
    /* The whole point: a fourteenth call site cannot reintroduce this. */
    const offenders = CUSTOMER_FILES
      .concat(['lib/customer/project.ts'])
      .filter(f => /join\(' · '\)|` · `|' · '/.test(codeOf(f)));
    expect(offenders).toEqual([]);
  });
});

describe('the product says the same word for the same thing', () => {
  /**
   * `ACT_LINE` is the most-read copy in the product - it sits under the title
   * for the whole of every visit - and two of its five lines said "vehicle"
   * where seven other customer strings say "car", one of them naming the
   * studio as "our team" where every other sentence says "the studio".
   */
  const copy = [
    'lib/os/visit.ts', 'lib/os/stay.ts', 'lib/os/log.ts', 'lib/os/club.ts',
    'lib/customer/project.ts',
  ];

  it('it is a car, never a vehicle', () => {
    for (const f of copy) {
      const said = (codeOf(f).match(/'[^']*\byour vehicle\b[^']*'/g) ?? []);
      expect({ f, said }).toEqual({ f, said: [] });
    }
  });

  it('and the studio, never a team', () => {
    for (const f of copy) {
      expect({ f, team: /'[^']*\bOur team\b/.test(codeOf(f)) }).toEqual({ f, team: false });
    }
  });

  /**
   * A DASH IS A HYPHEN. THIS RULE USED TO SAY THE EXACT OPPOSITE.
   *
   * It required an em dash everywhere, on the grounds of internal consistency,
   * and consistency was the only argument it had. The owner's is better and it
   * overrides: an em dash reads as machine-written. Whatever the typographic
   * merits, a studio's own voice sounding like it was generated is a worse
   * outcome than a dash of the wrong width, and this is the owner's copy.
   *
   * So the law is inverted rather than deleted - the product still says the
   * same thing the same way everywhere, which was always the point of having
   * a rule here at all.
   *
   * THE CHARACTER IS WRITTEN AS `\u2014`, NOT TYPED.
   *
   * A literal one here does not survive: the sweep that removes em dashes from
   * the product removed the em dash from THIS TEST's own regex, which quietly
   * turned it into "no hyphens anywhere" and failed every line of prose it was
   * meant to protect. An escape says the same thing to the regex engine and is
   * invisible to anything looking for the character.
   */
  it('a dash is a hyphen, never an em dash', () => {
    for (const f of copy) {
      const emDashed = codeOf(f).split('\n')
        .filter(l => /(['`])[^'`]*\u2014[^'`]*\1/.test(l))
        .map(l => l.trim().slice(0, 60));
      expect({ f, emDashed }).toEqual({ f, emDashed: [] });
    }
  });
});

describe('a sentence never has a hole where a fact should be', () => {
  /**
   * Every branch of the membership line interpolated a renewal date that a
   * lapsed plan does not have, so the customer was shown "Lapsed ." - with a
   * stranded space before the stop. `Renews .` was the same defect waiting.
   */
  it('the date leaves the sentence rather than leaving a gap', () => {
    const src = codeOf('lib/customer/project.ts');
    const fn = src.slice(src.indexOf('function membershipLines'));
    const block = fn.slice(0, fn.indexOf('\n}'));
    /* Every branch that can name a date must ask whether there is one. */
    expect(block).toMatch(/when \? `Lapsed \$\{when\}\.` : 'Lapsed\.'/);
    expect(block).toMatch(/when \? `The cycle ended \$\{when\}\.` : 'The cycle has ended\.'/);
    expect(block).toMatch(/when \? `Renews \$\{when\}\.` : ''/);
    expect(block).toMatch(/\.filter\(Boolean\)/);
  });

  it('and the line is dropped rather than drawn empty', () => {
    /* §18.1 - nothing is drawn for nothing. An active plan with no renewal
       date on file says nothing about renewal at all. */
    const src = codeOf('lib/customer/project.ts');
    const fn = src.slice(src.indexOf('function membershipLines'));
    expect(fn.slice(0, fn.indexOf('\n}'))).toMatch(/\]\.filter\(Boolean\)/);
  });
});

describe('a document that gets sent to people can be left', () => {
  /**
   * `/invoice/<id>` and `/chapter/<id>` are the two addresses that leave the
   * product. The chapter had no way out of any kind, and the invoice fell back
   * to `/history`, which is behind a session - a stranger opening a forwarded
   * receipt met a sign-in wall.
   */
  it('both use the one rule', () => {
    expect(codeOf('app/invoice/[id]/page.tsx')).toMatch(/publicParent/);
    expect(codeOf('app/chapter/[id]/page.tsx')).toMatch(/publicParent/);
  });

  it('and the chapter actually draws the control', () => {
    expect(codeOf('app/chapter/[id]/page.tsx')).toMatch(/<Back\b/);
  });

  it('the fallback is reachable without an account', () => {
    /* `/` is the landing to a visitor and Now to an owner - the same reasoning
       `parentOf` uses for the public marketplace. */
    expect(publicParent(null).href).toBe('/');
  });
});

describe('a value never crushes the label beside it', () => {
  /**
   * The booking's "Work" row at 390px with a real service name:
   *
   *     Work        Full-body paint protection film
   *     BMW
   *     M340i
   *     xDrive
   *     Sport
   *
   * The value was `flexShrink: 0`, so it took the whole row; the label had
   * `minWidth: 0` - which it needs, or the row can never wrap at all - so it
   * collapsed to nothing and broke one word per line. Both halves of that are
   * required for the defect, which is why neither looked wrong on its own.
   */
  it('the shared value yields, and takes its own line when it must', () => {
    const parts = codeOf('components/os/parts.tsx');
    const value = parts.slice(parts.indexOf('export function Value'));
    expect(value.slice(0, 700)).not.toMatch(/flexShrink: 0/);
    expect(value.slice(0, 700)).toMatch(/marginLeft: 'auto'/);
    /* `break-word`, NOT `anywhere`. `anywhere` breaks INSIDE a word, and the
       garage printed a price across two lines - "₹32,00" then "0". A number is
       never a break opportunity. */
    expect(value.slice(0, 700)).toMatch(/overflowWrap: 'break-word'/);
    expect(value.slice(0, 700)).not.toMatch(/overflowWrap: 'anywhere'/);
  });

  it('and the row it sits in can wrap', () => {
    const parts = codeOf('components/os/parts.tsx');
    const row = parts.slice(parts.indexOf('const style: CSSProperties'));
    expect(row.slice(0, 500)).toMatch(/flexWrap: 'wrap'/);
  });

  it('no label/value row anywhere pins its value against shrinking', () => {
    /* The booking held a local copy of the same pattern; a fourth copy is how
       this comes back. */
    for (const file of CUSTOMER_FILES) {
      const src = codeOf(file);
      /* Within ONE style object - no `}` between the two - so a fixed-size
         decorative element that happens to sit near a value is not counted. */
      const before = src.match(/font-mono[^}]{0,200}?flexShrink: 0/g)?.length ?? 0;
      const after = src.match(/flexShrink: 0[^}]{0,200}?font-mono/g)?.length ?? 0;
      expect({ file, pinned: before + after }).toEqual({ file, pinned: 0 });
    }
  });
});

describe('a sealed record from an older schema does not take the room down', () => {
  /**
   * A sealed visit is immutable, so a record written before a field existed
   * still has no value for it - and `stages`, `stage.media`, `services` and
   * `termsCaptured` were all read unguarded inside a `.map` over EVERY visit.
   * One legacy document did not cost that visit its photographs; it threw, and
   * the whole History room fell to the error boundary. Found by rendering a
   * record with a stage from an older shape.
   */
  it('every array the projection reads off a visit is guarded', () => {
    const src = codeOf('lib/customer/project.ts');
    const unguarded = [
      /visit\.stages\.(map|flatMap|filter)/,
      /visit\.services\.(map|flatMap|filter)/,
      /visit\.termsCaptured\.(map|flatMap|filter)/,
      /s\.media\.(map|flatMap|filter)/,
    ].filter(r => r.test(src)).map(String);
    expect(unguarded).toEqual([]);
  });
});

describe('a photograph that does not arrive composes rather than reports', () => {
  /**
   * §11.5. A failed `next/image` puts its ALT TEXT on screen at body size; on
   * a full-bleed hero that is a sentence sprawled across the composition -
   * "BMW M340i xDrive Sport, finished at AutoModz" - beside a browser glyph.
   * The attribute stays, because that is what a screen reader reads.
   */
  it('THE CAR’S HERO - the largest element in the product - says its failure', () => {
    /* It was the last raw `<Image>` on a customer surface. A car whose
       photograph 404s collapsed it to the ALT TEXT at 16px in full ink,
       sprawled across half the display. It cannot use the primitive - the
       cover box is bespoke, because the region marks live in the
       photograph's own coordinates - so it borrows the vocabulary. */
    const src = readFileSync('components/vehicle/photograph.tsx', 'utf8');
    expect(src).toMatch(/onError=\{\(\) => setFailed\(true\)\}/);
    expect(src).toMatch(/fontSize: 0, color: 'transparent'/);
    expect(src).toMatch(/Photograph unavailable/);
    /* And the composed absence is still a DIFFERENT state from the failure. */
    expect(src).toMatch(/if \(!url \|\| failed\)/);
  });

  it('THE PRIMITIVE OWNS THE RULE, and the class it replaced is gone', () => {
    /* `.am-photo` hid the alt TEXT and not the browser's broken-image glyph,
       which is replaced content. The primitive keeps the same two
       declarations on the image it renders AND says the failure, so the class
       has nothing left to do - and a class nobody wears is one the next screen
       will wear instead of using the primitive. */
    const photograph = readFileSync('components/os/Photograph.tsx', 'utf8');
    expect(photograph).toMatch(/fontSize: 0, color: 'transparent'/);
    expect(photograph).toMatch(/state === 'failed'/);
    expect(photograph).toMatch(/Photograph unavailable/);

    const css = readFileSync('app/globals.css', 'utf8');
    expect(css).not.toMatch(/^\.am-photo\s*\{/m);
  });

  it('and every customer photograph goes through the primitive or wears it', () => {
    /**
     * STRICTER AGAIN, AND THE CLASS NO LONGER COUNTS.
     *
     * `.am-photo` sets `color: transparent; font-size: 0`, which hides the alt
     * TEXT a failed image collapses to. It does NOT hide the browser's own
     * broken-image glyph, because that is replaced content and not text - so a
     * car whose photograph 404s drew a torn-page icon in the car chooser, in
     * the middle of the room. Found by LOOKING at the render; every geometric
     * assertion passed.
     *
     * `Photograph` owns all three states - absent, ready, failed - and says
     * the third rather than letting the browser draw it. The three screens
     * that still wore the class alone (the chooser, the record's hero and the
     * garage's lead tile) go through the primitive now, so the class is no
     * longer an accepted substitute for anything.
     *
     * `Photograph.tsx` itself is exempt because it IS the implementation.
     */
    const withImages = CUSTOMER_FILES
      .filter(f => f !== 'components/os/Photograph.tsx')
      .filter(f => /<Image\b|<img\b/.test(codeOf(f)));
    for (const file of withImages) {
      const src = codeOf(file);
      const photos = (src.match(/<Image\b/g) ?? []).length + (src.match(/<img\b/g) ?? []).length;
      const marked = (src.match(/<Photograph\b/g) ?? []).length;
      expect({ file, unmarked: Math.max(0, photos - marked) })
        .toEqual({ file, unmarked: 0 });
    }
  });
});

describe('the way back never shares a line with what follows it', () => {
  /**
   * `inline-flex` + `alignSelf` assumed a flex-column parent. In the album's
   * plain `<header>` the control sat on the same line as the vehicle name and
   * read as one run: "‹ Now BMW M340i xDrive Sport".
   */
  it('it is a block that sizes to its content', () => {
    const src = codeOf('components/os/RoomHeader.tsx');
    const back = src.slice(src.indexOf('export function Back'), src.indexOf('export interface RoomHeaderProps'));
    expect(back).toMatch(/display: 'flex'/);
    expect(back).toMatch(/width: 'fit-content'/);
    expect(back).not.toMatch(/display: 'inline-flex'/);
  });
});

describe('nothing the customer reads is assembled from an absent fact', () => {
  /**
   * Two of these reached a rendered screen in one sweep:
   *   · a listing with no owner count read "undefinedth owner" to a buyer
   *   · a membership benefit with no date threw inside `longDate` and took
   *     the whole Club room to the error boundary
   * Both are the same mistake - a value formatted before it was checked.
   */
  it('a missing owner count is silence, not a word', () => {
    expect(ownerWord(1)).toBe('1st owner');
    expect(ownerWord(3)).toBe('3rd owner');
    expect(ownerWord(undefined as unknown as number)).toBe('');
    expect(ownerWord(null as unknown as number)).toBe('');
    expect(ownerWord(0)).toBe('');
    expect(ownerWord(NaN)).toBe('');
  });

  it('and the row goes with it', () => {
    const src = codeOf('lib/customer/market.ts');
    expect(src).toMatch(/ownerWord\(c\.ownership\) \? \[\{ label: 'Owners'/);
  });

  it('a date nobody recorded is empty, never a crash', () => {
    /* Sixteen callers reach `longDate`; any one of them can be handed nothing. */
    expect(longDate(undefined as unknown as string)).toBe('');
    expect(longDate(null as unknown as string)).toBe('');
    expect(longDate('')).toBe('');
    expect(longDate('2026-07-12')).toBe('12 July 2026');
  });

  it('no customer string can print the word undefined', () => {
    /* The shape that produced it: interpolating a possibly-absent value
       straight into a sentence. */
    for (const f of ['lib/os/market.ts', 'lib/customer/market.ts', 'lib/customer/project.ts']) {
      const bad = codeOf(f).split('\n')
        .filter(l => /\$\{[a-zA-Z.?\[\]]*\}(st|nd|rd|th)\b/.test(l))
        .map(l => l.trim().slice(0, 50));
      expect({ f, bad }).toEqual({ f, bad: [] });
    }
  });
});
