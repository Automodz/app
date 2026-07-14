'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, FileText, MessageCircle, ExternalLink } from 'lucide-react';
import { getRecentInvoices, getReceivables, buildInvoiceWhatsAppLink, invoicePublicUrl } from '@/lib/firebaseService';
import { formatCurrency } from '@/lib/utils';
import type { Invoice, Job } from '@/lib/types';
import ErrorState from '@/components/ui/ErrorState';

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [receivables, setReceivables] = useState<Job[]>([]);

  const load = () => {
    setLoadError(false);
    setLoading(true);
    getReceivables().then(setReceivables).catch(() => {});
    getRecentInvoices()
      .then(inv => setInvoices(inv))
      .catch(e => { console.error('invoices load failed', e); setLoadError(true); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = invoices.filter(i =>
    !search ||
    i.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
    i.customerName.toLowerCase().includes(search.toLowerCase()) ||
    i.customerPhone.includes(search) ||
    i.vehicleRegNo.toLowerCase().includes(search.toLowerCase())
  );

  const total = filtered.filter(i => i.paymentStatus === 'paid').reduce((s, i) => s + i.total, 0);

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display font-800 text-2xl" style={{ color: 'var(--chrome)' }}>INVOICES</h1>
        <p className="text-sm font-body" style={{ color: 'var(--steel)' }}>
          {invoices.length} invoices · {formatCurrency(total)} collected (filtered)
        </p>
      </div>

      {receivables.length > 0 && (
        <div className="card-ember mb-5 p-4">
          <p className="data-label mb-2" style={{ color: 'var(--warning)' }}>
            OUTSTANDING · {formatCurrency(receivables.reduce((t, j) => t + j.totalAmount - (j.amountPaid ?? 0), 0))} across {receivables.length} job{receivables.length === 1 ? '' : 's'}
          </p>
          <div className="space-y-1.5">
            {receivables.slice(0, 8).map(j => (
              <div key={j.id} className="flex items-center gap-2 text-sm font-body">
                <span style={{ color: 'var(--chrome)' }}>{j.customerName}</span>
                <span style={{ color: 'var(--steel)' }}>{j.vehicleName} · {j.date}</span>
                <a href={`https://wa.me/91${j.customerPhone}?text=${encodeURIComponent(`Hi ${j.customerName}, a gentle reminder - ₹${j.totalAmount - (j.amountPaid ?? 0)} is pending for your ${j.serviceItems[0]?.serviceName ?? 'service'} at AutoModz.`)}`}
                  target="_blank" rel="noreferrer" className="ml-auto font-mono font-700" style={{ color: 'var(--warning)' }}>
                  {formatCurrency(j.totalAmount - (j.amountPaid ?? 0))} →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--steel)' }} />
        <input className="input pl-9 text-sm" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search invoice #, customer, phone, reg no…" />
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 shimmer rounded-2xl" />)}</div>
      ) : loadError ? (
        <ErrorState onRetry={load} />
      ) : filtered.length === 0 ? (
        <div className="card text-center py-14">
          <FileText size={26} className="mx-auto mb-3" style={{ color: 'var(--steel)' }} />
          <p className="font-body" style={{ color: 'var(--steel)' }}>No invoices yet - generate them from completed jobs and bookings.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inv, i) => (
            <motion.div key={inv.id} initial={false} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }} className="card-dark">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-700 text-sm" style={{ color: 'var(--ember)' }}>{inv.invoiceNumber}</span>
                    <span className="data-label" style={{ color: inv.paymentStatus === 'paid' ? 'var(--success)' : 'var(--warning)' }}>
                      {inv.paymentStatus === 'paid' ? 'PAID' : 'PENDING'}
                    </span>
                  </div>
                  <p className="text-xs font-body mt-0.5" style={{ color: 'var(--steel)' }}>
                    {inv.customerName} · {inv.vehicleName} ({inv.vehicleRegNo}) ·{' '}
                    {inv.createdAt?.toDate?.().toLocaleDateString('en-IN')}
                  </p>
                </div>
                <span className="font-mono font-700" style={{ color: 'var(--chrome)' }}>{formatCurrency(inv.total)}</span>
                <div className="flex items-center gap-2">
                  <a href={invoicePublicUrl(inv)} target="_blank" rel="noreferrer" title="Open invoice"
                    className="w-9 h-9 flex items-center justify-center rounded-xl"
                    style={{ background: 'var(--dark)', color: 'var(--steel)' }}>
                    <ExternalLink size={14} />
                  </a>
                  <a href={buildInvoiceWhatsAppLink(inv)} target="_blank" rel="noreferrer" title="Send on WhatsApp"
                    className="w-9 h-9 flex items-center justify-center rounded-xl"
                    style={{ background: 'rgba(37,211,102,0.12)', color: '#25D366' }}>
                    <MessageCircle size={14} />
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
