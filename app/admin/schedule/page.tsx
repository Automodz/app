'use client';
/**
 * Schedule - the planning surface. Four ways to look at the same days:
 *   Day        agenda by hour; drag a card onto another hour to reschedule
 *   Week       the next seven days at a glance
 *   Board      selected day by pipeline stage
 *   Technicians who is carrying what today; drag a job between lanes to reassign
 * Every card opens the booking/job workspace - nothing dead-ends here.
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Phone, CalendarDays, MessageCircle, GripVertical } from 'lucide-react';
import {
  getBookingsForDates, rescheduleBooking, getJobsForDate,
  listEmployees, setJobAssignees, getServices,
} from '@/lib/firebaseService';
import { categoryToResource, DAY_OPEN_MIN, WORK_DAY_MIN, RESOURCE_LABELS, type ResourceKey } from '@/lib/availability';
import type { Service } from '@/lib/types';
import { formatCurrency, formatTime, getStatusColor, getStatusLabel } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import ServiceIcon from '@/components/ui/ServiceIcon';
import ErrorState from '@/components/ui/ErrorState';
import BayStrip from '@/components/workspace/BayStrip';
import type { Booking, Employee, Job } from '@/lib/types';

const HOURS = Array.from({ length: 11 }, (_, i) => i + 9);
const VIEWS = ['Planner', 'Day', 'Week', 'Board', 'Technicians'] as const;
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
  const [view, setView] = useState<View>('Planner');
  const [selectedDate, setSelectedDate] = useState(() => localDate());
  const days = Array.from({ length: 7 }, (_, i) => localDate(i));

  const [bookings, setBookings] = useState<Booking[]>([]);   // whole week - all views share it
  const [services, setServices] = useState<Service[]>([]);   // duration lookup for the planner
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
      getServices().catch(() => [] as Service[]),
    ])
      .then(([b, j, e, sv]) => { setBookings(b); setJobs(j); setEmployees(e); setServices(sv); })
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

      {/* Bay occupancy — live only for today, where jobs are real */}
      {isToday && !loading && <BayStrip jobs={jobs} bookings={dayBookings} />}

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
      ) : view === 'Planner' ? (

        /* ── PLANNER: the two resources across the working day ── */
        (() => {
          const byName = new Map(services.map(sv => [sv.name, sv.duration]));
          const byCat = new Map<string, number>();
          services.forEach(sv => byCat.set(sv.category, Math.max(byCat.get(sv.category) ?? 0, sv.duration)));
          const durOf = (cat: string, name?: string) => (name && byName.get(name)) || byCat.get(cat) || 60;
          type Block = { id: string; label: string; sub: string; startMin: number; durMin: number; color: string; open: () => void };
          const lanes: Record<ResourceKey, Block[]> = { wash: [], protection: [] };
          const colorFor = (st: string) =>
            st === 'pending' ? 'var(--steel)'
            : ['vehicle_received', 'in_progress', 'quality_check', 'checked_in'].includes(st) ? 'var(--warning)'
            : ['ready_for_delivery'].includes(st) ? 'var(--info)'
            : st === 'completed' ? 'var(--success)'
            : 'var(--info)';
          dayBookings.filter(b => b.status !== 'cancelled').forEach(b => {
            const [h, m] = b.scheduledTime.split(':').map(Number);
            lanes[categoryToResource(b.serviceCategory)].push({
              id: 'b' + b.id, label: b.vehicleName, sub: `${formatTime(b.scheduledTime)} · ${b.serviceName}`,
              startMin: h * 60 + m,
              durMin: b.serviceDurationMinutes ?? durOf(b.serviceCategory),
              color: colorFor(b.status), open: () => openBooking(b),
            });
          });
          jobs.filter(j => !j.bookingId && j.status !== 'cancelled').forEach(j => {
            const created = j.createdAt?.toDate?.();
            const startMin = created ? Math.max(DAY_OPEN_MIN, created.getHours() * 60 + created.getMinutes()) : DAY_OPEN_MIN;
            lanes[categoryToResource(j.serviceItems[0]?.category ?? 'Washing')].push({
              id: 'j' + j.id, label: j.vehicleName || j.customerName,
              sub: `walk-in · ${j.serviceItems.map(x => x.serviceName).join(', ')}`,
              startMin,
              durMin: j.serviceItems.reduce((sum, it) => sum + durOf(it.category, it.serviceName), 0),
              color: colorFor(j.status), open: () => openJob(j),
            });
          });
          const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
          const pct = (min: number) => `${Math.min(100, Math.max(0, ((min - DAY_OPEN_MIN) / WORK_DAY_MIN) * 100))}%`;
          return (
            <div className="overflow-x-auto pb-2">
              <div style={{ minWidth: 640 }}>
                {/* hour axis */}
                <div className="relative h-6 mb-1 ml-28">
                  {HOURS.map(h => (
                    <span key={h} className="absolute font-mono" style={{ left: pct(h * 60), fontSize: 9, color: 'var(--faint)', transform: 'translateX(-50%)' }}>
                      {h > 12 ? h - 12 : h}{h >= 12 ? 'p' : 'a'}
                    </span>
                  ))}
                </div>
                {(['wash', 'protection'] as ResourceKey[]).map(rk => (
                  <div key={rk} className="flex items-stretch gap-2 mb-2">
                    <div className="w-26 shrink-0 flex items-center" style={{ width: 104 }}>
                      <span className="font-mono" style={{ fontSize: 9.5, letterSpacing: '0.12em', color: 'var(--pewter)' }}>
                        {RESOURCE_LABELS[rk].toUpperCase()}
                      </span>
                    </div>
                    <div className="relative flex-1 rounded-xl" style={{ height: 56, background: 'var(--fog)', border: '1px solid var(--border)' }}>
                      {/* hour gridlines */}
                      {HOURS.slice(1).map(h => (
                        <span key={h} aria-hidden className="absolute top-0 bottom-0" style={{ left: pct(h * 60), width: 1, background: 'var(--border)' }} />
                      ))}
                      {/* occupancy blocks */}
                      {lanes[rk].sort((a, b) => a.startMin - b.startMin).map(blk => (
                        <button key={blk.id} onClick={blk.open}
                          className="absolute top-1.5 bottom-1.5 rounded-lg px-2 text-left overflow-hidden cursor-pointer transition-transform hover:scale-[1.01]"
                          style={{
                            left: pct(blk.startMin),
                            width: `${Math.max(4, Math.min(100, (blk.durMin / WORK_DAY_MIN) * 100))}%`,
                            background: `color-mix(in srgb, ${blk.color} 18%, var(--dark))`,
                            border: `1px solid color-mix(in srgb, ${blk.color} 45%, transparent)`,
                          }}>
                          <p className="font-body font-600 truncate" style={{ fontSize: 11, color: 'var(--chrome)' }}>{blk.label}</p>
                          <p className="font-mono truncate" style={{ fontSize: 8.5, color: 'var(--pewter)' }}>{blk.sub}</p>
                        </button>
                      ))}
                      {lanes[rk].length === 0 && (
                        <span className="absolute inset-0 flex items-center justify-center font-body" style={{ fontSize: 12, color: 'var(--steel)' }}>
                          Free all day
                        </span>
                      )}
                      {/* now line */}
                      {isToday && nowMin >= DAY_OPEN_MIN && nowMin <= DAY_OPEN_MIN + WORK_DAY_MIN && (
                        <span aria-hidden className="absolute top-0 bottom-0 pointer-events-none" style={{ left: pct(nowMin), width: 2, background: 'var(--ember)', boxShadow: '0 0 8px var(--accent-glow)' }} />
                      )}
                    </div>
                  </div>
                ))}
                <p className="font-mono ml-28 mt-1" style={{ fontSize: 9, color: 'var(--faint)' }}>
                  Tap a block to open its workspace · multi-day work continues on following days
                </p>
              </div>
            </div>
          );
        })()
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
