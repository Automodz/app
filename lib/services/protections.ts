/**
 * THE PROTECTION COLLECTION (docs/AUTOMODZ-LIVING-STATES.md).
 *
 * Stored, never derived on read. Everything physical is created by a sealing
 * Visit; everything financial and legal is declared by the owner (or by the
 * studio on their behalf, at intake - the higher-yield path, since the papers
 * are usually in the glovebox).
 */
import {
  collection, doc, getDocs, setDoc, deleteDoc, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Protection, ProtectionKind, Service, Visit } from '../types';
import { liveProtection, protectionsFromVisit, sortByUrgency, type LiveProtection } from '../os/protection';
import { visitFromPair } from './visits';
import type { Booking, Job } from '../types';

/** Deterministic id: one live promise per kind per car, so re-coating replaces. */
const protectionId = (vehicleId: string, kind: ProtectionKind) => `${vehicleId}_${kind}`;

/* ── reading ────────────────────────────────────────────────────────────── */

/** Every promise shielding this car, most in need of attention first. */
export const getProtections = async (
  vehicleId: string,
  now?: Date,
): Promise<LiveProtection[]> => {
  const snap = await getDocs(
    query(collection(db, 'protections'), where('vehicleId', '==', vehicleId)),
  );
  const stored = snap.docs.map(d => ({ id: d.id, ...d.data() } as Protection));
  return sortByUrgency(stored.map(p => liveProtection(p, now)));
};

/* ── writing ────────────────────────────────────────────────────────────── */

/**
 * Store the promises a sealed Visit made. Idempotent: sealing twice writes
 * the same documents, so the migration and the live seal can both run.
 */
export const writeProtectionsFromVisit = async (visit: Visit, appliedOn: string) => {
  const rows = protectionsFromVisit(visit, appliedOn);
  await Promise.all(rows.map(p =>
    setDoc(
      doc(db, 'protections', protectionId(p.vehicleId, p.kind)),
      { ...p, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
      { merge: true },
    ),
  ));
  return rows.length;
};

/**
 * A promise AutoModz did not sell - insurance, PUC, RC, FASTag, a
 * manufacturer warranty. Entered by the owner or by the studio at intake,
 * so it is `declared`, never `captured`.
 */
export const declareProtection = async (
  p: Omit<Protection, 'id' | 'createdAt' | 'updatedAt' | 'termsSource'>,
) => {
  const id = protectionId(p.vehicleId, p.kind);
  await setDoc(
    doc(db, 'protections', id),
    { ...p, termsSource: 'declared', createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true },
  );
  return id;
};

export const removeProtection = (vehicleId: string, kind: ProtectionKind) =>
  deleteDoc(doc(db, 'protections', protectionId(vehicleId, kind)));

/* ── the one-time migration ─────────────────────────────────────────────── */

/**
 * Backfill a car's stored protections from the Booking + Job history it
 * already has. The catalogue is consulted HERE, once - the last moment that
 * inference is legitimate - and every term produced is flagged
 * `reconstructed` so a future reader can tell it apart from a term that was
 * captured at sale. After this, reconstruction is never permitted again
 * (VISIT-OBJECT.md §6).
 *
 * Returns what it wrote, so a caller can verify before trusting it.
 */
export const migrateVehicleProtections = async (args: {
  vehicleId: string;
  /** this vehicle's bookings, any status */
  bookings: Booking[];
  jobByBooking: Map<string, Job>;
  catalogue: Service[];
}): Promise<{ visits: number; protections: number }> => {
  const sealed = args.bookings
    .filter(b => b.status === 'completed' && b.vehicleId === args.vehicleId)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)); // oldest first: newest wins

  let protections = 0;
  for (const b of sealed) {
    const visit = visitFromPair(b, args.jobByBooking.get(b.id) ?? null, args.catalogue);
    if (!visit.termsCaptured.length) continue;
    protections += await writeProtectionsFromVisit(
      { ...visit, createdAt: b.createdAt, updatedAt: b.updatedAt } as Visit,
      b.scheduledDate,
    );
  }
  return { visits: sealed.length, protections };
};
