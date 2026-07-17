'use client';
/**
 * Bookings - the operational queue. Each row opens the unified Booking
 * Workspace (/admin/bookings/[id]) - the single source of truth for that job.
 * No dead-ends, no slide-over: every action happens inside the workspace.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, CheckCircle2, Clock, ChevronRight } from 'lucide-react';
import { getAllBookings } from '@/lib/firebaseService';
import { formatCurrency, getStatusColor, getStatusLabel, formatDate, formatTime } from '@/lib/utils';
import type { Booking, BookingStatus } from '@/lib/types';
import ServiceIcon from '@/components/ui/ServiceIcon';
import ErrorState from '@/components/ui/ErrorState';

const STATUSES: BookingStatus[] = [
  'pending', 'confirmed', 'vehicle_received',
  'in_progress', 'quality_check', 'ready_for_delivery',
  'completed', 'cancelled',
];

export default function AdminBookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const load = () => {
    setLoadError(false);
    setLoading(true);
    getAllBookings()
      .then(setBookings)
      .catch(e => { console.error('bookings load failed', e); setLoadError(true); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = bookings.filter(b => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      b.userName.toLowerCase().includes(q) ||
      b.vehicleName.toLowerCase().includes(q) ||
      b.serviceName.toLowerCase().includes(q) ||
      b.vehicleRegNo.toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || b.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const pendingPayments = bookings.filter(b => b.paymentStatus === 'pending' && b.status !== 'cancelled').length;
  const open = (id: string) => router.push(`/admin/bookings/${id}`);

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="font-display font-900 text-2xl text-foreground tracking-wide">BOOKINGS</h1>
        <p className="text-muted text-sm font-body flex items-center gap-2">
          {filtered.length} of {bookings.length} total
          {pendingPayments > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-display"
              style={{ background: 'var(--smoke)', color: 'var(--chrome)', border: '1px solid var(--border-strong)' }}>
              {pendingPayments} unpaid
            </span>
          )}
        </p>
      </div>

      {/* search + filter */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search customer, vehicle, service…" className="input-dark pl-9 text-sm" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="input-dark text-sm w-auto pr-8 appearance-none cursor-pointer min-w-[130px]">
          <option value="all">All Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
        </select>
      </div>

      {/* list */}
      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-14 shimmer rounded-xl" />)}</div>
      ) : loadError ? (
        <ErrorState onRetry={load} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted font-body">No bookings found</div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--fog)' }}>
          {filtered.map((b, i) => (
            <button key={b.id} onClick={() => open(b.id)}
              className="group w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[.03] cursor-pointer"
              style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
              <ServiceIcon category={b.serviceCategory} size={16} style={{ color: 'var(--pewter)', flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <p className="font-body font-600 truncate" style={{ fontSize: 13.5, color: 'var(--chrome)' }}>
                  {b.userName}
                  <span className="font-400" style={{ color: 'var(--steel)' }}> · {b.vehicleName}</span>
                </p>
                <p className="text-xs font-body truncate mt-0.5" style={{ color: 'var(--steel)' }}>
                  {b.serviceName} · {formatDate(b.scheduledDate)} {formatTime(b.scheduledTime)}
                  {b.jobId ? ' · In studio' : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono font-700 text-sm" style={{ color: 'var(--chrome)' }}>{formatCurrency(b.totalAmount)}</p>
                <p className="text-[10px] font-mono uppercase tracking-wider inline-flex items-center gap-1"
                  style={{ color: b.paymentStatus === 'verified' ? 'var(--success)' : 'var(--steel)' }}>
                  {b.paymentStatus === 'verified' ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                  {b.paymentStatus === 'verified' ? 'Paid' : 'Unpaid'}
                </p>
              </div>
              <span className={`status-badge text-xs shrink-0 ${getStatusColor(b.status)}`}>{getStatusLabel(b.status)}</span>
              <ChevronRight size={15} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
