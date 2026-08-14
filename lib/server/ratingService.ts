import 'server-only';
/**
 * RATING A VISIT - design screen 13's "Rate this visit".
 *
 * ── IT ATTACHES TO THE SEALED VISIT, AND TO NOTHING ELSE ─────────────────
 * The old rating hung off the PUBLIC invoice. Two things followed, and both
 * were wrong: anybody holding a shared invoice link could rate somebody else's
 * work, and a visit with no invoice - which is most of them - could not be
 * rated at all.
 *
 * ── ONCE IS STRUCTURAL, NOT A CHECK ──────────────────────────────────────
 * The document id IS the visit id. Rating twice is not something this has to
 * detect; it is not representable. A `create` that finds the document already
 * there is refused by Firestore itself.
 *
 * ── AND IT NEVER TOUCHES THE VISIT ───────────────────────────────────────
 * A sealed visit is permanent (§16.2). The opinion lives beside the record,
 * never inside it, so no rating can alter what the studio promised or what the
 * customer paid.
 */
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin';
import { canRate, type RatingRefusal } from '@/lib/os/settlement';
import type { Rating, Visit } from '@/lib/types';

export class RatingError extends Error {
  constructor(readonly code: RatingRefusal | string, readonly status = 409) {
    super(code);
  }
}

export async function rateVisit(
  callerUid: string,
  visitId: string,
  rating: number,
  comment?: string,
): Promise<Rating> {
  if (!adminDb) throw new RatingError('not-configured', 503);
  const db = adminDb;

  const visitSnap = await db.collection('visits').doc(visitId).get();
  const visit = visitSnap.exists
    ? ({ id: visitSnap.id, ...(visitSnap.data() as object) } as Visit) : null;

  /* OWNERSHIP IS THE VEHICLE'S. A visit carries no customer field - it is
     keyed by `vehicleId`, and vehicles live under their owner - so this is the
     same lookup the rules use, and there is no owner field to forge. */
  const ownsVehicle = !!visit && (
    await db.doc(`users/${callerUid}/vehicles/${visit.vehicleId}`).get()
  ).exists;

  const existing = await db.collection('ratings').doc(visitId).get();

  const verdict = canRate({
    visit,
    ownsVehicle,
    alreadyRated: existing.exists,
    rating,
  });
  if (!verdict.ok) {
    throw new RatingError(verdict.reason, verdict.reason === 'not-yours' ? 404 : 409);
  }

  const record = {
    visitId,
    customerId: callerUid,
    vehicleId: visit!.vehicleId,
    rating,
    ...(comment?.trim() ? { comment: comment.trim().slice(0, 1000) } : {}),
  };

  /* `create`, never `set`. A second rating is refused by the database rather
     than by a check that could race with itself. */
  await db.collection('ratings').doc(visitId).create({
    ...record,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { id: visitId, ...record, createdAt: Timestamp.now() } as unknown as Rating;
}

/** Which of this customer's visits already carry an opinion. */
export async function ratingsForCustomer(uid: string): Promise<Rating[]> {
  if (!adminDb) return [];
  const snap = await adminDb.collection('ratings').where('customerId', '==', uid).get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as object) }) as Rating);
}
