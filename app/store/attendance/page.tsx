'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { LogIn, LogOut, CheckCircle2, Timer, Wrench, X } from 'lucide-react';
import { listEmployees, checkIn, checkOut, getTodayAttendance, getJobsForDate } from '@/lib/firebaseService';
import { formatTime } from '@/lib/utils';
import type { Employee, AttendanceRecord } from '@/lib/types';
import { format, differenceInMinutes } from 'date-fns';

export default function StoreAttendancePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ name: string; hours: string; jobs: number } | null>(null);

  const load = async () => {
    const [emps, att] = await Promise.all([listEmployees(), getTodayAttendance()]);
    setEmployees(emps);
    setRecords(Object.fromEntries(att.map(r => [r.employeeId, r])));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const tsToTime = (ts?: { toDate?: () => Date }) =>
    ts?.toDate ? formatTime(format(ts.toDate(), 'HH:mm')) : '';

  const handleCheckIn = async (e: Employee) => {
    setBusy(e.id);
    try {
      await checkIn({ id: e.id, name: e.name });
      toast.success(`${e.name} checked in`);
      await load();
    } catch { toast.error('Check-in failed'); }
    setBusy(null);
  };

  const handleCheckOut = async (e: Employee) => {
    setBusy(e.id);
    try {
      const rec = records[e.id];
      await checkOut(e.id);
      toast.success(`${e.name} checked out`);
      // Shift summary - hours on shift + jobs handled today
      try {
        const inAt = rec?.checkInAt?.toDate?.();
        const mins = inAt ? Math.max(0, differenceInMinutes(new Date(), inAt)) : 0;
        const todaysJobs = await getJobsForDate(format(new Date(), 'yyyy-MM-dd'));
        const handled = todaysJobs.filter(j => j.createdByEmployeeId === e.id && j.status !== 'cancelled').length;
        setSummary({ name: e.name, hours: `${Math.floor(mins / 60)}h ${mins % 60}m`, jobs: handled });
      } catch { /* summary is a nicety - never block checkout */ }
      await load();
    } catch { toast.error('Check-out failed'); }
    setBusy(null);
  };

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display font-800 text-2xl" style={{ color: 'var(--chrome)' }}>ATTENDANCE</h1>
        <p className="text-sm font-body" style={{ color: 'var(--steel)' }}>
          {format(new Date(), 'EEEE, dd MMM yyyy')} · {Object.values(records).filter(r => r.status !== 'leave').length} present
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 shimmer rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {employees.map((e, i) => {
            const rec = records[e.id];
            const checkedIn = !!rec && !rec.checkOutAt;
            const done = !!rec?.checkOutAt;
            return (
              <motion.div key={e.id} initial={false} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }} className="card-dark flex items-center gap-4 py-5">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: done ? 'color-mix(in srgb, var(--success) 12%, transparent)' : checkedIn ? 'var(--accent-mist)' : 'var(--dark)' }}>
                  {done
                    ? <CheckCircle2 size={22} style={{ color: 'var(--success)' }} />
                    : <span className="font-display font-800 text-xl" style={{ color: checkedIn ? 'var(--ember)' : 'var(--steel)' }}>{e.name.charAt(0)}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body font-600" style={{ color: 'var(--chrome)' }}>{e.name}</p>
                  <p className="text-xs font-body" style={{ color: 'var(--steel)' }}>
                    {done
                      ? `${tsToTime(rec.checkInAt)} → ${tsToTime(rec.checkOutAt)}`
                      : checkedIn
                        ? `In since ${tsToTime(rec.checkInAt)}`
                        : 'Not checked in'}
                  </p>
                </div>
                {!rec && (
                  <button onClick={() => handleCheckIn(e)} disabled={busy === e.id}
                    className="btn-ember flex items-center gap-2 px-5 py-3 text-sm">
                    <LogIn size={15} /> Check In
                  </button>
                )}
                {checkedIn && (
                  <button onClick={() => handleCheckOut(e)} disabled={busy === e.id}
                    className="btn-ghost flex items-center gap-2 px-5 py-3 text-sm">
                    <LogOut size={15} /> Check Out
                  </button>
                )}
                {done && <span className="data-label" style={{ color: 'var(--success)' }}>Done</span>}
              </motion.div>
            );
          })}
        </div>
      )}

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
