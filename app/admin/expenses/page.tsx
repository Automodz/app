'use client';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Trash2, Wallet } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import {
  addExpense, deleteExpense, getExpensesForMonth,
  EXPENSE_CATEGORIES, todayDateStr,
} from '@/lib/firebaseService';
import { formatCurrency } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import type { Expense, ExpenseCategory } from '@/lib/types';
import ErrorState from '@/components/ui/ErrorState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const emptyForm = {
  amount: '', category: 'materials' as ExpenseCategory,
  note: '', vendor: '', paidVia: 'cash' as 'cash' | 'upi' | 'bank',
  date: todayDateStr(),
};

export default function AdminExpensesPage() {
  const { user } = useAppStore();
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null);

  const load = useCallback(() => {
    setLoading(true); setLoadError(false);
    getExpensesForMonth(month)
      .then(setExpenses)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [month]);
  useEffect(load, [load]);

  const save = async () => {
    if (!user) return;
    const amount = Number(form.amount);
    if (!amount || amount <= 0) { toast.error('Enter the amount'); return; }
    setSaving(true);
    try {
      await addExpense({
        amount, category: form.category,
        note: form.note.trim() || undefined,
        vendor: form.vendor.trim() || undefined,
        paidVia: form.paidVia, date: form.date,
        by: { id: user.uid, name: user.name },
      });
      toast.success('Expense recorded');
      setForm({ ...emptyForm, date: form.date });
      if (form.date.slice(0, 7) === month) load();
    } catch { toast.error('Could not save expense'); }
    setSaving(false);
  };

  const remove = async (e: Expense) => {
    setConfirmDelete(null);
    try {
      await deleteExpense(e.id);
      setExpenses(prev => prev.filter(x => x.id !== e.id));
      toast.success('Expense removed');
    } catch { toast.error('Could not delete'); }
  };

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory = EXPENSE_CATEGORIES
    .map(c => ({ ...c, total: expenses.filter(e => e.category === c.id).reduce((s, e) => s + e.amount, 0) }))
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);

  const shiftMonth = (delta: number) =>
    setMonth(format(addMonths(new Date(`${month}-01T12:00:00`), delta), 'yyyy-MM'));

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display font-800 text-2xl" style={{ color: 'var(--chrome)' }}>EXPENSES</h1>
          <p className="text-sm font-body" style={{ color: 'var(--steel)' }}>
            {format(new Date(`${month}-01T12:00:00`), 'MMMM yyyy')} · {formatCurrency(total)} · {expenses.length} entries
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => shiftMonth(-1)} className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--dark)', color: 'var(--steel)' }}><ChevronLeft size={16} /></button>
          <span className="font-mono text-sm px-2" style={{ color: 'var(--chrome)' }}>{month}</span>
          <button onClick={() => shiftMonth(1)} className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--dark)', color: 'var(--steel)' }}><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Quick add */}
      <div className="card p-4 mb-5">
        <p className="data-label mb-3" style={{ color: 'var(--steel)' }}>QUICK ADD</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="data-label block mb-1">Amount</label>
            <input className="input font-mono" inputMode="numeric" value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value.replace(/\D/g, '') })} placeholder="0" />
          </div>
          <div>
            <label className="data-label block mb-1">Date</label>
            <input className="input" type="date" value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label className="data-label block mb-1">Vendor (optional)</label>
            <input className="input" value={form.vendor}
              onChange={e => setForm({ ...form, vendor: e.target.value })} placeholder="Supplier / shop" />
          </div>
          <div>
            <label className="data-label block mb-1">Note (optional)</label>
            <input className="input" value={form.note}
              onChange={e => setForm({ ...form, note: e.target.value })} placeholder="What was it for?" />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap mb-3">
          {EXPENSE_CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setForm({ ...form, category: c.id })}
              className="px-3 py-2 rounded-xl data-label transition-all"
              style={{
                background: form.category === c.id ? 'var(--accent-mist)' : 'var(--dark)',
                border: form.category === c.id ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
                color: form.category === c.id ? 'var(--ember)' : 'var(--steel)',
              }}>{c.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {(['cash', 'upi', 'bank'] as const).map(v => (
            <button key={v} onClick={() => setForm({ ...form, paidVia: v })}
              className="px-4 py-2 rounded-xl data-label"
              style={{
                background: form.paidVia === v ? 'var(--accent-mist)' : 'var(--dark)',
                border: form.paidVia === v ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
                color: form.paidVia === v ? 'var(--ember)' : 'var(--steel)',
              }}>{v.toUpperCase()}</button>
          ))}
          <button onClick={save} disabled={saving} className="btn-ember ml-auto px-6 py-2.5">
            {saving ? 'Saving…' : 'Add Expense'}
          </button>
        </div>
      </div>

      {/* Category totals */}
      {byCategory.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {byCategory.slice(0, 8).map(c => (
            <div key={c.id} className="card-dark py-3 text-center">
              <p className="font-mono font-700" style={{ color: 'var(--chrome)' }}>{formatCurrency(c.total)}</p>
              <p className="data-label mt-0.5" style={{ color: 'var(--steel)' }}>{c.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-14 shimmer rounded-2xl" />)}</div>
      ) : loadError ? (
        <ErrorState onRetry={load} />
      ) : expenses.length === 0 ? (
        <div className="card text-center py-14">
          <Wallet size={26} className="mx-auto mb-3" style={{ color: 'var(--steel)' }} />
          <p className="font-body" style={{ color: 'var(--steel)' }}>No expenses recorded this month.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((e, i) => (
            <motion.div key={e.id} initial={false} animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }} className="card-dark flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>
                  {EXPENSE_CATEGORIES.find(c => c.id === e.category)?.label ?? e.category}
                  {e.vendor ? ` · ${e.vendor}` : ''}
                </p>
                <p className="text-xs font-body truncate" style={{ color: 'var(--steel)' }}>
                  {e.date} · {e.paidVia.toUpperCase()} · {e.enteredByName}{e.note ? ` - ${e.note}` : ''}
                </p>
              </div>
              <span className="font-mono font-700" style={{ color: 'var(--danger)' }}>−{formatCurrency(e.amount)}</span>
              <button onClick={() => setConfirmDelete(e)}
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'var(--dark)', color: 'var(--steel)' }}>
                <Trash2 size={14} />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete expense?"
        message={confirmDelete ? `${formatCurrency(confirmDelete.amount)} · ${confirmDelete.date}` : ''}
        confirmLabel="Delete"
        danger
        onConfirm={() => confirmDelete && remove(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}
