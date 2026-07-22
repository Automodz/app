'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, ChevronLeft, ChevronRight, IndianRupee, CheckCircle2, Plus } from 'lucide-react';
import { format, addMonths, getDaysInMonth } from 'date-fns';
import {
  getEmployee, getAttendanceForMonth, overrideAttendanceStatus,
  computeMonth, netPayable, getPayrollRecord, savePayrollDraft, markPayrollPaid, getPayrollHistory,
  getJobsForEmployee, employeeWashStats, employeeCategoryStats, fmtMin, shiftMath, attendanceCsv,
} from '@/lib/firebaseService';
import { formatCurrency } from '@/lib/utils';
import type { Employee, AttendanceRecord, PayrollRecord, PayrollAdjustment, AttendanceStatus, Job } from '@/lib/types';

const STATUS_CYCLE: (AttendanceStatus | null)[] = [null, 'present', 'half_day', 'leave'];
const STATUS_META: Record<AttendanceStatus, { label: string; color: string; bg: string }> = {
  present:  { label: 'P', color: 'var(--success)', bg: 'color-mix(in srgb, var(--success) 15%, transparent)' },
  half_day: { label: 'H', color: 'var(--steel)', bg: 'color-mix(in srgb, var(--steel) 15%, transparent)' },
  leave:    { label: 'L', color: 'var(--danger)', bg: 'color-mix(in srgb, var(--danger) 15%, transparent)' },
};

