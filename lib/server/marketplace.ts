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
import type { CarListing, Protection, SellRequest, Vehicle, Visit } from '@/lib/types';
import { PROTECTION_TITLE } from '@/lib/types';
import { hasPublicHistoryConsent } from '@/lib/os/consent';
import { measuredLifeOf } from '@/lib/os/protection';
import { visitDateOf } from '@/lib/os/visit';
import { isPublic } from '@/lib/os/market';
import { plainDoc } from './plain';

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
  return snap.docs.map(d => plainDoc<CarListing>(d.id, d.data()));
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
  const listing = plainDoc<CarListing>(snap.id, snap.data()!);
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
    .map(d => plainDoc<SellRequest>(d.id, d.data()))
    .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
});


/* ────────────────────────────────────────────────────────────────────────────
   THE CAR'S RECORD WITH US — design screen 17.

   "Detailed here since 2021 · 11 visits · 340 photos · paint original, no
   respray", on a page anyone can open. Every one of those is a fact about a
   real customer's car shown to strangers, which makes this the most sensitive
   read in the product and the only place a private record crosses into public.

   ── THE OWNER IS VALIDATED, NEVER TRUSTED ──────────────────────────────────
   A listing carries `vehicleId` and `vehicleOwnerId`, both set by the studio.
   `vehicleOwnerId` is not taken on faith: vehicles live UNDER their owner, so
   the pair is checked by reading `users/{ownerId}/vehicles/{vehicleId}`. A
   listing naming a car that is not in that garage resolves to nothing — which
   is exactly what should happen to a mistyped or a forged link between a
   listing and somebody else's car.

   ── AND CONSENT IS THE GATE, NOT THIS FUNCTION ─────────────────────────────
   This assembles what MAY be published; `publicHistoryOf` decides whether any
   of it is. The gate lives there because a check in a loader protects only
   that loader, and a screen holding `null` cannot leak a count.
   ──────────────────────────────────────────────────────────────────────────── */

export interface ListingRecord {
  vehicle: Pick<Vehicle, 'publicHistoryConsent'>;
  visits: Pick<Visit, 'servicedOn' | 'stages'>[];
  protections: { label: string; detail: string }[];
  photographs: number;
  since?: string;
}

export const loadListingRecord = cache(async (
  listing: Pick<CarListing, 'vehicleId' | 'vehicleOwnerId'>,
): Promise<ListingRecord | undefined> => {
  const { vehicleId, vehicleOwnerId } = listing;
  /* A trade-in the studio has never touched has no record to show, and that is
     the correct behaviour rather than a gap to fill. */
  if (!adminDb || !vehicleId || !vehicleOwnerId) return undefined;

  const vehicleSnap = await adminDb
    .doc(`users/${vehicleOwnerId}/vehicles/${vehicleId}`).get();
  /* THE LINK IS INVALID. Not "assume it is fine" and not "search for a car
     with this id somewhere else" — the second is how a plate join re-parented
     three bookings in production. */
  if (!vehicleSnap.exists) return undefined;
  const vehicle = plainDoc<Vehicle>(vehicleSnap.id, vehicleSnap.data()!);

  /* CONSENT IS CHECKED BEFORE THE HISTORY IS EVEN READ. `publicHistoryOf` is
     still the gate — this is not a second one — but reading a customer's
     visits in order to throw them away is work nobody asked for on a public
     page, and a record never loaded is a record that cannot leak. */
  if (!hasPublicHistoryConsent(vehicle)) return { vehicle, visits: [], protections: [], photographs: 0 };

  const [visitSnap, protectionSnap] = await Promise.all([
    adminDb.collection('visits').where('vehicleId', '==', vehicleId).get(),
    adminDb.collection('protections').where('vehicleId', '==', vehicleId).get(),
  ]);

  const visits = visitSnap.docs
    .map(d => plainDoc<Visit>(d.id, d.data()))
    .filter(v => v.status === 'sealed');

  /* Counts only. No caption, no url, no note — a photograph published beside a
     stranger's car is the customer's own garage on a listing page. */
  const photographs = visits.reduce(
    (n, v) => n + (v.stages ?? []).reduce((m, s) => m + (s.media?.length ?? 0), 0), 0);

  /* WORDED, NEVER RAW. A protection becomes "Full-body PPF · 68% life" — the
     kind and a measurement, and nothing about who paid for it or when it was
     invoiced. `measurementOf` returns null for a term with no honest start
     date, and a protection with no honest percentage is left out rather than
     given a bucket wearing a number. */
  const protections = protectionSnap.docs
    .map(d => plainDoc<Protection>(d.id, d.data()))
    .map(p => {
      const life = measuredLifeOf(p);
      return life === null
        ? null
        : {
            label: PROTECTION_TITLE[p.kind] ?? 'Protection',
            detail: `${Math.round(life * 100)}% life`,
          };
    })
    .filter((x): x is { label: string; detail: string } => x !== null);

  /* THE YEAR THE STUDIO FIRST SAW IT, from the visits themselves. Not the
     vehicle's `createdAt`, which is when somebody added it to the app. */
  const years = visits.map(v => visitDateOf(v).slice(0, 4)).filter(Boolean).sort();

  return { vehicle, visits, protections, photographs, since: years[0] || undefined };
});
