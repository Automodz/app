'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Calendar, Wrench, ChevronRight } from 'lucide-react';
import { getJobsForDate } from '@/lib/firebaseService';
import { formatCurrency } from '@/lib/utils';
import type { Job } from '@/lib/types';
import { format } from 'date-fns';
import ErrorState from '@/components/ui/ErrorState';

const STATUS_META: Record<string, { label: string; color: string }> = {
  checked_in:    { label: 'Checked In',  color: 'var(--info)' },
  in_progress:   { label: 'In Progress', color: 'var(--warning)' },
  quality_check: { label: 'QC',          color: 'var(--info)' },
  ready_for_delivery: { label: 'Ready',  color: 'var(--success)' },
  completed:     { label: 'Completed',   color: 'var(--success)' },
  cancelled:     { label: 'Cancelled',   color: 'var(--danger)' },
};

// the floor, left → right: what's waiting through what's gone
const STAGE_ORDER: { key: string; label: string }[] = [
  { key: 'checked_in',         label: 'Waiting' },
  { key: 'in_progress',        label: 'In progress' },
  { key: 'quality_check',      label: 'Quality check' },
  { key: 'ready_for_delivery', label: 'Ready for delivery' },
  { key: 'completed',          label: 'Delivered' },
  { key: 'cancelled',          label: 'Cancelled' },
];

export default function AdminJobsPage() {
  const router = useRouter();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = () => {
    setLoadError(false);
    setLoading(true);
    getJobsForDate(date)
      .then(j => setJobs(j))
      .catch(e => { console.error('jobs load failed', e); setLoadError(true); })
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [date]);

  const revenue = jobs.filter(j => j.status === 'completed').reduce((s, j) => s + j.totalAmount, 0);

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display font-800 text-2xl" style={{ color: 'var(--chrome)' }}>ACTIVE JOBS</h1>
          <p className="text-sm font-body" style={{ color: 'var(--steel)' }}>
            {jobs.length} jobs · {formatCurrency(revenue)} completed revenue
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={14} style={{ color: 'var(--steel)' }} />
          <input type="date" className="input py-2 w-44" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 shimmer rounded-2xl" />)}</div>
      ) : loadError ? (
        <ErrorState onRetry={load} />
      ) : jobs.length === 0 ? (
        <div className="card text-center py-14">
          <Wrench size={26} className="mx-auto mb-3" style={{ color: 'var(--steel)' }} />
          <p className="font-body" style={{ color: 'var(--steel)' }}>No active jobs on this date.</p>
        </div>
      ) : (
        <div className="space-y-7">
          {STAGE_ORDER.map(stage => {
            const group = jobs.filter(j => j.status === stage.key);
            if (group.length === 0) return null;
            const meta = STATUS_META[stage.key];
            return (
              <div key={stage.key}>
                <div className="flex items-center gap-2 mb-2.5 px-1">
                  <span className="rounded-full" style={{ width: 7, height: 7, background: meta.color }} />
                  <h2 className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fg-dim)' }}>{stage.label}</h2>
                  <span className="font-mono" style={{ fontSize: 10.5, color: 'var(--faint)' }}>{group.length}</span>
                </div>
                <div className="space-y-3">
                  {group.map((j, i) => {
                    const open = () => router.push(j.bookingId ? `/admin/bookings/${j.bookingId}` : `/admin/jobs/${j.id}`);
                    return (
                      <motion.button key={j.id} onClick={open}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.03, 0.2), duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        whileTap={{ scale: 0.99 }}
                        className="group card-dark w-full text-left transition-all hover:border-white/10">
                        <div className="flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>
                              {j.customerName} <span style={{ color: 'var(--steel)' }}>· {j.customerPhone}</span>
                            </p>
                            <p className="text-xs font-body mt-0.5 truncate" style={{ color: 'var(--steel)' }}>
                              {j.vehicleName} ({j.vehicleRegNo}) - {j.serviceItems.map(s => s.serviceName).join(', ')}
                            </p>
                            <p className="text-xs font-body mt-0.5" style={{ color: 'var(--steel)' }}>
                              By {j.createdByEmployeeName}{j.bay ? ` · Bay ${j.bay}` : ''}{j.bookingId ? ' · From booking' : ''}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-mono font-700" style={{ color: 'var(--ember)' }}>{formatCurrency(j.totalAmount)}</p>
                            <p className="data-label" style={{ color: j.paymentStatus === 'collected' ? 'var(--success)' : 'var(--steel)' }}>
                              {j.paymentStatus === 'collected' ? `Paid ${j.paymentMethod?.toUpperCase()}` : 'Unpaid'}
                            </p>
                          </div>
                          <ChevronRight size={16} className="shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--steel)' }} />
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
