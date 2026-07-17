'use client';
/**
 * Team attendance — the whole crew's day on one screen.
 * Employee flow: Check In → Working ⇄ Break → Check Out (one shift per day;
 * a closed shift can only be reopened by a manager). GPS/device/IP are
 * captured automatically at check-in — nobody types a time, ever.
 * Manager (admin session): force checkout, reopen, correct times, export
 * the month's payroll hours as CSV.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  LogIn, LogOut, CheckCircle2, Timer, Wrench, X, Coffee, Play,
  RotateCcw, Ban, Pencil, Download, MapPin,
} from 'lucide-react';
import {
  listEmployees, checkIn, checkOut, startBreak, endBreak,
  getTodayAttendance, getJobsForDate, captureAttendanceMeta,
  ShiftClosedError, shiftMath, attendanceCsv, getAttendanceForMonth,
  reopenAttendance, forceCheckOut, correctAttendanceTimes,
} from '@/lib/firebaseService';
import { formatTime } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import Sheet from '@/components/ui/Sheet';
import type { Employee, AttendanceRecord } from '@/lib/types';
import { format, differenceInMinutes } from 'date-fns';

const fmtMin = (m: number) => m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;

export default function StoreAttendancePage() {
  const { user, kioskEmployee } = useAppStore();
  const isManager = user?.role === 'admin';
  const actorId = kioskEmployee?.id ?? user?.employeeId ?? user?.uid ?? '';
  const actorName = kioskEmployee?.name ?? user?.name ?? 'Manager';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ name: string; hours: string; jobs: number } | null>(null);
  const [editRec, setEditRec] = useState<AttendanceRecord | null>(null);
  const [editIn, setEditIn] = useState('');
  const [editOut, setEditOut] = useState('');
  const [exporting, setExporting] = useState(false);
  const [, tick] = useState(0);

  const load = async () => {
    const [emps, att] = await Promise.all([listEmployees(), getTodayAttendance()]);
    setEmployees(emps);
    setRecords(Object.fromEntries(att.map(r => [r.employeeId, r])));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  // live durations — re-render each minute, no timers stored anywhere
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const tsToTime = (ts?: { toDate?: () => Date }) =>
    ts?.toDate ? formatTime(format(ts.toDate(), 'HH:mm')) : '';

  const run = async (id: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(id);
    try { await fn(); if (ok) toast.success(ok); await load(); }
    catch (e) {
      toast.error(e instanceof ShiftClosedError ? e.message : 'Action failed');
    }
    setBusy(null);
  };

  const handleCheckIn = (e: Employee) =>
    run(e.id, async () => {
      const meta = await captureAttendanceMeta();
      await checkIn({ id: e.id, name: e.name }, meta);
    }, `${e.name} checked in`);

  const handleCheckOut = (e: Employee) =>
    run(e.id, async () => {
      const rec = records[e.id];
      await checkOut(e.id);
      try {
        const inAt = rec?.checkInAt?.toDate?.();
        const mins = inAt ? Math.max(0, differenceInMinutes(new Date(), inAt)) : 0;
        const todaysJobs = await getJobsForDate(format(new Date(), 'yyyy-MM-dd'));
        const handled = todaysJobs.filter(j => j.createdByEmployeeId === e.id && j.status !== 'cancelled').length;
        setSummary({ name: e.name, hours: fmtMin(mins), jobs: handled });
      } catch { /* summary is a nicety — never block checkout */ }
    });

  const openEdit = (rec: AttendanceRecord) => {
    setEditRec(rec);
    setEditIn(rec.checkInAt?.toDate ? format(rec.checkInAt.toDate(), 'HH:mm') : '');
    setEditOut(rec.checkOutAt?.toDate ? format(rec.checkOutAt.toDate(), 'HH:mm') : '');
  };
  const saveEdit = async () => {
    if (!editRec) return;
    await run(editRec.employeeId, () => correctAttendanceTimes(
      editRec, { checkIn: editIn || undefined, checkOut: editOut || undefined },
      { id: actorId, name: actorName },
    ), 'Times corrected');
    setEditRec(null);
  };

  const exportMonth = async () => {
    setExporting(true);
    try {
      const month = format(new Date(), 'yyyy-MM');
      const all = (await Promise.all(employees.map(e => getAttendanceForMonth(e.id, month))))
        .flat().sort((a, b) => a.date.localeCompare(b.date) || a.employeeName.localeCompare(b.employeeName));
      const blob = new Blob([attendanceCsv(all)], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `attendance-${month}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { toast.error('Export failed'); }
    setExporting(false);
  };

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-800 text-2xl" style={{ color: 'var(--chrome)' }}>ATTENDANCE</h1>
          <p className="text-sm font-body" style={{ color: 'var(--steel)' }}>
            {format(new Date(), 'EEEE, dd MMM yyyy')} · {Object.values(records).filter(r => r.status !== 'leave').length} present
          </p>
        </div>
        {isManager && (
          <button onClick={exportMonth} disabled={exporting}
            className="btn-ghost flex items-center gap-2 px-4 py-2.5 text-xs">
            <Download size={13} /> {exporting ? 'Exporting…' : 'Month CSV'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 shimmer rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {employees.map((e, i) => {
            const rec = records[e.id];
            const m = rec ? shiftMath(rec) : null;
            const open = !!rec && !rec.checkOutAt;
            const done = !!rec?.checkOutAt;
            return (
              <motion.div key={e.id} initial={false} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }} className="card-dark py-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: done ? 'color-mix(in srgb, var(--success) 12%, transparent)' : m?.onBreak ? 'color-mix(in srgb, var(--warning) 14%, transparent)' : open ? 'var(--accent-mist)' : 'var(--dark)' }}>
                    {done
                      ? <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
                      : m?.onBreak
                        ? <Coffee size={18} style={{ color: 'var(--warning)' }} />
                        : <span className="font-display font-800 text-lg" style={{ color: open ? 'var(--ember)' : 'var(--steel)' }}>{e.name.charAt(0)}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-body font-600 truncate" style={{ color: 'var(--chrome)' }}>{e.name}</p>
                    <p className="text-xs font-body truncate" style={{ color: 'var(--steel)' }}>
                      {done ? `${tsToTime(rec.checkInAt)} → ${tsToTime(rec.checkOutAt)}`
                        : m?.onBreak ? `On break · in since ${tsToTime(rec!.checkInAt)}`
                        : open ? `Working since ${tsToTime(rec!.checkInAt)}`
                        : 'Not checked in'}
                    </p>
                  </div>
                  {!rec && (
                    <button onClick={() => handleCheckIn(e)} disabled={busy === e.id}
                      className="btn-ember flex items-center gap-1.5 px-4 py-3 text-sm shrink-0">
                      <LogIn size={14} /> Check In
                    </button>
                  )}
                </div>

                {/* shift facts — derived live, never typed */}
                {rec && m && (
                  <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-3 pl-1">
                    <span className="font-mono text-[10px]" style={{ color: 'var(--pewter)' }}>
                      <Timer size={10} className="inline mr-1 -mt-0.5" />{fmtMin(m.workedMin)} worked
                    </span>
                    {m.breakMin > 0 && (
                      <span className="font-mono text-[10px]" style={{ color: 'var(--pewter)' }}>
                        <Coffee size={10} className="inline mr-1 -mt-0.5" />{fmtMin(m.breakMin)} break
                      </span>
                    )}
                    {m.lateMin > 0 && (
                      <span className="font-mono text-[10px]" style={{ color: 'var(--warning)' }}>late {fmtMin(m.lateMin)}</span>
                    )}
                    {m.overtimeMin > 0 && (
                      <span className="font-mono text-[10px]" style={{ color: 'var(--info)' }}>OT {fmtMin(m.overtimeMin)}</span>
                    )}
                    {rec.checkInMeta?.lat !== undefined && (
                      <a href={`https://maps.google.com/?q=${rec.checkInMeta.lat},${rec.checkInMeta.lng}`}
                        target="_blank" rel="noopener noreferrer"
                        className="font-mono text-[10px] inline-flex items-center gap-1" style={{ color: 'var(--steel)' }}>
                        <MapPin size={10} /> location
                      </a>
                    )}
                  </div>
                )}

                {/* actions */}
                {(open || (done && isManager)) && (
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {open && (m?.onBreak
                      ? <button onClick={() => run(e.id, () => endBreak(e.id), 'Back to work')} disabled={busy === e.id}
                          className="btn-ember flex items-center gap-1.5 px-4 py-2.5 text-xs"><Play size={12} /> Resume</button>
                      : <button onClick={() => run(e.id, () => startBreak(e.id), 'Break started')} disabled={busy === e.id}
                          className="btn-ghost flex items-center gap-1.5 px-4 py-2.5 text-xs"><Coffee size={12} /> Break</button>
                    )}
                    {open && (
                      <button onClick={() => handleCheckOut(e)} disabled={busy === e.id}
                        className="btn-ghost flex items-center gap-1.5 px-4 py-2.5 text-xs"><LogOut size={12} /> Check Out</button>
                    )}
                    {isManager && open && (
                      <button onClick={() => run(e.id, () => forceCheckOut(rec!, { id: actorId, name: actorName }), 'Forced out')}
                        disabled={busy === e.id}
                        className="btn-ghost flex items-center gap-1.5 px-3 py-2.5 text-xs" style={{ color: 'var(--danger)' }}>
                        <Ban size={12} /> Force out
                      </button>
                    )}
                    {isManager && done && (
                      <button onClick={() => run(e.id, () => reopenAttendance(rec!, { id: actorId, name: actorName }), 'Shift reopened')}
                        disabled={busy === e.id}
                        className="btn-ghost flex items-center gap-1.5 px-3 py-2.5 text-xs"><RotateCcw size={12} /> Reopen</button>
                    )}
                    {isManager && rec && (
                      <button onClick={() => openEdit(rec)} disabled={busy === e.id}
                        className="btn-ghost flex items-center gap-1.5 px-3 py-2.5 text-xs"><Pencil size={12} /> Times</button>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Manager: correct times */}
      <Sheet open={!!editRec} onClose={() => setEditRec(null)} title={`Correct times · ${editRec?.employeeName ?? ''}`}>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <label className="block">
            <span className="data-label block mb-1.5" style={{ color: 'var(--steel)' }}>Check-in</span>
            <input type="time" value={editIn} onChange={e => setEditIn(e.target.value)} className="input w-full text-sm" />
          </label>
          <label className="block">
            <span className="data-label block mb-1.5" style={{ color: 'var(--steel)' }}>Check-out</span>
            <input type="time" value={editOut} onChange={e => setEditOut(e.target.value)} className="input w-full text-sm" />
          </label>
        </div>
        <button onClick={saveEdit} className="btn-ember w-full py-3.5 text-sm">Save correction</button>
      </Sheet>

      {/* Shift summary - shown after checkout */}
      {summary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
          onClick={() => setSummary(null)}>
          <motion.div initial={false} animate={{ scale: 1, opacity: 1 }}
            className="card-ember w-full max-w-sm p-6 text-center relative"
            onClick={ev => ev.stopPropagation()}>
            <button onClick={() => setSummary(null)} aria-label="Close"
              className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded-xl"
              style={{ background: 'var(--dark)', color: 'var(--steel)' }}>
              <X size={15} />
            </button>
            <p className="data-label mb-1" style={{ color: 'var(--ember)' }}>SHIFT COMPLETE</p>
            <p className="font-display font-800 text-xl mb-5" style={{ color: 'var(--chrome)' }}>
              Great work, {summary.name.split(' ')[0]}!
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-4">
                <Timer size={16} className="mx-auto mb-2" style={{ color: 'var(--ember)' }} />
                <p className="font-display font-800 text-lg text-ember">{summary.hours}</p>
                <p className="data-label mt-1">ON SHIFT</p>
              </div>
              <div className="card p-4">
                <Wrench size={16} className="mx-auto mb-2" style={{ color: 'var(--ember)' }} />
                <p className="font-display font-800 text-lg text-ember">{summary.jobs}</p>
                <p className="data-label mt-1">JOBS HANDLED</p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
