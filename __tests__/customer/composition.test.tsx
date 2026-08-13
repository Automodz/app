/**
 * THE COMPOSITION HOLDS ON A PHONE.
 *
 * Reported from production, Safari on an iPhone, a car in the studio:
 * "Running longer than planned — the work sets the pace." was set in 62px
 * display type, wrapped over six lines, and drawn straight through the car's
 * own name, the state's sentence, the ring it was supposed to be inside, and
 * the card below it. The screen was unreadable and nothing was clipping it.
 *
 * It was not a breakpoint, a `100vh`, a transform or a z-index. It was a
 * SENTENCE IN A NUMBER SLOT: `Dial` renders its children at a quarter of its
 * own diameter, `HomeScreen` handed it `state.timing`, and `state.timing` is
 * worded by the projection as prose — "Planned finish around 5:40 pm." on
 * plan, and the sentence above once the visit runs past it. Every live visit
 * was drawing this; the late wording was merely the longest.
 *
 * Two failures, so two sets of assertions:
 *
 *   1. THE SCREEN. The dial holds a measure, and the sentence is said once,
 *      in the pane that has always carried it.
 *   2. THE PRIMITIVE. Whatever a caller puts in that slot, it stays inside
 *      the ring — because a component whose layout depends on its caller
 *      behaving is not bounded, and this one was not.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'fs';
import { HomeScreen, type HomeModel } from '@/components/screens/HomeScreen';
import { Dial } from '@/components/os';
import { isCustomerSurface } from '@/navigation/routes';

const codeOf = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/** The exact sentence from the production screenshot. `lib/os/stay.ts`. */
const LATE = 'Running longer than planned — the work sets the pace.';
const ON_PLAN = 'Planned finish around 5:40 pm.';

const base: HomeModel = {
  vehicle: { name: 'Kia Seltos', plate: 'GJ01AB8539' },
  state: { word: 'Final checks', line: 'Final checks before it comes home.', timing: LATE },
  protections: [],
  nextAction: { label: 'Follow the visit', href: '/history/v1' },
  timeline: [],
  studio: { name: 'AutoModz', address: 'Maninagar', directions: '#', call: '#', message: '#' },
  forSale: [],
  marketHref: '/cars',
  record: [],
  live: {
    acts: [
      { label: 'Received', done: true, current: false },
      { label: 'Looked over', done: true, current: false },
      { label: 'In care', done: true, current: false },
      { label: 'Final checks', done: false, current: true },
      { label: 'Ready', done: false, current: false },
    ],
    timing: LATE,
    frames: [],
    href: '/history/v1',
  },
};

const html = (m: Partial<HomeModel> = {}) =>
  renderToStaticMarkup(<HomeScreen model={{ ...base, ...m }} />);

/** What is actually inside the ring, as rendered. */
const dialValue = (h: string) => {
  const at = h.indexOf('am-dial-value');
  if (at === -1) return null;
  const open = h.indexOf('>', at);
  return h.slice(open + 1, h.indexOf('</span>', open)).replace(/<[^>]+>/g, '');
};

/* ── 1. THE SCREEN ───────────────────────────────────────────────────────── */

