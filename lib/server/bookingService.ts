import { FieldValue, Timestamp, type DocumentReference, type Transaction } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin';
import { loadOccupancy, occupancyRange, type Reader } from './occupancy';
import { decidePrice, applyDiscount } from '@/lib/services/pricing';
import { assignBay, candidateSlots, spanEndDate } from '@/lib/availability';
import {
  bookingTransition, changeWindowOf, scheduledEpochMs,
  BOOKING_EXPIRED, BOOKING_TERMINAL,
  type BookingState,
} from '@/lib/os/lifecycle';
import { pickupFees, priceVisit, taxPolicy, storedBreakdown } from '@/lib/services/pricing';
import { resolveScope } from '@/lib/os/scope';
import { pickupTimeFor, fullAddress } from '@/lib/os/address';
import { DAY_OPEN_MIN } from '@/lib/availability';
import type {
  Booking, BookingDiscount, Estimate, Job, JobServiceItem, JobStatus,
  Promo, Service, StoredBreakdown, Subscription,
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
  /** A SAVED address of the caller's own. Read server-side and snapshotted. */
  pickupAddressId?: string;
  /**
   * THE ESTIMATE THIS BOOKING IS BEING MADE FROM - design screen 07 → 08 → 09.
   *
   * An id, never a figure. The estimate is a server-written, immutable record
   * of what the customer was quoted, so spending it by id means the booking
   * carries exactly the total that was on the screen when they chose. Absent
   * for the plain "book this service" path, which prices the whole service
   * through the same engine.
   */
  estimateId?: string;
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
  /* The booking being MOVED is not an obstacle to its own move. */
  opts: { excludeBookingId?: string } = {},
) => {
  if (!isDateStr(date) || !isTimeStr(time)) throw new BookingError('bad-slot', 400);
  if (date < today()) throw new BookingError('slot-in-the-past', 400);
  if (!candidateSlots(durationMinutes).includes(time)) throw new BookingError('not-a-slot', 400);

  const { rangeStart, rangeEnd } = occupancyRange([date], durationMinutes);
  const { occupants, cfg } = await loadOccupancy(reader, rangeStart, rangeEnd, {
    excludeBookingIds: opts.excludeBookingId ? [opts.excludeBookingId] : undefined,
  });

  /**
   * THE BAY IS CHOSEN HERE, INSIDE THE TRANSACTION, OR THERE IS NO BOOKING.
   *
   * This asked `computeAvailability` whether the slot was full and then wrote a
   * booking with no bay on it. Two customers taking the last bay at the same
   * moment both read "not full" and both were accepted - the transaction
   * retried on the WRITE, but neither write touched a document the other had
   * read, so there was nothing to conflict on.
   *
   * Assigning names the bay, and the caller writes that name onto the booking
   * inside this same transaction. The read set now includes the bookings that
   * occupy the bay, so a concurrent booking of the last one is a genuine
   * Firestore contention and one of the two retries and is refused.
   *
   * The client never sends a bay. It could not be trusted with one: it does not
   * know what else is on the floor, and the whole point of this function is
   * that the server decides.
   */
  const [h, m] = time.split(':').map(Number);
  const bay = assignBay(category, date, h * 60 + m, durationMinutes, occupants, cfg);
  if (!bay) throw new BookingError('slot-taken');
  return bay;
};

/**
 * WHOSE DECISION IS THIS, AND IS THE CALLER LOOKING AT THE CURRENT ONE?
 *
 * Two protections, both needed, both applied to every customer-initiated
 * mutation of an existing booking.
 *
 * 1 · AUTHORITY. Studio and admin are ONE authority against the customer.
 *     Once either has decided something about a booking - confirmed it, moved
 *     it, re-scoped it - `lastDecidedBy` is `studio`, and a customer may not
 *     write over it. They keep whatever the STATE MACHINE still grants them,
 *     which is withdrawing a request; that is checked separately by
 *     `bookingTransition` and is deliberately not weakened here.
 *
 * 2 · STALENESS. A phone can hold a booking on screen for an hour. If the
 *     studio reschedules in that time, a "cancel" or "move" sent from that
 *     screen was computed against a booking that no longer exists in that
 *     shape. A customer write must carry the `version` it read; anything else
 *     is refused rather than applied on top of a newer decision.
 *
 * Staff are exempt from both: they ARE the authority, and the floor cannot be
 * made to reload a screen before it can move a car.
 */
