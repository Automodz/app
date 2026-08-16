import 'server-only';
/**
 * THE ESTIMATE - design screen 07's "Estimate · ₹1,26,720 · Final on inspection".
 *
 * ── WHY AN OBJECT AND NOT A NUMBER IN A QUERY STRING ─────────────────────
 * The figure a customer sees when they choose a coverage has to survive three
 * more screens: the date, the confirmation, and the booking itself. Passing it
 * along in the URL would make it a client value, and a client value is not a
 * price - it is a suggestion the server has to ignore, which means the server
 * recomputes, which means four surfaces each computing a total and only one of
 * them being right. That is precisely the drift the audit found between the
 * estimate and the invoice.
 *
 * So the estimate is a SERVER-WRITTEN, IMMUTABLE record. The screen shows what
 * this wrote. The booking spends it by id, never by amount.
 *
 * ── ONE CALCULATION ──────────────────────────────────────────────────────
 * `priceVisit` is the only arithmetic. It takes the WORK (from `resolveScope`,
 * priced from the catalogue), the fees (one line per concierge leg), and the
 * tax policy - and it applies the one benefit that stands, through the same
 * `decidePrice` the kiosk and the booking service already use. Nothing here
 * adds, subtracts or rounds.
 *
 * ── THE SNAPSHOT IS THE POINT ────────────────────────────────────────────
 * Raising the catalogue price of full-body PPF changes what the NEXT customer
 * is quoted. It may not touch an estimate already given, or a booking made
 * from one. Both carry their own copy.
 */
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin';
import { priceVisit, pickupFees, taxPolicy, storedBreakdown } from '@/lib/services/pricing';
import { resolveScope, estimateExpiryOn, type ScopeChoice } from '@/lib/os/scope';
import type { Estimate, Service, Subscription } from '@/lib/types';

export class EstimateError extends Error {
  constructor(readonly code: string, readonly status = 409) {
    super(code);
  }
}

const today = () => new Date().toISOString().slice(0, 10);

export interface EstimateIntent extends ScopeChoice {
  vehicleId: string;
  serviceId: string;
  /** The concierge legs, each of which is its own fee line. */
  pickup?: boolean;
  drop?: boolean;
  /** A REQUEST to spend a membership wash. The engine decides if it can. */
  useMembershipWash?: boolean;
}

/**
 * Price a choice, and write it down.
 *
 * Ownership is structural: the vehicle is read from UNDER the caller's own
 * document, so a forged `vehicleId` cannot name somebody else's car - there is
 * no path to it.
 *
 * ── PREVIEW ──────────────────────────────────────────────────────────────
 * Screen 07 restates the estimate every time a coverage or an extra stage is
 * touched. Writing a document per tap would leave a customer who changed
 * their mind twice with three estimates and the studio with a collection of
 * quotes nobody ever asked for.
 *
 * A preview runs THE SAME calculation and stores nothing. It is not a second
 * pricing path - it is this one, with the write skipped - so the figure on the
 * screen and the figure in the record cannot be produced differently. The real
 * estimate is written when the customer moves on to choose a date, which is
 * the moment the quote starts having to survive.
 */
