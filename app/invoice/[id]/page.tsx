'use client';
/**
 * THE PAPER, HELD BY THE STUDIO.
 *
 * A customer reaches this from the record of their visit — "Receipt ·
 * AMZ-2026-0001" — and used to land somewhere else entirely: a light `#F5F5F5`
 * page, Tailwind utilities, a lucide printer icon, "PAID · CASH" in green, and
 * no way back. The application is an always-dark OS in monochrome; this looked
 * like a different product, because it was one.
 *
 * ── WHAT CHANGED AND WHAT DELIBERATELY DID NOT ──────────────────────────────
 * The SHELL is the OS: the same ground, the same tokens, the same primitives.
 * The DOCUMENT is still white paper, and that is not an oversight. It is a tax
 * document that gets printed and saved as a PDF, and a sheet of paper lying on
 * a dark desk reads as exactly what it is. Making the invoice itself dark would
 * cost every customer who prints one a page of black ink and would make the
 * studio's books look like an app screenshot.
 *
 * Not one figure moved. Same line items, same subtotal, same discount, same
 * GST, same total, same payment line, same GSTIN, same photographs.
 *
 * ── BACK ────────────────────────────────────────────────────────────────────
 * There was none. `history.back()` alone is not enough — this address is
 * shared, and whoever opens the link from a message has no history to go back
 * to. So: back to the visit when we came from one, and to History otherwise.
 */
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import InvoiceDocument, { InvoiceDocData } from '@/components/invoice/InvoiceDocument';
import RatingCard from '@/components/invoice/RatingCard';
import BeforeAfterSlider from '@/components/ui/BeforeAfterSlider';
import { Heading, Text, Button, Loading } from '@/components/system';
import { color, space, INSET, MEASURE, stack } from '@/design';
import { publicParent } from '@/navigation/resolve';

export default function PublicInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get('t');
  /* Where the customer came from, when the record sent them. A shared link
     carries none, and then History is the honest destination. */
  const from = searchParams.get('from');
  const [invoice, setInvoice] = useState<InvoiceDocData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError('Invalid link'); return; }
    fetch(`/api/invoice/${id}?t=${encodeURIComponent(token)}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json()).error || 'Not found');
        return r.json();
      })
      .then(setInvoice)
      .catch(e => setError(e.message));
  }, [id, token]);

  /* One rule for both shared documents — see `publicParent`. This fell back
     to `/history`, which is behind a session, so a stranger opening a receipt
     somebody sent them was pointed at a sign-in wall. */
  const parent = publicParent(from);
  const backHref = parent.href;

  /* One ground for all three states, so the page never changes character
     between loading, failing and holding the document. */
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <main
      style={{
        minHeight: '100svh',
        background: color.paper,
        paddingBottom: stack.contentFloor,
      }}
    >
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
      {children}
    </main>
  );

  if (error) {
    return (
      <Shell>
        <section style={{
          paddingInline: INSET, maxWidth: MEASURE + INSET * 2, marginInline: 'auto',
          minHeight: '70svh', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          {/* §20.3 — ours or theirs, and this one is neither the customer's
              fault nor a failure of their car. */}
          <Heading level="display">This paper isn’t here.</Heading>
          <Text role="body" tone="ink2" style={{ marginTop: space.line, maxWidth: MEASURE }}>
            The link may have expired, or it was never for this document. Your
            visit and everything in it are safe.
          </Text>
          <div style={{ marginTop: space.gap }}>
            <Button tier="forward" href={backHref}>Back to your visits</Button>
          </div>
        </section>
      </Shell>
    );
  }

  if (!invoice) {
    return (
      <Shell>
        <section style={{ minHeight: '70svh', display: 'grid', placeItems: 'center' }}>
          {/* §19.1 — loading is a state, not an absence. */}
          <Loading caption="Opening the paper" />
        </section>
      </Shell>
    );
  }

  const before = invoice.photos?.find(p => p.kind === 'before');
  const after = invoice.photos?.find(p => p.kind === 'after');

  return (
    <Shell>
      <div
        className="no-print"
        style={{
          paddingInline: INSET, maxWidth: 720, marginInline: 'auto',
          paddingTop: space.rest, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: space.line,
        }}
      >
        {/* The way out, first and on the left, where a back control belongs. */}
        <Button tier="quiet" href={backHref} style={{ paddingInline: 0 }}>
          ← The visit
        </Button>
        {/* §21.8 — the customer's word. Printing IS saving a PDF on a phone. */}
        <Button tier="forward" onClick={() => window.print()}>
          Print or save
        </Button>
      </div>

      {before && after ? (
        <div className="no-print" style={{ maxWidth: 720, marginInline: 'auto', paddingInline: INSET, paddingTop: space.gap }}>
          <BeforeAfterSlider before={before.url} after={after.url} alt="Your car" />
        </div>
      ) : null}

      {/* THE PAPER ITSELF. White, because it is paper and it prints. */}
      <div style={{ paddingBlock: space.rest }}>
        <InvoiceDocument invoice={invoice} />
      </div>

      <div className="no-print" style={{ maxWidth: 720, marginInline: 'auto', paddingInline: INSET }}>
        <RatingCard invoiceId={id} customerName={invoice.customerName} customerPhone={invoice.customerPhone} />
      </div>
    </Shell>
  );
}
