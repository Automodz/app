'use client';
/**
 * Workspace — the admin lands here. One screen that runs the day:
 *   intelligence strip  → numbers that change decisions (revenue, floor,
 *                         staff, stock, unpaid, leads)
 *   follow-ups          → the owner's action queue
 *   arriving            → today's bookings not yet checked in
 *   the floor           → live stage-grouped jobs, real time
 * No decorative dashboards. Everything clicks through to a workflow.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PlusCircle, Wrench, ChevronRight, Clock, CircleAlert,
  UserCheck, Package, IndianRupee, Phone, CalendarCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  subscribeTodaysJobs, getBookingsForDates, getPendingApprovals,
  getPresentTodayCount, getLowStockItems, getCarLeads, getSellRequests,
  getDueTasks, completeTask, addTask,
} from '@/lib/firebaseService';
import { formatCurrency, formatTime, getStatusColor, getStatusLabel } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import ServiceIcon from '@/components/ui/ServiceIcon';
import type { Booking, FollowUpTask, Job } from '@/lib/types';

const STAGES: { key: Job['status']; label: string; color: string }[] = [
  { key: 'checked_in',         label: 'Waiting',       color: 'var(--info)' },
  { key: 'in_progress',        label: 'In progress',   color: 'var(--warning)' },
  { key: 'quality_check',      label: 'Quality check', color: 'var(--info)' },
  { key: 'ready_for_delivery', label: 'Ready',         color: 'var(--success)' },
  { key: 'completed',          label: 'Delivered',     color: 'var(--success)' },
];

export default function AdminWorkspace() {
  const router = useRouter();
  const { user } = useAppStore();
  const today = format(new Date(), 'yyyy-MM-dd');

  // ── Live floor ──
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsReady, setJobsReady] = useState(false);
  const [streamKey, setStreamKey] = useState(0);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const unsub = subscribeTodaysJobs(
      j => { setJobs(j); setJobsReady(true); },
      () => setJobsReady(true),
    );
    return unsub;
  }, [streamKey]);
  useEffect(() => {
    const retry = () => setStreamKey(k => k + 1);
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, []);

  // ── Intelligence strip + arrivals (one-shot, each source tolerated) ──
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [approvals, setApprovals] = useState<Booking[]>([]);
  const [staffPresent, setStaffPresent] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const [newLeads, setNewLeads] = useState(0);
  useEffect(() => {
    getBookingsForDates([today]).then(setTodayBookings).catch(() => {});
    getPendingApprovals().then(setApprovals).catch(() => {});
    getPresentTodayCount().then(setStaffPresent).catch(() => {});
    getLowStockItems().then(items => setLowStock(items.length)).catch(() => {});
    Promise.all([getCarLeads().catch(() => []), getSellRequests().catch(() => [])])
      .then(([l, r]) => setNewLeads(
        l.filter(x => x.status === 'new').length + r.filter(x => x.status === 'new').length,
      ));
  }, [today]);

  // ── Follow-ups ──
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [taskDraft, setTaskDraft] = useState('');
  useEffect(() => { getDueTasks(today).then(setTasks).catch(() => {}); }, [today]);
  const finishTask = async (t: FollowUpTask) => {
    try { await completeTask(t.id); setTasks(prev => prev.filter(x => x.id !== t.id)); } catch {}
  };
  const quickAddTask = async () => {
    if (!taskDraft.trim() || !user) return;
    try {
      await addTask({ note: taskDraft.trim(), dueDate: today, byName: user.name });
      setTaskDraft('');
      setTasks(await getDueTasks(today));
    } catch {}
  };

  // ── Derived ──
  const byStage = useMemo(() => {
    const map: Record<string, Job[]> = {};
    for (const s of STAGES) map[s.key] = [];
    for (const j of jobs) if (map[j.status]) map[j.status].push(j);
    return map;
  }, [jobs]);
  const collected =
    jobs.filter(j => j.status === 'completed').reduce((s, j) => s + j.totalAmount, 0) +
    todayBookings.filter(b => b.status === 'completed' && !b.jobId).reduce((s, b) => s + b.totalAmount, 0);
  // no hidden money: outstanding = every ready/delivered job with balance due
  const unpaidJobs = jobs.filter(j =>
    ['ready_for_delivery', 'completed'].includes(j.status) && j.paymentStatus === 'pending');
  const outstanding = unpaidJobs.reduce((s, j) => s + Math.max(0, j.totalAmount - (j.amountPaid ?? 0)), 0);
  const floor = jobs.filter(j => !['completed', 'cancelled'].includes(j.status)).length;
  const arriving = todayBookings
    .filter(b => ['pending', 'confirmed'].includes(b.status) && !b.jobId)
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  const openJob = (j: Job) =>
    router.push(j.bookingId ? `/admin/bookings/${j.bookingId}` : `/admin/jobs/${j.id}`);
  const scrollTo = (key: string) =>
    sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const INTEL: { label: string; value: string; icon: typeof Wrench; href?: string; alert?: boolean; onClick?: () => void }[] = [
    { label: 'approvals',     value: String(approvals.length),  icon: CalendarCheck, alert: approvals.length > 0, onClick: () => scrollTo('approvals') },
    { label: 'collected',     value: formatCurrency(collected), icon: IndianRupee },
    { label: 'outstanding',   value: formatCurrency(outstanding), icon: CircleAlert, alert: outstanding > 0, onClick: () => scrollTo(unpaidJobs[0]?.status ?? 'completed') },
    { label: 'on the floor',  value: String(floor),             icon: Wrench },
    { label: 'staff in',      value: String(staffPresent),      icon: UserCheck,   href: '/store/attendance' },
    { label: 'low stock',     value: String(lowStock),          icon: Package,     href: '/admin/inventory', alert: lowStock > 0 },
  ];

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-display font-800 text-2xl" style={{ color: 'var(--chrome)' }}>Workspace</h1>
          <p className="text-sm font-body flex items-center gap-2" style={{ color: 'var(--steel)' }}>
            <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: 'var(--success)' }} />
            Live · {format(new Date(), 'EEEE, dd MMM')}
          </p>
        </div>
        {/* top bar already carries this action on desktop — keep it for mobile only */}
        <Link href="/admin/walkin" className="btn-ember flex md:hidden items-center gap-2 px-4 py-2.5 text-sm">
          <PlusCircle size={15} /> New walk-in
        </Link>
      </div>

      {/* Intelligence strip — numbers that change decisions */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
        {INTEL.map(s => {
          const inner = (
            <div className="flex flex-col gap-1 px-3 py-2.5 rounded-xl h-full transition-colors hover:bg-white/[.03]"
              style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
              <s.icon size={13} style={{ color: s.alert ? 'var(--warning)' : 'var(--steel)' }} />
              <span className="font-mono font-700 text-base leading-none" style={{ color: s.alert ? 'var(--warning)' : 'var(--chrome)' }}>
                {s.value}
              </span>
              <span className="text-[10px] font-body" style={{ color: 'var(--pewter)' }}>{s.label}</span>
            </div>
          );
          return s.href
            ? <Link key={s.label} href={s.href}>{inner}</Link>
            : s.onClick
              ? <button key={s.label} onClick={s.onClick} className="text-left cursor-pointer">{inner}</button>
              : <div key={s.label} className="cursor-default">{inner}</div>;
        })}
      </div>

      {/* Stage strip */}
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
      </div>

      {/* Pending booking approvals — first decision of the day */}
      {approvals.length > 0 && (
        <div className="mb-6" ref={el => { sectionRefs.current['approvals'] = el; }}>
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="rounded-full pulse-dot" style={{ width: 6, height: 6, background: 'var(--warning)' }} />
            <h2 className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--warning)' }}>
              Needs approval
            </h2>
            <span className="font-mono" style={{ fontSize: 10.5, color: 'var(--faint)' }}>{approvals.length}</span>
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid color-mix(in srgb, var(--warning) 25%, transparent)', background: 'var(--fog)' }}>
            {approvals.slice(0, 8).map((b, i) => (
              <button key={b.id} onClick={() => router.push(`/admin/bookings/${b.id}`)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[.03] cursor-pointer"
                style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <ServiceIcon category={b.serviceCategory} size={15} style={{ color: 'var(--chrome)' }} />
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm font-600 truncate" style={{ color: 'var(--chrome)' }}>
                    {b.userName} <span style={{ color: 'var(--steel)', fontWeight: 400 }}>· {b.serviceName}</span>
                  </p>
                  <p className="text-xs font-body" style={{ color: 'var(--steel)' }}>
                    {b.vehicleName} · {b.scheduledDate} {formatTime(b.scheduledTime)}
                  </p>
                </div>
                <span className="font-mono text-sm font-700 shrink-0" style={{ color: 'var(--chrome)' }}>{formatCurrency(b.totalAmount)}</span>
                <ChevronRight size={15} className="shrink-0" style={{ color: 'var(--steel)' }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Follow-ups — the action queue */}
      <div className="rounded-2xl px-4 py-3 mb-6" style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
        <p className="text-[10px] font-mono uppercase tracking-wider mb-2"
          style={{ color: tasks.length ? 'var(--warning)' : 'var(--faint)' }}>
          Follow-ups due · {tasks.length}
        </p>
        <div className="space-y-1.5 mb-2">
          {tasks.slice(0, 6).map(t => (
            <div key={t.id} className="flex items-center gap-2.5 text-sm font-body">
              <button onClick={() => finishTask(t)} aria-label="done"
                className="w-4 h-4 rounded shrink-0 cursor-pointer transition-colors hover:bg-white/[.08]"
                style={{ border: '1.5px solid var(--border-strong)' }} />
              <span style={{ color: 'var(--chrome)', fontSize: 13 }}>{t.note}</span>
              {t.customerName && <span className="text-xs" style={{ color: 'var(--steel)' }}>· {t.customerName}</span>}
              {t.customerPhone && (
                <a href={`https://wa.me/91${t.customerPhone}`} target="_blank" rel="noreferrer"
                  className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--ember)' }}>WhatsApp →</a>
              )}
              <span className="ml-auto font-mono text-[11px] shrink-0"
                style={{ color: t.dueDate < today ? 'var(--danger)' : 'var(--faint)' }}>
                {t.dueDate}
              </span>
            </div>
          ))}
          {tasks.length === 0 && (
            <p className="text-xs font-body" style={{ color: 'var(--steel)' }}>All clear — nothing due.</p>
          )}
        </div>
        <input className="input w-full text-sm py-2" value={taskDraft}
          onChange={e => setTaskDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && quickAddTask()}
          placeholder="Add a follow-up for today… (Enter)" />
      </div>

      {/* Arriving — bookings not yet checked in */}
      {arriving.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="rounded-full" style={{ width: 6, height: 6, background: 'var(--pewter)' }} />
            <h2 className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fg-dim)' }}>
              Arriving today
            </h2>
            <span className="font-mono" style={{ fontSize: 10.5, color: 'var(--faint)' }}>{arriving.length}</span>
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--fog)' }}>
            {arriving.map((b, i) => (
              <button key={b.id} onClick={() => router.push(`/admin/bookings/${b.id}`)}
                className="group w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[.03] cursor-pointer"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                <span className="font-mono text-xs w-14 shrink-0" style={{ color: 'var(--pewter)' }}>
                  {formatTime(b.scheduledTime)}
                </span>
                <ServiceIcon category={b.serviceCategory} size={15} style={{ color: 'var(--pewter)', flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <p className="font-body font-600 truncate" style={{ fontSize: 13.5, color: 'var(--chrome)' }}>
                    {b.userName}
                    <span className="font-400" style={{ color: 'var(--steel)' }}> · {b.vehicleName}</span>
                  </p>
                  <p className="text-xs font-body truncate mt-0.5" style={{ color: 'var(--steel)' }}>{b.serviceName}</p>
                </div>
                <span className={`status-badge text-[10px] shrink-0 ${getStatusColor(b.status)}`}>{getStatusLabel(b.status)}</span>
                <a href={`tel:+91${b.userPhone}`} onClick={e => e.stopPropagation()}
                  className="w-7 h-7 rounded-lg hidden sm:flex items-center justify-center transition-colors hover:bg-white/[.06] shrink-0"
                  style={{ border: '1px solid var(--border)' }}>
                  <Phone size={11} style={{ color: 'var(--pewter)' }} />
                </a>
                <ChevronRight size={15} className="shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--steel)' }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* The floor — live stage-grouped jobs */}
      {!jobsReady ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-14 shimmer rounded-xl" />)}</div>
      ) : jobs.length === 0 ? (
        <div className="card text-center py-14">
          <Wrench size={24} className="mx-auto mb-3" style={{ color: 'var(--steel)' }} />
          <p className="font-body text-sm" style={{ color: 'var(--steel)' }}>Quiet floor — start a walk-in to get moving.</p>
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

      {/* Front-desk shortcuts */}
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
