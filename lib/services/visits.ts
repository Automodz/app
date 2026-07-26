/**
 * THE VISIT COLLECTION (docs/VISIT-OBJECT.md).
 *
 * The anchor everything else references. During the migration window a Visit
 * is DERIVED from the `Booking` + `Job` pair that already exists, so nothing
 * about the live booking or kiosk flow changes: `visitFromPair` is a pure
 * projection, and `writeDerivedVisit` persists it alongside the pair.
 *
 * Migration order (VISIT-OBJECT.md §6):
 *   Phase 1  dual-write, verify against the pair   ← we are here
 *   Phase 2  customer surfaces read visits only
 *   Phase 3  studio writes visits only; pair retired
 */
import {
  collection, doc, getDoc, getDocs, query, where, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  Booking, CapturedTerm, Job, Service, Visit, VisitStage, VisitStageName, VisitStatus,
} from '../types';
import { captureTerms } from '../os/protection';
import { visitPhase } from '../os/visit';

/** Until the studio is location-aware there is exactly one. */
export const DEFAULT_LOCATION_ID = 'maninagar';

/** Ops status → the customer-facing stage it recorded (JOURNEY-STAGES.md §7). */
const STAGE_FROM_JOB_STATUS: Record<string, VisitStageName> = {
  checked_in: 'received',
  in_progress: 'deep_clean',
  quality_check: 'final_inspection',
  ready_for_delivery: 'ready',
  completed: 'ready',
};

const VISIT_STATUS: Record<string, VisitStatus> = {
  proposed: 'requested',
  agreed: 'agreed',
  live: 'open',
  archived: 'sealed',
  cancelled: 'cancelled',
};

/**
 * A Booking + Job pair, projected into the anchor.
 *
 * `catalogue` is consulted ONLY to capture terms, and only for a visit that
 * is sealing - which is the last legitimate moment to infer a warranty that
 * was never recorded at the time (hence `source: 'reconstructed'`).
 */
export function visitFromPair(
  booking: Booking,
  job: Job | null,
  catalogue: Service[],
): Omit<Visit, 'createdAt' | 'updatedAt'> {
  const status = VISIT_STATUS[visitPhase(booking.status)] ?? 'requested';
  const sealed = status === 'sealed';

  const stages: VisitStage[] = (job?.statusHistory ?? [])
    .map(h => {
      const stage = STAGE_FROM_JOB_STATUS[h.status];
      if (!stage) return null;
      return {
        stage,
        at: h.at,
        note: h.note?.trim() || undefined,
        media: [],
        byEmployeeId: h.byEmployeeId,
      } as VisitStage;
    })
    .filter((s): s is VisitStage => s !== null);

  // photographs belong to the stage nearest their kind
  const photos = job?.photos ?? [];
  const attach = (stage: VisitStageName, kinds: string[]) => {
    const target = stages.find(s => s.stage === stage);
    if (!target) return;
    target.media = photos
      .filter(p => kinds.includes(p.kind))
      .map(p => ({ url: p.url, kind: 'photo' as const }));
  };
  attach('received', ['before']);
  attach('deep_clean', ['during']);
  attach('ready', ['after']);

  const termsCaptured: CapturedTerm[] = sealed
    ? captureTerms({
        work: [{
          serviceName: booking.serviceName,
          category: booking.serviceCategory,
          appliedOn: booking.scheduledDate,
        }],
        catalogue,
        source: 'reconstructed',
      })
    : [];

  const subtotal = booking.serviceBasePrice ?? booking.totalAmount ?? 0;
  const discount = booking.discount?.amount ?? 0;

  return {
    id: booking.id,
    vehicleId: booking.vehicleId,
    locationId: DEFAULT_LOCATION_ID,
    source: job?.source === 'walk_in' ? 'walk_in' : 'requested',
    authoredBy: 'customer',
    requestedFor: { date: booking.scheduledDate, time: booking.scheduledTime },
    services: [{
      serviceId: booking.serviceId,
      name: booking.serviceName,
      category: booking.serviceCategory,
      price: booking.serviceBasePrice ?? booking.totalAmount ?? 0,
    }],
    discount: booking.discount,
    amounts: { subtotal, discount, total: booking.totalAmount ?? 0 },
    stages,
    bay: job?.bay,
    termsCaptured,
    status,
    sealedAt: sealed ? (job?.completedAt ?? booking.updatedAt) : undefined,
    bookingId: booking.id,
    jobId: job?.id,
  };
}

/* ── reading ────────────────────────────────────────────────────────────── */

export const getVisit = async (id: string): Promise<Visit | null> => {
  const snap = await getDoc(doc(db, 'visits', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Visit) : null;
};

export const getVisitsForVehicle = async (vehicleId: string): Promise<Visit[]> => {
  const snap = await getDocs(query(collection(db, 'visits'), where('vehicleId', '==', vehicleId)));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Visit))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
};

/* ── writing ────────────────────────────────────────────────────────────── */

/**
 * Persist a derived visit. Keyed by the booking id so the projection is
 * idempotent - running the migration twice produces one visit, not two.
 *
 * A SEALED visit is never overwritten. That is the seal doing its job: once
 * the record is permanent, re-deriving it from a mutated catalogue must not
 * be able to change what the customer was told.
 */
export const writeDerivedVisit = async (v: Omit<Visit, 'createdAt' | 'updatedAt'>) => {
  const ref = doc(db, 'visits', v.id);
  const existing = await getDoc(ref);
  if (existing.exists() && (existing.data() as Visit).sealedAt) return existing.id;

  const { id: _id, ...body } = v;
  await setDoc(
    ref,
    {
      ...body,
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return v.id;
};
