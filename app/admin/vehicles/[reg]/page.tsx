'use client';
/**
 * Vehicle 360 — the operational history of one car, keyed by registration
 * number. Every booking, every walk-in, every invoice, every technician,
 * every photo — one chronological stream. Reached from any workspace or
 * customer page by tapping the reg no.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Car, Wrench, FileText, CalendarClock, ChevronRight, MessageCircle } from 'lucide-react';
import {
  getJobsForVehicle, getBookingsForVehicle, getInvoicesForVehicle,
  invoicePublicUrl, buildInvoiceWhatsAppLink,
} from '@/lib/firebaseService';
import { formatCurrency, formatDate, getStatusLabel, getStatusColor } from '@/lib/utils';
import type { Booking, Invoice, Job } from '@/lib/types';
import ErrorState from '@/components/ui/ErrorState';

export default function VehicleHistoryPage() {
  const { reg } = useParams<{ reg: string }>();
  const regNo = decodeURIComponent(reg).replace(/\s+/g, '').toUpperCase();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true); setError(false);
    Promise.all([getJobsForVehicle(regNo), getBookingsForVehicle(regNo), getInvoicesForVehicle(regNo)])
      .then(([j, b, i]) => { setJobs(j); setBookings(b); setInvoices(i); })
      .catch(e => { console.error('vehicle history load failed', e); setError(true); })
      .finally(() => setLoading(false));
  }, [regNo]);
  useEffect(load, [load]);

  const latest = jobs[0] ?? bookings[0];
  const vehicleName = latest && 'vehicleName' in latest ? latest.vehicleName : '';
  const owners = [...new Set([...jobs.map(j => j.customerName), ...bookings.map(b => b.userName)])];
  const spent =
    bookings.filter(b => b.status === 'completed').reduce((s, b) => s + b.totalAmount, 0) +
    jobs.filter(j => j.status === 'completed' && !j.bookingId).reduce((s, j) => s + j.totalAmount, 0);
  const photos = jobs.flatMap(j => j.photos ?? []);
  const technicians = [...new Set(jobs.flatMap(j => (j.assignments ?? []).map(a => a.employeeName)))];

  const timeline = [
    ...bookings.map(b => ({
      id: 'b' + b.id, at: b.createdAt?.toMillis?.() ?? 0, icon: CalendarClock,
      title: b.serviceName,
      sub: `${formatDate(b.scheduledDate)} · ${b.userName}${b.jobId ? ' · in studio' : ''}`,
      amount: b.totalAmount,
      badge: { label: getStatusLabel(b.status), className: getStatusColor(b.status) },
      onOpen: () => router.push(`/admin/bookings/${b.id}`),
      trailing: undefined as React.ReactNode,
    })),
    ...jobs.filter(j => !j.bookingId).map(j => ({
      id: 'j' + j.id, at: j.createdAt?.toMillis?.() ?? 0, icon: Wrench,
      title: j.serviceItems.map(s => s.serviceName).join(', '),
      sub: `${formatDate(j.date)} · ${j.customerName} · walk-in${(j.assignments ?? []).filter(a => !a.removedAt).length ? ` · ${(j.assignments ?? []).filter(a => !a.removedAt).map(a => a.employeeName).join(', ')}` : ''}`,
      amount: j.totalAmount,
      badge: { label: getStatusLabel(j.status), className: undefined as string | undefined },
      onOpen: () => router.push(`/admin/jobs/${j.id}`),
      trailing: undefined as React.ReactNode,
    })),
    ...invoices.map(inv => ({
      id: 'i' + inv.id, at: inv.createdAt?.toMillis?.() ?? 0, icon: FileText,
      title: `Invoice ${inv.invoiceNumber}`,
      sub: `${inv.customerName} · ${inv.paymentStatus === 'paid' ? 'paid' : 'pending'}`,
      amount: inv.total,
      badge: undefined,
      onOpen: undefined as (() => void) | undefined,
      trailing: (
        <span className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <a href={invoicePublicUrl(inv)} target="_blank" rel="noreferrer"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/[.06]"
            style={{ border: '1px solid var(--border)', color: 'var(--pewter)' }}><FileText size={11} /></a>
          <a href={buildInvoiceWhatsAppLink(inv)} target="_blank" rel="noreferrer"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/[.06]"
            style={{ border: '1px solid var(--border)', color: 'var(--pewter)' }}><MessageCircle size={11} /></a>
        </span>
      ),
    })),
  ].sort((a, b) => b.at - a.at);

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <button onClick={() => router.back()} className="flex items-center gap-2 data-label mb-4 cursor-pointer" style={{ color: 'var(--steel)' }}>
        <ArrowLeft size={13} /> Back
      </button>

      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap mb-5">
        <span className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--smoke)' }}>
          <Car size={20} style={{ color: 'var(--chrome)' }} />
        </span>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-800 text-xl" style={{ color: 'var(--chrome)' }}>
            {vehicleName || 'Vehicle'} <span className="font-mono text-base" style={{ color: 'var(--pewter)' }}>{regNo}</span>
          </h1>
          <p className="text-xs font-body" style={{ color: 'var(--steel)' }}>
            {owners.length > 0 && `${owners.join(', ')} · `}
            {timeline.length} record{timeline.length === 1 ? '' : 's'}
            {technicians.length > 0 && ` · worked by ${technicians.join(', ')}`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--faint)' }}>Lifetime spend</p>
          <p className="font-display font-800 text-lg" style={{ color: 'var(--chrome)' }}>{formatCurrency(spent)}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-12 shimmer rounded-xl" />)}</div>
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : timeline.length === 0 ? (
        <div className="card text-center py-16">
          <Car size={24} className="mx-auto mb-3" style={{ color: 'var(--steel)' }} />
          <p className="font-body text-sm" style={{ color: 'var(--steel)' }}>No history for {regNo} yet.</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl overflow-hidden mb-6" style={{ border: '1px solid var(--border)', background: 'var(--fog)' }}>
            {timeline.map((t, i) => {
              const Row = (
                <>
                  <t.icon size={15} style={{ color: 'var(--pewter)', flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-body font-600 truncate" style={{ fontSize: 13.5, color: 'var(--chrome)' }}>{t.title}</p>
                    <p className="text-xs font-body truncate mt-0.5" style={{ color: 'var(--steel)' }}>{t.sub}</p>
                  </div>
                  <span className="font-mono font-700 text-sm shrink-0" style={{ color: 'var(--chrome)' }}>{formatCurrency(t.amount)}</span>
                  {t.badge && (t.badge.className
                    ? <span className={`status-badge text-[10px] shrink-0 ${t.badge.className}`}>{t.badge.label}</span>
                    : <span className="text-[10px] font-mono uppercase tracking-wider shrink-0" style={{ color: 'var(--steel)' }}>{t.badge.label}</span>)}
                  {t.trailing}
                  {t.onOpen && <ChevronRight size={15} className="shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--steel)' }} />}
                </>
              );
              const style = { borderTop: i === 0 ? 'none' : '1px solid var(--border)' } as React.CSSProperties;
              return t.onOpen ? (
                <button key={t.id} onClick={t.onOpen} style={style}
                  className="group w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[.03] cursor-pointer">
                  {Row}
                </button>
              ) : (
                <div key={t.id} style={style} className="flex items-center gap-3 px-4 py-2.5">{Row}</div>
              );
            })}
          </div>

          {photos.length > 0 && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider mb-2 px-1" style={{ color: 'var(--faint)' }}>
                Photos · {photos.length}
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {photos.map(p => <img key={p.path} src={p.url} alt={p.kind} className="w-full rounded-lg object-cover" style={{ aspectRatio: '1', border: '1px solid var(--border)' }} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