describe('the live dial holds a measure, not the sentence', () => {
  it('the reported sentence is nowhere near the ring', () => {
    /* The bug, pinned by its own words. */
    expect(dialValue(html())).not.toContain('Running longer');
    expect(dialValue(html())).not.toContain('the work sets');
  });

  it('the on-plan wording is no more welcome — it was prose too', () => {
    /* Every live visit drew this. The late sentence was only the longest, so
       fixing "the long one" would have left the screen broken on plan. */
    const h = html({ state: { ...base.state, timing: ON_PLAN }, live: { ...base.live!, timing: ON_PLAN } });
    expect(dialValue(h)).not.toContain('Planned finish');
  });

  it('it holds how far through the visit the floor has got', () => {
    /* Three of five acts done. The same number the ARC has always drawn — so
       the ring and the reading inside it cannot disagree. */
    expect(dialValue(html())).toBe('60%');
  });

  it('and that reading is short enough for the slot it is in', () => {
    expect((dialValue(html()) ?? '').length).toBeLessThanOrEqual(4);
  });

  it('the timing sentence is still said, once, where it always was', () => {
    /* The fix adds no words to the screen and removes none: the pane below
       the dial carries the sentence, exactly as before. §3.2 — one subject;
       §22.2 — and one wording of it.

       Counted on what is DRAWN, with the attributes stripped — the same
       sentence is deliberately also in the dial's accessible name, which is
       the test above, and an accessible name is not a second wording on the
       screen. */
    const visible = html().replace(/<[^>]+>/g, '\n');
    expect((visible.match(/Running longer than planned/g) ?? []).length).toBe(1);
    /* It LEADS the pane now rather than following the pane's own title. The
       title was "Follow the visit" — the exact words of the one action below
       it, pointing at the same address — so the pane says the thing only it
       has instead, and the words appear once, on the action. */
    expect((visible.match(/Follow the visit/g) ?? []).length).toBe(1);
    expect(visible.indexOf('Running longer')).toBeLessThan(visible.indexOf('Follow the visit'));
  });

  it('the ring is still lit by the same fraction', () => {
    /* Nothing about the composition moved. Guarded because "make the number
       agree with the arc" must never become "change the arc". */
    const screen = codeOf('components/screens/HomeScreen.tsx');
    expect(screen).toMatch(/fill=\{throughVisit\}/);
    expect(screen).toMatch(/const throughVisit = live && live\.acts\.length \? done \/ live\.acts\.length : 0/);
  });

  it('a screen reader is told the number AND the timing', () => {
    /* The sentence left the visible slot; it must not leave the accessible
       name, or the one customer who cannot see the pane loses it entirely. */
    const h = html();
    const label = h.match(/aria-label="([^"]*through the visit[^"]*)"/)?.[1] ?? '';
    expect(label).toContain('60 percent through the visit');
    expect(label).toContain('Running longer than planned');
  });
});

describe('the act names line up with the bars they name', () => {
  it('each name shares the segments’ grid instead of taking width from its neighbours', () => {
    /* `space-between` on five content-width spans let "Looked over" squeeze
       the four beside it — which is why the strip read as compressed on a
       phone. Asserted on the rule, since the widths themselves need a
       browser. */
    const screen = codeOf('components/screens/HomeScreen.tsx');
    /* The names' own block: from where they are mapped to the end of the
       phases pane. Bounded, because the rest of the screen uses
       `space-between` legitimately and an unbounded slice would read it. */
    const from = screen.indexOf('live.acts.map(a => (');
    const strip = screen.slice(from, screen.indexOf('live.frames.length', from));
    expect(strip).toMatch(/flex: 1, minWidth: 0, textAlign: 'center'/);
    expect(strip).not.toMatch(/justifyContent: 'space-between'/);
  });
});

/* ── 2. THE PRIMITIVE ────────────────────────────────────────────────────── */

describe('nothing a caller puts in the dial can leave the ring', () => {
  const render = (children: React.ReactNode) =>
    renderToStaticMarkup(<Dial fill={0.5} label="x" size={250}>{children}</Dial>);

  const styleOf = (h: string) => h.match(/class="am-display am-dial-value" style="([^"]*)"/)?.[1] ?? '';

  it('the reading is clamped to two lines and clipped', () => {
    const s = styleOf(render('82%'));
    expect(s).toMatch(/-webkit-line-clamp:\s*2/);
    expect(s).toMatch(/overflow:\s*hidden/);
  });

  it('a long reading is set SMALLER rather than allowed to be wider', () => {
    /* The step exists so a two-word state still fills the ring; the point is
       that it never grows the box. */
    const small = Number(styleOf(render('Final checks')).match(/font-size:\s*(\d+)/)?.[1]);
    const large = Number(styleOf(render('82%')).match(/font-size:\s*(\d+)/)?.[1]);
    expect(small).toBeLessThan(large);
    expect(large).toBe(Math.round(250 * 0.25));
  });

  it('prose gets the smallest step and is still clipped, not escaped', () => {
    const s = styleOf(render(LATE));
    expect(Number(s.match(/font-size:\s*(\d+)/)?.[1])).toBeLessThanOrEqual(Math.round(250 * 0.125));
    expect(s).toMatch(/-webkit-line-clamp:\s*2/);
  });

  it('the ring is a CEILING, so a narrow column shrinks it instead of overflowing', () => {
    /* `width: 250px` was the whole reason a phone could not contain this. */
    const h = render('82%');
    expect(h).toMatch(/width:\s*min\(250px,\s*100%\)/);
    expect(h).toMatch(/aspect-ratio:\s*1 \/ 1/);
    expect(h).not.toMatch(/height:\s*250px/);
  });

  it('the reading sits inside the ARC, not merely inside the element', () => {
    /* `inset: 0` let the number be drawn over the arc it belongs to. */
    expect(render('82%')).toMatch(/inset:\s*13%/);
  });

  it('the caption can never widen the ring either', () => {
    const h = renderToStaticMarkup(
      <Dial fill={0.5} label="x" caption="a caption nobody should have written here">82%</Dial>,
    );
    const cap = h.match(/class="am-label" style="([^"]*)"/)?.[1] ?? '';
    expect(cap).toMatch(/text-overflow:\s*ellipsis/);
    expect(cap).toMatch(/white-space:\s*nowrap/);
  });

  it('and it says so out loud in development', () => {
    /* The production symptom of prose in this slot is a clipped word, which
       is quiet enough to ship — and did. */
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(LATE);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[Dial]'));
    spy.mockClear();
    render('82%');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('the number is measured against the ring it actually got', () => {
    /* A dial that shrank to fit a narrow column kept sizing its type from the
       prop it asked for. Container units, and only inside `@supports`, so a
       browser without them keeps the arithmetic that was already correct. */
    const css = readFileSync('app/globals.css', 'utf8');
    const block = css.slice(css.indexOf('@supports (container-type: inline-size)'));
    expect(block).toMatch(/\.am-dial \{ container-type: inline-size; \}/);
    expect(block).toMatch(/\.am-dial-value \{ font-size: calc\(var\(--dial-scale[^)]*\) \* 100cqw\); \}/);
  });
});

