'use client';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Printer, Zap } from 'lucide-react';
import InvoiceDocument, { InvoiceDocData } from '@/components/invoice/InvoiceDocument';
import RatingCard from '@/components/invoice/RatingCard';
import BeforeAfterSlider from '@/components/ui/BeforeAfterSlider';

export default function PublicInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get('t');
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

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ background: '#F5F5F5' }}>
        <Zap size={28} color="#17181A" />
        <p style={{ fontFamily: 'sans-serif', color: '#666' }}>Invoice not found or link expired.</p>
      </div>
    );
  }
  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F5F5' }}>
        <div className="w-10 h-10 loader-ring" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#F5F5F5' }}>
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
      <div className="no-print flex justify-end max-w-[720px] mx-auto px-6 pt-6">
        <button onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: '#17181A', color: '#FFFFFF', border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
          <Printer size={15} /> Print / Save PDF
        </button>
      </div>
      {(() => {
        const before = invoice.photos?.find(p => p.kind === 'before');
        const after = invoice.photos?.find(p => p.kind === 'after');
        return before && after ? (
          <div className="no-print max-w-[720px] mx-auto px-6 pt-4">
            <BeforeAfterSlider before={before.url} after={after.url} alt="Your car" />
          </div>
        ) : null;
      })()}
      <div className="py-6">
        <InvoiceDocument invoice={invoice} />
      </div>
      <div className="no-print max-w-[720px] mx-auto px-6 pb-10">
        <RatingCard invoiceId={id} customerName={invoice.customerName} customerPhone={invoice.customerPhone} />
      </div>
    </div>
  );
}