const guardCustomerWrite = (
  booking: Booking,
  opts: { byStaff?: boolean; expectedVersion?: number },
  intent: 'reschedule' | 'cancel',
): void => {
  if (opts.byStaff) return;

  if (typeof opts.expectedVersion === 'number'
      && typeof booking.version === 'number'
      && opts.expectedVersion !== booking.version) {
    throw new BookingError('stale-write', 409);
  }

  /* Withdrawing is the customer's own right and the machine already bounds it.
     Re-timing something the studio has settled is not. */
  if (intent === 'reschedule' && booking.lastDecidedBy === 'studio') {
    throw new BookingError('studio-decided', 409);
  }
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

  /* Firestore retries a contended transaction 5 times by default. Eight
     simultaneous identical requests all collide on the same idempotency
     marker, and some exhausted the budget and surfaced as a 500 - the booking
     was still made exactly once, but a caller was told it had failed. More
     attempts, same semantics. */
  return db.runTransaction(async t => {
    /* ---- every read first; Firestore forbids a read after a write ---- */
    const existing = await t.get(intentRef);
    if (existing.exists) {
      const id = existing.data()!.bookingId as string;
      const snap = await t.get(db.collection('bookings').doc(id));
      const prior = snap.data() as { status?: string } | undefined;
      /* A marker is only a replay while the visit it points at is still
         standing. Because the key is derived from the intent, a customer who
         cancels and then books the same slot again arrives with the same key -
         and handing back the cancelled booking would silently swallow the
         second request. A cancelled or deleted record frees the intent. */
      if (prior && prior.status !== 'cancelled') {
        return {
          id, replayed: true,
          booking: { id, ...(snap.data() as object) } as Booking,
        };
      }
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

    /* ---- THE ESTIMATE, READ INSIDE THE TRANSACTION ----
       Inside, because it is also SPENT inside: an estimate that has already
       produced a booking must not produce a second one, and checking that
       outside the commit is checking it in a window somebody can race. */
    let estimate: Estimate | null = null;
    if (intent.estimateId) {
      const estRef = db.collection('estimates').doc(intent.estimateId);
      const estSnap = await t.get(estRef);
      if (!estSnap.exists) throw new BookingError('estimate-not-found', 404);
      const est = { id: estSnap.id, ...(estSnap.data() as object) } as Estimate;
      /* The same answer as an id that does not exist, so this cannot be used
         to discover which estimates are real. */
      if (est.userId !== ownerId) throw new BookingError('estimate-not-found', 404);
      if (est.vehicleId !== intent.vehicleId || est.serviceId !== intent.serviceId) {
        throw new BookingError('estimate-mismatch', 409);
      }
      if (est.status === 'consumed') throw new BookingError('estimate-already-used', 409);
      if (est.expiresOn < today()) throw new BookingError('estimate-expired', 409);
      estimate = est;
    }

    /* ---- WHERE THE VAN GOES ----
       Read from UNDER the caller's own document, so a forged address id cannot
       name somebody else's home - there is no path to it. Snapshotted onto the
       booking, so a later correction to the saved address cannot rewrite where
       this visit was collected from. */
    let addressRef: Booking['pickupAddressRef'] | undefined;
    if (intent.pickupAddressId) {
      const aSnap = await t.get(ownerRef.collection('addresses').doc(intent.pickupAddressId));
      if (!aSnap.exists) throw new BookingError('address-not-yours', 403);
      const a = aSnap.data() as {
        label: string; line1: string; line2?: string; area: string;
        city: string; pincode: string; contactName?: string; contactPhone?: string;
      };
      addressRef = {
        addressId: aSnap.id,
        label: a.label, line: fullAddress(a),
        line1: a.line1, ...(a.line2 ? { line2: a.line2 } : {}),
        area: a.area, city: a.city, pincode: a.pincode,
        ...(a.contactName ? { contactName: a.contactName } : {}),
        ...(a.contactPhone ? { contactPhone: a.contactPhone } : {}),
      };
    }

    /* THE BAY IS HELD FOR THE WORK ACTUALLY CHOSEN. A full-body PPF with a
       two-stage correction takes longer than the catalogue's headline
       duration, and reserving the headline would double-book the bay on the
       second day. */
    const duration = estimate?.scope.durationMinutes ?? service.duration ?? 60;
    /* AN UNKNOWN DURATION IS NOT A SIXTY-MINUTE ONE. A catalogue entry with no
       duration used to fall back to 60, which reserves a fraction of what the
       work needs and double-books the bay behind it. The studio can price a
       service without timing it; it cannot schedule one. */
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new BookingError('service-has-no-duration', 409);
    }
    const bay = await assertSlotOpen(
      t as unknown as Reader,
      intent.scheduledDate, intent.scheduledTime, service.category ?? '', duration,
    );

    /* ---- THE PRICE, DECIDED ONCE, BY THE CANONICAL ENGINE ----

       This used to be `decidePrice` for the service line plus a hand-added
       pickup fee, while the invoice added GST by a different route and the
       seal INFERRED the discount by subtracting one total from another. Four
       places, and the estimate and the invoice provably drifted.

       `priceVisit` is the whole calculation: work → discount → fees → tax →
       total, in that fixed order. Two ways in, one arithmetic:

         · WITH AN ESTIMATE the breakdown is the FROZEN one the customer saw.
           Re-deciding it here would mean a catalogue edit between quoting and
           booking silently repriced a customer mid-decision.
         · WITHOUT ONE the whole service is resolved and priced right here, so
           the plain path and the scoped path cannot disagree. */
    const pickup = !!intent.pickup, drop = !!intent.drop;

    const whole = resolveScope({ id: intent.serviceId, ...service } as Service, {});

    const breakdown: StoredBreakdown = estimate
      ? estimate.breakdown
      : storedBreakdown(priceVisit({
          services: whole.ok ? whole.lines : [{ name: service.name ?? '', price: service.price }],
          fees: pickupFees({ pickup, drop }),
          tax: taxPolicy(),
          benefit: {
            base: service.price,
            category: service.category ?? '',
            serviceId: intent.serviceId,
            ownerId,
            membership,
            wantsWash: !!intent.useMembershipWash,
            promos,
            myRedemptions,
            date: today(),
          },
        }));

    /* The legacy field the admin still reads, summed from the fee lines the
       engine named rather than computed a second time. */
    const pickupDropFee = breakdown.fees.reduce((n, f) => n + f.amount, 0);
    /* A LEG WITH NOWHERE TO GO IS NOT A LEG. The studio cannot collect a car
       from an address nobody gave it, and charging ₹50 for the attempt would
       be charging for a journey that cannot be made. */
    if (pickupDropFee > 0 && !addressRef && !intent.pickupAddress?.trim()) {
      throw new BookingError('pickup-address-required', 400);
    }
    const totalAmount = breakdown.total;

    /* The benefit that was actually applied, as the settlement needs it. With
       an estimate this comes out of the frozen breakdown - the promo the
       customer was quoted is the promo that gets counted. */
    const priced = {
      washCovered: breakdown.washCovered,
      membershipId: breakdown.membershipId,
      discount: breakdown.discount,
      promo: breakdown.promoId ? promos.find(p => p.id === breakdown.promoId) : undefined,
    };

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
      /* Decided by the server, inside the transaction that reserved it. */
      bayId: bay.id,
      bayGroup: bay.group,
      version: 1,
      lastDecidedBy: isStaff ? 'studio' : 'customer',
      pickupDropRequired: pickup || drop,
      pickupRequired: pickup,
      dropRequired: drop,
      pickupDropFee,
      pickupAddress: pickupDropFee > 0
        ? (addressRef?.line ?? intent.pickupAddress?.trim() ?? '') : '',
      ...(addressRef ? { pickupAddressRef: addressRef } : {}),
      /* DERIVED FROM THE SLOT, never chosen - a collection time a customer
         could set independently could fall after the work was due to start. */
      ...(pickup
        ? { pickupTime: pickupTimeFor(intent.scheduledTime, DAY_OPEN_MIN) ?? intent.scheduledTime }
        : {}),
      totalAmount,
      scheduledDate: intent.scheduledDate,
      scheduledTime: intent.scheduledTime,
      /* THE LAST DAY THE BAY IS HELD. Equal to `scheduledDate` for anything
         that finishes the same day, so every booking carries the field and no
         reader has to decide whether an absent one means "same day" or "we
         never worked it out". Derived from the duration by the availability
         engine - the same expansion that reserves the bay. */
      endDate: spanEndDate(
        intent.scheduledDate,
        Number(intent.scheduledTime.slice(0, 2)) * 60 + Number(intent.scheduledTime.slice(3, 5)),
        duration,
      ),
      status: 'pending',
      paymentMethod: intent.paymentMethod === 'upi' ? 'upi' : 'cash',
      paymentStatus: 'pending',
      transactionId: '',
      usedMembershipWash: priced.washCovered,
      ...(priced.membershipId && priced.washCovered
        ? { membershipId: priced.membershipId } : {}),
      ...(priced.discount ? { discount: priced.discount } : {}),
      /* WHAT WAS AGREED, FROZEN. The catalogue is authoritative for the next
         quote and may never rewrite this one - the same rule the captured
         warranty terms follow, applied to money. */
      breakdown,
      ...(estimate ? { scope: estimate.scope, estimateId: estimate.id } : {}),
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

    /* SPENT IN THE SAME COMMIT AS THE BOOKING IT PAID FOR. An estimate marked
       used without a booking, or a booking made from an estimate still open to
       be used again, are both representable only if these are two writes. */
    if (estimate) {
      t.update(db.collection('estimates').doc(estimate.id), {
        status: 'consumed',
        bookingId: bookingRef.id,
        consumedAt: FieldValue.serverTimestamp(),
      });
    }

    t.set(intentRef, {
      callerUid, ownerId, kind: 'appointment', bookingId: bookingRef.id,
      createdAt: FieldValue.serverTimestamp(),
    });

    const now = Timestamp.now();
    return {
      id: bookingRef.id, replayed: false,
      booking: { ...booking, id: bookingRef.id, createdAt: now, updatedAt: now } as Booking,
    };
  }, { maxAttempts: 12 });
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
    // through the one engine - the last hand-rolled discount line in the repo
    const totalAmount = applyDiscount(subtotal, discount);

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
  }, { maxAttempts: 12 });
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

