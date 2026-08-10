import {
  collection, doc, addDoc, updateDoc, deleteDoc, deleteField,
  getDocs, serverTimestamp, query, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Vehicle } from '../types';

/**
 * `undefined` IS A VALUE THE FORM CAN PRODUCE AND FIRESTORE CANNOT STORE.
 *
 * The car form has optional fields — the odometer, the year — and clearing one
 * means "remove this", not "write nothing". Firestore rejects `undefined`
 * outright on a write, so a customer emptying their odometer would have got a
 * failed save with no explanation. On a create the key is simply dropped; on
 * an update it becomes `deleteField()`, which is the difference between a car
 * that never had an odometer and one whose owner took it back.
 */
const forCreate = <T extends object>(v: T) =>
  Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined));

const forUpdate = <T extends object>(v: T) =>
  Object.fromEntries(
    Object.entries(v).map(([k, x]) => [k, x === undefined ? deleteField() : x]),
  );

export const addVehicle = async (uid: string, v: Omit<Vehicle, 'id' | 'createdAt'>) => {
  const r = await addDoc(collection(db, 'users', uid, 'vehicles'), {
    ...forCreate(v), createdAt: serverTimestamp(),
  });
  return r.id;
};

export const getVehicles = async (uid: string): Promise<Vehicle[]> => {
  const snap = await getDocs(collection(db, 'users', uid, 'vehicles'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle));
};

export const updateVehicle = (uid: string, vid: string, data: Partial<Vehicle>) =>
  updateDoc(doc(db, 'users', uid, 'vehicles', vid), forUpdate(data));

export const deleteVehicle = (uid: string, vid: string) =>
  deleteDoc(doc(db, 'users', uid, 'vehicles', vid));
/* ── Vehicle 360 — everything ever done to one car, keyed by VEHICLE ID ──
   These read by `vehicleId`, never by registration. A plate is a display
   snapshot: mistyped, reissued, transferred between cars. Joining on one put a
   "Honda City" booking in the BMW's room in production. §P1.6 — a registration
   may never establish ownership, and §P1.10 applies the same rule to the
   studio's own Vehicle-360 as to the customer's garage.

   `normReg` remains below for DISPLAY and duplicate-registration diagnostics
   only (§P1.8). Single-equality queries, sorted client-side. */

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
export const getJobsForVehicle = async (vehicleId: string, uid?: string): Promise<Job[]> => {
  const snap = await getDocs(query(
    collection(db, 'jobs'),
    ...(uid ? [where('customerId', '==', uid)] : []),
    where('vehicleId', '==', vehicleId),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Job))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
};

/** Scoped by owner for the same reason as `getJobsForVehicle` above: the rule
 *  grants read on `userId == uid`, so the query must not be able to match a
 *  document belonging to anyone else - a plate that passes between two
 *  customers is exactly the case that would otherwise deny the whole read. */
export const getBookingsForVehicle = async (vehicleId: string, uid?: string): Promise<Booking[]> => {
  const snap = await getDocs(query(
    collection(db, 'bookings'),
    ...(uid ? [where('userId', '==', uid)] : []),
    where('vehicleId', '==', vehicleId),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
};

/** Same scoping; the invoices rule grants read on `customerId == uid`. */
export const getInvoicesForVehicle = async (vehicleId: string, uid?: string): Promise<Invoice[]> => {
  const snap = await getDocs(query(
    collection(db, 'invoices'),
    ...(uid ? [where('customerId', '==', uid)] : []),
    where('vehicleId', '==', vehicleId),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
};

/* ── PUBLIC HISTORY CONSENT ─────────────────────────────────────────────── */

/**
 * Grant or revoke permission to show this car's service history publicly.
 *
 * Two writes in one batch: the flag the projection reads, and a permanent log
 * entry. The log is what answers "was this public on the day that buyer saw
 * it" — a boolean cannot, because it only knows the present.
 *
 * ONLY THE OWNER. `uid` scopes the path, so a caller cannot consent on behalf
 * of anyone else; the rules enforce the same thing server-side. The studio has
 * no way in here at all, which is deliberate — see lib/os/consent.ts.
 */
export const setPublicHistoryConsent = async (
  uid: string, vid: string, granted: boolean,
) => {
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid, 'vehicles', vid), {
    publicHistoryConsent: {
      granted,
      /* Both stamps are kept. Clearing the other one on each change would
         destroy the history the log exists to preserve. */
      ...(granted ? { grantedAt: serverTimestamp() } : { revokedAt: serverTimestamp() }),
    },
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(collection(db, 'users', uid, 'vehicles', vid, 'consentLog')), {
    kind: 'publicHistory',
    action: granted ? 'granted' : 'revoked',
    byUid: uid,
    at: serverTimestamp(),
  });
  await batch.commit();
};

/* ── THE PLATE SEARCH — a diagnostic, never an ownership claim ──────────── */

/**
 * Everything the studio has ever done under one registration.
 *
 * This DOES read by plate, and that is correct here for a reason the
 * ownership readers above do not share: a walk-in job has no `vehicleId`,
 * because the car was never in anyone's garage. The studio still worked on it,
 * still holds photographs of it, and still needs to find that record when the
 * same car returns. Fifteen of eighteen production jobs are exactly this.
 *
 * §P1.8 — a registration may be used for SEARCH and DIAGNOSIS. What it may
 * never do is establish ownership, which is why this function is named for
 * what it is and returns records without asserting whose they are. A caller
 * that wants "this customer's car" must use `getJobsForVehicle(vehicleId)`.
 *
 * Staff only: it deliberately crosses customer boundaries, which is the whole
 * point of a plate search at the counter, and is why no customer surface may
 * call it.
 */
export const findJobsByPlate = async (regNo: string): Promise<Job[]> => {
  const snap = await getDocs(query(
    collection(db, 'jobs'),
    where('vehicleRegNo', '==', normReg(regNo)),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Job))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
};

export const findBookingsByPlate = async (regNo: string): Promise<Booking[]> => {
  const snap = await getDocs(query(
    collection(db, 'bookings'),
    where('vehicleRegNo', '==', normReg(regNo)),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
};

export const findInvoicesByPlate = async (regNo: string): Promise<Invoice[]> => {
  const snap = await getDocs(query(
    collection(db, 'invoices'),
    where('vehicleRegNo', '==', normReg(regNo)),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
};
