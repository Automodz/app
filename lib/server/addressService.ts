import 'server-only';
/**
 * SAVED PICKUP AND DROP ADDRESSES — `users/{uid}/addresses/{id}`.
 *
 * ── WHY THE SERVER OWNS EVERY WRITE ──────────────────────────────────────
 * Two of the three rules here cannot be expressed in Firestore rules at all:
 *
 *   · EXACTLY ONE DEFAULT. Making one address the default must un-default the
 *     others, and that is a write to documents the request never named. A
 *     client doing it in two writes leaves two defaults the moment one fails.
 *   · AN ADDRESS AN ACTIVE BOOKING RELIES ON IS NOT DELETABLE. Rules cannot
 *     query, so they cannot know whether a van is due at that door on Tuesday.
 *
 * So this is the only door, and `firestore.rules` closes the direct one.
 * Reading stays owner-scoped in rules, because a read has nothing to enforce
 * beyond ownership and the subcollection gives that structurally.
 *
 * ── THE BOOKING NEVER HOLDS A REFERENCE ──────────────────────────────────
 * `snapshotOf` produces the frozen copy a booking carries. Editing a saved
 * address afterwards changes where the NEXT van goes and can never rewrite
 * where the last one went.
 */
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin';
import { checkAddress, fullAddress, type AddressInput } from '@/lib/os/address';
import type { SavedAddress } from '@/lib/types';

export class AddressError extends Error {
  constructor(readonly code: string, readonly status = 400) {
    super(code);
  }
}

/** Enough addresses for a person, few enough that nobody is storing a mailing list. */
export const MAX_ADDRESSES = 8;

const collection = (uid: string) => adminDb!.collection('users').doc(uid).collection('addresses');

export async function listAddresses(uid: string): Promise<SavedAddress[]> {
  if (!adminDb) return [];
  const snap = await collection(uid).get();
  return snap.docs
    .map(d => ({ id: d.id, ...(d.data() as object) }) as SavedAddress)
    /* Default first, then alphabetically — a stable order, so the chip a
       customer tapped last time is where they left it. */
    .sort((a, b) =>
      Number(b.isDefault) - Number(a.isDefault)
      || String(a.label).localeCompare(String(b.label)));
}

/**
 * The frozen copy a booking carries.
 *
 * `line` is assembled from the parts rather than stored a second time on the
 * address itself, so a corrected pincode cannot leave a stale sentence behind
 * it — and the snapshot keeps the parts too, because a driver needs them.
 */
export function snapshotOf(a: SavedAddress) {
  return {
    addressId: a.id,
    label: a.label,
    line: fullAddress(a),
    line1: a.line1,
    ...(a.line2 ? { line2: a.line2 } : {}),
    area: a.area,
    city: a.city,
    pincode: a.pincode,
    ...(a.contactName ? { contactName: a.contactName } : {}),
    ...(a.contactPhone ? { contactPhone: a.contactPhone } : {}),
  };
}

/**
 * Save an address, keeping exactly one default, in one commit.
 *
 * The FIRST address a customer saves becomes the default whether they asked or
 * not: a saved-address list with no default means the booking sheet has
 * nothing to pre-select, and the customer is made to choose from a list of one.
 */
export async function saveAddress(
  uid: string, input: AddressInput, addressId?: string,
): Promise<SavedAddress> {
  if (!adminDb) throw new AddressError('not-configured', 503);
  const db = adminDb;

  const checked = checkAddress(input);
  if (!checked.ok) throw new AddressError(checked.reason, 400);

  const ref = addressId
    ? collection(uid).doc(addressId)
    : collection(uid).doc();

  return db.runTransaction(async t => {
    const existingSnap = await t.get(collection(uid));
    const existing = existingSnap.docs;

    if (!addressId && existing.length >= MAX_ADDRESSES) {
      throw new AddressError('too-many-addresses', 409);
    }
    if (addressId && !existing.some(d => d.id === addressId)) {
      throw new AddressError('not-found', 404);
    }

    const first = existing.length === 0;
    const isDefault = checked.value.isDefault || first;

    if (isDefault) {
      /* EXACTLY ONE. Every other address is stood down in the SAME commit —
         two defaults is a state no reader can resolve, and it is reachable in
         one dropped connection if this is two writes. */
      for (const d of existing) {
        if (d.id !== ref.id && (d.data() as { isDefault?: boolean }).isDefault) {
          t.update(d.ref, { isDefault: false, updatedAt: FieldValue.serverTimestamp() });
        }
      }
    }

    const record = { ...checked.value, isDefault };
    t.set(ref, {
      ...record,
      ...(addressId ? {} : { createdAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: !!addressId });

    const now = Timestamp.now();
    return { id: ref.id, ...record, createdAt: now, updatedAt: now } as unknown as SavedAddress;
  }, { maxAttempts: 6 });
}

/**
 * Remove an address, unless a van is due at it.
 *
 * A booking carries a SNAPSHOT, so deleting the saved address never damages a
 * past visit's record — the refusal is not about data integrity. It is about
 * the customer: an address they deleted is one they believe the studio no
 * longer holds, and quietly driving to it on Tuesday would prove otherwise.
 * They are told which visit is in the way, so the refusal is actionable.
 */
export async function deleteAddress(
  uid: string, addressId: string,
): Promise<{ id: string; deleted: boolean }> {
  if (!adminDb) throw new AddressError('not-configured', 503);
  const db = adminDb;

  const ref = collection(uid).doc(addressId);
  const snap = await ref.get();
  if (!snap.exists) return { id: addressId, deleted: false };

  /* Only visits still ahead. A completed visit's snapshot is its own record
     and holds nothing back. */
  const active = await db.collection('bookings')
    .where('userId', '==', uid)
    .where('status', 'in', ['pending', 'confirmed', 'vehicle_received', 'in_progress', 'quality_check', 'ready_for_delivery'])
    .get();
  const inUse = active.docs.some(d =>
    (d.data() as { pickupAddressRef?: { addressId?: string } }).pickupAddressRef?.addressId === addressId);
  if (inUse) throw new AddressError('address-in-use', 409);

  const wasDefault = (snap.data() as { isDefault?: boolean }).isDefault === true;
  await ref.delete();

  /* THE DEFAULT MUST SURVIVE THE DELETION. Removing the default silently
     leaves a customer with several addresses and no pre-selected one, which
     reads as the studio having forgotten where they live. */
  if (wasDefault) {
    const rest = await collection(uid).get();
    const next = rest.docs.sort((a, b) =>
      String((a.data() as { label?: string }).label ?? '')
        .localeCompare(String((b.data() as { label?: string }).label ?? '')))[0];
    if (next) await next.ref.update({ isDefault: true, updatedAt: FieldValue.serverTimestamp() });
  }

  return { id: addressId, deleted: true };
}

/** One address, for its owner. Absent and not-yours are the same answer. */
export async function readAddress(uid: string, addressId: string): Promise<SavedAddress | null> {
  if (!adminDb) return null;
  const snap = await collection(uid).doc(addressId).get();
  return snap.exists ? ({ id: snap.id, ...(snap.data() as object) } as SavedAddress) : null;
}