export async function createEstimateAuthoritative(
  callerUid: string,
  intent: EstimateIntent,
  opts: { preview?: boolean } = {},
): Promise<Estimate> {
  if (!adminDb) throw new EstimateError('not-configured', 503);
  const db = adminDb;

  const idOk = (v: unknown) => typeof v === 'string' && v.trim().length > 0
    && v.length <= 1500 && !v.includes('/');
  if (!idOk(intent.vehicleId) || !idOk(intent.serviceId)) {
    throw new EstimateError('vehicle-and-service-required', 400);
  }

  const ownerRef = db.collection('users').doc(callerUid);
  const [vehicleSnap, serviceSnap, subSnap] = await Promise.all([
    ownerRef.collection('vehicles').doc(intent.vehicleId).get(),
    db.collection('services').doc(intent.serviceId).get(),
    db.collection('subscriptions').where('userId', '==', callerUid)
      .orderBy('createdAt', 'desc').limit(1).get(),
  ]);

  if (!vehicleSnap.exists) throw new EstimateError('vehicle-not-yours', 403);
  if (!serviceSnap.exists) throw new EstimateError('unknown-service', 404);

  const service = { id: serviceSnap.id, ...(serviceSnap.data() as object) } as Service;

  /* ── the work, from the catalogue, by id ── */
  const resolved = resolveScope(service, {
    scopeId: intent.scopeId,
    panelIds: intent.panelIds,
    addOnIds: intent.addOnIds,
  });
  if (!resolved.ok) {
    throw new EstimateError(resolved.reason, resolved.reason.startsWith('unknown') ? 404 : 400);
  }

  const membership = subSnap.docs[0]
    ? ({ id: subSnap.docs[0].id, ...(subSnap.docs[0].data() as object) } as Subscription & { id: string })
    : null;

  const pickup = intent.pickup === true;
  const drop = intent.drop === true;

  /* ── THE ONE CALCULATION ── */
  const breakdown = priceVisit({
    services: resolved.lines,
    /* One leg, one line. A single boolean would make a customer who is
       collected AND returned pay once and read a receipt that cannot explain
       the difference. */
    fees: pickupFees({ pickup, drop }),
    tax: taxPolicy(),
    benefit: {
      /* `base` is replaced by `priceVisit` with the services subtotal; it is
         passed for the type and never read. */
      base: resolved.scope.workPrice,
      category: service.category ?? '',
      serviceId: service.id,
      ownerId: callerUid,
      membership,
      wantsWash: intent.useMembershipWash === true,
      date: today(),
    },
  });

  const ref = db.collection('estimates').doc();
  const record = {
    userId: callerUid,
    vehicleId: intent.vehicleId,
    serviceId: service.id,
    serviceName: service.name ?? '',
    serviceCategory: service.category ?? '',
    scope: resolved.scope,
    breakdown: storedBreakdown(breakdown),
    pickup,
    drop,
    expiresOn: estimateExpiryOn(today()),
    status: 'open' as const,
  };
  if (opts.preview) {
    /* An empty id, because there is no document. A caller that tries to spend
       a preview therefore fails on a missing estimate rather than silently
       booking something nobody priced. */
    return { id: '', ...record, createdAt: Timestamp.now() } as unknown as Estimate;
  }

  await ref.set({ ...record, createdAt: FieldValue.serverTimestamp() });

  return { id: ref.id, ...record, createdAt: Timestamp.now() } as unknown as Estimate;
}

/**
 * Read one estimate, for its owner, refusing anything it may no longer be
 * spent on.
 *
 * `forSpending` is the stricter read the booking path uses: an estimate that
 * has already produced a booking, or whose week has run out, may still be
 * LOOKED at - the customer should be able to see what they were quoted - but
 * it may not be turned into a bay.
 */
export async function readEstimate(
  callerUid: string,
  estimateId: string,
  opts: { forSpending?: boolean } = {},
): Promise<Estimate> {
  if (!adminDb) throw new EstimateError('not-configured', 503);
  const snap = await adminDb.collection('estimates').doc(estimateId).get();
  if (!snap.exists) throw new EstimateError('not-found', 404);
  const estimate = { id: snap.id, ...(snap.data() as object) } as Estimate;
  /* Not "forbidden" - the same answer as an id that does not exist, so this
     cannot be used to discover which estimates are real. */
  if (estimate.userId !== callerUid) throw new EstimateError('not-found', 404);

  if (opts.forSpending) {
    if (estimate.status === 'consumed') throw new EstimateError('estimate-already-used', 409);
    if (estimate.expiresOn < today()) throw new EstimateError('estimate-expired', 409);
  }
  return estimate;
}
