import { FieldValue, Timestamp, type DocumentReference, type Transaction } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin';
import { loadOccupancy, occupancyRange, type Reader } from './occupancy';
import { decidePrice } from '@/lib/services/pricing';
import { computeAvailability, candidateSlots } from '@/lib/availability';
import { PICKUP_FEE } from '@/lib/utils';
import type {
  Booking, BookingDiscount, Job, JobServiceItem, JobStatus, Promo, Subscription,
} from '@/lib/types';

/**
 * THE BOOKING SERVICE - the only thing in this codebase that may create a
 * booking, and the only thing that may decide what one costs.
 *
 * WHY IT EXISTS. Until now the browser decided `totalAmount`, `discount`,
 * whether a promo applied and whether a membership wash covered the visit,
 * then wrote the booking itself. Firestore rules could check the shape of that
 * document but not its arithmetic, so any client could have booked a ₹2,20,000
 * PPF for ₹1. Separately, the booking, the promo count and the wash deduction
 * were three sequential writes from three different places, so a dropped
 * connection between any two of them left the studio's records disagreeing
 * with what the customer was charged.
 *
 * THE CONTRACT.
 *   The client expresses INTENT: which car, which service, when.
 *   The server decides PRICE: base, membership benefit, promo benefit, total.
 *   Incoming money values are not validated - they are ignored. There is no
 *   field a caller can set that changes what they pay.
 *
 * ATOMICITY. Firestore transactions span collections inside one database, so
 * the booking, the promo increment, the redemption record, the wash deduction
 * and the idempotency marker are ONE commit. There is no ordering to discuss
 * and no partial state to reconcile: either the visit exists fully paid-for
 * and fully counted, or it does not exist.
 *
 * The one thing a transaction cannot do is stop a concurrent INSERT that would
 * have matched a query it read - Firestore locks the documents a transaction
 * reads, and has no predicate or range locks, so two simultaneous requests can
 * both read "this slot is free". See `assertSlotOpen` for what is done about
 * that and why nothing stronger is sound here.
 *
 * ONE PRICING ENGINE. Every number below comes from `lib/services/pricing.ts`
 * - the same pure, unit-tested functions the UI uses to *quote* a price. The
 * UI quotes; only this file decides.
 */

const today = () => new Date().toISOString().slice(0, 10);
const isDateStr = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isTimeStr = (s: unknown) => typeof s === 'string' && /^\d{2}:\d{2}$/.test(s);

export class BookingError extends Error {
  constructor(readonly code: string, readonly status = 409) {
    super(code);
  }
}

/* ── Intent - everything the client is allowed to say ────────────────────── */

export interface AppointmentIntent {
  kind: 'appointment';
  vehicleId: string;
  serviceId: string;
  scheduledDate: string;
  scheduledTime: string;
  paymentMethod?: 'upi' | 'cash';
  pickup?: boolean;
  drop?: boolean;
  pickupAddress?: string;
  /** A REQUEST to spend a membership wash. The server decides if it can. */
  useMembershipWash?: boolean;
  /** Staff booking on behalf of a customer. Ignored for customer callers. */
  forUserId?: string;
  idempotencyKey: string;
}

export interface WalkInIntent {
  kind: 'walkin';
  customerId?: string;
  customerName: string;
  customerPhone: string;
  vehicleName: string;
  vehicleRegNo: string;
  /** Staff-priced line items - the counter may negotiate; a customer may not. */
  items: JobServiceItem[];
  useMembershipWash?: boolean;
  byEmployee: { id: string; name: string };
  assignees?: { id: string; name: string }[];
  idempotencyKey: string;
}

export type BookingIntent = AppointmentIntent | WalkInIntent;

export interface BookingResult {
  /** The canonical record as stored. Never the caller's version of it. */
  booking?: Booking;
  job?: Job;
  id: string;
  /** true when this request had already been committed under the same key */
  replayed: boolean;
}

/* The pricing DECISION lives in lib/services/pricing.ts, with the rest of the
   engine, where it is pure and unit-tested. Nothing in this file does
   arithmetic; it loads the facts, calls `decidePrice`, and writes the result. */

/* ── Shared reads ───────────────────────────────────────────────────────── */

