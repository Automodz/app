/**
 * HOME IS ONE COMPOSITION, NOT A DASHBOARD.
 *
 * Home had become ten independent rectangles of equal weight - protection
 * card, book-in-a-tap list, membership card, garage card, record strip,
 * timeline card, market strip - and ten equal things have no hierarchy. With
 * no hierarchy the customer's car stopped being the subject of their own home
 * screen, which is the only thing it was ever for.
 *
 * These assertions are about COMPOSITION, not pixels: how many primary
 * actions there are, what is drawn when there is nothing to draw, and whether
 * anything is said twice.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { Timestamp } from 'firebase/firestore';
import { HomeScreen, type HomeModel } from '@/components/screens/HomeScreen';
import { DOT } from '@/design';

const base: HomeModel = {
  vehicle: { name: 'BMW M4', plate: 'GJ 01 AA 0001' },
  state: { word: 'Cared for', line: 'Nothing needs your attention.' },
  protections: [],
  nextAction: { label: 'Arrange a visit', href: '/studio?arrange=1' },
  timeline: [],
  studio: {
    name: 'AutoModz', address: 'Maninagar', directions: '#', call: '#', message: '#',
  },
  forSale: [],
  marketHref: '/cars',
  record: [],
};

const html = (m: Partial<HomeModel> = {}) =>
  renderToStaticMarkup(<HomeScreen model={{ ...base, ...m }} />);

/**
 * §10.4 gives the filled tier to exactly one control per screen, and in the
 * ratified design that control is the WARM pane - the only surface in the
 * product tinted by the studio's own light. Counting the class is what makes
 * this assertion survive a restyle: the rule is "one thing asks", not "one
 * element is this hex".
 */
const primaries = (h: string) => (h.match(/am-glass-warm/g) ?? []).length;

