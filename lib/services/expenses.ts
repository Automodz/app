import {
  collection, doc, addDoc, deleteDoc, getDoc, getDocs, setDoc,
  query, where, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { db } from '../firebase';
import type { Expense, ExpenseCategory, DailyClosing, Job } from '../types';

export const EXPENSE_CATEGORIES: { id: ExpenseCategory; label: string }[] = [
  { id: 'materials',    label: 'Materials' },
  { id: 'rent',         label: 'Rent' },
  { id: 'electricity',  label: 'Electricity' },
  { id: 'water',        label: 'Water' },
  { id: 'equipment',    label: 'Equipment' },
  { id: 'maintenance',  label: 'Maintenance' },
  { id: 'marketing',    label: 'Marketing' },
  { id: 'transport',    label: 'Transport' },
  { id: 'refreshments', label: 'Refreshments' },
  { id: 'other',        label: 'Other' },
];

export const addExpense = async (data: {
  amount: number; category: ExpenseCategory; note?: string;
  paidVia: 'cash' | 'upi' | 'bank'; vendor?: string; date: string;
  by: { id: string; name: string };
}): Promise<string> => {
  const r = await addDoc(collection(db, 'expenses'), {
    amount: Math.round(data.amount),
    category: data.category,
    ...(data.note ? { note: data.note } : {}),
    paidVia: data.paidVia,
    ...(data.vendor ? { vendor: data.vendor } : {}),
    date: data.date,
    month: data.date.slice(0, 7),
    enteredById: data.by.id, enteredByName: data.by.name,
    createdAt: serverTimestamp(),
  });
  return r.id;
};

export const deleteExpense = (id: string) => deleteDoc(doc(db, 'expenses', id));

export const getExpensesForMonth = async (month: string): Promise<Expense[]> => {
  const snap = await getDocs(query(collection(db, 'expenses'), where('month', '==', month)));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Expense))
    .sort((a, b) => b.date.localeCompare(a.date));
};

// ─── Daily closing ──────────────────────────────────────────────────────────

/** Expected drawer/UPI totals for a date, computed from the payment ledger. */
export const computeDayTakings = (jobs: Job[], date: string) => {
  let cash = 0, upi = 0;
  for (const j of jobs) {
    for (const p of j.payments ?? []) {
      if (p.date !== date) continue;
      if (p.method === 'cash') cash += p.amount; else upi += p.amount;
    }
    // Legacy jobs collected before the ledger existed: count the full amount
    // on the job's own date when there are no payment records.
    if (!j.payments?.length && j.paymentStatus === 'collected' && j.date === date) {
      if (j.paymentMethod === 'cash') cash += j.totalAmount; else upi += j.totalAmount;
    }
  }
  return { cash, upi };
};

export const getDailyClosing = async (date: string): Promise<DailyClosing | null> => {
  const snap = await getDoc(doc(db, 'dailyClosings', date));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as DailyClosing) : null;
};

export const saveDailyClosing = async (data: Omit<DailyClosing, 'id' | 'closedAt'>) => {
  await setDoc(doc(db, 'dailyClosings', data.date), {
    ...data, closedAt: Timestamp.now(),
  });
};

export const todayDateStr = () => format(new Date(), 'yyyy-MM-dd');
