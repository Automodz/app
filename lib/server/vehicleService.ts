import 'server-only';
/**
 * THE GARAGE — the only thing that may put a car in one.
 *
 * ── THE HOLE THIS CLOSES, AND IT IS THE WORST ONE IN THE PRODUCT ─────────
 * A vehicle document lives at `users/{uid}/vehicles/{vehicleId}`, and
 * `firestore.rules` let a customer write anything under their own uid. That
 * reads as obviously safe — it is their own subtree — and it was not, because
 * `ownsVehicle()` is the OWNERSHIP PRIMITIVE for four collections:
 *
 *     protections   read if ownsVehicle(resource.data.vehicleId)
 *     visits        read if ownsVehicle(resource.data.vehicleId)
 *     declarations  read if ownsVehicle(resource.data.vehicleId)
 *
 * The check is `exists(users/{me}/vehicles/{thatId})`. So a customer who knew
 * ANOTHER customer's vehicle id could create an empty document at that id
 * under their own uid — a write the rules allowed — and immediately read that
 * car's protections, its whole service history with the studio's stage notes
 * and photographs, and its declared certificates. Squatting an id was an
 * ownership claim.
 *
 * And vehicle ids are not secret. They travel in the customer's own addresses
 * — `/vehicle?car=<id>`, `/history?car=<id>` — so they are in browser history,
 * in screenshots, and in any link anybody shares.
 *
 * ── THE FIX IS THAT THE ID IS NOT THE CLIENT'S TO CHOOSE ─────────────────
 * The server allocates it. A browser can no longer name the document it is
 * creating, so it cannot name somebody else's, and `ownsVehicle` becomes a
 * claim only the server can have made.
 *
 * Everything else here is what the form already did, moved behind the same
 * door: the duplicate-plate check (a customer with two records for one car has
 * two histories for one car), the normalisation, and the removal of a field
 * the customer emptied.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin';
import type { Vehicle } from '@/lib/types';

export class VehicleError extends Error {
  constructor(readonly code: string, readonly status = 409) {
    super(code);
  }
}

const db = () => {
  if (!adminDb) throw new VehicleError('not-configured', 503);
  return adminDb;
};

/** One plate, one shape — so two spellings of one car cannot both exist. */
export const normalisePlate = (s: string) =>
  (s ?? '').toUpperCase().replace(/\s+/g, ' ').trim();

/**
 * WHAT A CUSTOMER MAY SAY ABOUT THEIR OWN CAR.
 *
 * Five fields, and no others are read off the request — not `createdAt`, not
 * `photo`, not anything a later feature adds. A field the customer cannot
 * legitimately author is a field the server must not accept.
 */
export interface CarIntent {
  name?: unknown;
  registrationNumber?: unknown;
  year?: unknown;
  odometer?: unknown;
  color?: unknown;
}

export type CarRefusal =
  | 'name-required' | 'registration-required' | 'registration-taken'
  | 'not-found' | 'colour-too-long';

const digits = (v: unknown): number | undefined => {
  const n = Number(String(v ?? '').replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

interface CleanCar {
  name: string;
  registrationNumber: string;
  year?: number;
  odometer?: number;
  color?: string;
}

function validate(input: CarIntent | null): CleanCar {
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  if (name.length < 2) throw new VehicleError('name-required', 400);

  const registrationNumber = normalisePlate(
    typeof input?.registrationNumber === 'string' ? input.registrationNumber : '',
  );
  if (registrationNumber.length < 4) throw new VehicleError('registration-required', 400);

  const color = typeof input?.color === 'string' ? input.color.trim() : '';
  if (color.length > 40) throw new VehicleError('colour-too-long', 400);

  return {
    name: name.slice(0, 80),
    registrationNumber: registrationNumber.slice(0, 20),
    year: digits(input?.year),
    odometer: digits(input?.odometer),
    ...(color ? { color } : {}),
  };
}

/** A field the customer emptied is REMOVED, not left standing at its old value. */
const withRemovals = (c: CleanCar) => ({
  name: c.name,
  registrationNumber: c.registrationNumber,
  year: c.year ?? FieldValue.delete(),
  odometer: c.odometer ?? FieldValue.delete(),
  color: c.color ?? FieldValue.delete(),
});

export interface CarResult {
  vehicleId: string;
  name: string;
  registrationNumber: string;
}

/**
 * Put a car in this customer's garage. THE SERVER ALLOCATES THE ID.
 *
 * `uid` MUST come from a verified session; it is the only thing that decides
 * whose garage this is.
 */
export async function addCar(uid: string, input: CarIntent | null): Promise<CarResult> {
  const clean = validate(input);
  const garage = db().collection(`users/${uid}/vehicles`);

  /* A customer with two records for one car has two histories for one car. */
  const existing = await garage.get();
  if (existing.docs.some(d =>
    normalisePlate((d.data() as Partial<Vehicle>).registrationNumber ?? '') === clean.registrationNumber)) {
    throw new VehicleError('registration-taken', 409);
  }

  /* `.doc()` with no argument — the id is Firestore's, never the caller's.
     That single line is what closes the squatting hole. */
  const ref = garage.doc();
  await ref.set({
    ...clean,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { vehicleId: ref.id, name: clean.name, registrationNumber: clean.registrationNumber };
}

/** Correct a car already in this customer's garage. */
export async function correctCar(
  uid: string, vehicleId: unknown, input: CarIntent | null,
): Promise<CarResult> {
  const id = typeof vehicleId === 'string' ? vehicleId.trim() : '';
  if (!id) throw new VehicleError('not-found', 404);
  const clean = validate(input);

  const ref = db().doc(`users/${uid}/vehicles/${id}`);
  const snap = await ref.get();
  /* Under this uid, or not at all. There is no ownership field to compare and
     so nothing for a caller to set. */
  if (!snap.exists) throw new VehicleError('not-found', 404);

  const siblings = await db().collection(`users/${uid}/vehicles`).get();
  if (siblings.docs.some(d =>
    d.id !== id
    && normalisePlate((d.data() as Partial<Vehicle>).registrationNumber ?? '') === clean.registrationNumber)) {
    throw new VehicleError('registration-taken', 409);
  }

  await ref.update({ ...withRemovals(clean), updatedAt: FieldValue.serverTimestamp() });
  return { vehicleId: id, name: clean.name, registrationNumber: clean.registrationNumber };
}
