// Pure payroll math - no Firebase imports, unit-testable.
import { getDaysInMonth } from 'date-fns';
import type { Employee, AttendanceRecord, PayrollAdjustment } from '../types';

export interface MonthComputation {
  daysPresent: number;
  halfDays: number;
  leaves: number;
  baseAmount: number;
}

/**
 * monthly: base × (present + half×0.5) / days-in-month (pro-rata on attendance)
 * per_day: rate × (present + half×0.5)
 */
export const computeMonth = (
  salary: Employee['salary'],
  attendance: Pick<AttendanceRecord, 'status'>[],
  month: string, // YYYY-MM
): MonthComputation => {
  const daysPresent = attendance.filter(a => a.status === 'present').length;
  const halfDays = attendance.filter(a => a.status === 'half_day').length;
  const leaves = attendance.filter(a => a.status === 'leave').length;
  const effectiveDays = daysPresent + halfDays * 0.5;

  let baseAmount = 0;
  if (salary.type === 'per_day') {
    baseAmount = Math.round((salary.perDayRate ?? 0) * effectiveDays);
  } else {
    const daysInMonth = getDaysInMonth(new Date(`${month}-01T12:00:00`));
    baseAmount = Math.round((salary.monthlyBase ?? 0) * Math.min(1, effectiveDays / daysInMonth));
  }
  return { daysPresent, halfDays, leaves, baseAmount };
};

export const netPayable = (base: number, advances: PayrollAdjustment[], deductions: PayrollAdjustment[]) =>
  Math.max(0, base
    - advances.reduce((s, a) => s + a.amount, 0)
    - deductions.reduce((s, d) => s + d.amount, 0));