const loadPromoContext = async (reader: Reader, ownerId: string | null) => {
  const db = adminDb!;
  const [promoSnap, mineSnap] = await Promise.all([
    reader.get(db.collection('promos').where('active', '==', true)),
    ownerId
      ? reader.get(db.collection('promoRedemptions').where('userId', '==', ownerId))
      : Promise.resolve({ docs: [] as { data(): unknown }[] }),
  ]);
  const promos = promoSnap.docs.map(d => ({
    id: (d as unknown as { id: string }).id, ...(d.data() as object),
  })) as Promo[];
  const myRedemptions = new Map<string, number>();
  mineSnap.docs.forEach(d => {
    const r = d.data() as { promoId?: string };
    if (r.promoId) myRedemptions.set(r.promoId, (myRedemptions.get(r.promoId) ?? 0) + 1);
  });
  return { promos, myRedemptions };
};

const loadMembership = async (
  t: Transaction, ownerId: string | null,
): Promise<(Subscription & { id: string }) | null> => {
  if (!ownerId) return null;
  const snap = await t.get(adminDb!.collection('subscriptions')
    .where('userId', '==', ownerId)
    .orderBy('createdAt', 'desc')
    .limit(1));
  const d = snap.docs[0];
  return d ? ({ id: d.id, ...(d.data() as object) } as Subscription & { id: string }) : null;
};

/**
 * Refuse a slot the studio cannot actually work.
 *
 * This runs on the SAME occupancy the availability endpoint offers from
 * (`lib/server/occupancy`), inside the transaction, so a slot filled between
 * the customer seeing it and confirming it is rejected rather than accepted.
 *
 * What it cannot do is serialise two requests that arrive at once: Firestore
 * has no predicate locks, so both transactions read a bay that is free and
 * neither sees the other's not-yet-written booking. A uniqueness document per
 * slot WOULD serialise them, and was rejected deliberately: it becomes a
 * second, independent record of occupancy that admin reschedule, cancel,
 * reject and no-show would all have to maintain, and the day one of them
 * forgets, the studio has slots that are permanently unbookable for no visible
 * reason. Customer bookings land `pending` for the owner to approve, so the
 * residual risk of a simultaneous double-book is one extra row in an approval
 * queue a human already reads - not work done twice.
 */
const assertSlotOpen = async (
  reader: Reader,
  date: string, time: string, category: string, durationMinutes: number,
) => {
  if (!isDateStr(date) || !isTimeStr(time)) throw new BookingError('bad-slot', 400);
  if (date < today()) throw new BookingError('slot-in-the-past', 400);
  if (!candidateSlots(durationMinutes).includes(time)) throw new BookingError('not-a-slot', 400);

  const { rangeStart, rangeEnd } = occupancyRange([date], durationMinutes);
  const { occupants, cfg } = await loadOccupancy(reader, rangeStart, rangeEnd);
  const { fullSlots } = computeAvailability([date], category, durationMinutes, occupants, cfg);
  if ((fullSlots[date] ?? []).includes(time)) throw new BookingError('slot-taken');
};

/* ── The one entry point ────────────────────────────────────────────────── */

export const createBookingAuthoritative = async (
  callerUid: string,
  intent: BookingIntent,
): Promise<BookingResult> => {
  const db = adminDb!;

  if (!intent?.idempotencyKey || typeof intent.idempotencyKey !== 'string'
      || intent.idempotencyKey.length < 8 || intent.idempotencyKey.length > 128
      || /[^A-Za-z0-9_-]/.test(intent.idempotencyKey)) {
    throw new BookingError('bad-idempotency-key', 400);
  }

  const callerSnap = await db.collection('users').doc(callerUid).get();
  const caller = callerSnap.data() as
    { role?: string; name?: string; phone?: string; email?: string } | undefined;
  const isStaff = caller?.role === 'admin' || caller?.role === 'employee';

  // one marker per caller per key - a replay lands on the same document
  const intentRef = db.collection('bookingIntents').doc(`${callerUid}_${intent.idempotencyKey}`);

  return intent.kind === 'walkin'
    ? createWalkIn(callerUid, caller, isStaff, intent, intentRef)
    : createAppointment(callerUid, caller, isStaff, intent, intentRef);
};

type IntentRef = DocumentReference;
type CallerDoc = { role?: string; name?: string; phone?: string; email?: string } | undefined;

