import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, serverTimestamp, query, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Vehicle } from '../types';

export const addVehicle = async (uid: string, v: Omit<Vehicle, 'id' | 'createdAt'>) => {
  const r = await addDoc(collection(db, 'users', uid, 'vehicles'), {
    ...v, createdAt: serverTimestamp(),
  });
  return r.id;
};

export const getVehicles = async (uid: string): Promise<Vehicle[]> => {
  const snap = await getDocs(collection(db, 'users', uid, 'vehicles'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle));
};

export const updateVehicle = (uid: string, vid: string, data: Partial<Vehicle>) =>
  updateDoc(doc(db, 'users', uid, 'vehicles', vid), data);

export const deleteVehicle = (uid: string, vid: string) =>
  deleteDoc(doc(db, 'users', uid, 'vehicles', vid));
/* ── Vehicle 360 — everything ever done to one car, keyed by reg no ──
   Single-equality queries only (no composite indexes needed); sorted client-side. */

import type { Booking, Invoice, Job } from '../types';

const normReg = (reg: string) => reg.replace(/\s+/g, '').toUpperCase();

export const getJobsForVehicle = async (regNo: string): Promise<Job[]> => {
  const snap = await getDocs(query(collection(db, 'jobs'), where('vehicleRegNo', '==', normReg(regNo))));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Job))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
};

export const getBookingsForVehicle = async (regNo: string): Promise<Booking[]> => {
  const snap = await getDocs(query(collection(db, 'bookings'), where('vehicleRegNo', '==', normReg(regNo))));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
};

export const getInvoicesForVehicle = async (regNo: string): Promise<Invoice[]> => {
  const snap = await getDocs(query(collection(db, 'invoices'), where('vehicleRegNo', '==', normReg(regNo))));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
};
