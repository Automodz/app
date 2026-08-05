import 'server-only';
/**
 * THE MARKETPLACE, READ ON THE SERVER.
 *
 * Source: docs/AUTOMODZ-OS.md §22.2 · docs/AUTOMODZ-OS-ARCHITECTURE.md §1
 *
 * `/cars` is the one part of the customer product a stranger can open, so it is
 * also the one part that has to be findable — which means it renders on the
 * server with its content in the HTML, not fetched into an empty page after
 * hydration. The client-side readers in `lib/services/cars.ts` could not do
 * that, and they are gone.
 *
 * ONE SOURCE OF TRUTH. Every listing a customer ever sees comes through this
 * file. `active` is enforced here rather than at each caller, so no surface can
 * forget it and show a car the studio has withdrawn.
 */
import { cache } from 'react';
import { adminDb } from './firebaseAdmin';
import type { CarListing, SellRequest } from '@/lib/types';
import { isPublic } from '@/lib/os/market';

/**
 * Firestore hands back `Timestamp`s and `undefined`s that cannot cross into a
 * client component. Everything a renderer touches is made plain here.
 */
const plain = <T,>(id: string, data: FirebaseFirestore.DocumentData): T =>
  JSON.parse(JSON.stringify({ id, ...data })) as T;

/**
 * Every listing a customer may see.
 *
 * Ordering and filtering happen in the engine (`os/market`), not in the query:
 * the whole active stock is a small collection, and a Firestore `orderBy` here
 * would need a composite index for every sort the product might want.
 */
export const loadListings = cache(async (): Promise<CarListing[]> => {
  if (!adminDb) return [];
  const snap = await adminDb.collection('carListings').where('active', '==', true).get();
  return snap.docs.map(d => plain<CarListing>(d.id, d.data()));
});

/**
 * One listing, by id.
 *
 * Returns null for a withdrawn car as well as a missing one, so an old link
 * cannot keep showing a listing the studio has taken down. The caller cannot
 * tell the two apart, which is correct — neither is for sale.
 */
export const loadListing = cache(async (id: string): Promise<CarListing | null> => {
  if (!adminDb || !id) return null;
  const snap = await adminDb.collection('carListings').doc(id).get();
  if (!snap.exists) return null;
  const listing = plain<CarListing>(snap.id, snap.data()!);
  return isPublic(listing) ? listing : null;
});

/** The listings this customer has kept. Ids only — the cars are already loaded. */
export const loadSavedIds = cache(async (uid: string): Promise<string[]> => {
  if (!adminDb || !uid) return [];
  const snap = await adminDb.collection('users').doc(uid).collection('savedCars').get();
  return snap.docs.map(d => d.id);
});

/**
 * What this customer has offered the studio, newest first.
 *
 * §19 — a request that vanishes the moment it is sent is a request the customer
 * cannot believe in. The old form showed a thank-you and then forgot; this is
 * what lets the surface say "you offered us this, and here is where it stands".
 */
export const loadMySellRequests = cache(async (uid: string): Promise<SellRequest[]> => {
  if (!adminDb || !uid) return [];
  const snap = await adminDb.collection('sellRequests').where('userId', '==', uid).get();
  return snap.docs
    .map(d => plain<SellRequest>(d.id, d.data()))
    .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
});
