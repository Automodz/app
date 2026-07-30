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
/* ── Vehicle 360 - everything ever done to one car, keyed by reg no ──
   Single-equality queries only (no composite indexes needed); sorted client-side. */

import type { Booking, Invoice, Job } from '../types';

const normReg = (reg: string) => reg.replace(/\s+/g, '').toUpperCase();

/**
 * OWNERSHIP IS PART OF THE QUERY, NOT ONLY OF THE RULE.
 *
 * `jobs` read is granted on `resource.data.customerId == uid`, and that field is
 * OPTIONAL - a walk-in job, or one whose phone never matched an account, has
 * none. Filtering by plate alone therefore returned documents the caller could
 * not read, and Firestore denies the whole query when any matched document
 * fails, so one unlinked job on a plate broke every read for that car.
 *
 * Passing `uid` makes the rule provably satisfiable for every document
 * returned: an unlinked job simply is not this customer's job and does not
 * appear. Two equality filters are served by merging single-field indexes, so no
 * composite index is required.
 *
 * `uid` is OPTIONAL because staff read the same collections under a different
 * rule (`isStaff()`, which grants all) - the admin vehicle page must keep seeing
 * every job on a plate, including walk-ins that belong to no account. A customer
 * surface must always pass it.
 */
export const getJobsForVehicle = async (regNo: string, uid?: string): Promise<Job[]> => {
  const snap = await getDocs(query(
    collection(db, 'jobs'),
    ...(uid ? [where('customerId', '==', uid)] : []),
    where('vehicleRegNo', '==', normReg(regNo)),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Job))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
};

/** Scoped by owner for the same reason as `getJobsForVehicle` above: the rule
 *  grants read on `userId == uid`, so the query must not be able to match a
 *  document belonging to anyone else - a plate that passes between two
 *  customers is exactly the case that would otherwise deny the whole read. */
export const getBookingsForVehicle = async (regNo: string, uid?: string): Promise<Booking[]> => {
  const snap = await getDocs(query(
    collection(db, 'bookings'),
    ...(uid ? [where('userId', '==', uid)] : []),
    where('vehicleRegNo', '==', normReg(regNo)),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
};

/** Same scoping; the invoices rule grants read on `customerId == uid`. */
export const getInvoicesForVehicle = async (regNo: string, uid?: string): Promise<Invoice[]> => {
  const snap = await getDocs(query(
    collection(db, 'invoices'),
    ...(uid ? [where('customerId', '==', uid)] : []),
    where('vehicleRegNo', '==', normReg(regNo)),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
};
