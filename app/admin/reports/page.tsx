'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Download, TrendingUp, TrendingDown } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { listInventoryItems , getExpensesForMonth, studioThroughput, fmtMin } from '@/lib/firebaseService';
import { formatCurrency } from '@/lib/utils';
import type { Booking, Job, PayrollRecord, InventoryTxn } from '@/lib/types';

interface MonthReport {
  bookingRevenue: number;
  jobRevenue: number;
  bookingCount: number;
  jobCount: number;
  upiCollected: number;
  cashCollected: number;
  discountsGiven: number;
  salariesPaid: number;
  inventoryConsumedCost: number;
  purchasesCost: number;
  avgTurnaroundMin: number | null;
  peakHour: number | null;
  busyMin: { wash: number; protection: number };
  workingDays: number;
}

export default function AdminReportsPage() {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [report, setReport] = useState<MonthReport | null>(null);
  const [expenses, setExpenses] = useState(0);
  const [rows, setRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const from = `${month}-01`, to = `${month}-31`;

    const [bookingsSnap, jobsSnap, payrollSnap, txnsSnap, items, monthExpenses] = await Promise.all([
      getDocs(query(collection(db, 'bookings'), where('scheduledDate', '>=', from), where('scheduledDate', '<=', to))),
      getDocs(query(collection(db, 'jobs'), where('date', '>=', from), where('date', '<=', to))),
      getDocs(query(collection(db, 'payroll'), where('month', '==', month))),
      getDocs(collection(db, 'inventoryTxns')),
      listInventoryItems(true),
      getExpensesForMonth(month).catch(() => []),
    ]);
    const expensesTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);
    setExpenses(expensesTotal);

    const bookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
    const jobs = jobsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Job));
    const payroll = payrollSnap.docs.map(d => d.data() as PayrollRecord);
    const costMap = Object.fromEntries(items.map(i => [i.id, i.costPerUnit]));
    const txns = txnsSnap.docs
      .map(d => d.data() as InventoryTxn)
      .filter(t => {
        const dt = t.createdAt?.toDate?.();
        return dt && format(dt, 'yyyy-MM') === month;
      });

    const completedBookings = bookings.filter(b => b.status === 'completed');
    const completedJobs = jobs.filter(j => j.status === 'completed');

    const r: MonthReport = {
      bookingRevenue: completedBookings.reduce((s, b) => s + b.totalAmount, 0),
      jobRevenue: completedJobs.reduce((s, j) => s + j.totalAmount, 0),
      bookingCount: completedBookings.length,
      jobCount: completedJobs.length,
      upiCollected:
        completedBookings.filter(b => b.paymentMethod === 'upi' && b.paymentStatus === 'verified').reduce((s, b) => s + b.totalAmount, 0) +
        completedJobs.filter(j => j.paymentMethod === 'upi' && j.paymentStatus === 'collected').reduce((s, j) => s + j.totalAmount, 0),
      cashCollected:
        completedBookings.filter(b => b.paymentMethod === 'cash' && b.paymentStatus === 'verified').reduce((s, b) => s + b.totalAmount, 0) +
        completedJobs.filter(j => j.paymentMethod === 'cash' && j.paymentStatus === 'collected').reduce((s, j) => s + j.totalAmount, 0),
      discountsGiven:
        completedBookings.reduce((s, b) => s + (b.discount?.amount ?? 0), 0) +
        completedJobs.reduce((s, j) => s + (j.discount?.amount ?? 0), 0),
      salariesPaid: payroll.filter(p => p.status === 'paid').reduce((s, p) => s + p.netPayable, 0),
      inventoryConsumedCost: txns
        .filter(t => t.type === 'consumption')
        .reduce((s, t) => s + Math.abs(t.qtyDelta) * (costMap[t.itemId] ?? 0), 0),
      purchasesCost: txns
        .filter(t => t.type === 'purchase')
        .reduce((s, t) => s + (t.costTotal ?? 0), 0),
      ...(() => {
        const t = studioThroughput(jobs);
        return {
          avgTurnaroundMin: t.avgTurnaroundMin,
          peakHour: t.peakHour,
          busyMin: t.busyMin,
          workingDays: new Set(jobs.map(j => j.date)).size || 1,
        };
      })(),
    };
    setReport(r);

    // CSV rows: one line per completed sale
    setRows([
      ['Type', 'Date', 'Customer', 'Phone', 'Vehicle', 'Services', 'Discount', 'Total', 'Payment', 'Status'],
      ...completedBookings.map(b => [
        'Booking', b.scheduledDate, b.userName, b.userPhone, `${b.vehicleName} (${b.vehicleRegNo})`,
        b.serviceName, String(b.discount?.amount ?? 0), String(b.totalAmount), b.paymentMethod, b.paymentStatus,
      ]),
      ...completedJobs.map(j => [
        'Walk-in', j.date, j.customerName, j.customerPhone, `${j.vehicleName} (${j.vehicleRegNo})`,
        j.serviceItems.map(s => s.serviceName).join(' + '), String(j.discount?.amount ?? 0),
        String(j.totalAmount), j.paymentMethod ?? '', j.paymentStatus,
      ]),
    ]);
    setLoading(false);
  }, [month]);
  useEffect(() => { load().catch(() => setLoading(false)); }, [load]);

  const downloadCsv = () => {
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `automodz-sales-${month}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const revenue = (report?.bookingRevenue ?? 0) + (report?.jobRevenue ?? 0);
  const costs = (report?.salariesPaid ?? 0) + (report?.inventoryConsumedCost ?? 0) + expenses;
  const net = revenue - costs;

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display font-800 text-2xl" style={{ color: 'var(--chrome)' }}>REPORTS</h1>
          <p className="text-sm font-body" style={{ color: 'var(--steel)' }}>Monthly performance & export for your accountant</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(format(addMonths(new Date(`${month}-01T12:00:00`), -1), 'yyyy-MM'))}
            className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: 'var(--dark)', color: 'var(--steel)' }}>
            <ChevronLeft size={15} />
          </button>
          <span className="font-mono font-700 text-sm w-24 text-center" style={{ color: 'var(--chrome)' }}>
            {format(new Date(`${month}-01T12:00:00`), 'MMM yyyy')}
          </span>
          <button onClick={() => setMonth(format(addMonths(new Date(`${month}-01T12:00:00`), 1), 'yyyy-MM'))}
            className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: 'var(--dark)', color: 'var(--steel)' }}>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {loading || !report ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-28 shimmer rounded-2xl" />)}</div>
      ) : (
        <>
          {/* Net */}
          <motion.div initial={false} animate={{ opacity: 1, y: 0 }} className="card-ember rounded-2xl p-5 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="data-label" style={{ color: 'var(--steel)' }}>Net profit (revenue − salaries − materials − expenses)</p>
                <p className="font-display font-800 text-3xl mt-1" style={{ color: net >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {formatCurrency(net)}
                </p>
              </div>
              {net >= 0 ? <TrendingUp size={28} style={{ color: 'var(--success)' }} /> : <TrendingDown size={28} style={{ color: 'var(--danger)' }} />}
            </div>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            {[
              { l: 'Total revenue', v: formatCurrency(revenue), c: 'var(--ember)' },
              { l: `Bookings (${report.bookingCount})`, v: formatCurrency(report.bookingRevenue), c: 'var(--chrome)' },
              { l: `Walk-ins (${report.jobCount})`, v: formatCurrency(report.jobRevenue), c: 'var(--chrome)' },
              { l: 'UPI collected', v: formatCurrency(report.upiCollected), c: 'var(--info)' },
              { l: 'Cash collected', v: formatCurrency(report.cashCollected), c: 'var(--success)' },
              { l: 'Discounts given', v: formatCurrency(report.discountsGiven), c: 'var(--ember)' },
              { l: 'Salaries paid', v: formatCurrency(report.salariesPaid), c: 'var(--warning)' },
              { l: 'Materials used (est.)', v: formatCurrency(report.inventoryConsumedCost), c: 'var(--warning)' },
              { l: 'Expenses', v: formatCurrency(expenses), c: 'var(--danger)' },
              { l: 'Stock purchases', v: formatCurrency(report.purchasesCost), c: 'var(--danger)' },
              { l: 'Avg turnaround', v: fmtMin(report.avgTurnaroundMin), c: 'var(--info)' },
              { l: 'Peak hour', v: report.peakHour !== null ? `${report.peakHour}:00` : '—', c: 'var(--info)' },
              // utilization = worked minutes / (working days × 600-min day per bay)
              { l: 'Wash bay utilization', v: `${Math.min(100, Math.round(report.busyMin.wash / (report.workingDays * 600) * 100))}%`, c: 'var(--chrome)' },
              { l: 'Protection bay utilization', v: `${Math.min(100, Math.round(report.busyMin.protection / (report.workingDays * 600) * 100))}%`, c: 'var(--chrome)' },
              { l: 'Idle capacity', v: fmtMin(Math.max(0, report.workingDays * 1200 - report.busyMin.wash - report.busyMin.protection)), c: 'var(--faint)' },
            ].map((s, i) => (
              <motion.div key={s.l} initial={false} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }} className="card-dark py-4 text-center">
                <p className="font-display font-800 text-lg" style={{ color: s.c }}>{s.v}</p>
                <p className="data-label mt-1" style={{ color: 'var(--steel)' }}>{s.l}</p>
              </motion.div>
            ))}
          </div>

          <button onClick={downloadCsv} className="btn-ghost w-full flex items-center justify-center gap-2 py-3.5">
            <Download size={15} /> Download sales CSV ({rows.length - 1} rows)
          </button>
          <p className="text-xs font-body text-center mt-3" style={{ color: 'var(--steel)' }}>
            Materials cost is estimated from current per-unit item costs × quantities consumed.
          </p>
        </>
      )}
    </div>
  );
}
