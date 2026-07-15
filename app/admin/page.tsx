'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar, Users, TrendingUp, ChevronRight, AlertCircle,
  Wrench, UserCheck, Package, Inbox, IndianRupee,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  getAllBookings, getAdminStats, getJobsForDate,
  getPresentTodayCount, getLowStockItems, getCarLeads, getSellRequests,
  getDueTasks, completeTask, addTask,
} from '@/lib/firebaseService';
import { formatCurrency, getStatusColor, getStatusLabel, formatDate } from '@/lib/utils';
import ServiceIcon from '@/components/ui/ServiceIcon';
import { useAppStore } from '@/lib/store';
import StatCard from '@/components/ui/StatCard';
import GlassCard from '@/components/ui/GlassCard';
import PageHeader from '@/components/ui/PageHeader';
import Skeleton from '@/components/ui/Skeleton';
import type { Booking, FollowUpTask } from '@/lib/types';

interface Stats {
  totalBookings: number;
  todayBookings: number;
  totalCustomers: number;
  revenue: number;
}

interface OpsStats {
  todayRevenue: number;
  activeJobs: number;
  staffPresent: number;
  lowStock: number;
  pendingPayments: number;
  newLeads: number;
}

export default function AdminDashboard() {
  const { user } = useAppStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [ops, setOps] = useState<OpsStats | null>(null);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      try {
        const [statsData, bookings] = await Promise.all([
          getAdminStats(),
          getAllBookings(),
        ]);
        setStats(statsData);
        setRecentBookings(bookings.slice(0, 8));

        // Operational cards - each source tolerated independently
        const [jobs, staffPresent, lowStockItems, leads, sellReqs] = await Promise.all([
          getJobsForDate(today).catch(() => []),
          getPresentTodayCount().catch(() => 0),
          getLowStockItems().catch(() => []),
          getCarLeads().catch(() => []),
          getSellRequests().catch(() => []),
        ]);
        const todayBookingsRevenue = bookings
          .filter(b => b.status === 'completed' && b.scheduledDate === today)
          .reduce((s, b) => s + b.totalAmount, 0);
        const todayJobsRevenue = jobs
          .filter(j => j.status === 'completed')
          .reduce((s, j) => s + j.totalAmount, 0);
        setOps({
          todayRevenue: todayBookingsRevenue + todayJobsRevenue,
          activeJobs: jobs.filter(j => !['completed', 'cancelled'].includes(j.status)).length,
          staffPresent,
          lowStock: lowStockItems.length,
          pendingPayments:
            bookings.filter(b => b.paymentStatus === 'pending' && !['cancelled'].includes(b.status)).length +
            jobs.filter(j => j.paymentStatus === 'pending' && j.status !== 'cancelled').length,
          newLeads: leads.filter(l => l.status === 'new').length + sellReqs.filter(r => r.status === 'new').length,
        });
      } catch {}
      finally { setLoading(false); }
    };
    load();
  }, []);

  const pendingBookings = recentBookings.filter(b => b.status === 'pending');

  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [taskDraft, setTaskDraft] = useState('');
  useEffect(() => {
    getDueTasks(new Date().toISOString().slice(0, 10)).then(setTasks).catch(() => {});
  }, []);

  const finishTask = async (t: FollowUpTask) => {
    try {
      await completeTask(t.id);
      setTasks(prev => prev.filter(x => x.id !== t.id));
    } catch {}
  };

  const quickAddTask = async () => {
    if (!taskDraft.trim() || !user) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      await addTask({ note: taskDraft.trim(), dueDate: today, byName: user.name });
      setTaskDraft('');
      setTasks(await getDueTasks(today));
    } catch {}
  };

  const OPS_CARDS = ops ? [
    { label: "TODAY'S REVENUE", value: formatCurrency(ops.todayRevenue), icon: IndianRupee, href: '/admin/jobs', alert: false },
    { label: 'ACTIVE JOBS', value: String(ops.activeJobs), icon: Wrench, href: '/store/board', alert: false },
    { label: 'STAFF PRESENT', value: String(ops.staffPresent), icon: UserCheck, href: '/admin/employees', alert: false },
    { label: 'LOW STOCK', value: String(ops.lowStock), icon: Package, href: '/admin/inventory', alert: ops.lowStock > 0 },
    { label: 'UNPAID', value: String(ops.pendingPayments), icon: AlertCircle, href: '/admin/bookings', alert: ops.pendingPayments > 0 },
    { label: 'NEW CAR LEADS', value: String(ops.newLeads), icon: Inbox, href: '/admin/cars/leads', alert: false },
  ] : [];

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back · ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}`}
      />

      {/* Follow-ups due - the owner's action queue */}
      <div className="card p-4 mb-5">
        <p className="data-label mb-3" style={{ color: tasks.length ? 'var(--warning)' : 'var(--steel)' }}>
          FOLLOW-UPS DUE · {tasks.length}
        </p>
        <div className="space-y-2 mb-3">
          {tasks.slice(0, 6).map(t => (
            <div key={t.id} className="flex items-center gap-3 text-sm font-body">
              <button onClick={() => finishTask(t)}
                className="w-5 h-5 rounded-md shrink-0 flex items-center justify-center"
                style={{ border: '1.5px solid var(--border-strong)' }} aria-label="done" />
              <span style={{ color: 'var(--chrome)' }}>{t.note}</span>
              {t.customerName && <span style={{ color: 'var(--steel)' }}>· {t.customerName}</span>}
              {t.customerPhone && (
                <a href={`https://wa.me/91${t.customerPhone}`} target="_blank" rel="noreferrer"
                  className="data-label" style={{ color: 'var(--ember)' }}>WhatsApp →</a>
              )}
              <span className="ml-auto font-mono text-xs shrink-0"
                style={{ color: t.dueDate < new Date().toISOString().slice(0, 10) ? 'var(--danger)' : 'var(--steel)' }}>
                {t.dueDate}
              </span>
            </div>
          ))}
          {tasks.length === 0 && (
            <p className="text-sm font-body" style={{ color: 'var(--steel)' }}>All clear - nothing due.</p>
          )}
        </div>
        <div className="flex gap-2">
          <input className="input flex-1 text-sm" value={taskDraft}
            onChange={e => setTaskDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && quickAddTask()}
            placeholder="Add a follow-up for today… (Enter)" />
        </div>
      </div>

      {/* Alerts */}
      {pendingBookings.length > 0 && (
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }} className="mb-5">
          <GlassCard accent padding="sm" className="flex items-center gap-3">
            <AlertCircle size={16} style={{ color: 'var(--warning)' }} className="shrink-0" />
            <span className="text-sm font-body flex-1" style={{ color: 'var(--fg-dim)' }}>
              {pendingBookings.length} booking{pendingBookings.length > 1 ? 's' : ''} waiting for confirmation
            </span>
            <Link href="/admin/bookings" className="text-xs font-mono shrink-0"
              style={{ color: 'var(--ember)', letterSpacing: '0.08em' }}>
              VIEW →
            </Link>
          </GlassCard>
        </motion.div>
      )}

      {/* Business totals - metallic stat grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <StatCard label="TODAY'S BOOKINGS" value={stats.todayBookings} icon={<Calendar size={16} />} />
          <StatCard label="TOTAL CUSTOMERS" value={stats.totalCustomers} icon={<Users size={16} />} />
          <StatCard label="TOTAL REVENUE" value={formatCurrency(stats.revenue)} icon={<TrendingUp size={16} />} />
        </div>
      )}

      {/* Operations today - tappable liquid-glass tiles */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : ops && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {OPS_CARDS.map((s, i) => (
            <motion.div key={s.label} initial={false} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.05 }}>
              <Link href={s.href} className="block">
                <GlassCard className="holo-surface transition-all hover:!border-[var(--border-strong)]" padding="md">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: s.alert
                          ? 'color-mix(in srgb, var(--warning) 12%, transparent)'
                          : 'var(--accent-mist)',
                        border: '1px solid var(--accent-haze)',
                      }}>
                      <s.icon size={17} style={{ color: s.alert ? 'var(--warning)' : 'var(--ember)' }} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-display font-800 text-lg truncate text-ember">{s.value}</div>
                      <div className="data-label mt-0.5">{s.label}</div>
                    </div>
                  </div>
                </GlassCard>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* Recent Bookings */}
      <GlassCard padding="lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-800 text-base tracking-wide" style={{ color: 'var(--chrome)' }}>
            RECENT BOOKINGS
          </h2>
          <Link href="/admin/bookings" className="text-xs font-mono flex items-center gap-1"
            style={{ color: 'var(--ember)', letterSpacing: '0.08em' }}>
            VIEW ALL <ChevronRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : recentBookings.length === 0 ? (
          <div className="text-center py-8 font-body text-sm" style={{ color: 'var(--muted)' }}>No bookings yet</div>
        ) : (
          <div className="space-y-2">
            {recentBookings.map((b, i) => (
              <motion.div key={b.id} initial={false} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}>
                <Link href="/admin/bookings">
                  <div className="flex items-center gap-3 px-3 py-3 rounded-xl transition-colors border border-transparent"
                    style={{ borderColor: 'transparent' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--fog)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}>
                    <ServiceIcon category={b.serviceCategory} size={16} style={{ color: 'var(--chrome)' }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-body text-sm font-500 truncate" style={{ color: 'var(--fg)' }}>{b.userName}</div>
                      <div className="text-xs font-body" style={{ color: 'var(--muted)' }}>
                        {b.serviceName} • {formatDate(b.scheduledDate)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`status-badge text-xs ${getStatusColor(b.status)}`}>{getStatusLabel(b.status)}</span>
                      <div className="font-display font-700 text-xs mt-1" style={{ color: 'var(--fg)' }}>
                        {formatCurrency(b.totalAmount)}
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