export default function EmployeePayrollPage() {
  const { id } = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [jobsWorked, setJobsWorked] = useState<Job[]>([]);
  const [record, setRecord] = useState<PayrollRecord | null>(null);
  const [history, setHistory] = useState<PayrollRecord[]>([]);
  const [advances, setAdvances] = useState<PayrollAdjustment[]>([]);
  const [advanceInput, setAdvanceInput] = useState('');
  const [deductions, setDeductions] = useState<PayrollAdjustment[]>([]);
  const [deductionInput, setDeductionInput] = useState('');
  const [deductionNote, setDeductionNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [emp, att, rec, hist, jw] = await Promise.all([
      getEmployee(id), getAttendanceForMonth(id, month),
      getPayrollRecord(id, month), getPayrollHistory(id),
      getJobsForEmployee(id, 30).catch(() => [] as Job[]),
    ]);
    setEmployee(emp); setAttendance(att); setRecord(rec); setHistory(hist); setJobsWorked(jw);
    setAdvances(rec?.advances ?? []);
    setDeductions(rec?.deductions ?? []);
    setLoading(false);
  }, [id, month]);
  useEffect(() => { load().catch(() => setLoading(false)); }, [load]);

  const shiftMonth = (delta: number) =>
    setMonth(format(addMonths(new Date(`${month}-01T12:00:00`), delta), 'yyyy-MM'));

  const attMap = Object.fromEntries(attendance.map(a => [a.date, a]));
  const comp = employee ? computeMonth(employee.salary, attendance, month) : null;
  const net = comp ? netPayable(comp.baseAmount, advances, deductions) : 0;
  const isPaid = record?.status === 'paid';

  const cycleDay = async (date: string) => {
    if (!employee || isPaid) return;
    if (date > format(new Date(), 'yyyy-MM-dd')) return;
    const current = attMap[date]?.status ?? null;
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];
    // null → present → half → leave → (back to present; can't unset a record, mark leave instead)
    await overrideAttendanceStatus(
      { id: employee.id, name: employee.name }, date, next ?? 'present',
    );
    await load();
  };

  const addAdvance = () => {
    const amount = Number(advanceInput);
    if (!amount) return;
    setAdvances([...advances, { amount, date: format(new Date(), 'yyyy-MM-dd') }]);
    setAdvanceInput('');
  };

  const addDeduction = () => {
    const amount = Number(deductionInput);
    if (!amount) return;
    setDeductions([...deductions, {
      amount, date: format(new Date(), 'yyyy-MM-dd'),
      note: deductionNote.trim() || 'Deduction',
    }]);
    setDeductionInput('');
    setDeductionNote('');
  };

  const saveDraft = async () => {
    if (!employee || !comp) return;
    setBusy(true);
    try {
      await savePayrollDraft({
        employee: { id: employee.id, name: employee.name },
        month, computation: comp, advances, deductions,
      });
      toast.success('Draft saved');
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
    setBusy(false);
  };

  const settle = async (via: 'upi' | 'cash') => {
    if (!employee || !comp) return;
    setBusy(true);
    try {
      await savePayrollDraft({
        employee: { id: employee.id, name: employee.name },
        month, computation: comp, advances, deductions,
      });
      await markPayrollPaid(employee.id, month, via);
      toast.success(`Salary paid · ${via.toUpperCase()}`);
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
    setBusy(false);
  };

  if (loading) return <div className="p-8 flex justify-center"><div className="w-10 h-10 loader-ring" /></div>;
  if (!employee) return <div className="p-8 text-center font-body" style={{ color: 'var(--steel)' }}>Employee not found.</div>;

  const daysInMonth = getDaysInMonth(new Date(`${month}-01T12:00:00`));
  const firstDow = new Date(`${month}-01T12:00:00`).getDay();

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <Link href="/admin/employees" className="flex items-center gap-2 data-label mb-4" style={{ color: 'var(--steel)' }}>
        <ArrowLeft size={13} /> Employees
      </Link>

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display font-800 text-2xl" style={{ color: 'var(--chrome)' }}>{employee.name.toUpperCase()}</h1>
          <p className="text-sm font-body" style={{ color: 'var(--steel)' }}>
            {employee.role} · {employee.salary.type === 'monthly'
              ? `${formatCurrency(employee.salary.monthlyBase ?? 0)}/month`
              : `${formatCurrency(employee.salary.perDayRate ?? 0)}/day`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftMonth(-1)} className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: 'var(--dark)', color: 'var(--steel)' }}><ChevronLeft size={15} /></button>
          <span className="font-mono font-700 text-sm w-24 text-center" style={{ color: 'var(--chrome)' }}>
            {format(new Date(`${month}-01T12:00:00`), 'MMM yyyy')}
          </span>
          <button onClick={() => shiftMonth(1)} className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: 'var(--dark)', color: 'var(--steel)' }}><ChevronRight size={15} /></button>
        </div>
      </div>

      {/* Month hours - derived from the automatic shift timeline */}
      {attendance.length > 0 && (() => {
        const maths = attendance.map(a => shiftMath(a));
        const tot = (k: 'workedMin' | 'breakMin' | 'overtimeMin') =>
          maths.reduce((s, m) => s + m[k], 0);
        const lateDays = maths.filter(m => m.lateMin > 0).length;
        const h = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;
        return (
          <div className="card mb-5">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <p className="data-label" style={{ color: 'var(--steel)' }}>Hours · {month}</p>
              <button
                onClick={() => {
                  const blob = new Blob([attendanceCsv(attendance)], { type: 'text/csv' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = `hours-${employee?.name ?? id}-${month}.csv`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                }}
                className="btn-ghost flex items-center gap-1.5 px-3 py-2 text-xs">
                <ChevronRight size={12} className="rotate-90" /> Hours CSV
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Worked', value: h(tot('workedMin')) },
                { label: 'Breaks', value: h(tot('breakMin')) },
                { label: 'Overtime', value: h(tot('overtimeMin')) },
                { label: 'Late days', value: String(lateDays) },
              ].map(s => (
                <div key={s.label} className="p-3 rounded-xl" style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
                  <p className="font-mono font-700 text-base" style={{ color: 'var(--chrome)' }}>{s.value}</p>
                  <p className="text-[10px] font-body mt-0.5" style={{ color: 'var(--pewter)' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Attendance calendar */}
      <div className="card mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="data-label" style={{ color: 'var(--steel)' }}>
            Attendance - tap a day to cycle P → H → L
          </p>
          <div className="flex gap-3">
            {Object.entries(STATUS_META).map(([k, m]) => (
              <span key={k} className="data-label flex items-center gap-1" style={{ color: m.color }}>
                <span className="w-2 h-2 rounded-full" style={{ background: m.color }} /> {m.label}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="text-center data-label py-1" style={{ color: 'var(--steel)' }}>{d}</div>
          ))}
          {[...Array(firstDow)].map((_, i) => <div key={`pad-${i}`} />)}
          {[...Array(daysInMonth)].map((_, i) => {
            const day = i + 1;
            const date = `${month}-${String(day).padStart(2, '0')}`;
            const rec = attMap[date];
            const meta = rec ? STATUS_META[rec.status] : null;
            const future = date > format(new Date(), 'yyyy-MM-dd');
            return (
              <button key={date} onClick={() => cycleDay(date)} disabled={future || isPaid}
                className="aspect-square rounded-lg flex flex-col items-center justify-center"
                style={{
                  background: meta?.bg ?? 'var(--dark)',
                  border: '1px solid var(--border)',
                  opacity: future ? 0.3 : 1,
                }}>
                <span className="text-xs font-mono" style={{ color: meta?.color ?? 'var(--steel)' }}>{day}</span>
                {meta && <span className="data-label" style={{ color: meta.color, fontSize: 8 }}>{meta.label}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Salary computation */}
      {comp && (
        <div className="card mb-5">
          <p className="data-label mb-3" style={{ color: 'var(--steel)' }}>
            Salary - {format(new Date(`${month}-01T12:00:00`), 'MMMM yyyy')}
            {isPaid && <span className="ml-2" style={{ color: 'var(--success)' }}>SETTLED · {record?.paidVia?.toUpperCase()}</span>}
          </p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { l: 'Present', v: String(comp.daysPresent), c: 'var(--success)' },
              { l: 'Half days', v: String(comp.halfDays), c: 'var(--steel)' },
              { l: 'Leaves', v: String(comp.leaves), c: 'var(--danger)' },
            ].map(x => (
              <div key={x.l} className="card-dark py-3 text-center">
                <p className="font-display font-800 text-xl" style={{ color: x.c }}>{x.v}</p>
                <p className="data-label mt-0.5" style={{ color: 'var(--steel)' }}>{x.l}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2 text-sm font-body">
            <div className="flex justify-between">
              <span style={{ color: 'var(--steel)' }}>Base earned</span>
              <span className="font-mono" style={{ color: 'var(--chrome)' }}>{formatCurrency(comp.baseAmount)}</span>
            </div>
            {advances.map((a, i) => (
              <div key={i} className="flex justify-between">
                <span style={{ color: 'var(--danger)' }}>Advance ({a.date})</span>
                <span className="font-mono" style={{ color: 'var(--danger)' }}>−{formatCurrency(a.amount)}</span>
              </div>
            ))}
            {deductions.map((d, i) => (
              <div key={i} className="flex justify-between">
                <span style={{ color: 'var(--danger)' }}>{d.note ?? 'Deduction'}</span>
                <span className="font-mono" style={{ color: 'var(--danger)' }}>−{formatCurrency(d.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <span className="font-600" style={{ color: 'var(--chrome)' }}>Net payable</span>
              <span className="font-mono font-700 text-lg" style={{ color: 'var(--ember)' }}>{formatCurrency(net)}</span>
            </div>
          </div>

          {!isPaid && (
            <>
              <div className="flex gap-2 mt-4">
                <div className="relative flex-1">
                  <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--steel)' }} />
                  <input className="input pl-8 text-sm" inputMode="numeric" value={advanceInput}
                    onChange={e => setAdvanceInput(e.target.value.replace(/\D/g, ''))} placeholder="Record advance" />
                </div>
                <button onClick={addAdvance} className="btn-ghost px-4 flex items-center gap-1.5 text-sm">
                  <Plus size={13} /> Add
                </button>
              </div>
              <div className="flex gap-2 mt-2">
                <div className="relative w-32 shrink-0">
                  <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--steel)' }} />
                  <input className="input pl-8 text-sm" inputMode="numeric" value={deductionInput}
                    onChange={e => setDeductionInput(e.target.value.replace(/\D/g, ''))} placeholder="Deduct" />
                </div>
                <input className="input flex-1 text-sm" value={deductionNote} maxLength={60}
                  onChange={e => setDeductionNote(e.target.value)} placeholder="Reason (damage, uniform…)" />
                <button onClick={addDeduction} className="btn-ghost px-4 flex items-center gap-1.5 text-sm">
                  <Plus size={13} /> Add
                </button>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={saveDraft} disabled={busy} className="btn-ghost flex-1 py-3 text-sm">Save Draft</button>
                <button onClick={() => settle('cash')} disabled={busy} className="btn-ember flex-1 py-3 text-sm">
                  Paid Cash · {formatCurrency(net)}
                </button>
                <button onClick={() => settle('upi')} disabled={busy} className="btn-ember flex-1 py-3 text-sm">
                  Paid UPI · {formatCurrency(net)}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Payroll history */}
      {history.length > 0 && (
        <div className="card-dark">
          <p className="data-label mb-3" style={{ color: 'var(--steel)' }}>Payment history</p>
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="flex items-center gap-3 text-xs font-body">
                {h.status === 'paid'
                  ? <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />
                  : <span className="w-3 h-3 rounded-full" style={{ border: '1px solid var(--steel)' }} />}
                <span style={{ color: 'var(--chrome)' }}>{format(new Date(`${h.month}-01T12:00:00`), 'MMMM yyyy')}</span>
                <span style={{ color: 'var(--steel)' }}>{h.daysPresent}P · {h.halfDays}H · {h.leaves}L</span>
                <span className="ml-auto font-mono font-700" style={{ color: h.status === 'paid' ? 'var(--success)' : 'var(--steel)' }}>
                  {formatCurrency(h.netPayable)} {h.status === 'paid' ? `· ${h.paidVia?.toUpperCase()}` : '· draft'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Service performance - one card: per-category averages + wash detail */}
      {(() => {
        const cs = employeeCategoryStats(jobsWorked, id);
        const w = employeeWashStats(jobsWorked, id);
        if (!cs.jobsWorked) return null;
        return (
          <div className="card-dark mt-4">
            <p className="data-label mb-3" style={{ color: 'var(--steel)' }}>Service performance · last {jobsWorked.length} jobs</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ...cs.perCategory.map(c => ({
                  label: `Avg ${c.category.toLowerCase()} (${c.count})`,
                  value: fmtMin(c.avgWorkMin),
                })),
                { label: 'Jobs worked', value: String(cs.jobsWorked) },
                { label: 'Revenue handled', value: formatCurrency(cs.revenue) },
                ...(w.washesDone ? [
                  { label: 'Active wash time', value: fmtMin(w.activeWorkMin) },
                  { label: 'Completion rate', value: w.completionRate !== null ? `${w.completionRate}%` : '-' },
                ] : []),
              ].map(s => (
                <div key={s.label} className="p-3 rounded-xl" style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
                  <p className="font-mono font-700 text-base" style={{ color: 'var(--chrome)' }}>{s.value}</p>
                  <p className="text-[10px] font-body mt-0.5" style={{ color: 'var(--pewter)' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Jobs worked (assignment-based) */}
      {jobsWorked.length > 0 && (
        <div className="card-dark mt-4">
          <p className="data-label mb-3" style={{ color: 'var(--steel)' }}>Recent jobs worked · {jobsWorked.length}</p>
          <div className="space-y-2">
            {jobsWorked.slice(0, 15).map(j => (
              <div key={j.id} className="flex items-center gap-3 text-sm font-body">
                <span className="font-mono" style={{ color: 'var(--steel)' }}>{j.date}</span>
                <span style={{ color: 'var(--chrome)' }}>{j.vehicleName}</span>
                <span className="truncate" style={{ color: 'var(--steel)' }}>
                  {j.serviceItems.map(x => x.serviceName).join(', ')}
                </span>
                <span className="ml-auto font-mono" style={{ color: j.status === 'completed' ? 'var(--success)' : 'var(--steel)' }}>
                  {formatCurrency(j.totalAmount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
