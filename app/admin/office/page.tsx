'use client';
/**
 * Office — the Owner OS home. Money and decisions, not operations:
 *   intelligence strip  → revenue, outstanding, approvals, staff, stock, leads
 *   approvals           → bookings awaiting a yes
 *   follow-ups          → the owner's action queue
 * Live production lives on the Studio Board (/admin).
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Wrench, ChevronRight, CircleAlert, UserCheck, Package,
  IndianRupee, CalendarCheck, UserPlus, BarChart3, Wallet, LockKeyhole,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  subscribeTodaysJobs, getBookingsForDates, getPendingApprovals,
  getPresentTodayCount, getLowStockItems, getCarLeads, getSellRequests,
  getDueTasks, completeTask, addTask,
} from '@/lib/firebaseService';
import { formatCurrency, formatTime } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import ServiceIcon from '@/components/ui/ServiceIcon';
import type { Booking, FollowUpTask, Job } from '@/lib/types';

export default function OfficePage() {
  const router = useRouter();
  const { user } = useAppStore();
  const today = format(new Date(), 'yyyy-MM-dd');

  const [jobs, setJobs] = useState<Job[]>([]);
  useEffect(() => subscribeTodaysJobs(setJobs, () => {}), []);

  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [approvals, setApprovals] = useState<Booking[]>([]);
  const [staffPresent, setStaffPresent] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const [newLeads, setNewLeads] = useState(0);
  useEffect(() => {
    getBookingsForDates([today])
      .then(bs => setTodayBookings(bs.filter(b => b.scheduledDate === today)))
      .catch(() => {});
    getPendingApprovals().then(setApprovals).catch(() => {});
    getPresentTodayCount().then(setStaffPresent).catch(() => {});
    getLowStockItems().then(items => setLowStock(items.length)).catch(() => {});
    Promise.all([getCarLeads().catch(() => []), getSellRequests().catch(() => [])])
      .then(([l, r]) => setNewLeads(
        l.filter(x => x.status === 'new').length + r.filter(x => x.status === 'new').length,
      ));
  }, [today]);

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

  const collected =
    jobs.filter(j => j.status === 'completed').reduce((s, j) => s + j.totalAmount, 0) +
    todayBookings.filter(b => b.status === 'completed' && !b.jobId).reduce((s, b) => s + b.totalAmount, 0);
  const unpaidJobs = jobs.filter(j =>
    ['ready_for_delivery', 'completed'].includes(j.status) && j.paymentStatus === 'pending');
  const outstanding = unpaidJobs.reduce((s, j) => s + Math.max(0, j.totalAmount - (j.amountPaid ?? 0)), 0);

  const INTEL: { label: string; value: string; icon: typeof Wrench; href?: string; alert?: boolean }[] = [
    { label: 'collected',   value: formatCurrency(collected),   icon: IndianRupee, href: '/admin/close' },
    { label: 'outstanding', value: formatCurrency(outstanding), icon: CircleAlert, href: '/admin/invoices', alert: outstanding > 0 },
    { label: 'approvals',   value: String(approvals.length),    icon: CalendarCheck, href: '/admin/bookings', alert: approvals.length > 0 },
    { label: 'staff in',    value: String(staffPresent),        icon: UserCheck, href: '/admin/attendance' },
    { label: 'low stock',   value: String(lowStock),            icon: Package,   href: '/admin/inventory', alert: lowStock > 0 },
    { label: 'new leads',   value: String(newLeads),            icon: UserPlus,  href: '/admin/cars/leads', alert: newLeads > 0 },
  ];

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-display font-800 text-2xl" style={{ color: 'var(--chrome)' }}>Office</h1>
          <p className="text-sm font-body" style={{ color: 'var(--steel)' }}>
            {format(new Date(), 'EEEE, dd MMM')} · money & decisions
          </p>
        </div>
      </div>

      {/* Intelligence strip */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-6">
        {INTEL.map(s => (
          <Link key={s.label} href={s.href ?? '#'}>
            <div className="flex flex-col gap-1 px-3 py-2.5 rounded-xl h-full transition-colors hover:bg-white/[.03]"
              style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
              <s.icon size={13} style={{ color: s.alert ? 'var(--warning)' : 'var(--steel)' }} />
              <span className="font-mono font-700 text-base leading-none" style={{ color: s.alert ? 'var(--warning)' : 'var(--chrome)' }}>
                {s.value}
              </span>
              <span className="text-[10px] font-body" style={{ color: 'var(--pewter)' }}>{s.label}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Pending booking approvals */}
      {approvals.length > 0 && (
        <div className="mb-6">
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

      {/* Follow-ups */}
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
            <p className="text-xs font-body" style={{ color: 'var(--steel)' }}>All clear - nothing due.</p>
          )}
        </div>
        <input className="input w-full text-sm py-2" value={taskDraft}
          onChange={e => setTaskDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && quickAddTask()}
          placeholder="Add a follow-up for today… (Enter)" />
      </div>

      {/* Owner shortcuts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { href: '/admin/reports',  label: 'Reports',     icon: BarChart3 },
          { href: '/admin/expenses', label: 'Expenses',    icon: Wallet },
          { href: '/admin/close',    label: 'Daily close', icon: LockKeyhole },
          { href: '/admin/invoices', label: 'Invoices',    icon: IndianRupee },
        ].map(s => (
          <Link key={s.href} href={s.href}
            className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl transition-colors hover:bg-white/[.03]"
            style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
            <s.icon size={15} style={{ color: 'var(--steel)' }} />
            <span className="font-body text-sm font-600" style={{ color: 'var(--chrome)' }}>{s.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
