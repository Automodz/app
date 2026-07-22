'use client';
/**
 * Daily Close - the end-of-day ritual: Money → Operations → Tomorrow → Close.
 * Everything derives from the day's jobs, expenses, attendance and tomorrow's
 * bookings. (Inventory consumed joins when a consumption read-model exists;
 * technician hours show for today only - there is no per-date attendance query.)
 */
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, Lock, Truck, CarFront, IndianRupee, CalendarClock, Timer } from 'lucide-react';
import { format, addDays } from 'date-fns';
import {
  getJobsForDate, getDailyClosing, saveDailyClosing,
  getExpensesForMonth, computeDayTakings, todayDateStr,
  getBookingsForDates, getTodayAttendance, shiftMath,
} from '@/lib/firebaseService';
import { formatCurrency, formatTime } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import type { Booking, DailyClosing, Job } from '@/lib/types';

const fmtH = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;

export default function DailyClosePage() {
  const { user } = useAppStore();
  const [date, setDate] = useState(todayDateStr());
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState<DailyClosing | null>(null);
  const [expected, setExpected] = useState({ cash: 0, upi: 0 });
  const [cashExpenses, setCashExpenses] = useState(0);
  const [jobsCompleted, setJobsCompleted] = useState(0);
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [dayJobs, setDayJobs] = useState<Job[]>([]);
  const [dayExpenses, setDayExpenses] = useState(0);
  const [tomorrow, setTomorrow] = useState<Booking[]>([]);
  const [staffMin, setStaffMin] = useState<{ name: string; min: number }[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tmr = format(addDays(new Date(date + 'T12:00:00'), 1), 'yyyy-MM-dd');
      const [jobs, existing, monthExp, tmrBookings, att] = await Promise.all([
        getJobsForDate(date),
        getDailyClosing(date),
        getExpensesForMonth(date.slice(0, 7)).catch(() => []),
        getBookingsForDates([tmr]).catch(() => []),
        date === todayDateStr() ? getTodayAttendance().catch(() => null) : Promise.resolve(null),
      ]);
      setExpected(computeDayTakings(jobs, date));
      setDayJobs(jobs);
      setJobsCompleted(jobs.filter(j => j.status === 'completed').length);
      setTomorrow(tmrBookings
        .filter(b => ['pending', 'confirmed'].includes(b.status))
        .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime)));
      setStaffMin(att ? att.map(r => ({ name: r.employeeName, min: shiftMath(r).workedMin })) : null);
      setDayExpenses(monthExp.filter(e => e.date === date).reduce((s, e) => s + e.amount, 0));
      setCashExpenses(monthExp.filter(e => e.date === date && e.paidVia === 'cash')
        .reduce((s, e) => s + e.amount, 0));
      setClosing(existing);
      if (existing) { setCounted(String(existing.cashCounted)); setNote(existing.note ?? ''); }
      else { setCounted(''); setNote(''); }
    } catch { toast.error('Could not load the day'); }
    setLoading(false);
  }, [date]);
  useEffect(() => { load(); }, [load]);

  // Drawer should hold: cash received − cash expenses paid out of the drawer
  const drawerExpected = expected.cash - cashExpenses;
  const variance = counted === '' ? null : Number(counted) - drawerExpected;

  const close = async () => {
    if (!user || counted === '') { toast.error('Count the drawer first'); return; }
    setSaving(true);
    try {
      await saveDailyClosing({
        date,
        cashExpected: expected.cash,
        upiExpected: expected.upi,
        cashCounted: Number(counted),
        variance: Number(counted) - drawerExpected,
        cashExpenses,
        ...(note.trim() ? { note: note.trim() } : {}),
        jobsCompleted,
        closedById: user.uid, closedByName: user.name,
      } as Omit<DailyClosing, 'id' | 'closedAt'>);
      toast.success('Day closed');
      await load();
    } catch { toast.error('Could not save closing'); }
    setSaving(false);
  };

  const row = (l: string, v: string, c = 'var(--chrome)') => (
    <div className="flex justify-between py-1.5 text-sm font-body">
      <span style={{ color: 'var(--steel)' }}>{l}</span>
      <span className="font-mono font-700" style={{ color: c }}>{v}</span>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-800 text-2xl" style={{ color: 'var(--chrome)' }}>DAILY CLOSING</h1>
          <p className="text-sm font-body" style={{ color: 'var(--steel)' }}>Count the drawer, lock the day</p>
        </div>
        <input className="input w-auto" type="date" value={date} max={todayDateStr()}
          onChange={e => setDate(e.target.value)} />
      </div>

      {loading ? (
        <div className="h-64 shimmer rounded-2xl" />
      ) : (
        <>
          {/* ── 1 · MONEY ── */}
          <div className="card p-5 mb-4">
            <p className="data-label mb-2" style={{ color: 'var(--steel)' }}>1 · MONEY · {jobsCompleted} jobs completed</p>
            {row('UPI received', formatCurrency(expected.upi), 'var(--info)')}
            {row('Cash received', formatCurrency(expected.cash), 'var(--success)')}
            {row('Cash expenses paid out', `−${formatCurrency(cashExpenses)}`, 'var(--danger)')}
            <div className="border-t mt-2 pt-2" style={{ borderColor: 'var(--border)' }}>
              {row('Drawer should hold', formatCurrency(drawerExpected), 'var(--ember)')}
              {row('Estimated day result (takings − expenses)',
                formatCurrency(expected.cash + expected.upi - dayExpenses),
                expected.cash + expected.upi - dayExpenses >= 0 ? 'var(--success)' : 'var(--danger)')}
            </div>
          </div>

          {/* ── 2 · OPERATIONS ── */}
          <div className="card p-5 mb-4">
            <p className="data-label mb-3" style={{ color: 'var(--steel)' }}>2 · OPERATIONS</p>
            {(() => {
              const inside = dayJobs.filter(j => ['checked_in', 'in_progress', 'quality_check'].includes(j.status));
              const readyList = dayJobs.filter(j => j.status === 'ready_for_delivery');
              const unpaid = dayJobs.filter(j =>
                ['ready_for_delivery', 'completed'].includes(j.status) && j.paymentStatus === 'pending');
              const unpaidSum = unpaid.reduce((s, j) => s + Math.max(0, j.totalAmount - (j.amountPaid ?? 0)), 0);
              return (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { icon: Truck, n: readyList.length, l: 'Deliveries pending', warn: readyList.length > 0 },
                      { icon: CarFront, n: inside.length, l: 'Vehicles inside', warn: inside.length > 0 },
                      { icon: IndianRupee, n: unpaid.length, l: 'Payments pending', warn: unpaid.length > 0 },
                    ].map(s => (
                      <div key={s.l} className="rounded-xl px-3 py-2.5 text-center" style={{ background: 'var(--dark)', border: '1px solid var(--border)' }}>
                        <s.icon size={13} className="mx-auto" style={{ color: s.warn ? 'var(--warning)' : 'var(--steel)' }} />
                        <p className="font-mono font-700 text-base mt-1" style={{ color: s.warn ? 'var(--warning)' : 'var(--chrome)' }}>{s.n}</p>
                        <p className="text-[10px] font-body" style={{ color: 'var(--pewter)' }}>{s.l}</p>
                      </div>
                    ))}
                  </div>
                  {unpaidSum > 0 && row('Outstanding on today’s cars', formatCurrency(unpaidSum), 'var(--warning)')}
                  {[...readyList, ...inside].map(j => (
                    <p key={j.id} className="text-xs font-body py-0.5" style={{ color: 'var(--steel)' }}>
                      {j.vehicleName} · {j.customerName} - {j.status === 'ready_for_delivery' ? 'awaiting pickup' : 'still in the studio'}
                    </p>
                  ))}
                  {staffMin && staffMin.length > 0 && (
                    <div className="border-t mt-3 pt-2" style={{ borderColor: 'var(--border)' }}>
                      {staffMin.map(s => (
                        <p key={s.name} className="flex justify-between text-xs font-body py-0.5">
                          <span style={{ color: 'var(--steel)' }}><Timer size={10} className="inline mr-1 -mt-0.5" />{s.name}</span>
                          <span className="font-mono" style={{ color: 'var(--chrome)' }}>{fmtH(s.min)}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* ── 3 · TOMORROW ── */}
          <div className="card p-5 mb-4">
            <p className="data-label mb-2" style={{ color: 'var(--steel)' }}>3 · TOMORROW · {tomorrow.length} arrival{tomorrow.length === 1 ? '' : 's'}</p>
            {tomorrow.length === 0 ? (
              <p className="text-xs font-body" style={{ color: 'var(--steel)' }}>No bookings yet for tomorrow.</p>
            ) : tomorrow.slice(0, 8).map(b => (
              <p key={b.id} className="flex items-center gap-2 text-xs font-body py-1">
                <CalendarClock size={11} style={{ color: 'var(--info)' }} />
                <span className="font-mono w-16 shrink-0" style={{ color: 'var(--pewter)' }}>{formatTime(b.scheduledTime)}</span>
                <span className="truncate" style={{ color: 'var(--chrome)' }}>{b.vehicleName}</span>
                <span className="truncate" style={{ color: 'var(--steel)' }}>· {b.serviceName}</span>
              </p>
            ))}
          </div>

          {closing ? (
            <div className="card-ember p-5">
              <div className="flex items-center gap-2 mb-3">
                <Lock size={16} style={{ color: 'var(--success)' }} />
                <p className="font-display font-700" style={{ color: 'var(--chrome)' }}>
                  DAY CLOSED · by {closing.closedByName}
                </p>
              </div>
              {row('Counted', formatCurrency(closing.cashCounted))}
              {row('Variance', `${closing.variance >= 0 ? '+' : ''}${formatCurrency(closing.variance)}`,
                closing.variance === 0 ? 'var(--success)' : 'var(--danger)')}
              {closing.note && <p className="text-sm font-body mt-2" style={{ color: 'var(--steel)' }}>{closing.note}</p>}
            </div>
          ) : (
            <div className="card p-5">
              <p className="data-label mb-3" style={{ color: 'var(--steel)' }}>4 · CLOSE</p>
              <label className="data-label block mb-1">Cash counted in drawer</label>
              <input className="input font-mono text-xl mb-3" inputMode="numeric" value={counted}
                onChange={e => setCounted(e.target.value.replace(/\D/g, ''))} placeholder="0" />
              {variance !== null && (
                <p className="font-mono text-sm mb-3 inline-flex items-center gap-1.5" style={{ color: variance === 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {variance === 0 ? <><CheckCircle2 size={14} /> Drawer matches</> :
                   variance > 0 ? `+${formatCurrency(variance)} over` : `${formatCurrency(variance)} SHORT`}
                </p>
              )}
              <label className="data-label block mb-1">Note (required if short)</label>
              <input className="input mb-4" value={note} onChange={e => setNote(e.target.value)}
                placeholder="Explain any variance…" />
              <button onClick={close}
                disabled={saving || counted === '' || (variance !== null && variance < 0 && !note.trim())}
                className="btn-ember w-full py-3.5 flex items-center justify-center gap-2">
                <CheckCircle2 size={16} /> {saving ? 'Closing…' : 'Close the Day'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