const createAppointment = async (
  callerUid: string, caller: CallerDoc, isStaff: boolean,
  intent: AppointmentIntent, intentRef: IntentRef,
): Promise<BookingResult> => {
  const db = adminDb!;
  const ownerId = isStaff && intent.forUserId ? intent.forUserId : callerUid;
  if (intent.forUserId && intent.forUserId !== callerUid && !isStaff) {
    throw new BookingError('forbidden', 403);
  }
  /* Non-EMPTY, please. An empty string is a valid string and an invalid
     document id: `collection('vehicles').doc('')` throws inside the
     transaction and surfaces as a 500, which tells a caller nothing and looks
     like a studio outage. Firestore ids also may not contain a slash. */
  const idOk = (v: unknown) => typeof v === 'string' && v.trim().length > 0
    && v.length <= 1500 && !v.includes('/');
  if (!idOk(intent.vehicleId) || !idOk(intent.serviceId)) {
    throw new BookingError('vehicle-and-service-required', 400);
  }

  const bookingRef = db.collection('bookings').doc();

  return db.runTransaction(async t => {
    /* ---- every read first; Firestore forbids a read after a write ---- */
    const existing = await t.get(intentRef);
    if (existing.exists) {
      const id = existing.data()!.bookingId as string;
      const snap = await t.get(db.collection('bookings').doc(id));
      return {
        id, replayed: true,
        booking: { id, ...(snap.data() as object) } as Booking,
      };
    }

    const ownerRef = db.collection('users').doc(ownerId);
    const [ownerSnap, vehicleSnap, serviceSnap] = await Promise.all([
      t.get(ownerRef),
      t.get(ownerRef.collection('vehicles').doc(intent.vehicleId)),
      t.get(db.collection('services').doc(intent.serviceId)),
    ]);

    /* OWNERSHIP. The vehicle is read from UNDER the owner's document, so a
       forged vehicleId cannot name someone else's car - there is no path to
       it. An id that isn't theirs simply doesn't exist. */
    if (!vehicleSnap.exists) throw new BookingError('vehicle-not-yours', 403);
    if (!serviceSnap.exists) throw new BookingError('unknown-service', 404);

    const owner = ownerSnap.data() as
      { name?: string; phone?: string; email?: string } | undefined;
    const vehicle = vehicleSnap.data() as { name?: string; registrationNumber?: string };
    const service = serviceSnap.data() as {
      name?: string; category?: string; price?: number; duration?: number; active?: boolean;
    };
    if (service.active === false) throw new BookingError('service-not-offered');
    if (typeof service.price !== 'number' || service.price <= 0) {
      throw new BookingError('service-not-priced');
    }

    const [membership, { promos, myRedemptions }] = await Promise.all([
      loadMembership(t, ownerId),
      loadPromoContext(t as unknown as Reader, ownerId),
    ]);

    const duration = service.duration ?? 60;
    await assertSlotOpen(
      t as unknown as Reader,
      intent.scheduledDate, intent.scheduledTime, service.category ?? '', duration,
    );

    /* ---- the price, decided here and nowhere else ---- */
    const priced = decidePrice({
      base: service.price,
      category: service.category ?? '',
      serviceId: intent.serviceId,
      ownerId,
      membership,
      wantsWash: !!intent.useMembershipWash,
      promos,
      myRedemptions,
      date: today(),
    });

    const pickup = !!intent.pickup, drop = !!intent.drop;
    const pickupDropFee = (pickup ? PICKUP_FEE : 0) + (drop ? PICKUP_FEE : 0);
    if (pickupDropFee > 0 && !intent.pickupAddress?.trim()) {
      throw new BookingError('pickup-address-required', 400);
    }
    const totalAmount = priced.netService + pickupDropFee;

    /* ---- writes ---- */
    const booking: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'> = {
      userId: ownerId,
      userName: owner?.name ?? '',
      userPhone: owner?.phone ?? '',
      userEmail: owner?.email ?? '',
      vehicleId: intent.vehicleId,
      vehicleName: vehicle.name ?? '',
      vehicleRegNo: vehicle.registrationNumber ?? '',
      serviceId: intent.serviceId,
      serviceName: service.name ?? '',
      serviceCategory: service.category ?? '',
      serviceBasePrice: service.price,
      serviceDurationMinutes: duration,
      pickupDropRequired: pickup || drop,
      pickupRequired: pickup,
      dropRequired: drop,
      pickupDropFee,
      pickupAddress: pickupDropFee > 0 ? intent.pickupAddress!.trim() : '',
      totalAmount,
      scheduledDate: intent.scheduledDate,
      scheduledTime: intent.scheduledTime,
      status: 'pending',
      paymentMethod: intent.paymentMethod === 'upi' ? 'upi' : 'cash',
      paymentStatus: 'pending',
      transactionId: '',
      usedMembershipWash: priced.washCovered,
      ...(priced.membershipId && priced.washCovered
        ? { membershipId: priced.membershipId } : {}),
      ...(priced.discount ? { discount: priced.discount } : {}),
    };

    t.set(bookingRef, {
      ...booking,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    settleBenefits(t, {
      promo: priced.promo,
      discount: priced.discount,
      ownerId,
      refKey: bookingRef.id,
      refField: 'bookingId',
      washCovered: priced.washCovered,
      membership,
    });

    t.set(intentRef, {
      callerUid, ownerId, kind: 'appointment', bookingId: bookingRef.id,
      createdAt: FieldValue.serverTimestamp(),
    });

    const now = Timestamp.now();
    return {
      id: bookingRef.id, replayed: false,
      booking: { ...booking, id: bookingRef.id, createdAt: now, updatedAt: now } as Booking,
    };
  });
};

const createWalkIn = async (
  callerUid: string, caller: CallerDoc, isStaff: boolean,
  intent: WalkInIntent, intentRef: IntentRef,
): Promise<BookingResult> => {
  const db = adminDb!;
  if (!isStaff) throw new BookingError('staff-only', 403);
  if (!Array.isArray(intent.items) || intent.items.length === 0) {
    throw new BookingError('no-items', 400);
  }
  if (intent.items.some(i =>
    typeof i.price !== 'number' || !Number.isFinite(i.price) || i.price < 0
    || typeof i.serviceId !== 'string' || typeof i.category !== 'string')) {
    throw new BookingError('bad-items', 400);
  }
  const phone = (intent.customerPhone ?? '').replace(/\D/g, '').slice(-10);
  if (phone.length < 10) throw new BookingError('bad-phone', 400);
  if (!intent.byEmployee?.id) throw new BookingError('operator-required', 400);

  const jobRef = db.collection('jobs').doc();

  return db.runTransaction(async t => {
    const existing = await t.get(intentRef);
    if (existing.exists) {
      const id = existing.data()!.jobId as string;
      const snap = await t.get(db.collection('jobs').doc(id));
      return { id, replayed: true, job: { id, ...(snap.data() as object) } as Job };
    }

    /* The operator is a label, not an authorisation - the CALLER is already
       proven staff. Still checked, so a typo can't attribute work to a
       employee id that doesn't exist. */
    const opSnap = await t.get(db.collection('employees').doc(intent.byEmployee.id));
    const operatorValid = opSnap.exists || intent.byEmployee.id === callerUid;
    if (!operatorValid) throw new BookingError('unknown-operator', 400);

    const ownerId = intent.customerId ?? null;
    // phone-keyed CRM row for accountless customers, read now so the upsert can
    // ride the same commit instead of being a best-effort afterthought
    const crmRef = db.collection('walkinCustomers').doc(phone);
    const crmSnap = ownerId ? null : await t.get(crmRef);
    const [membership, { promos, myRedemptions }] = await Promise.all([
      loadMembership(t, ownerId),
      loadPromoContext(t as unknown as Reader, ownerId),
    ]);

    /* The counter's prices stand - staff may negotiate, and that is the point
       of a kiosk. What staff may NOT do is invent a benefit: the wash cover
       and the discount below come from the same engine as the app. */
    const items = intent.items.map(i => ({ ...i, price: Math.round(i.price) }));
    const washItem = items.find(i => i.category === 'Washing');
    const top = items.reduce((a, b) => (b.price > a.price ? b : a));

    const priced = decidePrice({
      base: top.price,
      category: top.category,
      serviceId: top.serviceId,
      ownerId,
      membership,
      wantsWash: !!intent.useMembershipWash && !!washItem,
      promos,
      myRedemptions,
      date: today(),
    });

    /* A covered wash zero-prices its own line and takes the place of any other
       benefit - the same rule the kiosk has always applied
       (`memberWashActive && discount ? undefined : discount`). Spending a wash
       AND a percentage would be stacking, which this product has never done. */
    const finalItems: JobServiceItem[] = priced.washCovered && washItem
      ? items.map(i => (i === washItem ? { ...i, price: 0 } : i))
      : items;
    const subtotal = finalItems.reduce((s, i) => s + i.price, 0);
    const discount = priced.washCovered ? undefined : priced.discount;
    const usedPromo = priced.washCovered ? undefined : priced.promo;
    const totalAmount = Math.max(0, subtotal - (discount?.amount ?? 0));

    const workers = intent.assignees?.length ? intent.assignees : [intent.byEmployee];
    const at = Timestamp.now();
    /* Admin-SDK Timestamps, not the client ones `lib/types.ts` is written
       against - identical on the wire, different classes at compile time. */
    const assignments = workers.map((w, i) => ({
      employeeId: w.id, employeeName: w.name,
      role: i === 0 ? 'lead' : 'helper',
      assignedAt: at,
      assignedById: intent.byEmployee.id, assignedByName: intent.byEmployee.name,
    }));

    const job: Record<string, unknown> = {
      source: 'walk_in',
      customerName: intent.customerName,
      customerPhone: phone,
      vehicleName: intent.vehicleName,
      vehicleRegNo: (intent.vehicleRegNo ?? '').toUpperCase(),
      serviceItems: finalItems,
      status: 'checked_in' as JobStatus,
      subtotal, totalAmount,
      paymentStatus: 'pending',
      createdByEmployeeId: intent.byEmployee.id,
      createdByEmployeeName: intent.byEmployee.name,
      assignments,
      assignedIds: workers.map(w => w.id),
      statusHistory: [{
        status: 'checked_in', at,
        byEmployeeId: intent.byEmployee.id, byEmployeeName: intent.byEmployee.name,
      }],
      date: today(),
      usedMembershipWash: priced.washCovered,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (ownerId) job.customerId = ownerId;
    if (discount) job.discount = discount;
    if (priced.washCovered && priced.membershipId) job.membershipId = priced.membershipId;

    t.set(jobRef, job);

    settleBenefits(t, {
      promo: usedPromo,
      discount,
      ownerId,
      customerPhone: phone,
      refKey: jobRef.id,
      refField: 'jobId',
      washCovered: priced.washCovered,
      membership,
    });

    if (crmSnap) {
      const prev = crmSnap.data() as
        { vehicleNames?: string[]; totalSpent?: number; firstVisit?: string } | undefined;
      const vehicles = new Set([...(prev?.vehicleNames ?? []), intent.vehicleName]);
      t.set(crmRef, {
        name: intent.customerName, phone,
        vehicleNames: [...vehicles].slice(0, 10),
        visits: FieldValue.increment(1),
        totalSpent: prev?.totalSpent ?? 0,
        lastVisit: today(),
        firstVisit: prev?.firstVisit ?? today(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    t.set(intentRef, {
      callerUid, ...(ownerId ? { ownerId } : {}), kind: 'walkin', jobId: jobRef.id,
      createdAt: FieldValue.serverTimestamp(),
    });

    const now = Timestamp.now();
    return {
      id: jobRef.id, replayed: false,
      job: { ...job, id: jobRef.id, createdAt: now, updatedAt: now } as unknown as Job,
    };
  });
};

/**
 * The two benefits that cost the studio something, moved in the SAME commit as
 * the record that spends them. A promo counted without a visit, or a visit with
 * an uncounted promo, is no longer representable.
 */
const settleBenefits = (
  t: Transaction,
  a: {
    promo?: Promo;
    discount?: BookingDiscount;
    ownerId: string | null;
    customerPhone?: string;
    refKey: string;
    refField: 'bookingId' | 'jobId';
    washCovered: boolean;
    membership: (Subscription & { id: string }) | null;
  },
) => {
  const db = adminDb!;

  if (a.promo && a.discount?.source === 'promo') {
    t.update(db.collection('promos').doc(a.promo.id), {
      usedCount: (a.promo.usedCount ?? 0) + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
    t.set(db.collection('promoRedemptions').doc(`${a.promo.id}_${a.refKey}`), {
      promoId: a.promo.id,
      ...(a.ownerId ? { userId: a.ownerId } : {}),
      ...(a.customerPhone ? { customerPhone: a.customerPhone } : {}),
      [a.refField]: a.refKey,
      // the engine's own figure, computed from the server's base price - there
      // is no client number anywhere in this value
      discountAmount: a.discount.amount,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  if (a.washCovered && a.membership) {
    t.update(db.collection('subscriptions').doc(a.membership.id), {
      washesUsed: (a.membership.washesUsed ?? 0) + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
};
