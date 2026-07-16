'use client';
/**
 * Workspace — the live floor. This is where the studio actually runs:
 * every car on-site today, grouped by stage, updating in real time.
 * It absorbs what used to be "Store Mode" and "Active Jobs" — one view,
 * compact rows, no tables, no giant cards.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PlusCircle, Wrench, ChevronRight, Calendar, Clock, CircleAlert } from 'lucide-react';
import { subscribeTodaysJobs, getJobsForDate } from '@/lib/firebaseService';
import { formatCurrency } from '@/lib/utils';
import type { Job } from '@/lib/types';
import { format } from 'date-fns';
import ErrorState from '@/components/ui/ErrorState';

const STAGES: { key: Job['status']; label: string; color: string }[] = [
  { key: 'checked_in',         label: 'Waiting',       color: 'var(--info)' },
  { key: 'in_progress',        label: 'In progress',   color: 'var(--warning)' },
  { key: 'quality_check',      label: 'Quality check', color: 'var(--info)' },
  { key: 'ready_for_delivery', label: 'Ready',         color: 'var(--success)' },
  { key: 'completed',          label: 'Delivered',     color: 'var(--success)' },
];

export default function WorkspacePage() {
  const router = useRouter();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [date, setDate] = useState(today);
  const isToday = date === today;

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [streamKey, setStreamKey] = useState(0);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Today is live; past/future dates are a one-shot fetch.
  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    if (isToday) {
      const unsub = subscribeTodaysJobs(
        j => { setJobs(j); setLoading(false); setLoadError(false); },
        () => { setLoading(false); setLoadError(true); },
      );
      return unsub;
    }
    getJobsForDate(date)
      .then(setJobs)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [date, isToday, streamKey]);

  // Reconnect the live stream when the network returns
  useEffect(() => {
    const retry = () => setStreamKey(k => k + 1);
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, []);

  const byStage = useMemo(() => {
    const map: Record<string, Job[]> = {};
    for (const s of STAGES) map[s.key] = [];
    for (const j of jobs) if (map[j.status]) map[j.status].push(j);
    return map;
  }, [jobs]);

  const collected = jobs
    .filter(j => j.status === 'completed')
    .reduce((s, j) => s + j.totalAmount, 0);
  const unpaid = jobs.filter(j =>
    ['ready_for_delivery', 'completed'].includes(j.status) && j.paymentStatus === 'pending').length;
  const activeCount = jobs.filter(j => !['completed', 'cancelled'].includes(j.status)).length;

  const openJob = (j: Job) =>
    router.push(j.bookingId ? `/admin/bookings/${j.bookingId}` : `/admin/jobs/${j.id}`);
  const scrollTo = (key: string) =>
    sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-display font-800 text-2xl" style={{ color: 'var(--chrome)' }}>Workspace</h1>
          <p className="text-sm font-body flex items-center gap-2" style={{ color: 'var(--steel)' }}>
            {isToday ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: 'var(--success)' }} />
                Live · {format(new Date(), 'EEE, dd MMM')} · {activeCount} on the floor
              </>
            ) : (
              <>Viewing {date} · {jobs.length} jobs</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Calendar size={14} style={{ color: 'var(--steel)' }} />
            <input type="date" className="input py-2 w-40 text-sm" value={date}
              onChange={e => setDate(e.target.value || today)} />
          </div>
          <Link href="/store/new" className="btn-ember flex items-center gap-2 px-4 py-2.5 text-sm">
            <PlusCircle size={15} /> New walk-in
          </Link>
        </div>
      </div>

      {/* Stage strip — one glance at the whole floor */}
      <div className="flex items-stretch gap-2 mb-6 overflow-x-auto pb-1">
        {STAGES.map(s => (
          <button key={s.key} onClick={() => scrollTo(s.key)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl shrink-0 transition-colors cursor-pointer"
            style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
            <span className="rounded-full" style={{ width: 6, height: 6, background: s.color }} />
            <span className="font-mono font-700 text-sm" style={{ color: 'var(--chrome)' }}>
              {byStage[s.key]?.length ?? 0}
            </span>
            <span className="text-xs font-body" style={{ color: 'var(--pewter)' }}>{s.label}</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 px-3.5 py-2 rounded-xl shrink-0"
          style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
          <span className="font-mono font-700 text-sm" style={{ color: 'var(--chrome)' }}>{formatCurrency(collected)}</span>
          <span className="text-xs font-body" style={{ color: 'var(--pewter)' }}>collected</span>
          {unpaid > 0 && (
            <span className="flex items-center gap-1 text-xs font-body" style={{ color: 'var(--warning)' }}>
              <CircleAlert size={12} /> {unpaid} unpaid
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-14 shimmer rounded-xl" />)}</div>
      ) : loadError ? (
        <ErrorState onRetry={() => setStreamKey(k => k + 1)} />
      ) : jobs.length === 0 ? (
        <div className="card text-center py-16">
          <Wrench size={26} className="mx-auto mb-3" style={{ color: 'var(--steel)' }} />
          <p className="font-body text-sm" style={{ color: 'var(--steel)' }}>
            {isToday ? 'Quiet floor — start a walk-in to get moving.' : 'No jobs on this date.'}
          </p>
        </div>
      ) : (
        <div className="space-y-7">
          {STAGES.map(stage => {
            const group = byStage[stage.key] ?? [];
            if (group.length === 0) return null;
            return (
              <div key={stage.key} ref={el => { sectionRefs.current[stage.key] = el; }}
                style={{ scrollMarginTop: 76 }}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="rounded-full" style={{ width: 6, height: 6, background: stage.color }} />
                  <h2 className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fg-dim)' }}>
                    {stage.label}
                  </h2>
                  <span className="font-mono" style={{ fontSize: 10.5, color: 'var(--faint)' }}>{group.length}</span>
                </div>
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--fog)' }}>
                  {group.map((j, i) => (
                    <button key={j.id} onClick={() => openJob(j)}
                      className="group w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[.03] cursor-pointer"
                      style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                      <div className="flex-1 min-w-0">
                        <p className="font-body font-600 truncate" style={{ fontSize: 13.5, color: 'var(--chrome)' }}>
                          {j.customerName}
                          <span className="font-400" style={{ color: 'var(--steel)' }}> · {j.vehicleName}{j.vehicleRegNo ? ` · ${j.vehicleRegNo}` : ''}</span>
                        </p>
                        <p className="text-xs font-body truncate mt-0.5" style={{ color: 'var(--steel)' }}>
                          {j.serviceItems.map(s => s.serviceName).join(', ')}
                          {j.bay ? ` · Bay ${j.bay}` : ''}
                          {j.assignments?.filter(a => !a.removedAt).length
                            ? ` · ${j.assignments.filter(a => !a.removedAt).map(a => a.employeeName).join(', ')}`
                            : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-700 text-sm" style={{ color: 'var(--chrome)' }}>{formatCurrency(j.totalAmount)}</p>
                        <p className="text-[10px] font-mono uppercase tracking-wider"
                          style={{ color: j.paymentStatus === 'collected' ? 'var(--success)' : 'var(--steel)' }}>
                          {j.paymentStatus === 'collected' ? 'Paid' : 'Unpaid'}
                        </p>
                      </div>
                      <ChevronRight size={15} className="shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--steel)' }} />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Front-desk shortcuts that used to live in Store Mode */}
      <div className="flex items-center gap-4 mt-8">
        <Link href="/store/attendance" className="flex items-center gap-1.5 text-xs font-body" style={{ color: 'var(--steel)' }}>
          <Clock size={12} /> Team attendance →
        </Link>
        <Link href="/admin/close" className="flex items-center gap-1.5 text-xs font-body" style={{ color: 'var(--steel)' }}>
          Daily close →
        </Link>
      </div>
    </div>
  );
}
