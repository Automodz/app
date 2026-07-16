'use client';
/**
 * Bookings — the operational queue. Each row opens the unified Booking
 * Workspace (/admin/bookings/[id]) — the single source of truth for that job.
 * No dead-ends, no slide-over: every action happens inside the workspace.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, CheckCircle2, Clock, ChevronRight, Zap } from 'lucide-react';
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
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-[76px] shimmer rounded-2xl" />)}</div>
      ) : loadError ? (
        <ErrorState onRetry={load} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted font-body">No bookings found</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b, i) => (
            <motion.button key={b.id} onClick={() => open(b.id)}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              whileTap={{ scale: 0.99 }}
              className="group w-full card-dark text-left transition-all hover:border-white/10">
              <div className="flex items-center gap-3">
                <span className="grid place-items-center rounded-xl shrink-0"
                  style={{ width: 44, height: 44, background: 'var(--smoke)', border: '1px solid var(--border-strong)', color: 'var(--chrome)' }}>
                  <ServiceIcon category={b.serviceCategory} size={19} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-body text-sm text-foreground font-600 truncate">{b.userName}</div>
                      <div className="text-muted text-xs font-body truncate">{b.serviceName} • {b.vehicleName}</div>
                    </div>
                    <span className={`status-badge text-xs shrink-0 ${getStatusColor(b.status)}`}>{getStatusLabel(b.status)}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs font-body" style={{ color: 'var(--muted)' }}>
                    <span>{formatDate(b.scheduledDate)} {formatTime(b.scheduledTime)}</span>
                    <span>{formatCurrency(b.totalAmount)}</span>
                    <span className={`inline-flex items-center gap-1 ${b.paymentStatus === 'verified' ? 'text-emerald-400' : ''}`}>
                      {b.paymentStatus === 'verified' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                      {b.paymentStatus === 'verified' ? 'Paid' : 'Unpaid'}
                    </span>
                    {b.jobId && <span className="inline-flex items-center gap-1" style={{ color: 'var(--success)' }}><Zap size={11} /> In studio</span>}
                  </div>
                </div>
                <ChevronRight size={16} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