/* ── 3. A ROOM IS ALWAYS DARK ────────────────────────────────────────────── */

describe('the light theme cannot reach inside a room', () => {
  it('the chrome that knows what a room is applies it', () => {
    /* The rooms write their ink from one palette and that palette is the dark
       one: #EDEBE7 is 16.74:1 on paper and about 1.1:1 on a white pane. A
       customer with `theme: 'light'` stored from the marketing site got a room
       whose words were simply not there. */
    const chrome = codeOf('navigation/CustomerChrome.tsx');
    expect(chrome).toMatch(/<RoomTheme \/>/);
  });

  /**
   * WIDENED, DELIBERATELY. This block first asserted that the theme was
   * applied only inside the ROOM branch. That was the smallest correct fix
   * for the reported screenshot and it was too small: `/cars`,
   * `/cars/<id>` and `/dashboard/sell-car` are drawn from the same one dark
   * palette and carry no dock on purpose, so they were left in daylight —
   * measured on `/cars/<id>`, the title, the price and every value in the
   * specification list were white on white.
   *
   * Two questions now, from one route table: `roomFor` decides the DOCK,
   * `isCustomerSurface` decides the LIGHT.
   */
  it('and it reaches every customer surface, dock or no dock', () => {
    const chrome = codeOf('navigation/CustomerChrome.tsx');
    expect(chrome).toMatch(/isCustomerSurface\(pathname\)\s*\?\s*<><RoomTheme \/>[\s\S]{0,40}\{children\}<\/>/);

    /* The predicate itself, on the addresses that were broken. */
    expect(isCustomerSurface('/cars')).toBe(true);
    expect(isCustomerSurface('/cars/abc123')).toBe(true);
    expect(isCustomerSurface('/dashboard/sell-car')).toBe(true);
    expect(isCustomerSurface('/welcome')).toBe(true);
    /* And every room, so the two answers can never disagree. */
    for (const r of ['/', '/studio', '/garage', '/membership', '/you', '/history', '/vehicle']) {
      expect({ r, customer: isCustomerSurface(r) }).toEqual({ r, customer: true });
    }
  });

  /**
   * AND THE LIGHT TRAVELS WITH THE PALETTE.
   *
   * Half of "the room" is the palette and the other half is the field, and
   * only the first half was reaching these surfaces. The door and the public
   * landing took `RoomTheme` and stopped — so they were the room's near-black
   * with none of the room's amber, which is the difference between the studio
   * and a black page. They are the first two things anybody sees.
   *
   * A surface also cannot paint its own ground, or it covers the field it was
   * just given: `Ambient` is fixed at `z-index: 0` and a positioned element
   * later in the DOM with an opaque background sits straight on top of it.
   * That is why mounting the field alone changed nothing until the landing's
   * and the door's own `background: color.paper` came off — `body` is already
   * `--bg`, and no room paints its own ground either (`os/Screen`).
   */
  it('and so does the field, on the same surfaces', () => {
    const chrome = codeOf('navigation/CustomerChrome.tsx');
    /* Both non-room branches: the customer surface, and the signed-out home. */
    expect(chrome).toMatch(/isCustomerSurface\(pathname\)\s*\?\s*<><RoomTheme \/><Ambient \/>/);
    expect(chrome).toMatch(/!signedIn && pathname === HOME\) return <><RoomTheme \/><Ambient \/>/);
    /* Three lights, one field — mounted once, never per screen. */
    expect(chrome.match(/<Ambient \/>/g)).toHaveLength(3);
  });

  it('and nothing under that field paints its own ground over it', () => {
    for (const f of ['components/screens/LandingScreen.tsx', 'app/auth/login/page.tsx']) {
      /* `color.paper` may still be used — the landing's intro splash is meant
         to be opaque. What may not exist is a root that fills itself with it. */
      expect({ f, opaqueRoot: /minHeight: '100svh',[\s\S]{0,80}background: color\.paper/.test(codeOf(f)) })
        .toEqual({ f, opaqueRoot: false });
      expect({ f, opaqueRoot: /overflowX: 'clip', background: color\.paper/.test(codeOf(f)) })
        .toEqual({ f, opaqueRoot: false });
    }
  });

  it('but never onto a surface that is not the customer product', () => {
    /* The legal pages and a printable invoice paint their own ground and are
       not drawn from this palette; operations has its own shell entirely.
       Forcing the room's light onto them would be inventing a rule. */
    for (const r of ['/privacy', '/terms', '/invoice/abc', '/admin', '/admin/schedule', '/store']) {
      expect({ r, customer: isCustomerSurface(r) }).toEqual({ r, customer: false });
    }
  });

  it('before the first paint, not after it', () => {
    /* An effect alone flashes a light room for a frame on every cold load. */
    const theme = codeOf('navigation/RoomTheme.tsx');
    expect(theme).toMatch(/dangerouslySetInnerHTML/);
    expect(theme).toMatch(/data-theme','dark'/);
  });

  it('and the customer gets their own preference back on the way out', () => {
    /* The stored choice is not overwritten and not discarded — the landing
       page, the legal pages and an invoice still honour it. */
    const theme = codeOf('navigation/RoomTheme.tsx');
    expect(theme).toMatch(/return \(\) => wear\(storedTheme\(\)\)/);
    expect(theme).not.toMatch(/localStorage\.setItem/);
  });
});

