'use client';
import Image from 'next/image';
import { BUSINESS, GOOGLE_REVIEW_URL } from '@/lib/config/storeConfig';

export interface InvoiceDocData {
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  vehicleName: string;
  vehicleRegNo: string;
  lineItems: { name: string; qty: number; unitPrice: number; amount: number }[];
  subtotal: number;
  discount?: { label: string; amount: number };
  gst?: { rate: number; amount: number; gstin?: string };
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  photos?: { url: string; path: string; kind: 'before' | 'after' }[];
  createdAt: string | null; // ISO
}

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

/** Print-friendly invoice - always light, self-contained styling for print-to-PDF. */
export default function InvoiceDocument({ invoice }: { invoice: InvoiceDocData }) {
  const dateStr = invoice.createdAt
    ? new Date(invoice.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  return (
    <div style={{
      background: 'white', color: '#111', maxWidth: 720, margin: '0 auto',
      padding: '40px 36px', fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <Image src="/logo.png" alt="AutoModz" width={56} height={56} style={{ borderRadius: 12, objectFit: 'contain' }} />
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '0.06em' }}>
              AUTOMODZ
            </div>
            <div style={{ fontSize: 11, color: '#666', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {BUSINESS.tagline}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#999', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Invoice</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16, color: '#17181A' }}>
            {invoice.invoiceNumber}
          </div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{dateStr}</div>
        </div>
      </div>

      {/* Parties */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 28 }}>
        <div style={{ flex: 1, background: '#FAFAFA', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: '#999', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Billed to</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{invoice.customerName}</div>
          <div style={{ fontSize: 12, color: '#666' }}>+91 {invoice.customerPhone}</div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{invoice.vehicleName} · {invoice.vehicleRegNo}</div>
        </div>
        <div style={{ flex: 1, background: '#FAFAFA', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: '#999', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>From</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{BUSINESS.name}</div>
          <div style={{ fontSize: 11.5, color: '#666', lineHeight: 1.5 }}>{BUSINESS.address}</div>
          <div style={{ fontSize: 12, color: '#666' }}>+91 {BUSINESS.phone}</div>
          {invoice.gst?.gstin && <div style={{ fontSize: 11, color: '#666' }}>GSTIN: {invoice.gst.gstin}</div>}
        </div>
      </div>

      {/* Line items */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #111' }}>
            {['Service', 'Qty', 'Rate', 'Amount'].map((h, i) => (
              <th key={h} style={{
                textAlign: i === 0 ? 'left' : 'right', padding: '8px 4px',
                fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#999',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems.map((li, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #EEE' }}>
              <td style={{ padding: '11px 4px', fontSize: 13, fontWeight: 500 }}>{li.name}</td>
              <td style={{ padding: '11px 4px', fontSize: 13, textAlign: 'right' }}>{li.qty}</td>
              <td style={{ padding: '11px 4px', fontSize: 13, textAlign: 'right' }}>{inr(li.unitPrice)}</td>
              <td style={{ padding: '11px 4px', fontSize: 13, textAlign: 'right', fontWeight: 600 }}>{inr(li.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28 }}>
        <div style={{ width: 260 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, color: '#666' }}>
            <span>Subtotal</span><span>{inr(invoice.subtotal)}</span>
          </div>
          {invoice.discount && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, color: '#059669' }}>
              <span>{invoice.discount.label}</span><span>−{inr(invoice.discount.amount)}</span>
            </div>
          )}
          {invoice.gst && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, color: '#666' }}>
              <span>GST ({invoice.gst.rate}%)</span><span>{inr(invoice.gst.amount)}</span>
            </div>
          )}
          <div style={{
            display: 'flex', justifyContent: 'space-between', padding: '10px 0', marginTop: 6,
            borderTop: '2px solid #111', fontWeight: 700, fontSize: 17,
          }}>
            <span>Total</span><span style={{ color: '#17181A' }}>{inr(invoice.total)}</span>
          </div>
          <div style={{
            textAlign: 'right', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: invoice.paymentStatus === 'paid' ? '#059669' : '#D97706', fontWeight: 700, marginTop: 4,
          }}>
            {invoice.paymentStatus === 'paid' ? `Paid · ${invoice.paymentMethod.toUpperCase()}` : 'Payment pending'}
          </div>
        </div>
      </div>

      {/* Before / after photos */}
      {invoice.photos && invoice.photos.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, color: '#999', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
            Your car - before & after
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {invoice.photos.map(p => (
              <div key={p.path} style={{ position: 'relative' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.kind}
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 10, display: 'block' }} />
                <span style={{
                  position: 'absolute', bottom: 4, left: 4, fontSize: 9, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 6px',
                  borderRadius: 6, background: 'rgba(0,0,0,0.65)',
                  color: p.kind === 'after' ? '#6EE7B7' : '#FCD34D',
                }}>{p.kind}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: '1px solid #EEE', paddingTop: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: '#666' }}>Thank you for choosing AutoModz - see you at the next detail!</div>
        <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
          {BUSINESS.address} · +91 {BUSINESS.phone}
        </div>
        <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noreferrer"
          style={{ display: 'inline-block', marginTop: 10, fontSize: 12, fontWeight: 600, color: '#17181A', borderBottom: '1px solid #17181A', textDecoration: 'none' }}>
          ★ Happy with the work? Leave us a Google review →
        </a>
      </div>
    </div>
  );
}
