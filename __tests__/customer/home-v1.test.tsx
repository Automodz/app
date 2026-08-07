/**
 * HOME IS ONE COMPOSITION, NOT A DASHBOARD.
 *
 * Home had become ten independent rectangles of equal weight — protection
 * card, book-in-a-tap list, membership card, garage card, record strip,
 * timeline card, market strip — and ten equal things have no hierarchy. With
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
};

const html = (m: Partial<HomeModel> = {}) =>
  renderToStaticMarkup(<HomeScreen model={{ ...base, ...m }} />);

/** The filled tier — §10.4 gives it to exactly one control per screen. */
const primaries = (h: string) => (h.match(/background:#F4F5F6/g) ?? []).length;

describe('Home V1 — one composition', () => {
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
      expect(html()).not.toContain('<details');
    });
    it('no booking, no NEXT VISIT frame', () => {
      expect(html()).not.toContain('NEXT VISIT');
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
      expect(h).toContain('NEXT VISIT');
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
      /* Suppression lives in the projection — these assert the render simply
         obeys it, and that Home never invents a sentence of its own. */
      expect(html()).not.toContain('All quiet');
      const live = html({
        state: { word: 'In care', line: 'Caring for it.' },
        live: { acts: [], frames: [], href: '/x' },
      });
      expect(live).not.toContain('In the studio -');
    });

    it('protection is a state, disclosed — not a wall of countdowns', () => {
      const h = html({
        protection: {
          headline: 'Protected',
          layers: ['PPF', 'Ceramic', 'Glass'],
          said: 'Everything’s holding',
          tone: 'assent',
          items: [{ id: 'p1', label: 'Ceramic', term: 'Through March 2027', tone: 'assent' }],
        },
      });
      expect(h).toContain('Protected');
      expect(h).toContain('PPF · Ceramic · Glass');
      /* Behind a tap, so a glance is not a reading exercise. */
      expect(h).toContain('<details');
      expect(h).toContain('Through March 2027');
    });

    it('while the car is here, Home becomes the visit', () => {
      /* The stage it is at, the studio's own timing, and the photographs as
         they are taken — none of which the customer could see without leaving
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
      expect(h).toContain('WORTH CONSIDERING');
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
      /* Tapping one makes Home that car's home — an address, not local state. */
      expect(h).toContain('/?car=v2');
      /* The one being shown says so. */
      expect(h).toContain('aria-current="true"');
    });

    it('its life is a photograph and a fact, not a log', () => {
      const h = html({ life: { count: '11 visits since 2023', href: '/history?car=v1', entries: [] } });
      expect(h).toContain('Its life at AutoModz');
      expect(h).toContain('11 visits since 2023');
      /* No "see all" — the photograph is the way in. */
      expect(h).not.toContain('See all');
    });

    it('its life carries what the studio already said', () => {
      /* `os/log` reached the customer only through the command palette, which
         a phone customer never opens. Carried verbatim — this is not a second
         timeline, and nothing here re-derives it. */
      const h = html({ life: { count: '2 visits since 2025', href: '/history?car=v1', entries: [
        { id: 'l1', line: 'Ceramic coating applied - protected until August 2026.', when: '10 November 2025' },
        { id: 'l2', line: 'The studio confirmed your Club membership on Gold.', when: '14 July 2026' },
      ] } });
      expect(h).toContain('Ceramic coating applied');
      expect(h).toContain('10 November 2025');
      expect(h).toContain('Club membership on Gold');
    });
  });
});

/* Keeps `Timestamp` imported for parity with the other render suites. */
void Timestamp;