describe('the dock names the four rooms you are not standing in', () => {
  it('their ink is the token with a measured contrast, not a literal', () => {
    /* `rgba(237,235,231,0.42)` is primary ink at 42% — a number nobody had
       measured, and about 2.6:1 on the dock's own glass. §21.1 wants 4.5:1
       and §22.4 wants no component writing its own colour value. */
    const dock = codeOf('navigation/BottomNavigation.tsx');
    expect(dock).toMatch(/color: active \? color\.amber : color\.ink3/);
    expect(dock).not.toMatch(/rgba\(237,\s*235,\s*231/);
  });

  it('and every slot is still a 44px target', () => {
    const dock = codeOf('navigation/BottomNavigation.tsx');
    expect(dock).toMatch(/minWidth: TARGET_MIN/);
    expect(dock).toMatch(/minHeight: TARGET_MIN/);
  });
});

/* ── 4. WHAT IT WAS NOT ──────────────────────────────────────────────────── */

describe('the viewport assumptions were already right, and stay right', () => {
  it('no customer surface measures itself against the large viewport', () => {
    /* `100vh` on a phone is the height WITHOUT the browser's own bars, so the
       last of the page sits under them. Checked because it is the usual
       suspect for this symptom and was, here, innocent — which is worth
       keeping true. */
    const surfaces = [
      'components/os/Screen.tsx', 'components/screens/Room.tsx',
      'components/screens/ServerRoom.tsx', 'components/screens/LiveVisitScreen.tsx',
    ];
    for (const f of surfaces) {
      expect({ f, vh: /:\s*'100vh'|100vh[^a-z]/.test(codeOf(f)) }).toEqual({ f, vh: false });
      expect(codeOf(f)).toMatch(/100svh/);
    }
  });

  it('the room reserves the whole fixed stack, safe area included', () => {
    const screen = codeOf('components/os/Screen.tsx');
    expect(screen).toMatch(/paddingBottom: stack\.contentFloor/);
    expect(screen).toMatch(/env\(safe-area-inset-top/);
    const grid = codeOf('design/grid.ts');
    expect(grid).toMatch(/contentFloor:[^;]*env\(safe-area-inset-bottom/);
  });
});
