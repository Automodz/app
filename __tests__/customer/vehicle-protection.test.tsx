/**
 * THE CAR'S OWN ROOM OWNS ITS PROTECTION.
 *
 * §11.1 — protection belongs to the car. It was projected into this room ONLY
 * as marks on the photograph, positioned by `regionsFor()`, which has never
 * returned a region because nobody has ever authored one for a real photograph.
 * And the projection first threw away every protection that does not sit
 * somewhere on the paint: insurance, the pollution certificate, the
 * registration and the FASTag — six of the ten kinds.
 *
 * Between the two, a Kia with seven live protections, one of them a PUC
 * nineteen days from lapsing, showed a name, a plate, one state word, "With
 * AutoModz since 2026" and two links. Home summarised the protection. The car
 * itself said nothing about it.
 *
 * These assertions are the ownership: the room states every layer and when it
 * runs out, it draws no document control where there is no document, and it
 * offers the §18.4 invitation when a car has nothing declared.
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
  declareHref: 'https://wa.me/000',
};

const layer = (over: Partial<VehicleProtection> = {}): VehicleProtection => ({
  id: 'p1', label: 'Ceramic coating', term: '46 days left', tone: 'caution',
  region: 'paint', ...over,
});

/* Rendered through the renderer boundary, exactly as the room is. Asserted on
   BOTH compositions — a car with a photograph and one still awaiting its
   first — because protection lives below the fold in both and the §11.5
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

  it('says when each one runs out — the expiry is the point', () => {
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

  it('NO DOCUMENT, NO DOCUMENT CONTROL — nothing writes one yet', () => {
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

  it('a car with nothing declared gets the invitation, not an empty frame', () => {
    /* §18.4 — one line, one action. It existed only behind a region tap,
       which nothing in the product could perform. */
    const h = html({ protections: [] });
    expect(h).toContain('Nothing declared yet');
    expect(h).toContain('Tell us what protects it');
    expect(h).not.toContain('What protects it<');
  });

  it('and no invitation where there is nowhere to send it', () => {
    /* §10.5 — never a control with no destination. */
    const h = html({ protections: [], declareHref: undefined });
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
       missing — and it renders `Acts` too, so the protection must survive it. */
    const h = html({ protections: [
      layer({ label: 'Pollution certificate', term: 'Lapsed 30 July 2026', tone: 'lapsed', region: undefined }),
    ] }, noPhoto);

    expect(h).toContain('What protects it');
    expect(h).toContain('Pollution certificate');
    expect(h).toContain('Lapsed 30 July 2026');
  });
});
