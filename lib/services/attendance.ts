import {
  collection, doc, setDoc, updateDoc, getDoc, getDocs,
  query, where, serverTimestamp, Timestamp, deleteField, arrayUnion,
} from 'firebase/firestore';
import { format, differenceInMinutes } from 'date-fns';
import { db } from '../firebase';
import type { AttendanceRecord, AttendanceStatus, AttendanceMeta, Employee } from '../types';

const todayStr = () => format(new Date(), 'yyyy-MM-dd');
const recordId = (date: string, employeeId: string) => `${date}_${employeeId}`;

/* ── Shift policy (studio hours are 9–7; grace before "late") ─────────── */
export const SHIFT_START = '09:00';
export const SHIFT_END = '19:00';
export const LATE_GRACE_MIN = 15;
const SHIFT_LEN_MIN = 10 * 60;

/** Thrown when an employee tries to check in after checkout - managers reopen. */
export class ShiftClosedError extends Error {
  constructor() { super('Shift already closed - ask a manager to reopen it.'); }
}

/** Best-effort device/GPS/IP capture. Never blocks or fails a check-in. */
export const captureAttendanceMeta = async (): Promise<AttendanceMeta> => {
  const meta: AttendanceMeta = {};
  try { meta.device = navigator.userAgent.slice(0, 160); } catch { /* SSR */ }
  try {
    const pos = await new Promise<GeolocationPosition>((res, rej) => {
      navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000, maximumAge: 60000 });
    });
    meta.lat = Number(pos.coords.latitude.toFixed(6));
    meta.lng = Number(pos.coords.longitude.toFixed(6));
    meta.accuracy = Math.round(pos.coords.accuracy);
  } catch { /* permission denied / timeout - attendance still records */ }
  try {
    const r = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
    if (r.ok) meta.ip = (await r.json()).ip;
  } catch { /* offline / blocked - fine */ }
  return meta;
};

/**
 * Check in. ONE check-in per day: a still-open record is returned as-is
 * (idempotent double-tap); a CLOSED record throws ShiftClosedError - only a
 * manager reopen clears it.
 */
export const checkIn = async (
  employee: Pick<Employee, 'id' | 'name'>,
  meta?: AttendanceMeta,
): Promise<AttendanceRecord> => {
  const date = todayStr();
  const id = recordId(date, employee.id);
  const ref = doc(db, 'attendance', id);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    const rec = { id, ...existing.data() } as AttendanceRecord;
    if (rec.checkOutAt) throw new ShiftClosedError();
    return rec;
  }
  await setDoc(ref, {
    employeeId: employee.id, employeeName: employee.name,
    date, checkInAt: serverTimestamp(), status: 'present',
    breaks: [],
    ...(meta && Object.keys(meta).length ? { checkInMeta: meta } : {}),
  });
  const snap = await getDoc(ref);
  return { id, ...snap.data() } as AttendanceRecord;
};

export const checkOut = async (employeeId: string) => {
  const id = recordId(todayStr(), employeeId);
  const ref = doc(db, 'attendance', id);
  const snap = await getDoc(ref);
  const rec = snap.data() as AttendanceRecord | undefined;
  // close any running break so durations stay truthful
  const breaks = (rec?.breaks ?? []).map(b => b.endAt ? b : { ...b, endAt: Timestamp.now() });
  await updateDoc(ref, { checkOutAt: serverTimestamp(), breaks });
};

/** Working → break. No-op if already on break or not checked in. */
export const startBreak = async (employeeId: string) => {
  const ref = doc(db, 'attendance', recordId(todayStr(), employeeId));
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const rec = snap.data() as AttendanceRecord;
  if (rec.checkOutAt || (rec.breaks ?? []).some(b => !b.endAt)) return;
  await updateDoc(ref, { breaks: arrayUnion({ startAt: Timestamp.now() }) });
};

