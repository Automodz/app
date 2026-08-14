/**
 * THE CAR'S OWN ROOM OWNS ITS PROTECTION.
 *
 * §11.1 - protection belongs to the car. It was projected into this room ONLY
 * as marks on the photograph, positioned by `regionsFor()`, which has never
 * returned a region because nobody has ever authored one for a real photograph.
 * And the projection first threw away every protection that does not sit
 * somewhere on the paint: insurance, the pollution certificate, the
 * registration and the FASTag - six of the ten kinds.
 *
 * Between the two, a Kia with seven live protections, one of them a PUC
 * nineteen days from lapsing, showed a name, a plate, one state word, "With
 * AutoModz since 2026" and two links. Home summarised the protection. The car
 * itself said nothing about it.
 *
 * These assertions are the ownership: the room states every layer and when it
 * runs out, and it draws no document control where there is no document.
 *
 * ── WHAT CHANGED WITH THE CERTIFICATE FLOW ───────────────────────────────
 * Two assertions here used to pin the §18.4 invitation: an empty-ledger pane
 * saying "Nothing declared yet · Tell us what protects it", over a `wa.me`
 * link. That was the product's ONLY declaration path and it ended in a
 * messaging application - nothing on the other side of it wrote a Protection.
 * A test that pins a workaround keeps the workaround.
 *
 * The certificate now carries its own row in the ledger whatever the car has,
 * and the row carries a real act, so there is no empty ledger left to fill.
 * The two assertions below replace those: a layer with an act draws it, and a
 * layer without one draws nothing extra.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { VehicleScreen } from '@/components/screens/VehicleScreen';
import type { VehicleModel, VehicleProtection } from '@/components/screens/VehicleScreen';
import { photograph } from '@/components/vehicle';

const base: VehicleModel = {
  name: 'Kia Seltos',
  plate: 'GJ01AB8539',
  state: 'Cared for',
  since: 'With AutoModz since 2026',
  historyHref: '/history?car=v1',
  protections: [],
  media: [],
  editHref: '/garage?edit=v1',
  arrangeHref: '/studio?arrange=1',
};

const layer = (over: Partial<VehicleProtection> = {}): VehicleProtection => ({
  id: 'p1', label: 'Ceramic coating', term: '46 days left', tone: 'caution',
  region: 'paint', ...over,
});

/* Rendered through the renderer boundary, exactly as the room is. Asserted on
   BOTH compositions - a car with a photograph and one still awaiting its
   first - because protection lives below the fold in both and the §11.5
   absence used to take the whole room with it. */
const withPhoto = photograph({ url: 'https://x.test/car.jpg', aspect: 1, regions: [] });
const noPhoto = photograph({ aspect: 1, regions: [] });

const html = (over: Partial<VehicleModel> = {}, rendering = withPhoto) =>
  renderToStaticMarkup(<VehicleScreen model={{ ...base, ...over }} rendering={rendering} />);

describe('what protects the car, in the car’s own room', () => {
  it('states every layer, including the ones that are nowhere on the paint', () => {
    const h = html({ protections: [
      layer({ id: 'a', label: 'Ceramic coating', term: '46 days left' }),
      layer({ id: 'b', label: 'Pollution certificate', term: '19 days left', region: undefined, tone: 'urgent' }),
      layer({ id: 'c', label: 'Insurance', term: 'Through December 2026', region: undefined, tone: 'assent' }),
      layer({ id: 'd', label: 'FASTag', term: 'Topped up', region: undefined, tone: 'assent' }),
      layer({ id: 'e', label: 'Registration', term: 'For as long as you own it', region: undefined, tone: 'assent' }),
    ] });

    expect(h).toContain('What protects it');
    for (const label of ['Ceramic coating', 'Pollution certificate', 'Insurance', 'FASTag', 'Registration']) {
      expect(h).toContain(label);
    }
  });

  it('says when each one runs out - the expiry is the point', () => {
    const h = html({ protections: [
      layer({ id: 'a', term: '19 days left' }),
      layer({ id: 'b', label: 'Insurance', term: 'Through December 2026', region: undefined }),
      layer({ id: 'c', label: 'Paint protection film', term: 'For as long as you own it', region: undefined }),
    ] });

    expect(h).toContain('19 days left');
    expect(h).toContain('Through December 2026');
    expect(h).toContain('For as long as you own it');
  });

  it('a lapsed layer is not dressed up as a healthy one', () => {
    const h = html({ protections: [
      layer({ label: 'Pollution certificate', term: 'Lapsed 30 July 2026', tone: 'lapsed', region: undefined }),
    ] });
    expect(h).toContain('Lapsed 30 July 2026');
  });

  it('NO DOCUMENT, NO DOCUMENT CONTROL - nothing writes one yet', () => {
    /* §14.6 offers the file behind one tap. Not one protection in production
       carries a `document`, so a control here would be a promise the product
       cannot keep. */
    const h = html({ protections: [layer()] });
    expect(h).not.toContain('The original');
  });

  it('and the control appears the moment a real file exists', () => {
    const h = html({ protections: [layer({ documentHref: 'https://files.test/puc.pdf' })] });
    expect(h).toContain('The original');
    expect(h).toContain('https://files.test/puc.pdf');
  });

  it('a layer the customer can act on carries the way in, in the ledger', () => {
    /* §10.5 - nothing is inert. The certificate is the first protection with
       something to do about it, and the row is where that lives. */
    const h = html({ protections: [
      layer({
        label: 'Pollution certificate',
        term: 'Not added',
        tone: 'caution',
        region: undefined,
        action: { label: 'Declare certificate', href: '/vehicle/puc?car=v1' },
      }),
    ] });
    expect(h).toContain('Declare certificate');
    expect(h).toContain('/vehicle/puc?car=v1');
  });

  it('and a layer with nothing to do about it draws no control at all', () => {
    /* A ceramic coating is not something a customer renews from a screen. */
    const h = html({ protections: [layer()] });
    expect(h).not.toContain('Declare certificate');
    expect(h).not.toContain('/vehicle/puc');
  });

  it('the dead WhatsApp invitation is gone, and stays gone', () => {
    /* It was the only declaration path in the product and it wrote nothing.
       `render.test.tsx` already forbids `wa.me` across the rooms; this pins
       the copy, because a sentence can outlive the link under it. */
    const h = html({ protections: [] });
    expect(h).not.toContain('Nothing declared yet');
    expect(h).not.toContain('Tell us what protects it');
  });

  it('the room still says what it always said', () => {
    /* Protection is added to this room, not substituted for it. */
    const h = html({ protections: [layer()] });
    expect(h).toContain('Kia Seltos');
    expect(h).toContain('GJ01AB8539');
    expect(h).toContain('Cared for');
    expect(h).toContain('Its history');
    expect(h).toContain('Correct the car');
  });

  it('a car still awaiting its first photograph says it just the same', () => {
    /* §11.5's composition is a different room, not this one with the picture
       missing - and it renders `Acts` too, so the protection must survive it. */
    const h = html({ protections: [
      layer({ label: 'Pollution certificate', term: 'Lapsed 30 July 2026', tone: 'lapsed', region: undefined }),
    ] }, noPhoto);

    expect(h).toContain('What protects it');
    expect(h).toContain('Pollution certificate');
    expect(h).toContain('Lapsed 30 July 2026');
  });
});
