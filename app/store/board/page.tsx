'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  PlusCircle, Wrench, UserRound, LogIn, LogOut, Timer,
  Clock, IndianRupee, Truck, CircleAlert, CalendarClock, LockKeyhole, Phone,
} from 'lucide-react';
import {
  subscribeTodaysJobs, checkIn, checkOut, getTodayAttendance, getBookingsForDates,
} from '@/lib/firebaseService';
import { formatCurrency, formatTime } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import JobCard from '@/components/store/JobCard';
import type { Booking, Job, AttendanceRecord } from '@/lib/types';
import { format, differenceInMinutes } from 'date-fns';

const COLUMNS: { status: Job['status']; label: string }[] = [
  { status: 'checked_in',         label: 'CHECKED IN' },
  { status: 'in_progress',        label: 'IN PROGRESS' },
  { status: 'quality_check',      label: 'QUALITY CHECK' },
  { status: 'ready_for_delivery', label: 'READY' },
];

export default function StoreBoardPage() {
  const { kioskEmployee, user } = useAppStore();
  const myId = kioskEmployee?.id ?? (user?.role === 'employee' ? user.employeeId : undefined);
  const myName = kioskEmployee?.name ?? user?.name ?? '';
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [mineOnly, setMineOnly] = useState(false);

  const [streamDown, setStreamDown] = useState(false);
  const [streamKey, setStreamKey] = useState(0); // bump to resubscribe

  // My shift - check-in state for the signed-in employee
  const [myShift, setMyShift] = useState<AttendanceRecord | null | undefined>(undefined);
  const [shiftBusy, setShiftBusy] = useState(false);

  // Today's arrivals — booked cars not yet checked in (same source the
  // Admin Workspace reads; rendered here so the desk never misses one)
  const [arrivals, setArrivals] = useState<Booking[]>([]);
  useEffect(() => {
    getBookingsForDates([format(new Date(), 'yyyy-MM-dd')])
      .then(bs => setArrivals(bs
        .filter(b => ['pending', 'confirmed'].includes(b.status) && !b.jobId)
        .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))))
      .catch(() => {});
  }, []);
  // Kiosk rides on the owner's admin session, so booking check-in (an /admin
  // route) is reachable from the shared tablet; personal employee phones are not.
  const isAdminSession = user?.role === 'admin';

  useEffect(() => {
    const unsub = subscribeTodaysJobs(
      (j) => { setJobs(j); setLoading(false); setStreamDown(false); },
      () => { setLoading(false); setStreamDown(true); },
    );
    return unsub;
  }, [streamKey]);

  // Auto-resubscribe when the connection comes back
  useEffect(() => {
    const retry = () => setStreamKey(k => k + 1);
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, []);

  useEffect(() => {
    if (!myId) { setMyShift(null); return; }
    getTodayAttendance()
      .then(recs => setMyShift(recs.find(r => r.employeeId === myId) ?? null))
      .catch(() => setMyShift(null));
  }, [myId]);

  const toggleShift = async () => {
    if (!myId || shiftBusy) return;
    setShiftBusy(true);
    try {
      if (myShift && !myShift.checkOutAt) {
        await checkOut(myId);
        toast.success('Checked out - see you tomorrow!');
      } else if (!myShift) {
        await checkIn({ id: myId, name: myName });
        toast.success('Checked in - have a great shift!');
      }
      const recs = await getTodayAttendance();
      setMyShift(recs.find(r => r.employeeId === myId) ?? null);
    } catch { toast.error('Could not update your shift'); }
    setShiftBusy(false);
  };

  const onShift = !!myShift && !myShift.checkOutAt;
  const shiftDone = !!myShift?.checkOutAt;
  const inAt = myShift?.checkInAt?.toDate?.();
  const shiftMins = onShift && inAt ? Math.max(0, differenceInMinutes(new Date(), inAt)) : 0;
  const tsToTime = (ts?: { toDate?: () => Date }) =>
    ts?.toDate ? formatTime(format(ts.toDate(), 'HH:mm')) : '';

  const delivered = jobs.filter(j => j.status === 'completed').length;
  const isMine = (j: Job) => !myId || (j.assignedIds?.includes(myId) ?? j.createdByEmployeeId === myId);
  const active = jobs.filter(j => j.status !== 'cancelled' && j.status !== 'completed' &&
    (!mineOnly || isMine(j)));
  const myActive = myId ? jobs.filter(j => j.status !== 'cancelled' && j.status !== 'completed' && isMine(j)).length : 0;
  const revenueToday = jobs
    .filter(j => j.status === 'completed')
    .reduce((s, j) => s + j.totalAmount, 0);
  const unpaidReady = jobs.filter(j =>
    ['ready_for_delivery', 'completed'].includes(j.status) && j.paymentStatus === 'pending').length;
  const readyCount = jobs.filter(j => j.status === 'ready_for_delivery').length;

  return (
    <div className="p-4 md:p-6 lg:grid lg:grid-cols-[280px_1fr] lg:gap-6 lg:items-start">

      {/* ── Shift rail: the employee's own corner of the workspace ── */}
      <aside className="mb-5 lg:mb-0 lg:sticky lg:top-20 space-y-4">
        {/* My shift */}
        <div className="card p-4">
          <p className="data-label mb-3" style={{ color: 'var(--steel)' }}>MY SHIFT</p>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: onShift ? 'color-mix(in srgb, var(--success) 14%, transparent)' : 'var(--dark)' }}>
              <span className="font-display font-800 text-lg"
                style={{ color: onShift ? 'var(--success)' : 'var(--steel)' }}>
                {myName.charAt(0) || '?'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-body font-600 text-sm truncate" style={{ color: 'var(--chrome)' }}>{myName}</p>
              <p className="text-xs font-body" style={{ color: onShift ? 'var(--success)' : 'var(--steel)' }}>
                {shiftDone ? `Shift done · ${tsToTime(myShift?.checkInAt)} → ${tsToTime(myShift?.checkOutAt)}`
                  : onShift ? `On shift since ${tsToTime(myShift?.checkInAt)}`
                  : myShift === undefined ? 'Checking…' : 'Not checked in'}
              </p>
            </div>
          </div>
          {onShift && (
            <div className="flex items-center gap-2 mb-3 text-xs font-mono" style={{ color: 'var(--steel)' }}>
              <Timer size={12} /> {Math.floor(shiftMins / 60)}h {shiftMins % 60}m on shift · {myActive} job{myActive === 1 ? '' : 's'} on you
            </div>
          )}
          {myId && !shiftDone && myShift !== undefined && (
            <button onClick={toggleShift} disabled={shiftBusy}
              className={`${onShift ? 'btn-ghost' : 'btn-ember'} w-full py-3 flex items-center justify-center gap-2 text-sm`}>
              {onShift ? <LogOut size={15} /> : <LogIn size={15} />}
              {shiftBusy ? 'Saving…' : onShift ? 'Check Out' : 'Check In'}
            </button>
          )}
          <Link href="/store/attendance" className="block text-center data-label mt-3 py-2 cursor-pointer"
            style={{ color: 'var(--steel)' }}>
            <Clock size={11} className="inline mr-1 -mt-0.5" />Whole team →
          </Link>
        </div>

        {/* Daily progress */}
        <div className="card p-4">
          <p className="data-label mb-3" style={{ color: 'var(--steel)' }}>TODAY</p>
          <div className="grid grid-cols-3 lg:grid-cols-1 gap-3">
            <div className="flex items-center gap-2.5">
              <Wrench size={15} style={{ color: 'var(--ember)' }} />
              <div>
                <p className="font-mono font-700 text-base leading-none" style={{ color: 'var(--chrome)' }}>{active.length}</p>
                <p className="data-label mt-1">ACTIVE</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Truck size={15} style={{ color: 'var(--success)' }} />
              <div>
                <p className="font-mono font-700 text-base leading-none" style={{ color: 'var(--chrome)' }}>{delivered}</p>
                <p className="data-label mt-1">DELIVERED</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <IndianRupee size={15} style={{ color: 'var(--ember)' }} />
              <div>
                <p className="font-mono font-700 text-base leading-none" style={{ color: 'var(--chrome)' }}>{formatCurrency(revenueToday)}</p>
                <p className="data-label mt-1">COLLECTED</p>
              </div>
            </div>
          </div>
          {(readyCount > 0 || unpaidReady > 0) && (
            <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: '1px solid var(--border)' }}>
              {readyCount > 0 && (
                <p className="text-xs font-body flex items-center gap-1.5" style={{ color: 'var(--info)' }}>
                  <Truck size={12} /> {readyCount} car{readyCount === 1 ? '' : 's'} awaiting delivery
                </p>
              )}
              {unpaidReady > 0 && (
                <p className="text-xs font-body flex items-center gap-1.5" style={{ color: 'var(--warning)' }}>
                  <CircleAlert size={12} /> {unpaidReady} payment{unpaidReady === 1 ? '' : 's'} pending
                </p>
              )}
            </div>
          )}
        </div>

        {/* Arriving today — booked cars the desk should expect */}
        {arrivals.length > 0 && (
          <div className="card p-4">
            <p className="data-label mb-3 flex items-center gap-1.5" style={{ color: 'var(--steel)' }}>
              <CalendarClock size={11} /> ARRIVING · {arrivals.length}
            </p>
            <div className="space-y-1">
              {arrivals.slice(0, 6).map(b => {
                const inner = (
                  <>
                    <span className="font-mono text-xs w-12 shrink-0" style={{ color: 'var(--pewter)' }}>
                      {formatTime(b.scheduledTime)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-body font-600 text-sm truncate" style={{ color: 'var(--chrome)' }}>{b.userName}</p>
                      <p className="text-xs font-body truncate" style={{ color: 'var(--steel)' }}>{b.vehicleName}</p>
                    </div>
                    <a href={`tel:+91${b.userPhone}`} onClick={e => e.stopPropagation()}
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ border: '1px solid var(--border)' }}>
                      <Phone size={11} style={{ color: 'var(--pewter)' }} />
                    </a>
                  </>
                );
                return isAdminSession ? (
                  <Link key={b.id} href={`/admin/bookings/${b.id}`}
                    className="flex items-center gap-2.5 py-2 rounded-lg px-1 transition-colors hover:bg-white/[.03]">
                    {inner}
                  </Link>
                ) : (
                  <div key={b.id} className="flex items-center gap-2.5 py-2 px-1">{inner}</div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="hidden lg:block space-y-2">
          <Link href="/store/new" className="btn-ember w-full py-3.5 flex items-center justify-center gap-2">
            <PlusCircle size={16} /> New Walk-In
          </Link>
          {isAdminSession && (
            <Link href="/admin/close" className="btn-ghost w-full py-3 flex items-center justify-center gap-2 text-sm">
              <LockKeyhole size={14} /> Daily Close
            </Link>
          )}
        </div>
      </aside>

      {/* ── Main workspace: the live board ── */}
      <section>
        {streamDown && (
          <button onClick={() => setStreamKey(k => k + 1)}
            className="w-full mb-4 py-3 rounded-xl data-label cursor-pointer"
            style={{ background: 'color-mix(in srgb, var(--warning) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)', color: 'var(--warning)' }}>
            Live updates paused - tap to reconnect
          </button>
        )}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="font-display font-800 text-xl md:text-2xl" style={{ color: 'var(--chrome)' }}>WORKSHOP FLOOR</h1>
            <p className="text-sm font-body" style={{ color: 'var(--steel)' }}>
              {format(new Date(), 'EEE, dd MMM')} · live board
            </p>
          </div>
          <div className="flex items-center gap-2">
            {myId && (
              <button onClick={() => setMineOnly(m => !m)}
                className="flex items-center gap-2 px-4 rounded-xl data-label transition-all cursor-pointer"
                style={{
                  minHeight: 44,
                  background: mineOnly ? 'var(--accent-mist)' : 'var(--dark)',
                  border: mineOnly ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
                  color: mineOnly ? 'var(--ember)' : 'var(--steel)',
                }}>
                <UserRound size={14} /> MY JOBS
              </button>
            )}
            <Link href="/store/new" className="btn-ember flex items-center gap-2 px-5 py-3 lg:hidden">
              <PlusCircle size={16} /> New Walk-In
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-48 shimmer rounded-2xl" />)}
          </div>
        ) : active.length === 0 ? (
          <div className="card text-center py-16">
            <Wrench size={28} className="mx-auto mb-3" style={{ color: 'var(--steel)' }} />
            <p className="font-body" style={{ color: 'var(--steel)' }}>
              {mineOnly ? 'Nothing assigned to you right now.' : 'No jobs yet today. Tap “New Walk-In” to start one.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
            {COLUMNS.map(col => {
              const colJobs = active.filter(j => j.status === col.status);
              return (
                <div key={col.status}>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <span className="data-label" style={{ color: 'var(--steel)' }}>{col.label}</span>
                    <span className="data-label px-2 py-0.5 rounded-lg" style={{ background: 'var(--dark)', color: 'var(--chrome)' }}>
                      {colJobs.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {colJobs.map(j => <JobCard key={j.id} job={j} />)}
                    {colJobs.length === 0 && (
                      <div className="rounded-2xl border border-dashed py-8 text-center"
                        style={{ borderColor: 'var(--border)' }}>
                        <p className="data-label" style={{ color: 'var(--steel)' }}>Empty</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