describe('Home V1 - one composition', () => {
  it('offers exactly one primary action, whatever the state', () => {
    expect(primaries(html())).toBe(1);
    expect(primaries(html({ nextAction: { label: 'Follow the visit', href: '/x' } }))).toBe(1);
    expect(primaries(html({
      membership: { plan: 'Gold', said: '2 washes remaining this cycle', href: '/membership' },
      garage: { cars: [{ id: 'v1', name: 'M4', state: 'Protected', href: '/?car=v1', current: true }] },
      forSale: [{ id: 'c1', title: 'A car', price: '₹9L', detail: '2019', href: '/cars/c1' }],
    }))).toBe(1);
  });

  it('the action follows the car directly, with no card between them', () => {
    /* The hero's state and the act that answers it are one thought. A card
       wedged between them is what made Home read as a dashboard. */
    const h = html();
    expect(h.indexOf('Cared for')).toBeLessThan(h.indexOf('Arrange a visit'));
  });

  it('says nothing twice', () => {
    /* `state.note` already carries the service being done; a second line
       repeating it under the hero was the first thing this rewrite added and
       the first thing it had to take back out. */
    const h = html({ state: { word: 'In care', line: 'Caring for it.', note: 'Interior deep clean' } });
    expect((h.match(/Interior deep clean/g) ?? []).length).toBe(1);
  });

  describe('nothing is drawn for nothing (§18.1)', () => {
    it('no protection, no protection region', () => {
      expect(html()).not.toContain('Protection<');
    });
    it('no booking, no Concierge pane', () => {
      expect(html()).not.toContain('Concierge');
    });
    it('no record, no life section', () => {
      expect(html()).not.toContain('Its life at');
    });
    it('not a member, and Home does not sell one', () => {
      expect(html()).not.toContain('CLUB');
    });
    it('one car, no garage rail', () => {
      /* The cars ARE the navigation; with one there is nothing to navigate. */
      expect(html()).not.toContain('aria-current');
    });
    it('nothing for sale, no market rail', () => {
      expect(html()).not.toContain('selling');
    });
  });

  describe('and what is drawn when there is something', () => {
    it('an upcoming visit is stated plainly', () => {
      const h = html({
        next: { service: 'Ceramic maintenance', when: 'Saturday · 10:30', vehicleName: 'BMW M4', href: '/history/b1' },
      });
      expect(h).toContain('Concierge');
      expect(h).toContain('Ceramic maintenance');
      expect(h).toContain('Saturday · 10:30');
    });

    it('the one sentence is carried, not rewritten', () => {
      /* `os/truth` phrases it; Home prints it. A second wording of the same
         fact would be a second source of truth about it. */
      const h = html({ truth: 'Ceramic coating - 23 days of protection left.' });
      expect(h).toContain('Ceramic coating - 23 days of protection left.');
    });

    it('and is absent when it would repeat the hero or say nothing', () => {
      /* Suppression lives in the projection - these assert the render simply
         obeys it, and that Home never invents a sentence of its own. */
      expect(html()).not.toContain('All quiet');
      const live = html({
        state: { word: 'In care', line: 'Caring for it.' },
        live: { acts: [], frames: [], href: '/x' },
      });
      expect(live).not.toContain('In the studio -');
    });

    it('protection is a state, summarised - not a wall of countdowns', () => {
      /* It used to sit behind a `<details>`, so that a glance was not a
         reading exercise. The design answers the same worry with the DIAL:
         the number is the glance, so the layers under it are already
         supporting detail and are simply left open. A disclosure control on
         two rows is more interface than the rows it hides. */
      const h = html({
        protection: {
          headline: 'Protected',
          layers: ['PPF', 'Ceramic', 'Glass'],
          said: 'Everything’s holding',
          tone: 'assent',
          items: [{ id: 'p1', label: 'Ceramic', term: 'Through March 2027', tone: 'assent' }],
        },
        protections: [
          { id: 'p1', label: 'Ceramic', term: 'Through March 2027', remaining: 0.8, tone: 'assent' },
        ],
      });
      expect(h).toContain('Protected');
      /* The separator is `DOT` - the same glyph, but binding forward so it can
         never end a line. Compared through the token rather than by retyping
         it, since the two are indistinguishable on screen. */
      expect(h).toContain(['PPF', 'Ceramic', 'Glass'].join(DOT));
      expect(h).toContain('Through March 2027');
      expect(h).not.toContain('<details');
    });

    it('while the car is here, Home becomes the visit', () => {
      /* The stage it is at, the studio's own timing, and the photographs as
         they are taken - none of which the customer could see without leaving
         Home. This is the differentiator, not a card announcing one. */
      const h = html({
        state: { word: 'In care', line: 'Caring for it.' },
        nextAction: { label: 'Follow the visit', href: '/history/b1' },
        live: {
          acts: [
            { label: 'Received', done: true, current: false },
            { label: 'In care', done: false, current: true },
            { label: 'Ready', done: false, current: false },
          ],
          timing: 'Expected back this evening',
          frames: [{ id: 'f1', url: 'https://example.test/a.jpg', caption: 'On arrival' }],
          href: '/history/b1',
        },
      });
      expect(h).toContain('Received');
      expect(h).toContain('Expected back this evening');
      expect(h).toContain('On arrival');
      /* Still one primary action. */
      expect(primaries(h)).toBe(1);
    });

    it('a recommendation always says why', () => {
      /* The proposal engine names the object it reasons from. A suggestion
         that cannot explain itself is an advertisement. */
      const h = html({
        suggestion: {
          headline: 'Your ceramic is due',
          reason: 'The ceramic coat applied in March is six weeks from its end.',
          href: '/studio?arrange=1&cat=Ceramic',
        },
      });
      expect(h).toContain('Advisor');
      expect(h).toContain('Your ceramic is due');
      expect(h).toContain('six weeks from its end');
    });

    it('the other cars are the navigation, each with its own state', () => {
      const h = html({
        garage: { cars: [
          { id: 'v1', name: 'M4', state: 'Protected', href: '/?car=v1', current: true },
          { id: 'v2', name: 'Fortuner', state: 'In care', href: '/?car=v2', current: false },
        ] },
      });
      expect(h).toContain('Fortuner');
      expect(h).toContain('In care');
      /* Tapping one makes Home that car's home - an address, not local state. */
      expect(h).toContain('/?car=v2');
      /* The one being shown says so. */
      expect(h).toContain('aria-current="true"');
    });

    it('its life is a photograph and a fact, not a log', () => {
      const h = html({ life: { count: '11 visits since 2023', href: '/history?car=v1' } });
      expect(h).toContain('Its life at AutoModz');
      expect(h).toContain('11 visits since 2023');
      /* No "see all" - the photograph is the way in. */
      expect(h).not.toContain('See all');
    });

    it('the log carries what the studio already said', () => {
      /* `os/log` reached the customer only through the command palette, which
         a phone customer never opens. Carried verbatim - this is not a second
         timeline, and nothing here re-derives it. */
      const h = html({ record: [
        { id: 'l1', line: 'Ceramic coating applied - protected until August 2026.', when: '10 November 2025' },
        { id: 'l2', line: 'The studio confirmed your Club membership on Gold.', when: '14 July 2026' },
      ] });
      expect(h).toContain('Ceramic coating applied');
      expect(h).toContain('10 November 2025');
      expect(h).toContain('Club membership on Gold');
    });
  });
});

/* Keeps `Timestamp` imported for parity with the other render suites. */

