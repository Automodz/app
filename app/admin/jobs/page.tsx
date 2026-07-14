'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Wrench } from 'lucide-react';
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

export default function AdminJobsPage() {
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
          <h1 className="font-display font-800 text-2xl" style={{ color: 'var(--chrome)' }}>WALK-IN JOBS</h1>
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
          <p className="font-body" style={{ color: 'var(--steel)' }}>No walk-in jobs on this date.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((j, i) => {
            const meta = STATUS_META[j.status];
            return (
              <motion.div key={j.id} initial={false} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }} className="card-dark">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>
                      {j.customerName} <span style={{ color: 'var(--steel)' }}>· {j.customerPhone}</span>
                    </p>
                    <p className="text-xs font-body mt-0.5" style={{ color: 'var(--steel)' }}>
                      {j.vehicleName} ({j.vehicleRegNo}) - {j.serviceItems.map(s => s.serviceName).join(', ')}
                    </p>
                    <p className="text-xs font-body mt-0.5" style={{ color: 'var(--steel)' }}>
                      By {j.createdByEmployeeName}{j.bay ? ` · Bay ${j.bay}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-700" style={{ color: 'var(--ember)' }}>{formatCurrency(j.totalAmount)}</p>
                    <p className="data-label mt-1" style={{ color: meta.color }}>{meta.label}</p>
                    <p className="data-label" style={{ color: j.paymentStatus === 'collected' ? 'var(--success)' : 'var(--steel)' }}>
                      {j.paymentStatus === 'collected' ? `Paid ${j.paymentMethod?.toUpperCase()}` : 'Unpaid'}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
