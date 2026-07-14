import {
  collection, doc, setDoc, updateDoc, getDoc, getDocs,
  query, where, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { db } from '../firebase';
import type { AttendanceRecord, AttendanceStatus, Employee } from '../types';

const todayStr = () => format(new Date(), 'yyyy-MM-dd');
const recordId = (date: string, employeeId: string) => `${date}_${employeeId}`;

/** Idempotent check-in - deterministic doc ID means a second tap is a no-op. */
export const checkIn = async (employee: Pick<Employee, 'id' | 'name'>): Promise<AttendanceRecord> => {
  const date = todayStr();
  const id = recordId(date, employee.id);
  const ref = doc(db, 'attendance', id);
  const existing = await getDoc(ref);
  if (existing.exists()) return { id, ...existing.data() } as AttendanceRecord;
  await setDoc(ref, {
    employeeId: employee.id, employeeName: employee.name,
    date, checkInAt: serverTimestamp(), status: 'present',
  });
  const snap = await getDoc(ref);
  return { id, ...snap.data() } as AttendanceRecord;
};

export const checkOut = async (employeeId: string) => {
  const id = recordId(todayStr(), employeeId);
  await updateDoc(doc(db, 'attendance', id), { checkOutAt: serverTimestamp() });
};

export const getTodayAttendance = async (): Promise<AttendanceRecord[]> => {
  const snap = await getDocs(query(collection(db, 'attendance'), where('date', '==', todayStr())));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
};

/** month = YYYY-MM */
export const getAttendanceForMonth = async (employeeId: string, month: string): Promise<AttendanceRecord[]> => {
  const snap = await getDocs(query(
    collection(db, 'attendance'),
    where('employeeId', '==', employeeId),
    where('date', '>=', `${month}-01`),
    where('date', '<=', `${month}-31`),
  ));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as AttendanceRecord))
    .sort((a, b) => a.date.localeCompare(b.date));
};

export const getPresentTodayCount = async (): Promise<number> => {
  const records = await getTodayAttendance();
  return records.filter(r => r.status !== 'leave').length;
};

/** Owner override - mark half-day/leave or fix a missed check-in (creates the doc if needed). */
export const overrideAttendanceStatus = async (
  employee: Pick<Employee, 'id' | 'name'>, date: string, status: AttendanceStatus, note?: string,
) => {
  const id = recordId(date, employee.id);
  const ref = doc(db, 'attendance', id);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    await updateDoc(ref, { status, ...(note ? { note } : {}) });
  } else {
    await setDoc(ref, {
      employeeId: employee.id, employeeName: employee.name,
      date, checkInAt: Timestamp.now(), status, ...(note ? { note } : {}),
    });
  }
};
