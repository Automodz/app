import {
  collection, doc, addDoc, updateDoc,
  getDocs, getDoc, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { sha256Hex } from '../utils';
import type { Employee, EmployeeRole, EmployeeSalaryConfig } from '../types';

export const createEmployee = async (data: {
  name: string; phone: string; email?: string; role: EmployeeRole;
  pin: string; salary: EmployeeSalaryConfig; joinedAt: string;
}) => {
  const { pin, ...rest } = data;
  const pinHash = await sha256Hex(pin);
  const r = await addDoc(collection(db, 'employees'), {
    ...rest, pinHash, active: true,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return r.id;
};

export const updateEmployee = (id: string, data: Partial<Omit<Employee, 'id' | 'pinHash' | 'createdAt'>>) =>
  updateDoc(doc(db, 'employees', id), { ...data, updatedAt: serverTimestamp() });

export const deactivateEmployee = (id: string) =>
  updateDoc(doc(db, 'employees', id), { active: false, updatedAt: serverTimestamp() });

export const reactivateEmployee = (id: string) =>
  updateDoc(doc(db, 'employees', id), { active: true, updatedAt: serverTimestamp() });

export const resetPin = async (id: string, newPin: string) => {
  const pinHash = await sha256Hex(newPin);
  await updateDoc(doc(db, 'employees', id), { pinHash, updatedAt: serverTimestamp() });
};

export const listEmployees = async (includeInactive = false): Promise<Employee[]> => {
  const base = collection(db, 'employees');
  const snap = includeInactive
    ? await getDocs(base)
    : await getDocs(query(base, where('active', '==', true)));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Employee))
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const getEmployee = async (id: string): Promise<Employee | null> => {
  const snap = await getDoc(doc(db, 'employees', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Employee) : null;
};

/** Verify a kiosk PIN against the stored hash. Returns true on match. */
export const verifyPin = async (employee: Employee, pin: string): Promise<boolean> => {
  const hash = await sha256Hex(pin);
  return hash === employee.pinHash;
};
