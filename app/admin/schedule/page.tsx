'use client';
/**
 * Schedule — the planning surface. Four ways to look at the same days:
 *   Day        agenda by hour; drag a card onto another hour to reschedule
 *   Week       the next seven days at a glance
 *   Board      selected day by pipeline stage
 *   Technicians who is carrying what today; drag a job between lanes to reassign
 * Every card opens the booking/job workspace — nothing dead-ends here.
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Phone, CalendarDays, MessageCircle, GripVertical } from 'lucide-react';
import {
  getBookingsForDates, rescheduleBooking, getJobsForDate,
  listEmployees, setJobAssignees,
} from '@/lib/firebaseService';
import { formatCurrency, formatTime, getStatusColor, getStatusLabel } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import ServiceIcon from '@/components/ui/ServiceIcon';
import ErrorState from '@/components/ui/ErrorState';
import type { Booking, Employee, Job } from '@/lib/types';

const HOURS = Array.from({ length: 11 }, (_, i) => i + 9);
const VIEWS = ['Day', 'Week', 'Board', 'Technicians'] as const;
type View = typeof VIEWS[number];

const BOARD_COLUMNS: { label: string; statuses: Booking['status'][] }[] = [
  { label: 'Pending',   statuses: ['pending'] },
  { label: 'Confirmed', statuses: ['confirmed'] },
  { label: 'In studio', statuses: ['vehicle_received', 'in_progress', 'quality_check'] },
  { label: 'Ready',     statuses: ['ready_for_delivery'] },
  { label: 'Done',      statuses: ['completed'] },
];

const localDate = (offset = 0) => {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function AdminSchedulePage() {
  const router = useRouter();
  const { user } = useAppStore();
  const [view, setView] = useState<View>('Day');
  const [selectedDate, setSelectedDate] = useState(() => localDate());
  const days = Array.from({ length: 7 }, (_, i) => localDate(i));

  const [bookings, setBookings] = useState<Booking[]>([]);   // whole week — all views share it
  const [jobs, setJobs] = useState<Job[]>([]);               // technician view
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadError(false);
    setLoading(true);
    Promise.all([
      getBookingsForDates(days),
      getJobsForDate(selectedDate).catch(() => [] as Job[]),
      listEmployees().catch(() => [] as Employee[]),
    ])
      .then(([b, j, e]) => { setBookings(b); setJobs(j); setEmployees(e); })
      .catch(e => { console.error('schedule load failed', e); setLoadError(true); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);
  useEffect(load, [load]);

  const dayBookings = bookings
    .filter(b => b.scheduledDate === selectedDate)
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  const isToday = selectedDate === localDate();
  const displayDate = new Date(selectedDate + 'T12:00:00');

  const openBooking = (b: Booking) => router.push(`/admin/bookings/${b.id}`);
  const openJob = (j: Job) =>
    router.push(j.bookingId ? `/admin/bookings/${j.bookingId}` : `/admin/jobs/${j.id}`);

  // ── Drag: booking card → hour row (Day view) ──
  const dropOnHour = async (hour: number) => {
    const b = bookings.find(x => x.id === dragId);
    setDragId(null); setDropTarget(null);
    if (!b) return;
    const time = `${String(hour).padStart(2, '0')}:00`;
    if (b.scheduledTime === time) return;
    try {
      await rescheduleBooking(b.id, b.scheduledDate, time);
      setBookings(prev => prev.map(x => x.id === b.id ? { ...x, scheduledTime: time } : x));
      toast.success(`${b.userName} moved to ${formatTime(time)}`);
    } catch { toast.error('Could not reschedule'); }
  };

  // ── Drag: job card → technician lane ──
  const dropOnTech = async (tech: Employee | null) => {
    const j = jobs.find(x => x.id === dragId);
    setDragId(null); setDropTarget(null);
    if (!j || !user) return;
    const activeIds = j.assignments?.filter(a => !a.removedAt).map(a => a.employeeId) ?? [];
    if (tech ? activeIds.length === 1 && activeIds[0] === tech.id : activeIds.length === 0) return;
    const next = tech ? [{ id: tech.id, name: tech.name }] : [];
    try {
      await setJobAssignees(j, next, { id: user.uid, name: user.name });
      setJobs(await getJobsForDate(selectedDate));
      toast.success(tech ? `Assigned to ${tech.name}` : 'Unassigned');
    } catch { toast.error('Could not reassign'); }
  };

  // ── Shared rich-but-compact booking card ──
  const BookingCard = ({ b, draggable }: { b: Booking; draggable?: boolean }) => (
    <div draggable={draggable} onDragStart={() => setDragId(b.id)} onDragEnd={() => { setDragId(null); setDropTarget(null); }}
      onClick={() => openBooking(b)}
      className="group flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-colors hover:bg-white/[.04]"
      style={{ background: 'var(--fog)', border: '1px solid var(--border)', opacity: dragId === b.id ? 0.4 : 1 }}>
      {draggable && <GripVertical size={12} style={{ color: 'var(--faint)', cursor: 'grab' }} className="shrink-0" />}
      <ServiceIcon category={b.serviceCategory} size={15} style={{ color: 'var(--pewter)', flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <p className="font-body font-600 truncate" style={{ fontSize: 13, color: 'var(--chrome)' }}>
          {b.userName}
          <span className="font-400" style={{ color: 'var(--steel)' }}> · {b.vehicleName}</span>
        </p>
        <p className="text-xs font-body truncate" style={{ color: 'var(--steel)' }}>
          {formatTime(b.scheduledTime)} · {b.serviceName} · {formatCurrency(b.totalAmount)}
        </p>
      </div>
      <span className={`status-badge text-[10px] shrink-0 ${getStatusColor(b.status)}`}>{getStatusLabel(b.status)}</span>
      <span className="hidden sm:flex items-center gap-1 shrink-0">
        <a href={`tel:+91${b.userPhone}`} onClick={e => e.stopPropagation()}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/[.06]"
          style={{ border: '1px solid var(--border)' }}>
          <Phone size={11} style={{ color: 'var(--pewter)' }} />
        </a>
        <a href={`https://wa.me/91${b.userPhone}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/[.06]"
          style={{ border: '1px solid var(--border)' }}>
          <MessageCircle size={11} style={{ color: 'var(--pewter)' }} />
        </a>
      </span>
    </div>
  );

  const JobChip = ({ j }: { j: Job }) => (
    <div draggable onDragStart={() => setDragId(j.id)} onDragEnd={() => { setDragId(null); setDropTarget(null); }}
      onClick={() => openJob(j)}
      className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors hover:bg-white/[.04]"
      style={{ background: 'var(--fog)', border: '1px solid var(--border)', opacity: dragId === j.id ? 0.4 : 1 }}>
      <GripVertical size={12} style={{ color: 'var(--faint)', cursor: 'grab' }} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-body font-600 truncate" style={{ fontSize: 12.5, color: 'var(--chrome)' }}>{j.vehicleName}</p>
        <p className="text-[11px] font-body truncate" style={{ color: 'var(--steel)' }}>
          {j.serviceItems.map(s => s.serviceName).join(', ')}
        </p>
      </div>
      <span className="text-[10px] font-mono uppercase tracking-wider shrink-0" style={{ color: 'var(--steel)' }}>
        {getStatusLabel(j.status)}
      </span>
    </div>
  );

  const activeJobs = jobs.filter(j => !['completed', 'cancelled'].includes(j.status));
  const laneJobs = (empId: string | null) => activeJobs.filter(j => {
    const ids = j.assignments?.filter(a => !a.removedAt).map(a => a.employeeId) ?? [];
    return empId === null ? ids.length === 0 : ids.includes(empId);
  });

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="font-display font-800 text-2xl" style={{ color: 'var(--chrome)' }}>Schedule</h1>
          <p className="text-sm font-body" style={{ color: 'var(--steel)' }}>
            {displayDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            {isToday && <span className="ml-2 text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--success)' }}>Today</span>}
          </p>
        </div>
        {/* Segmented control */}
        <div className="flex items-center p-0.5 rounded-xl" style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
          {VIEWS.map(v => (
            <button key={v} onClick={() => setView(v)}
              className="px-3.5 py-1.5 rounded-[10px] text-xs font-body font-500 transition-colors cursor-pointer"
              style={view === v
                ? { background: 'var(--dark)', color: 'var(--chrome)', border: '1px solid var(--border-2)' }
                : { color: 'var(--pewter)', border: '1px solid transparent' }}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Date strip (Week view carries its own days) */}
      {view !== 'Week' && (
        <div className="flex gap-1.5 mb-5 overflow-x-auto no-scroll pb-1">
          {days.map(d => {
            const dt = new Date(d + 'T12:00:00');
            const sel = d === selectedDate;
            const count = bookings.filter(b => b.scheduledDate === d).length;
            return (
              <button key={d} onClick={() => setSelectedDate(d)}
                className="flex-shrink-0 w-12 rounded-xl py-2 flex flex-col items-center gap-0.5 transition-colors cursor-pointer"
                style={{
                  background: sel ? 'var(--accent-mist)' : 'var(--fog)',
                  border: sel ? '1px solid var(--accent-haze)' : '1px solid var(--border)',
                }}>
                <span className="text-[9px] font-mono uppercase" style={{ color: sel ? 'var(--fg-dim)' : 'var(--faint)' }}>
                  {dt.toLocaleDateString('en-IN', { weekday: 'short' })}
                </span>
                <span className="font-display font-700 text-base leading-none" style={{ color: sel ? 'var(--chrome)' : 'var(--pewter)' }}>
                  {dt.getDate()}
                </span>
                <span className="text-[9px] font-mono" style={{ color: count ? 'var(--fg-dim)' : 'var(--faint)' }}>
                  {count || '·'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-12 shimmer rounded-xl" />)}</div>
      ) : loadError ? (
        <ErrorState onRetry={load} />
      ) : view === 'Day' ? (

        /* ── DAY: agenda by hour, drag to reschedule ── */
        dayBookings.length === 0 ? (
          <div className="card text-center py-16">
            <CalendarDays size={24} className="mx-auto mb-3" style={{ color: 'var(--steel)' }} />
            <p className="font-body text-sm" style={{ color: 'var(--steel)' }}>Nothing scheduled for this day.</p>
          </div>
        ) : (
          <div>
            {HOURS.map(hour => {
              const slots = dayBookings.filter(b => parseInt(b.scheduledTime.split(':')[0]) === hour);
              const target = dropTarget === `h${hour}`;
              return (
                <div key={hour} className="flex gap-3"
                  onDragOver={e => { if (dragId) { e.preventDefault(); setDropTarget(`h${hour}`); } }}
                  onDragLeave={() => setDropTarget(t => (t === `h${hour}` ? null : t))}
                  onDrop={() => dropOnHour(hour)}>
                  <div className="w-10 shrink-0 text-right pt-2">
                    <span className="text-[11px] font-mono" style={{ color: slots.length ? 'var(--pewter)' : 'var(--faint)' }}>
                      {hour > 12 ? hour - 12 : hour}{hour >= 12 ? 'p' : 'a'}
                    </span>
                  </div>
                  <div className="flex-1 py-1 rounded-xl transition-colors"
                    style={target ? { background: 'var(--accent-mist)', outline: '1px dashed var(--border-strong)' } : undefined}>
                    {slots.length === 0 ? (
                      <div className="flex items-center h-7"><div className="w-full h-px" style={{ background: 'var(--border)' }} /></div>
                    ) : (
                      <div className="space-y-1.5">{slots.map(b => <BookingCard key={b.id} b={b} draggable />)}</div>
                    )}
                  </div>
                </div>
              );
            })}
            <p className="text-[11px] font-body mt-4" style={{ color: 'var(--faint)', paddingLeft: 52 }}>
              Drag a card onto another hour to reschedule.
            </p>
          </div>
        )

      ) : view === 'Week' ? (

        /* ── WEEK: seven days at a glance ── */
        <div className="space-y-5">
          {days.map(d => {
            const dt = new Date(d + 'T12:00:00');
            const list = bookings.filter(b => b.scheduledDate === d);
            return (
              <div key={d}>
                <button onClick={() => { setSelectedDate(d); setView('Day'); }}
                  className="flex items-baseline gap-2 mb-2 px-1 cursor-pointer">
                  <h2 className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>
                    {d === localDate() ? 'Today' : d === localDate(1) ? 'Tomorrow'
                      : dt.toLocaleDateString('en-IN', { weekday: 'long' })}
                  </h2>
                  <span className="text-xs font-body" style={{ color: 'var(--faint)' }}>
                    {dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {list.length || 'free'}
                  </span>
                </button>
                {list.length > 0 && (
                  <div className="space-y-1.5">{list.map(b => <BookingCard key={b.id} b={b} />)}</div>
                )}
              </div>
            );
          })}
        </div>

      ) : view === 'Board' ? (

        /* ── BOARD: selected day by pipeline stage ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 items-start">
          {BOARD_COLUMNS.map(col => {
            const list = dayBookings.filter(b => col.statuses.includes(b.status));
            return (
              <div key={col.label}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="font-mono text-[10.5px] uppercase tracking-wider" style={{ color: 'var(--fg-dim)' }}>{col.label}</span>
                  <span className="font-mono text-[10.5px]" style={{ color: 'var(--faint)' }}>{list.length}</span>
                </div>
                <div className="space-y-1.5">
                  {list.map(b => <BookingCard key={b.id} b={b} />)}
                  {list.length === 0 && (
                    <div className="rounded-xl border border-dashed py-5 text-center" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-[10px] font-mono uppercase" style={{ color: 'var(--faint)' }}>Empty</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      ) : (

        /* ── TECHNICIANS: lanes, drag to reassign ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
          {[...employees.map(e => ({ key: e.id, label: e.name, emp: e as Employee | null })),
            { key: 'unassigned', label: 'Unassigned', emp: null as Employee | null }].map(lane => {
            const list = laneJobs(lane.emp?.id ?? null);
            const target = dropTarget === `t${lane.key}`;
            return (
              <div key={lane.key}
                onDragOver={e => { if (dragId) { e.preventDefault(); setDropTarget(`t${lane.key}`); } }}
                onDragLeave={() => setDropTarget(t => (t === `t${lane.key}` ? null : t))}
                onDrop={() => dropOnTech(lane.emp)}
                className="rounded-2xl p-3 transition-colors"
                style={{
                  border: target ? '1px dashed var(--border-strong)' : '1px solid var(--border)',
                  background: target ? 'var(--accent-mist)' : 'var(--phantom)',
                }}>
                <div className="flex items-center justify-between mb-2 px-0.5">
                  <span className="font-body font-600 text-sm" style={{ color: lane.emp ? 'var(--chrome)' : 'var(--pewter)' }}>
                    {lane.label}
                  </span>
                  <span className="font-mono text-[10.5px]" style={{ color: 'var(--faint)' }}>{list.length}</span>
                </div>
                <div className="space-y-1.5">
                  {list.map(j => <JobChip key={j.id} j={j} />)}
                  {list.length === 0 && (
                    <div className="rounded-xl border border-dashed py-4 text-center" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-[10px] font-mono uppercase" style={{ color: 'var(--faint)' }}>No jobs</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <p className="xl:col-span-3 md:col-span-2 text-[11px] font-body" style={{ color: 'var(--faint)' }}>
            Drag a job between lanes to reassign it. Jobs shown are for the selected day.
          </p>
        </div>
      )}
    </div>
  );
}
