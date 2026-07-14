import {
  doc, setDoc, getDoc, getDocs, updateDoc, collection, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { netPayable, type MonthComputation } from './payrollMath';
import type { PayrollRecord, PayrollAdjustment, Employee } from '../types';

export * from './payrollMath';

// ── Firestore ────────────────────────────────────────────────────────────────

const recordId = (month: string, employeeId: string) => `${month}_${employeeId}`;

export const getPayrollRecord = async (employeeId: string, month: string): Promise<PayrollRecord | null> => {
  const snap = await getDoc(doc(db, 'payroll', recordId(month, employeeId)));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as PayrollRecord) : null;
};

export const savePayrollDraft = async (data: {
  employee: Pick<Employee, 'id' | 'name'>;
  month: string;
  computation: MonthComputation;
  advances: PayrollAdjustment[];
  deductions: PayrollAdjustment[];
}): Promise<PayrollRecord> => {
  const id = recordId(data.month, data.employee.id);
  const existing = await getDoc(doc(db, 'payroll', id));
  if (existing.exists() && (existing.data() as PayrollRecord).status === 'paid') {
    throw new Error('This month is already settled');
  }
  const record = {
    employeeId: data.employee.id, employeeName: data.employee.name,
    month: data.month,
    daysPresent: data.computation.daysPresent,
    halfDays: data.computation.halfDays,
    leaves: data.computation.leaves,
    baseAmount: data.computation.baseAmount,
    advances: data.advances, deductions: data.deductions,
    netPayable: netPayable(data.computation.baseAmount, data.advances, data.deductions),
    status: 'draft' as const,
    updatedAt: serverTimestamp(),
    ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
  };
  await setDoc(doc(db, 'payroll', id), record, { merge: true });
  const snap = await getDoc(doc(db, 'payroll', id));
  return { id, ...snap.data() } as PayrollRecord;
};

export const markPayrollPaid = (employeeId: string, month: string, paidVia: 'upi' | 'cash') =>
  updateDoc(doc(db, 'payroll', recordId(month, employeeId)), {
    status: 'paid', paidVia, paidAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });

export const getPayrollHistory = async (employeeId: string): Promise<PayrollRecord[]> => {
  const snap = await getDocs(query(collection(db, 'payroll'), where('employeeId', '==', employeeId)));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as PayrollRecord))
    .sort((a, b) => b.month.localeCompare(a.month));
};
