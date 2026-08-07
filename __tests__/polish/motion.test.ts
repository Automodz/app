/**
 * POLISH — motion discipline and dead weight.
 *
 * §7.3 is absolute: "Nothing may invent a duration. If a motion does not fit
 * one of these, question the motion." §7.2 permits exactly two curves.
 *
 * THE LANDING PAGE OBEYED NEITHER, and it is the first thing every visitor
 * sees. Its scroll reveal ran at `duration.morph` — 620ms, the token §7.5
 * reserves for a photograph carrying between two surfaces — and the hero used
 * hand-typed 750ms and 1000ms values, a third curve (`'easeInOut'`), and
 * index-based stagger chains that delayed later items by up to 210ms on top.
 *
 * A four-item row therefore finished arriving ~830ms after it scrolled into
 * view. Retimed to `duration.move`, with the chains removed, the same row is
 * complete in 280ms.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { duration, curve, easing } from '@/design';

const codeOf = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

/** Everything a customer can see move. */
const SURFACES = [...walk('components/screens'), ...walk('components/system'),
  ...walk('components/market'), ...walk('components/vehicle')];

describe('§7.3 — nothing invents a duration', () => {
  it('the four durations are the constitution\'s, unchanged', () => {
    expect(duration).toEqual({ tick: 120, move: 280, scene: 480, morph: 620 });
  });

  it('no customer surface types a duration of its own', () => {
    /* `duration: 0` is exempt: it is how reduced motion is expressed. */
    const offenders: string[] = [];
    for (const f of SURFACES) {
      for (const m of codeOf(f).matchAll(/duration:\s*([0-9.]+)\b/g)) {
        if (m[1] !== '0') offenders.push(`${f} → ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the landing page uses the tokens like every other surface', () => {
    const src = codeOf('components/screens/LandingScreen.tsx');
    expect(src).toMatch(/duration\.move \/ 1000/);
    expect(src).not.toMatch(/duration: 0\.\d/);
    expect(src).not.toMatch(/duration: 1,/);
  });

  it('a scroll reveal is a `move`, not a `morph`', () => {
    /* `morph` belongs to a photograph crossing between surfaces (§7.5). Using
       it for a paragraph made every reveal more than twice as slow as the
       constitution allows for "an element changing place or state". */
    const reveal = codeOf('components/screens/LandingScreen.tsx')
      .slice(codeOf('components/screens/LandingScreen.tsx').indexOf('const reveal = {'));
    expect(reveal.slice(0, 240)).toMatch(/duration\.move/);
    expect(reveal.slice(0, 240)).not.toMatch(/duration\.morph/);
  });
});

describe('§7.2 — two curves, and only two', () => {
  it('the curves are unchanged', () => {
    expect(curve.ease).toEqual([0.22, 1, 0.36, 1]);
    expect(easing.ease).toBe('cubic-bezier(0.22, 1, 0.36, 1)');
  });

  it('no TRANSITION reaches for a named easing keyword', () => {
    /* `'easeInOut'` is framer-motion's own curve — a third one, which §7.2
       forbids, and it was on the landing page's hero sweep.

       LOOPS ARE EXEMPT, and deliberately. §7.4 permits exactly two things to
       loop — the live indicator and the loading breath — and a loop needs a
       SYMMETRIC curve or it lurches. `curve.ease` decays hard and settles,
       which is right for an arrival and wrong for a breath. `Loading` and
       `Skeleton` are the two, both `repeat: Infinity`. */
    const offenders = SURFACES.filter(f => {
      const src = codeOf(f);
      if (!/['"]ease(InOut|Out|In)['"]|['"]linear['"]/.test(src)) return false;
      return !/repeat: Infinity/.test(src);
    });
    expect(offenders).toEqual([]);
  });

  it('the only looping surfaces are the two §7.4 allows', () => {
    const looping = SURFACES.filter(f => /repeat: Infinity/.test(codeOf(f)));
    expect(looping.sort()).toEqual([
      'components/system/Loading.tsx',
      'components/system/Skeleton.tsx',
    ]);
  });
});

describe('§7.1 — motion decorates, it never gates', () => {
  it('nothing staggers content behind an index', () => {
    /* `delay: i * 0.07` makes the fourth item wait 210ms for no reason the
       customer can perceive as anything but slowness. */
    const offenders: string[] = [];
    for (const f of SURFACES) {
      for (const m of codeOf(f).matchAll(/delay:\s*[^,}]+/g)) offenders.push(`${f} → ${m[0]}`);
    }
    expect(offenders).toEqual([]);
  });

  it('every animating surface still honours reduced motion', () => {
    const animated = SURFACES.filter(f => /framer-motion/.test(codeOf(f)));
    expect(animated.length).toBeGreaterThan(0);
    for (const f of animated) {
      expect({ f, guarded: /useReducedMotion|MotionConfig/.test(codeOf(f)) })
        .toEqual({ f, guarded: true });
    }
  });
});

describe('nothing renders a boundary that cannot do anything', () => {
  it('no Suspense wraps a component that cannot suspend', () => {
    /* `/cars` wrapped a server component with no state, no effects and no
       `useSearchParams` in `<Suspense fallback={null}>` — a tree for React to
       walk and nothing for the customer. The ones that remain wrap a client
       component that really does read search params. */
    const cars = codeOf('app/cars/page.tsx');
    expect(cars).not.toMatch(/Suspense/);
    expect(codeOf('app/dashboard/sell-car/page.tsx')).not.toMatch(/Suspense/);
    /* `/cars/[id]` keeps its boundary: `ListingScreen` reads `?ask=`. */
    expect(codeOf('app/cars/[id]/page.tsx')).toMatch(/Suspense/);
    expect(codeOf('components/screens/ListingScreen.tsx')).toMatch(/useSearchParams/);
  });
});

describe('the stylesheet carries nothing dead', () => {
  const css = readFileSync('app/globals.css', 'utf8');
  const defined = [...new Set([...css.matchAll(/^\.([a-z][a-z0-9-]+)/gm)].map(m => m[1]))];
  const source = [...walk('app'), ...walk('components'), ...walk('lib'), ...walk('navigation')]
    .map(f => readFileSync(f, 'utf8')).join('\n');

  it('every class it defines is used somewhere', () => {
    /* 62 classes survived three retired eras — the ember palette, the WebGL
       hero, the old `st-` surfaces — and shipped on every page. */
    const unused = defined.filter(c => !new RegExp(`\\b${c}\\b`).test(source));
    expect(unused).toEqual([]);
  });

  it('every keyframe it defines is animated by something', () => {
    const frames = [...css.matchAll(/@keyframes\s+([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
    const orphans = frames.filter(n =>
      !new RegExp(`animation[^;{}]*\\b${n}\\b`).test(css));
    expect(orphans).toEqual([]);
  });

  it('its braces balance', () => {
    expect((css.match(/\{/g) ?? []).length).toBe((css.match(/\}/g) ?? []).length);
  });

  it('it is meaningfully smaller than it was', () => {
    /* 60,071 chars before the dead-CSS pass, 41,632 after — a third of the
       stylesheet was rules for three retired eras, shipping on every page.

       The ceiling has since moved to 48,000 to admit the ambient field, the
       glass material, the press feedback and the focus ring — all live rules
       with call sites, all asserted above by "every class it defines is used
       somewhere". The guard's job is to catch DEAD weight creeping back, and
       that assertion is the one doing it; this is the coarse backstop. */
    expect(css.length).toBeLessThan(48_000);
  });
});