/** Break → working. Closes the open break window. */
export const endBreak = async (employeeId: string) => {
  const ref = doc(db, 'attendance', recordId(todayStr(), employeeId));
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const rec = snap.data() as AttendanceRecord;
  const breaks = (rec.breaks ?? []).map(b => b.endAt ? b : { ...b, endAt: Timestamp.now() });
  await updateDoc(ref, { breaks });
};

/* ── Manager controls (audited) ───────────────────────────────────────── */

export const reopenAttendance = async (rec: AttendanceRecord, by: { id: string; name: string }) =>
  updateDoc(doc(db, 'attendance', rec.id), {
    checkOutAt: deleteField(),
    reopenedById: by.id, reopenedByName: by.name,
  });

export const forceCheckOut = async (rec: AttendanceRecord, by: { id: string; name: string }) => {
  const breaks = (rec.breaks ?? []).map(b => b.endAt ? b : { ...b, endAt: Timestamp.now() });
  await updateDoc(doc(db, 'attendance', rec.id), {
    checkOutAt: serverTimestamp(), breaks,
    forcedOutById: by.id, forcedOutByName: by.name,
  });
};

/** Correct in/out times (HH:mm on the record's own date). */
export const correctAttendanceTimes = async (
  rec: AttendanceRecord,
  times: { checkIn?: string; checkOut?: string },
  by: { id: string; name: string },
) => {
  const at = (hhmm: string) => Timestamp.fromDate(new Date(`${rec.date}T${hhmm}:00`));
  const update: Record<string, unknown> = { editedById: by.id, editedByName: by.name };
  if (times.checkIn) update.checkInAt = at(times.checkIn);
  if (times.checkOut) update.checkOutAt = at(times.checkOut);
  await updateDoc(doc(db, 'attendance', rec.id), update);
};

/* ── Reads ────────────────────────────────────────────────────────────── */

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

/* ── Pure shift math (derived, never stored) ──────────────────────────── */

export interface ShiftMath {
  onBreak: boolean;
  breakMin: number;
  /** minutes actually worked (span − breaks; live for open shifts) */
  workedMin: number;
  lateMin: number;      // 0 when on time (grace applied)
  overtimeMin: number;  // worked beyond the 10h shift
}

export const shiftMath = (rec: AttendanceRecord, now = new Date()): ShiftMath => {
  const inAt = rec.checkInAt?.toDate?.();
  const outAt = rec.checkOutAt?.toDate?.() ?? now;
  const breaks = rec.breaks ?? [];
  const onBreak = !rec.checkOutAt && breaks.some(b => !b.endAt);
  const breakMin = breaks.reduce((s, b) => {
    const st = b.startAt?.toDate?.(); if (!st) return s;
    const en = b.endAt?.toDate?.() ?? now;
    return s + Math.max(0, differenceInMinutes(en, st));
  }, 0);
  const spanMin = inAt ? Math.max(0, differenceInMinutes(outAt, inAt)) : 0;
  const workedMin = Math.max(0, spanMin - breakMin);
  const shiftStart = inAt ? new Date(`${rec.date}T${SHIFT_START}:00`) : null;
  const lateMin = inAt && shiftStart
    ? Math.max(0, differenceInMinutes(inAt, shiftStart) - LATE_GRACE_MIN)
    : 0;
  const overtimeMin = Math.max(0, workedMin - SHIFT_LEN_MIN);
  return { onBreak, breakMin, workedMin, lateMin, overtimeMin };
};

/** CSV rows for a month of records - payroll hours export. */
export const attendanceCsv = (records: AttendanceRecord[]): string => {
  const fmt = (ts?: Timestamp) => ts?.toDate ? format(ts.toDate(), 'HH:mm') : '';
  const rows = [
    ['Date', 'Employee', 'Status', 'In', 'Out', 'Break (min)', 'Worked (min)', 'Late (min)', 'Overtime (min)'],
    ...records.map(r => {
      const m = shiftMath(r);
      return [r.date, r.employeeName, r.status, fmt(r.checkInAt), fmt(r.checkOutAt),
        String(m.breakMin), String(m.workedMin), String(m.lateMin), String(m.overtimeMin)];
    }),
  ];
  return rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
};
