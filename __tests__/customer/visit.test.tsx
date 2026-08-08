/**
 * ONE VISIT — the permanent record.
 *
 * The trust surface. A customer opening a finished visit is asking what was
 * done to their car, what it looked like before and after, and what they were
 * actually charged — and until now the last of those lived at another address,
 * so they had to leave the record of the work to learn what the work cost.
 *
 * Two things were connected rather than invented, and both were already in the
 * backend:
 *
 *   THE COMPARISON. Before/during/after is recorded on the JOB. `framesOfVisit`
 *   prefers stage media, which carries `kind: 'photo'` — the moment is not on
 *   it — so for every visit whose stages held any media the distinction was
 *   shadowed and no comparison could be drawn. Read separately now.
 *
 *   THE RECEIPT. Line items, the discount by name, GST and payment status were
 *   complete on the invoice and rendered only by `/invoice/[id]`.
 *
 * These assertions are the state matrix: every combination of photography,
 * invoice and protection a real visit can be in.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { VisitScreen } from '@/components/screens/VisitScreen';
import type { HistoryVisit } from '@/components/screens/HistoryScreen';

const base: HistoryVisit = {
  id: 'v1',
  when: '20 July 2026',
  title: 'Glass coating',
  line: 'Glass polished, then sealed.',
  did: 'Glass polished, then sealed. Cured overnight before handover.',
};

const html = (v: Partial<HistoryVisit> = {}) =>
  renderToStaticMarkup(<VisitScreen visit={{ ...base, ...v }} />);

const receipt: NonNullable<HistoryVisit['receipt']> = {
  number: 'AMZ-2026-0184',
  lineItems: [
    { name: 'Glass coating', qty: 1, unitPrice: '₹12,000', amount: '₹12,000' },
    { name: 'Maintenance wash', qty: 1, unitPrice: '₹1,200', amount: '₹1,200' },
  ],
  subtotal: '₹13,200',
  discount: { label: 'Gold member 15% off', amount: '₹1,980' },
  gst: { rate: '18%', amount: '₹2,020' },
  total: '₹13,240',
  paid: true,
  method: 'upi',
};

describe('the visit record', () => {
  it('leads with what was done, in the studio’s words', () => {
    const h = html();
    expect(h).toContain('Glass coating');
    expect(h).toContain('Cured overnight before handover.');
  });

  describe('before and after', () => {
    it('both sides — the comparison is drawn', () => {
      const h = html({ comparison: { before: 'https://x.test/b.jpg', after: 'https://x.test/a.jpg' } });
      expect(h).toContain('role="slider"');
      expect(h).toContain('Before');
      expect(h).toContain('After');
      /* Legible before hydration — the seam starts at the midpoint, so a
         customer whose JavaScript never arrives still sees both halves. */
      expect(h).toContain('aria-valuenow="50"');
    });

    it('before only — no comparison, and no invented other half', () => {
      /* The projection refuses to build one; the screen simply has nothing.
         Filling the missing side from another frame would be a lie about the
         customer's own car. */
      const h = html({ photos: [{ url: 'https://x.test/b.jpg', description: 'x', caption: 'Before' }] });
      expect(h).not.toContain('role="slider"');
      expect(h).toContain('Before');
    });

    it('after only — same', () => {
      const h = html({ photos: [{ url: 'https://x.test/a.jpg', description: 'x', caption: 'After' }] });
      expect(h).not.toContain('role="slider"');
    });

    it('no photographs at all — nothing is drawn for nothing', () => {
      const h = html();
      expect(h).not.toContain('role="slider"');
      expect(h).not.toContain('<figure');
    });

    it('during photographs stay as supporting documentation', () => {
      const h = html({
        comparison: { before: 'https://x.test/b.jpg', after: 'https://x.test/a.jpg' },
        photos: [{ url: 'https://x.test/d.jpg', description: 'x', caption: 'During' }],
      });
      expect(h).toContain('role="slider"');
      expect(h).toContain('During');
    });
  });

  describe('the receipt', () => {
    it('states the total and how it was settled, without leaving the record', () => {
      const h = html({ receipt });
      expect(h).toContain('₹13,240');
      expect(h).toContain('Paid');
      expect(h).toContain('UPI');
    });

    it('the breakdown is behind a tap, and it is complete', () => {
      const h = html({ receipt });
      expect(h).toContain('<details');
      expect(h).toContain('AMZ-2026-0184');
      expect(h).toContain('Glass coating');
      expect(h).toContain('Maintenance wash');
      expect(h).toContain('₹13,200');
      expect(h).toContain('Gold member 15% off');
      expect(h).toContain('GST 18%');
      expect(h).toContain('₹2,020');
    });

    it('an unpaid invoice says so, and does not claim payment', () => {
      const h = html({ receipt: { ...receipt, paid: false, method: undefined } });
      expect(h).toContain('Payable at the studio');
      expect(h).not.toContain('>Paid<');
    });

    it('no invoice — the sealed total still stands, without a breakdown', () => {
      /* Most visits never have paper raised for them. A sealed visit knows
         what it came to regardless, and hiding that would have been a
         regression the album's own test caught. */
      const h = html({ settled: '₹64,000' });
      expect(h).toContain('₹64,000');
      expect(h).not.toContain('<details');
    });

    it('no invoice and no total — no money anywhere', () => {
      const h = html();
      expect(h).not.toContain('<details');
      expect(h).not.toContain('₹');
    });

    it('the total is stated once, not twice', () => {
      /* `settled` said the same figure before this; the album still uses it,
         where a visit is a line rather than an account. Here the receipt owns
         the money — one fact, one place. */
      const h = html({ receipt, settled: '₹13,240' });
      expect((h.match(/₹13,240/g) ?? []).length).toBe(1);
    });
  });

  describe('what it promised', () => {
    it('protection delivered is stated as captured, flat', () => {
      const h = html({ promised: [{ label: 'Glass coating', term: 'through june 2027' }] });
      expect(h).toContain('Glass coating');
      expect(h).toContain('through june 2027');
    });

    it('a visit that promised nothing says nothing', () => {
      expect(html()).not.toContain('through');
    });

    it('no document UI when there is no document', () => {
      const h = html();
      expect(h).not.toContain('Receipt ·');
      expect(h).not.toContain('Invoice ·');
    });
  });

  it('the share remains, and only when there is something to share', () => {
    expect(html({ shareHref: '/chapter/abc' })).toContain('Share this chapter');
    expect(html()).not.toContain('Share this chapter');
  });

  it('no card-stack — the record is photography and type', () => {
    /* `am-glass` is the one raised material. A record made of eight of them
       is the dashboard this screen exists not to be. */
    const h = html({ receipt, comparison: { before: 'https://x.test/b.jpg', after: 'https://x.test/a.jpg' } });
    expect((h.match(/am-glass/g) ?? []).length).toBe(0);
  });
});