/* ────────────────────────────────────────────────────────────────────────────
   GIVING BACK WHAT A CANCELLED VISIT CONSUMED.

   `settleBenefits` above SPENDS a membership wash and a promo redemption when a
   booking is created. Nothing gave them back. A customer who cancelled - or
   whose booking the STUDIO refused - permanently lost a wash they had paid for
   and a promo they had not used. `cancelBooking` in lib/services/bookings.ts
   only ever wrote `status: 'cancelled'`.

   It could not have been fixed there. `firestore.rules` lets a customer touch a
   subscription's `status` and nothing else, so a client cannot decrement
   `washesUsed`; the restore has to be server-authoritative. It lives here,
   beside the code that spends it, so the two can never drift apart.
   ──────────────────────────────────────────────────────────────────────────── */

export interface CancelResult {
  id: string;
  /** true when the booking was ALREADY cancelled - nothing was given back. */
  alreadyCancelled: boolean;
  washRestored: boolean;
  promoRestored: boolean;
}

/**
 * WHICH STATUSES MAY STILL BE CANCELLED IS NOT THIS FILE'S OPINION.
 *
 * It used to be: a local `CANCELLABLE` array here, a duplicate list in
 * `firestore.rules`, and a third in `ManageVisit`'s `changeable` flag. The one
 * table lives in `lib/os/lifecycle` now, and every caller asks it - so the
 * sheet cannot offer an act the server refuses, and the rules cannot allow one
 * the service rejects.
 */

