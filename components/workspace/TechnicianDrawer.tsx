'use client';
/**
 * Technician workspace - opens as a drawer from the Studio Board's tech rail.
 * Operations, not HR: what they're working on, how the day is going, and the
 * actions a manager needs (assign a waiting vehicle, break control). All data
 * arrives as props from the board's existing streams - no new listeners.
 */
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Coffee, Play, Timer, Wrench, IndianRupee, UserRound, ChevronRight, CarFront,
} from 'lucide-react';
import { startBreak, endBreak, shiftMath, setJobAssignees } from '@/lib/firebaseService';
import { jobTimeline, fmtMin } from '@/lib/services/washMetrics';
import { RESOURCE_LABELS, categoryToResource } from '@/lib/availability';
import { formatCurrency, formatTime } from '@/lib/utils';
import { format } from 'date-fns';
import type { AttendanceRecord, Job } from '@/lib/types';

export default function TechnicianDrawer({ employeeId, jobs, attendance, actor, onChanged, onOpenJob }: {
  employeeId: string;
  jobs: Job[];
  attendance: AttendanceRecord[];
  actor: { id: string; name: string };
  /** attendance changed (break) - board refetches */
  onChanged: () => void;
  onOpenJob: (j: Job) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const rec = attendance.find(a => a.employeeId === employeeId);
  const name = rec?.employeeName ?? 'Technician';
  const m = rec ? shiftMath(rec) : null;
  const onShift = !!rec && !rec.checkOutAt;

  const mine = useMemo(() => jobs.filter(j => j.assignedIds?.includes(employeeId)), [jobs, employeeId]);
  const current = mine.find(j => j.status === 'in_progress');
  const nextUp = mine.filter(j => j.status === 'checked_in');
  const doneToday = mine.filter(j => j.status === 'completed');
  const unassignedWaiting = useMemo(() =>
    jobs.filter(j => j.status === 'checked_in' && !j.assignedIds?.includes(employeeId)), [jobs, employeeId]);

  const revenueToday = doneToday.reduce((s, j) => s + j.totalAmount, 0);
  const avgMin = useMemo(() => {
    const spans = doneToday.map(j => jobTimeline(j).workMin).filter((n): n is number => n !== null);
    return spans.length ? Math.round(spans.reduce((s, n) => s + n, 0) / spans.length) : null;
  }, [doneToday]);

  const currentStart = current
    ? (current.statusHistory ?? []).find(h => h.status === 'in_progress')?.at?.toDate?.() ?? null : null;
  const workMin = currentStart ? Math.max(0, Math.round((Date.now() - currentStart.getTime()) / 60000)) : null;
  const bay = current ? RESOURCE_LABELS[categoryToResource(current.serviceItems[0]?.category ?? 'Washing')] : null;

  const toggleBreak = async () => {
    if (!rec || busy) return;
    setBusy('break');
    try {
      if (m?.onBreak) { await endBreak(employeeId); toast.success(`${name} back to work`); }
      else { await startBreak(employeeId); toast.success(`${name} on break`); }
      onChanged();
    } catch { toast.error('Could not update break'); }
    setBusy(null);
  };

  const assign = async (j: Job) => {
    if (busy) return;
    setBusy('assign:' + j.id);
    try {
      const active = (j.assignments ?? []).filter(a => !a.removedAt).map(a => ({ id: a.employeeId, name: a.employeeName }));
      await setJobAssignees(j, [...active, { id: employeeId, name }], actor);
      toast.success(`${j.vehicleName} → ${name}`);
    } catch { toast.error('Could not assign'); }
    setBusy(null);
  };

  const tsToTime = (ts?: { toDate?: () => Date }) =>
    ts?.toDate ? formatTime(format(ts.toDate(), 'HH:mm')) : '-';

  const state = !onShift ? 'Off shift' : m?.onBreak ? 'On break' : current ? 'Working' : 'Available';
  const stateColor = !onShift ? 'var(--steel)' : m?.onBreak ? 'var(--warning)' : current ? 'var(--success)' : 'var(--info)';

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto">
      {/* identity + live state */}
      <div className="flex items-center gap-3.5 mb-6">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in srgb, ${stateColor} 12%, var(--dark))` }}>
          <span className="font-display font-800 text-2xl" style={{ color: stateColor }}>{name.charAt(0)}</span>
        </div>
        <div className="min-w-0">
          <h2 className="font-display font-800 text-xl truncate" style={{ color: 'var(--chrome)' }}>{name}</h2>
          <p className="font-mono text-xs inline-flex items-center gap-1.5" style={{ color: stateColor }}>
            <span className="rounded-full" style={{ width: 6, height: 6, background: stateColor }} /> {state}
            {onShift && rec && <span style={{ color: 'var(--steel)' }}>· in since {tsToTime(rec.checkInAt)}</span>}
          </p>
        </div>
      </div>

      {/* current work */}
      {current ? (
        <button onClick={() => onOpenJob(current)}
          className="w-full text-left rounded-2xl p-4 mb-4 cursor-pointer transition-colors hover:bg-white/[.02]"
          style={{ background: 'var(--fog)', border: '1px solid var(--border-strong)' }}>
          <p className="font-mono mb-2" style={{ fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--faint)' }}>CURRENT JOB</p>
          <p className="font-display font-700 text-lg leading-tight" style={{ color: 'var(--chrome)' }}>{current.vehicleName}</p>
          <p className="text-sm font-body mt-0.5" style={{ color: 'var(--steel)' }}>
            {current.serviceItems.map(s => s.serviceName).join(' + ')} · {bay}
          </p>
          <div className="flex items-center gap-4 mt-3 flex-wrap font-mono text-[11px]" style={{ color: 'var(--pewter)' }}>
            {currentStart && <span><Timer size={11} className="inline mr-1 -mt-0.5" />started {formatTime(format(currentStart, 'HH:mm'))}</span>}
            {workMin !== null && <span>{fmtMin(workMin)} on it</span>}
            <ChevronRight size={14} className="ml-auto" style={{ color: 'var(--steel)' }} />
          </div>
        </button>
      ) : (
        <div className="rounded-2xl border border-dashed py-5 text-center mb-4" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs font-body" style={{ color: 'var(--steel)' }}>
            {onShift ? 'No active job - assign a waiting vehicle below.' : 'Not on shift today.'}
          </p>
        </div>
      )}

      {/* day stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        {[
          { icon: Wrench, v: String(doneToday.length), l: 'Jobs done' },
          { icon: Timer, v: avgMin !== null ? fmtMin(avgMin) : '-', l: 'Avg time' },
          { icon: IndianRupee, v: formatCurrency(revenueToday), l: 'Revenue' },
          { icon: Coffee, v: m ? fmtMin(m.breakMin) : '-', l: 'Break' },
        ].map(s => (
          <div key={s.l} className="rounded-xl px-3 py-2.5" style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
            <s.icon size={12} style={{ color: 'var(--steel)' }} />
            <p className="font-mono font-700 text-sm mt-1" style={{ color: 'var(--chrome)' }}>{s.v}</p>
            <p className="text-[10px] font-body" style={{ color: 'var(--pewter)' }}>{s.l}</p>
          </div>
        ))}
      </div>

      {/* break control */}
      {onShift && (
        <button onClick={toggleBreak} disabled={busy === 'break'}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl mb-5 cursor-pointer transition-transform active:scale-[.99]"
          style={{
            background: m?.onBreak ? 'var(--accent-grad)' : 'var(--fog)',
            color: m?.onBreak ? 'var(--on-accent)' : 'var(--chrome)',
            border: m?.onBreak ? 'none' : '1px solid var(--border-2)',
          }}>
          {m?.onBreak ? <Play size={15} /> : <Coffee size={15} />}
          <span className="font-display" style={{ fontSize: 13.5, fontWeight: 700 }}>
            {busy === 'break' ? 'Saving…' : m?.onBreak ? 'End break - back to work' : 'Start break'}
          </span>
        </button>
      )}

      {/* queued for this technician */}
      {nextUp.length > 0 && (
        <div className="mb-5">
          <p className="font-mono mb-2" style={{ fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--faint)' }}>NEXT ASSIGNED</p>
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--fog)' }}>
            {nextUp.map((j, i) => (
              <button key={j.id} onClick={() => onOpenJob(j)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-colors hover:bg-white/[.03]"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                <CarFront size={13} style={{ color: 'var(--steel)' }} />
                <div className="flex-1 min-w-0">
                  <p className="font-body font-600 text-sm truncate" style={{ color: 'var(--chrome)' }}>{j.vehicleName}</p>
                  <p className="text-xs font-body truncate" style={{ color: 'var(--steel)' }}>{j.serviceItems.map(s => s.serviceName).join(' + ')}</p>
                </div>
                <ChevronRight size={13} style={{ color: 'var(--steel)' }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* one-tap assign from the waiting queue */}
      {onShift && !m?.onBreak && unassignedWaiting.length > 0 && (
        <div>
          <p className="font-mono mb-2" style={{ fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--faint)' }}>
            ASSIGN A WAITING VEHICLE
          </p>
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--fog)' }}>
            {unassignedWaiting.map((j, i) => (
              <div key={j.id} className="flex items-center gap-3 px-4 py-2.5"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                <UserRound size={13} style={{ color: 'var(--steel)' }} />
                <div className="flex-1 min-w-0">
                  <p className="font-body font-600 text-sm truncate" style={{ color: 'var(--chrome)' }}>{j.vehicleName}</p>
                  <p className="text-xs font-body truncate" style={{ color: 'var(--steel)' }}>
                    {j.serviceItems.map(s => s.serviceName).join(' + ')} · {RESOURCE_LABELS[categoryToResource(j.serviceItems[0]?.category ?? 'Washing')]}
                  </p>
                </div>
                <button onClick={() => assign(j)} disabled={busy === 'assign:' + j.id}
                  className="px-3 py-2 rounded-lg shrink-0 cursor-pointer transition-transform active:scale-95"
                  style={{ background: 'var(--accent-grad)', color: 'var(--on-accent)' }}>
                  <span className="font-display" style={{ fontSize: 11, fontWeight: 700 }}>
                    {busy === 'assign:' + j.id ? 'Assigning…' : 'Assign'}
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
