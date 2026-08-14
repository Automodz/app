/**
 * THE PAPER BELONGS TO THE STUDIO THAT ISSUED IT.
 *
 * A customer reaches `/invoice/[id]` from the record of their visit - "Receipt
 * · AMZ-2026-0001" - and landed somewhere else entirely: a light `#F5F5F5`
 * page, Tailwind utilities, a lucide printer icon, "PAID · CASH" in green, and
 * no way back at all. The application is an always-dark OS in monochrome. This
 * looked like a different product because it was one.
 *
 * The SHELL is the OS now. The DOCUMENT is still white, and that is deliberate:
 * it is a tax document that gets printed and saved as a PDF, and a sheet of
 * paper on a dark desk reads as exactly what it is. A dark invoice would cost
 * every customer who prints one a page of black ink.
 *
 * Not one figure moved.
 */
import { readFileSync } from 'fs';
import { hrefForDestination, publicParent } from '@/navigation/resolve';

const codeOf = (p: string) => readFileSync(p, 'utf8');
const liveCodeOf = (p: string) =>
  codeOf(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const page = liveCodeOf('app/invoice/[id]/page.tsx');
/**
 * The raw source, for the two assertions about the back-link guard.
 *
 * `liveCodeOf` strips `//` line comments with a regex, and the guard it needs
 * to see contains the literal string `'//'` - so the stripper eats the rest of
 * that line and the assertion fails against code that is perfectly correct.
 * Worth writing down: a comment-stripper that does not understand strings will
 * do this to any line guarding against protocol-relative URLs.
 */
const pageRaw = codeOf('app/invoice/[id]/page.tsx');
const doc = liveCodeOf('components/invoice/InvoiceDocument.tsx');

describe('the shell is the OS', () => {
  it('stands on the same ground as every room', () => {
    expect(page).toMatch(/background: color\.paper/);
    expect(page).toMatch(/from '@\/design'/);
  });

  it('uses the product’s own primitives, not a second set', () => {
    expect(page).toMatch(/from '@\/components\/system'/);
    /* The old shell drew its own button out of inline styles and a lucide
       icon, and its own spinner out of a Tailwind class. */
    expect(page).not.toMatch(/lucide-react/);
    expect(page).not.toMatch(/className="[^"]*\b(flex|min-h-screen|rounded-xl|w-10)\b/);
  });

  it('loading and failure are states, not blank screens (§19.1, §20.3)', () => {
    expect(page).toMatch(/<Loading caption=/);
    expect(page).toMatch(/This paper isn’t here\./);
    /* §20.4 - say the car is safe. */
    expect(page).toMatch(/are safe/);
  });
});

describe('there is a way back', () => {
  /**
   * THE RULE MOVED, AND GOT STRICTER.
   *
   * These two assertions read the invoice's own inline implementation - the
   * `'/history'` literal and the `startsWith` guard. Both now live in
   * `publicParent`, shared with `/chapter/<id>`, which is the OTHER address in
   * the product that gets sent to people and which had no way out at all.
   *
   * And the fallback changed on purpose: `/history` is behind a session, so a
   * stranger opening a receipt somebody forwarded them was pointed at a
   * sign-in wall. A dead end with a sign-in on it is still a dead end.
   */
  it('both shared documents ask the same one rule', () => {
    expect(pageRaw).toMatch(/publicParent\(from\)/);
    expect(readFileSync('app/chapter/[id]/page.tsx', 'utf8'))
      .toMatch(/publicParent\(params\.get\('from'\)\)/);
  });

  it('it lands somewhere a reader with no account can actually stand', () => {
    expect(publicParent(null).href).toBe('/');
    expect(publicParent(undefined).href).toBe('/');
  });

  it('and it refuses an off-site destination smuggled through the query', () => {
    /* `?from=` is attacker-controllable on a public address. */
    expect(publicParent('/history/v1').href).toBe('/history/v1');
    expect(publicParent('//evil.example.com').href).toBe('/');
    expect(publicParent('https://evil.example.com').href).toBe('/');
    expect(publicParent('javascript:alert(1)').href).toBe('/');
  });

  it('the record tells the paper which visit sent it - through the resolver', () => {
    const href = hrefForDestination({
      to: 'invoice', invoiceId: 'i1', token: 'tok', fromVisitId: 'vis-9',
    });
    expect(href).toContain('/invoice/i1');
    expect(href).toContain('t=tok');
    expect(href).toContain(`from=${encodeURIComponent('/history/vis-9')}`);
  });

  it('a paper nobody was sent from is still a valid address', () => {
    expect(hrefForDestination({ to: 'invoice', invoiceId: 'i1', token: 'tok' }))
      .toBe('/invoice/i1?t=tok');
    expect(hrefForDestination({ to: 'invoice', invoiceId: 'i1' })).toBe('/invoice/i1');
  });
});

describe('the document itself', () => {
  it('is still white, because it is paper and it prints', () => {
    expect(doc).toMatch(/background: 'white'/);
    expect(page).toMatch(/@media print/);
    expect(page).toMatch(/window\.print\(\)/);
  });

  it('carries no colour - the identity is monochrome', () => {
    /* Green "PAID", amber "pending", mint and yellow photo captions. */
    for (const gone of ['#059669', '#D97706', '#6EE7B7', '#FCD34D']) {
      expect(doc).not.toContain(gone);
    }
  });

  it('and every figure it ever showed is still shown', () => {
    for (const kept of [
      'invoice.lineItems.map', 'invoice.subtotal', 'invoice.discount',
      'invoice.gst', 'invoice.total', 'invoice.paymentStatus',
      'invoice.paymentMethod', 'invoice.invoiceNumber', 'gst.gstin',
    ]) {
      expect(doc).toContain(kept);
    }
  });

  it('no new concept was introduced alongside it', () => {
    /* The page holds the paper, the before/after it already had, and the
       rating card it already had. Nothing else. */
    const imports = page.match(/^import .*$/gm) ?? [];
    const components = imports.filter(l => l.includes('@/components'));
    expect(components.join('\n')).toMatch(/InvoiceDocument/);
    expect(components.join('\n')).toMatch(/RatingCard/);
    expect(components.join('\n')).toMatch(/BeforeAfterSlider/);
    expect(components).toHaveLength(4); // + the system primitives
  });
});