/**
 * Cancel a booking and return everything it consumed, in ONE commit.
 *
 * IDEMPOTENT BY READ, not by marker: the booking's own status is the guard. A
 * second cancel finds it already `cancelled` and restores nothing, so a retry
 * or a double tap cannot credit two washes.
 *
 * `byStaff` allows the studio to refuse a booking that a customer could no
 * longer cancel themselves - the refusal must still return the wash.
 */
export const cancelBookingAuthoritative = async (
  callerUid: string,
  bookingId: string,
  opts: { byStaff?: boolean; reason?: string; noShow?: boolean; expectedVersion?: number } = {},
): Promise<CancelResult> => {
  if (!adminDb) throw new BookingError('not-configured', 503);
  if (!bookingId || typeof bookingId !== 'string') throw new BookingError('bad-booking', 400);
  const db = adminDb;

  return db.runTransaction(async t => {
    const bookingRef = db.collection('bookings').doc(bookingId);
    const snap = await t.get(bookingRef);
    if (!snap.exists) throw new BookingError('not-found', 404);
    const booking = { id: snap.id, ...(snap.data() as object) } as Booking;

    if (!opts.byStaff && booking.userId !== callerUid) {
      throw new BookingError('not-yours', 403);
    }
    guardCustomerWrite(booking, opts, 'cancel');

    /* Already cancelled: succeed, restore nothing. The caller asked for a state
       the booking is already in, which is not an error - but crediting a second
       wash for it would be. */
    if (booking.status === 'cancelled') {
      return { id: bookingId, alreadyCancelled: true, washRestored: false, promoRestored: false };
    }

    /* A customer may not cancel work already under way; the studio may. The
       machine decides, and returns the reason the API hands back verbatim. */
    const move = bookingTransition(
      booking.status, 'cancelled', opts.byStaff ? 'studio' : 'customer',
    );
    if (!move.ok) throw new BookingError(move.reason ?? 'too-late', 409);

    let washRestored = false;
    let promoRestored = false;

    /* ── the wash ──
       A NO-SHOW FORFEITS IT. The studio held the bay and the slot went unused,
       so the entitlement is spent even though no work happened. A cancellation
       in time, and a refusal by the studio, both return it. This is a business
       rule and it is the one place it is written. */
    if (booking.usedMembershipWash && booking.membershipId && !opts.noShow) {
      const subRef = db.collection('subscriptions').doc(booking.membershipId);
      const subSnap = await t.get(subRef);
      if (subSnap.exists) {
        const sub = subSnap.data() as Subscription;
        /* Floored at zero. A membership that was edited between the booking and
           the cancel must not be driven negative by giving one back. */
        t.update(subRef, {
          washesUsed: Math.max(0, (sub.washesUsed ?? 0) - 1),
          updatedAt: FieldValue.serverTimestamp(),
        });
        washRestored = true;
      }
    }

    /* ── the promo ──
       Returned even on a no-show: a promo is a right to a price, not a
       consumable the studio spent holding a bay. */
    if (booking.discount?.source === 'promo' && booking.discount.promoId) {
      const promoRef = db.collection('promos').doc(booking.discount.promoId);
      const promoSnap = await t.get(promoRef);
      const redemptionRef = db
        .collection('promoRedemptions')
        .doc(`${booking.discount.promoId}_${bookingId}`);
      const redemptionSnap = await t.get(redemptionRef);

      /* The redemption document is the evidence that it was actually spent.
         Decrementing without it would let a booking that never redeemed the
         promo hand a use back to the pool. */
      if (redemptionSnap.exists) {
        if (promoSnap.exists) {
          const promo = promoSnap.data() as Promo;
          t.update(promoRef, {
            usedCount: Math.max(0, (promo.usedCount ?? 0) - 1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        t.delete(redemptionRef);
        promoRestored = true;
      }
    }

    t.update(bookingRef, {
      status: 'cancelled',
      /* THE BAY IS RELEASED BY THE STATUS, not by clearing the field.
         `loadOccupancy` only counts live bookings, so a cancelled, rejected or
         expired one stops occupying the moment its status changes - and keeping
         `bayId` means the studio can still see where the car WOULD have gone. */
      version: (booking.version ?? 0) + 1,
      lastDecidedBy: opts.byStaff ? 'studio' : 'customer',
      cancelledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      ...(opts.reason ? { rejectionReason: opts.reason } : {}),
      ...(opts.noShow ? { noShow: true } : {}),
    });

    return { id: bookingId, alreadyCancelled: false, washRestored, promoRestored };
  }, { maxAttempts: 8 });
};

/* ────────────────────────────────────────────────────────────────────────────
   MOVING A VISIT - design screen 10.

   THE RULE THIS ENFORCES IS NOT A UI RULE. Until now `rescheduleBooking` was
   `updateDoc(doc(db,'bookings',id), { scheduledDate, scheduledTime })` from the
   browser, permitted by a rule that checked only which KEYS changed. So a
   customer could move a visit to an hour the studio was already working, to a
   date in the past, to a slot that does not exist, and - the one that costs
   money - to two hours before a two-day PPF the studio had already ordered
   film for. The browser also decided whether the 24-hour window had closed,
   from the browser's own clock, which anybody can set.

   Everything below runs on the server's clock, against the booking's OWN
   scheduled timestamp, inside the transaction that writes the move.
   ──────────────────────────────────────────────────────────────────────────── */

export interface RescheduleResult {
  id: string;
  from: { scheduledDate: string; scheduledTime: string };
  to: { scheduledDate: string; scheduledTime: string; endDate: string };
  /** How many times this booking has now been moved. */
  moves: number;
  /** True when the request asked for the slot it already held. */
  unchanged: boolean;
}

export const rescheduleBookingAuthoritative = async (
  callerUid: string,
  bookingId: string,
  next: { scheduledDate: string; scheduledTime: string },
  opts: { byStaff?: boolean; now?: Date; expectedVersion?: number } = {},
): Promise<RescheduleResult> => {
  if (!adminDb) throw new BookingError('not-configured', 503);
  if (!bookingId || typeof bookingId !== 'string') throw new BookingError('bad-booking', 400);
  if (!isDateStr(next?.scheduledDate) || !isTimeStr(next?.scheduledTime)) {
    throw new BookingError('bad-slot', 400);
  }
  const db = adminDb;
  const now = opts.now ?? new Date();

  return db.runTransaction(async t => {
    const ref = db.collection('bookings').doc(bookingId);
    const snap = await t.get(ref);
    if (!snap.exists) throw new BookingError('not-found', 404);
    const booking = { id: snap.id, ...(snap.data() as object) } as Booking;

    if (!opts.byStaff && booking.userId !== callerUid) {
      throw new BookingError('not-yours', 403);
    }
    guardCustomerWrite(booking, opts, 'reschedule');

    /* ── 1 · a settled booking has no slot left to move ──
       A move is not a status change, so the transition table is not the guard
       here; what it does settle is that these three states are final, and a
       record that is final may not acquire a new date under any caller. */
    if (BOOKING_TERMINAL.includes(booking.status)) {
      throw new BookingError(`already-${booking.status}`, 409);
    }

    /* ── 2 · the 24-hour rule, on the SERVER's clock ──
       Measured from the booking's own scheduled timestamp, interpreted in
       studio time. Staff may move a booking at any time - the studio ringing a
       customer to say "we can take you earlier" is the case this exists for,
       and it is the studio's own bay to give away. */
    if (!opts.byStaff) {
      const window = changeWindowOf(
        {
          status: booking.status as BookingState,
          scheduledDate: booking.scheduledDate,
          scheduledTime: booking.scheduledTime,
        },
        now,
      );
      if (!window.allowed) throw new BookingError(window.reason, 409);
    }

    /* Asking for the slot it already holds is not an error and writes nothing:
       a double tap must not consume a move or re-announce the visit. */
    if (booking.scheduledDate === next.scheduledDate
        && booking.scheduledTime === next.scheduledTime) {
      return {
        id: bookingId,
        from: { scheduledDate: booking.scheduledDate, scheduledTime: booking.scheduledTime },
        to: {
          scheduledDate: booking.scheduledDate,
          scheduledTime: booking.scheduledTime,
          endDate: booking.endDate ?? booking.scheduledDate,
        },
        moves: booking.rescheduleCount ?? 0,
        unchanged: true,
      };
    }

    /* ── 3 · the destination must be a slot the studio can actually work ──
       The SAME occupancy the availability endpoint offers from, inside this
       transaction, with this booking excluded so it cannot block itself. */
    /* An old booking taken under the counting model may carry no duration at
       all; 60 is the only honest fallback for a record that never had one, and
       it is deliberately NOT applied to new bookings - see `create`. */
    const duration = booking.serviceDurationMinutes ?? 60;
    const movedBay = await assertSlotOpen(
      t as unknown as Reader,
      next.scheduledDate, next.scheduledTime, booking.serviceCategory ?? '', duration,
      { excludeBookingId: bookingId },
    );

    const startMin = Number(next.scheduledTime.slice(0, 2)) * 60
      + Number(next.scheduledTime.slice(3, 5));
    const endDate = spanEndDate(next.scheduledDate, startMin, duration);

    t.update(ref, {
      scheduledDate: next.scheduledDate,
      scheduledTime: next.scheduledTime,
      endDate,
      /* A MOVE RE-ASSIGNS THE BAY. The old one is released by the same write
         that takes the new one, so a reschedule can never leave a car holding
         two bays, and the bay it lands in is chosen by the server against the
         floor as it stands inside this transaction. */
      bayId: movedBay.id,
      bayGroup: movedBay.group,
      /* The audit trail. `SEQUENCE` in the calendar export reads this, which is
         what tells an owner's calendar that the new time supersedes the old. */
      rescheduleCount: (booking.rescheduleCount ?? 0) + 1,
      rescheduledAt: FieldValue.serverTimestamp(),
      rescheduledBy: opts.byStaff ? 'studio' : 'customer',
      /* Every write moves the version, or the staleness guard has nothing to
         compare against; and it records the authority, so a studio move locks
         the booking against later customer re-timing. */
      version: (booking.version ?? 0) + 1,
      lastDecidedBy: opts.byStaff ? 'studio' : 'customer',
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      id: bookingId,
      from: { scheduledDate: booking.scheduledDate, scheduledTime: booking.scheduledTime },
      to: { scheduledDate: next.scheduledDate, scheduledTime: next.scheduledTime, endDate },
      moves: (booking.rescheduleCount ?? 0) + 1,
      unchanged: false,
    };
  }, { maxAttempts: 8 });
};

/* ────────────────────────────────────────────────────────────────────────────
   AGEING A REQUEST OUT.

   Three bookings sat `pending` thirteen to seventeen days past the day they
   asked for. They were correctly excluded from "upcoming", so the customer
   could not see them, could not cancel them, and had no way to learn that the
   studio was never going to answer. A record with no terminal state does not
   resolve; it just stops being looked at.

   `expired` is deliberately NOT `cancelled` - see lib/os/lifecycle. A wash is
   returned here, because the studio held a bay nobody used only in the sense
   that the studio never accepted it: an unanswered request consumed nothing.
   ──────────────────────────────────────────────────────────────────────────── */

export const expireBookingAuthoritative = async (
  bookingId: string,
  opts: { now?: Date } = {},
): Promise<{ id: string; expired: boolean; washRestored: boolean }> => {
  if (!adminDb) throw new BookingError('not-configured', 503);
  const db = adminDb;
  const now = opts.now ?? new Date();

  return db.runTransaction(async t => {
    const ref = db.collection('bookings').doc(bookingId);
    const snap = await t.get(ref);
    if (!snap.exists) throw new BookingError('not-found', 404);
    const booking = { id: snap.id, ...(snap.data() as object) } as Booking;

    const move = bookingTransition(booking.status as BookingState, BOOKING_EXPIRED, 'system');
    if (!move.ok) return { id: bookingId, expired: false, washRestored: false };

    /* Only a request whose DAY has gone. `isStaleRequest` is the same predicate
       the projection uses to stop calling it upcoming, so a booking can never
       be invisible and un-expired at once. */
    const at = scheduledEpochMs(booking.scheduledDate, booking.scheduledTime);
    if (at === null || now.getTime() - at <= 24 * 60 * 60 * 1000) {
      return { id: bookingId, expired: false, washRestored: false };
    }

    let washRestored = false;
    if (booking.usedMembershipWash && booking.membershipId) {
      const subRef = db.collection('subscriptions').doc(booking.membershipId);
      const subSnap = await t.get(subRef);
      if (subSnap.exists) {
        const sub = subSnap.data() as Subscription;
        t.update(subRef, {
          washesUsed: Math.max(0, (sub.washesUsed ?? 0) - 1),
          updatedAt: FieldValue.serverTimestamp(),
        });
        washRestored = true;
      }
    }

    t.update(ref, {
      status: BOOKING_EXPIRED,
      expiredAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { id: bookingId, expired: true, washRestored };
  }, { maxAttempts: 6 });
};
