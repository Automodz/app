'use client';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, Lock } from 'lucide-react';
import {
  getJobsForDate, getDailyClosing, saveDailyClosing,
  getExpensesForMonth, computeDayTakings, todayDateStr,
} from '@/lib/firebaseService';
import { formatCurrency } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import type { DailyClosing } from '@/lib/types';

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [jobs, existing, monthExp] = await Promise.all([
        getJobsForDate(date),
        getDailyClosing(date),
        getExpensesForMonth(date.slice(0, 7)).catch(() => []),
      ]);
      setExpected(computeDayTakings(jobs, date));
      setJobsCompleted(jobs.filter(j => j.status === 'completed').length);
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
          <div className="card p-5 mb-4">
            <p className="data-label mb-2" style={{ color: 'var(--steel)' }}>SYSTEM TOTALS · {jobsCompleted} jobs completed</p>
            {row('UPI received', formatCurrency(expected.upi), 'var(--info)')}
            {row('Cash received', formatCurrency(expected.cash), 'var(--success)')}
            {row('Cash expenses paid out', `−${formatCurrency(cashExpenses)}`, 'var(--danger)')}
            <div className="border-t mt-2 pt-2" style={{ borderColor: 'var(--border)' }}>
              {row('Drawer should hold', formatCurrency(drawerExpected), 'var(--ember)')}
            </div>
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
              <label className="data-label block mb-1">Cash counted in drawer</label>
              <input className="input font-mono text-xl mb-3" inputMode="numeric" value={counted}
                onChange={e => setCounted(e.target.value.replace(/\D/g, ''))} placeholder="0" />
              {variance !== null && (
                <p className="font-mono text-sm mb-3" style={{ color: variance === 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {variance === 0 ? '✓ Drawer matches' :
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