/**
 * ONE IMPORTANT FACT = ONE DOMINANT PRESENTATION.
 *
 * A car whose ceramic is inside the attention window had the SAME underlying
 * fact stated three times on one screen, in three different wordings:
 *
 *   hero `state.note`      "The ceramic coating has 23 days of protection
 *                           left - time to renew it."   ← proposal.reason
 *   `truth`                "Ceramic coating - 23 days of protection left."
 *   WORTH CONSIDERING      the same headline and reason again
 *
 * `homeStateCopy` builds the hero OUT OF the proposal in those states, so the
 * hero is already saying what needs attention and why, in the largest type on
 * the screen, above a primary action the same proposal resolved. It wins.
 *
 * The suppression is derived from the ownership STATE, never by comparing
 * sentences - two engines phrasing one fact differently must not be detected
 * by string equality, or the day either is reworded the duplication returns
 * silently.
 */
describe('the i20 attention state - one fact, one presentation', () => {
  /** The hero as `homeStateCopy` builds it when a proposal is speaking. */
  const attention = {
    state: {
      word: 'Care due',
      line: 'Ceramic coating renewal due.',
      note: 'The ceramic coating has 23 days of protection left - time to renew it.',
    },
    nextAction: { label: 'Renew it', href: '/studio?arrange=1&cat=Ceramic' },
  } as const;

  it('the hero states it, and nothing states it again', () => {
    const h = html(attention);
    /* The reason appears exactly once - on the hero. */
    expect((h.match(/23 days of protection left/g) ?? []).length).toBe(1);
    expect(h).toContain('Ceramic coating renewal due.');
    expect(h).toContain('Renew it');
  });

  it('truth is absent when the hero owns the proposal', () => {
    /* The projection decides this; the render simply has nothing to draw. */
    const h = html({ ...attention, truth: undefined });
    expect(h).not.toContain('Ceramic coating - 23 days');
  });

  it('and no second Advisor pane appears', () => {
    const h = html(attention);
    expect(h).not.toContain('Advisor');
  });

  it('protection stays supporting detail, not a third repetition', () => {
    const h = html({
      ...attention,
      protection: {
        headline: 'Protected', layers: ['Ceramic coating', 'Warranty'],
        said: 'Everything’s holding', tone: 'assent',
        items: [{ id: 'p1', label: 'Ceramic coating', term: 'Through March 2027', tone: 'caution' }],
      },
      protections: [
        { id: 'p1', label: 'Ceramic coating', term: 'Through March 2027', remaining: 0.2, tone: 'caution' },
      ],
    });
    /* Below the dial, and it does not restate the countdown. */
    expect(h).toContain('Through March 2027');
    expect((h.match(/23 days of protection left/g) ?? []).length).toBe(1);
  });

  it('still exactly one primary action', () => {
    expect(primaries(html(attention))).toBe(1);
  });
});

/**
 * THE LOG AND THE LIFE ARE INDEPENDENT.
 *
 * `record` was nested inside `life`, and `life` requires a SEALED VISIT - so a
 * car with a membership confirmed and a coating applied but no completed visit
 * computed its entries and could never show them. Two of the demo customer's
 * four cars were in exactly that position. A life is a record of visits; a log
 * is what the studio has already said. Either can exist without the other.
 */
describe('the log and the life are gated separately', () => {
  const entries = [
    { id: 'l1', line: 'Ceramic coating applied - protected until August 2026.', when: '10 November 2025' },
  ];
  const life = { count: '3 visits since 2023', href: '/history?car=v1' };

  it('sealed visit AND log - both appear', () => {
    const h = html({ life, record: entries });
    expect(h).toContain('Its life at');
    expect(h).toContain('Ceramic coating applied');
  });

  it('NO sealed visit but a log - the log still appears', () => {
    /* The defect, stated: this rendered nothing at all before. */
    const h = html({ record: entries });
    expect(h).not.toContain('Its life at');
    expect(h).toContain('Ceramic coating applied');
  });

  it('a sealed visit but NO log - the life still appears', () => {
    const h = html({ life, record: [] });
    expect(h).toContain('Its life at');
    expect(h).not.toContain('Ceramic coating applied');
  });

  it('neither - neither is drawn (§18.1)', () => {
    const h = html({ record: [] });
    expect(h).not.toContain('Its life at');
    expect(h).not.toContain('Ceramic coating applied');
  });

  it('two cars, two independent logs - no leakage between them', () => {
    const a = html({ record: [{ id: 'a', line: 'Work began on the Kia Seltos.', when: '23 July 2026' }] });
    const b = html({ record: [{ id: 'b', line: 'The studio confirmed your Club membership on Gold.', when: '14 July 2026' }] });
    expect(a).toContain('Kia Seltos');
    expect(a).not.toContain('Club membership');
    expect(b).toContain('Club membership');
    expect(b).not.toContain('Kia Seltos');
  });
});

/* Keeps `Timestamp` imported for parity with the other render suites. */
void Timestamp;
