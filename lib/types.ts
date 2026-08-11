import { Timestamp } from 'firebase/firestore';
import type { Term } from './os/term';

/** Customer-controlled notification channels/categories (Profile → Notifications). */
export interface NotificationPrefs {
  promotions: boolean;
  serviceReminders: boolean;
  membershipReminders: boolean;
  whatsapp: boolean;
}

export interface User {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  photoURL?: string;
  notificationPrefs?: NotificationPrefs;
  role: 'customer' | 'employee' | 'admin';
  /** Set when role === 'employee' - links to the employees collection */
  employeeId?: string;
  /** Admin-written notes shown on the Customer 360 page */
  notes?: string;
  tags?: string[];
  /**
   * When this customer finished their first arrival. Absent means they have
   * not.
   *
   * ON THE USER DOCUMENT, not in localStorage, and that is the whole point:
   * the flag used to be `localStorage['automodz-welcomed']`, so signing in on
   * a second device welcomed the same person again, clearing browser data
   * re-triggered it forever, and there was no way for the studio to reset it
   * for someone. The server owns this.
   */
  welcomedAt?: Timestamp;
  /**
   * QUIET MODE — design screen 19: "Only approvals and handover reach you."
   *
   * It suppresses DELIVERY, never the record. Which events break through is
   * `BREAKS_QUIET` in lib/os/events.ts, and it is the engine's decision rather
   * than each caller's, so no code path can forget to honour it and none can
   * silently over-honour it and swallow a handover.
   */
  quietMode?: boolean;
  /**
   * The customer's UPI address, for the payment intent on screen 13.
   *
   * NEVER read to decide an amount, and never published. The payable figure is
   * always the studio's own, from the sealed visit; this only decides which
   * app opens. Owner-readable and owner-writable, and nothing else may read it.
   */
  upiVpa?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * A SAVED PICKUP OR DROP ADDRESS — `users/{uid}/addresses/{id}`.
 *
 * Design screens 08 ("Bodakdev · Home") and 19 ("Pickup addresses · 2 saved").
 * Structured rather than a free string, because a driver needs the parts:
 * `bookings.pickupAddress` was declared and never populated, and a single line
 * cannot be validated, cannot be re-used, and cannot tell a pincode from a
 * flat number.
 *
 * A booking stores a SNAPSHOT of the chosen address, not a reference. Editing
 * a saved address later must never rewrite where a past visit was collected
 * from — the same rule the captured warranty terms follow.
 */
export interface SavedAddress {
  id: string;
  /** "Home", "Office" — the customer's own word. */
  label: string;
  line1: string;
  line2?: string;
  area: string;
  city: string;
  pincode: string;
  /** Who the driver asks for, when it is not the account holder. */
  contactName?: string;
  contactPhone?: string;
  /** Exactly one address may hold this. Enforced server-side in one commit. */
  isDefault: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Vehicle {
  id: string;
  name: string;
  registrationNumber: string;
  /** the cover - the Glance's hero. Always mirrors photos[0] so every existing
   *  reader keeps working; `photos` is the full, ordered gallery. */
  photo?: string;
  /** the car's gallery, in the owner's own order. photos[0] is the cover. */
  photos?: string[];
  /** legacy descriptors; the photograph replaced the pickers that set them */
  category?: 'Hatchback' | 'Sedan' | 'Compact SUV' | 'Full SUV' | 'Luxury';
  color?: string;
  notes?: string;
  /**
   * THE ODOMETER, IN KILOMETRES.
   *
   * The car's own room shows it (design screen 1d) and nothing in the product
   * held it — a customer could see their coating's life and their warranty and
   * not the one number every owner knows by heart. Optional and owner-entered:
   * the studio reads it at every visit but does not publish it, so a value
   * here is the owner's, and a car without one simply does not show the tile
   * rather than showing a zero.
   */
  odometer?: number;
  /** The model year, as the owner gives it. Part of the car's one-line descriptor. */
  year?: number;
  /**
   * MAY THIS CAR'S SERVICE HISTORY BE SHOWN PUBLICLY?
   *
   * Design screen 17 puts "detailed here since 2021 · 11 visits · 340 photos ·
   * original paint" on a listing anyone can open. That is one customer's
   * record shown to strangers, so it is consent, and consent has rules:
   *
   *   ABSENT MEANS NO. Not "not asked yet", not "probably fine" — no. Every
   *   existing car is therefore private until its owner says otherwise, and
   *   nobody is grandfathered in.
   *
   *   IT BELONGS TO THE CAR, NOT THE LISTING. A listing is created, edited and
   *   deleted by the studio; consent must outlive that and cannot be acquired
   *   by making a listing.
   *
   *   IT IS NEVER INFERRED. Not from owning the car, not from completing a
   *   visit, not from uploading photographs, not from listing it for sale.
   *   Only an explicit act by the owner grants it, and any act revokes it
   *   immediately.
   *
   * `revokedAt` is kept rather than the record being deleted, so the audit
   * trail can answer "was this public on the day that buyer saw it".
   */
  publicHistoryConsent?: {
    granted: boolean;
    grantedAt?: Timestamp;
    revokedAt?: Timestamp;
  };
  createdAt: Timestamp;
}

/**
 * HOW MUCH OF THE CAR — design screen 07's three coverages.
 *
 * A scope is a PRICED VARIANT of a service, not a service of its own. "Front
 * end PPF" and "Full-body PPF" are one piece of work at two sizes: the same
 * film, the same warranty, the same bay. Modelling them as two catalogue
 * entries would duplicate the brand, the description and the warranty, and the
 * day one of those is edited the two stop agreeing about what the studio sells.
 */
export type ScopeKind = 'front' | 'full' | 'custom';

export interface ServicePanel {
  id: string;
  /** "Rear quarter", "Bonnet" — the customer's word for a part of the car. */
  label: string;
  price: number;
  durationMinutes: number;
}

export interface ServiceScope {
  id: string;
  kind: ScopeKind;
  /** "Full body" */
  label: string;
  /** The one line under it — what is actually covered. */
  detail: string;
  /**
   * ABSENT FOR `custom`, and that absence is the design's "On quote".
   * A custom coverage is priced by picking panels, or by the studio quoting
   * it; there is no table price to read, and a zero here would claim there is.
   */
  price?: number;
  durationMinutes?: number;
  /** Which panels this scope covers. Only meaningful for `custom`. */
  panels?: ServicePanel[];
  order?: number;
}

/**
 * An extra stage, chosen at quote time. A real catalogue object with a price
 * and a duration — never a string a client can invent.
 */
export interface ServiceAddOn {
  id: string;
  /** "Two-stage correction" */
  label: string;
  /** "Recommended before film" / "Adds 4 hours" */
  detail: string;
  price: number;
  durationMinutes: number;
  /** Scope ids this is recommended alongside. Advisory only; never enforced. */
  recommendedWith?: string[];
  order?: number;
}

export interface Service {
  id: string;
  category: 'PPF' | 'Washing' | 'Ceramic' | 'Coating';
  name: string;
  brand: string | null;
  price: number;
  duration: number; // minutes
  warranty: string | null;
  description: string;
  popular: boolean;
  active: boolean;
  order: number;
  /**
   * Screen 07's coverages. A service with none is booked whole, at `price`,
   * exactly as every service was before — so this is additive and no existing
   * catalogue entry has to change to keep working.
   */
  scopes?: ServiceScope[];
  addOns?: ServiceAddOn[];
  createdAt: Timestamp;
}

/**
 * WHAT WAS CHOSEN, AS IT WAS PRICED AT THE TIME.
 *
 * Copied onto the estimate and then onto the booking. The catalogue is
 * authoritative for the NEXT quote and may never rewrite this one — the same
 * rule `CapturedTerm` exists for, applied to money instead of to a warranty.
 */
export interface BookedScope {
  scopeId: string;
  scopeKind: ScopeKind;
  label: string;
  /** Only for `custom`: the panels chosen, each at the price it carried then. */
  panels?: { id: string; label: string; price: number }[];
  addOns: { id: string; label: string; price: number; durationMinutes: number }[];
  /** The work before any benefit — the figure the estimate was built on. */
  workPrice: number;
  durationMinutes: number;
  /** Screen 07's "2 days in the bay". */
  bayDays: number;
}

/**
 * A PRICE BREAKDOWN AS STORED.
 *
 * `PriceBreakdown` (lib/services/pricing.ts) carries the whole `Promo`
 * document, which is a live record with its own timestamps and usage counts.
 * Freezing that into an estimate would be freezing a copy of a record that
 * keeps changing; only the promo's IDENTITY belongs in a snapshot.
 */
export interface StoredBreakdown {
  subtotal: number;
  discount?: BookingDiscount;
  discountAmount: number;
  fees: { label: string; amount: number }[];
  feesTotal: number;
  taxable: number;
  /** ABSENT when no tax applied — never a zero, which would claim a nil charge. */
  tax?: { rate: number; amount: number; gstin?: string };
  total: number;
  washCovered: boolean;
  membershipId?: string;
  promoId?: string;
}

/**
 * THE ESTIMATE — design screen 07's "Estimate · Gold −12% · ₹1,26,720".
 *
 * Server-created, immutable, owner-scoped. It exists so that the figure a
 * customer saw when they chose is the figure carried to the date screen, to
 * the confirmation, and into the booking — rather than each of those four
 * surfaces recomputing it and one of them being right.
 *
 * "Final on inspection" is still true and is not a licence to drift: the final
 * figure may only rise through an APPROVAL the customer granted (screen 12).
 */
export interface Estimate {
  id: string;
  userId: string;
  vehicleId: string;
  serviceId: string;
  serviceName: string;
  serviceCategory: string;
  scope: BookedScope;
  breakdown: StoredBreakdown;
  /** Legs priced into `breakdown.fees`, restated so a reader need not parse labels. */
  pickup: boolean;
  drop: boolean;
  /** YYYY-MM-DD. A price quoted against a catalogue does not stand for ever. */
  expiresOn: string;
  status: 'open' | 'consumed' | 'expired';
  bookingId?: string;
  createdAt: Timestamp;
}

/**
 * `expired` is a TERMINAL state and it is not a cancellation.
 *
 * Three bookings sat `pending` thirteen to seventeen days past the day they
 * asked for, correctly excluded from "upcoming" and therefore invisible: the
 * customer could not see them, could not cancel them, and were never told the
 * studio would not answer. A request that is never answered has to resolve
 * somewhere, and calling it `cancelled` would put a decision in the record that
 * nobody made — and would credit back a membership wash on a slot that was
 * never accepted. The transitions into it live in lib/os/lifecycle.ts.
 */
export type BookingStatus =
  | 'pending' | 'confirmed' | 'vehicle_received'
  | 'in_progress' | 'quality_check' | 'ready_for_delivery'
  | 'completed' | 'cancelled' | 'expired';

export interface Booking {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  userEmail: string;
  vehicleId: string;
  vehicleName: string;
  vehicleRegNo: string;
  serviceId: string;
  serviceName: string;
  serviceCategory: string;
  serviceBasePrice: number;
  /** Duration of the booked service in minutes, used for capacity calculations */
  serviceDurationMinutes?: number;
  pickupDropRequired: boolean;
  pickupDropFee: number;
  /** Granular legs - ₹50 each, either or both (older bookings only have pickupDropRequired) */
  pickupRequired?: boolean;
  dropRequired?: boolean;
  /** The one-line form, kept because the WhatsApp template reads it. */
  pickupAddress?: string;
  /**
   * WHERE THE VAN ACTUALLY GOES — a SNAPSHOT of the saved address, never a
   * reference to it.
   *
   * A customer who moves house and corrects "Home" has not changed the street
   * the studio drove to last March. Editing a saved address must change where
   * the next van goes and must never rewrite where the last one went — the
   * same rule the captured warranty terms follow.
   */
  pickupAddressRef?: {
    addressId: string;
    label: string;
    line: string;
    line1: string;
    line2?: string;
    area: string;
    city: string;
    pincode: string;
    contactName?: string;
    contactPhone?: string;
  };
  /** Derived from the slot, never chosen. See lib/os/address.pickupTimeFor. */
  pickupTime?: string;
  totalAmount: number;
  scheduledDate: string;
  /**
   * THE LAST WORKING DAY THE BAY IS HELD — design screen 08's "Wed 12 – Thu 13
   * Feb". Derived from the work's duration by `spanEndDate`, never chosen: a
   * customer-settable end date would be a second, contradictable answer to
   * "how long is my car away". Equal to `scheduledDate` for same-day work, and
   * absent only on bookings written before the field existed.
   */
  endDate?: string;
  scheduledTime: string;
  status: BookingStatus;
  /** How many times it has been moved. Feeds the calendar export's SEQUENCE. */
  rescheduleCount?: number;
  rescheduledAt?: Timestamp;
  rescheduledBy?: 'customer' | 'studio';
  /** When an unanswered request aged out. Never set on a cancellation. */
  expiredAt?: Timestamp;
  /**
   * WHAT WAS CHOSEN AND WHAT IT COST, frozen at the moment of booking.
   *
   * The catalogue is authoritative for a NEW quote and must never rewrite an
   * old one: editing the price of full-body PPF cannot change what a customer
   * agreed to last month. See lib/os/scope.ts.
   */
  scope?: BookedScope;
  /** The estimate this booking was made from. */
  estimateId?: string;
  /**
   * WHAT IT COST, LINE BY LINE, AS DECIDED AT THE MOMENT OF BOOKING.
   *
   * `totalAmount` is the same figure and is kept because every existing reader
   * uses it. This is the working behind it: the services, the one benefit that
   * applied, each concierge leg as its own line, and the tax block — absent
   * rather than zero when no tax applied. Produced by `priceVisit` and by
   * nothing else, so the estimate, the confirmation and the invoice cannot
   * quote three different totals for one visit.
   */
  breakdown?: StoredBreakdown;
  paymentMethod: 'upi' | 'cash';
  paymentStatus: 'pending' | 'verified' | 'failed';
  transactionId?: string;
  adminNotes?: string;
  /** Discount applied at checkout - membership % or promo, best-of, never stacked */
  discount?: BookingDiscount;
  invoiceId?: string;
  /** Operational record link - set at vehicle check-in. Booking (commercial
   *  truth) and Job (operational truth) are a permanent 1:1; neither replaces
   *  the other. */
  jobId?: string;
  // membership fields - set when a wash is deducted from an active subscription
  usedMembershipWash?: boolean;
  membershipId?: string;
  cancelledAt?: Timestamp;
  /** Approval workflow - set when an admin rejects the pending booking. */
  rejectionReason?: string;
  /** Customer never arrived for a confirmed slot. */
  noShow?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  /** The coarse channel category. `event` below carries the precise fact. */
  type: 'booking_update' | 'promotion' | 'reminder' | 'membership';
  read: boolean;
  bookingId?: string;
  /**
   * THE EVENT THIS RECORD IS. See lib/os/events.ts.
   *
   * Absent on documents written before events existed, which is why every
   * reader still works from `type` and treats this as an refinement rather
   * than a requirement.
   */
  event?: import('./os/events').StudioEventType;
  sourceKind?: import('./os/events').EventSourceKind;
  sourceId?: string;
  vehicleId?: string;
  /**
   * The record was written and the phone stayed dark, because the customer
   * asked for quiet. Never means the fact was dropped — quiet mode suppresses
   * DELIVERY and never history.
   */
  heldByQuietMode?: boolean;
  /**
   * §17.3 — the surface this notification is about. Resolved once, at the
   * moment it is written, by `navigation/resolve.notificationHref`, so the
   * stored record and the push payload can never point at different places.
   */
  url?: string;
  createdAt: Timestamp;
}

export interface StepData {
  vehicle?: Vehicle;
  service?: Service;
  date?: string;
  time?: string;
  notes?: string;
  pickupDrop?: boolean;
  pickup?: boolean;
  drop?: boolean;
  pickupAddress?: string;
  paymentMethod?: 'upi' | 'cash';
  transactionId?: string;
}

// ─── MEMBERSHIP / SUBSCRIPTION ───────────────────────────────────────────────

export type MembershipPlan = 'Silver' | 'Gold' | 'Platinum';
export type MembershipStatus = 'active' | 'expired' | 'cancelled' | 'pending';

export interface MembershipPlanConfig {
  id: MembershipPlan;
  price: number;
  washesPerMonth: number;
  label: string;
  color: string;
  perks: string[];
}

export interface Subscription {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  plan: MembershipPlan;
  status: MembershipStatus;
  startDate: string;        // YYYY-MM-DD
  endDate: string;          // YYYY-MM-DD (startDate + 30 days)
  /**
   * TWO COUNTS THAT DISAGREED, BOTH KEPT BECAUSE BOTH ARE IN PRODUCTION.
   *
   * A live Gold subscription carries `washesTotal: 16` and
   * `washesIncluded: 8`, against a plan that grants 8. Neither field is the
   * authority any more — `os/club.washesGrantedBy` reads the catalogue and
   * falls back to these only for a plan the catalogue no longer has. They are
   * typed so the drift is visible rather than arriving as `any`.
   */
  washesTotal: number;
  /** What the plan granted at purchase. Agrees with the catalogue where set. */
  washesIncluded?: number;
  washesUsed: number;
  paymentMethod: 'upi' | 'cash';
  transactionId?: string;
  adminNotes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /**
   * WHEN THE STUDIO TOOK THE MONEY — the source of truth for membership
   * revenue. Written exactly once, when an admin activates the subscription,
   * and never moved after.
   *
   * `createdAt` is when the customer ASKED, which is before payment.
   * `updatedAt` moves on every later edit, including cancellation, so a
   * cancelled membership would have drifted out of the month it was paid in.
   * Neither could carry revenue.
   */
  paidAt?: Timestamp;
  /**
   * What was actually collected, in rupees, captured at activation.
   *
   * Reports read this rather than looking the plan's price up today: changing
   * Silver from ₹1,499 to ₹1,799 must not silently rewrite last year's
   * revenue. The plan's price is what it costs NOW; this is what was paid THEN.
   */
  amountPaid?: number;
}

// ─── DISCOUNTS / PROMOS ──────────────────────────────────────────────────────

export interface BookingDiscount {
  source: 'membership' | 'promo';
  promoId?: string;
  label: string;
  amount: number;
}

export type PromoScope =
  | { kind: 'all' }
  | { kind: 'category'; categories: string[] }
  | { kind: 'services'; serviceIds: string[] };

export type PromoTarget =
  | { kind: 'all' }
  | { kind: 'customers'; userIds: string[] };

export interface Promo {
  id: string;
  code: string;               // uppercase
  label: string;
  type: 'percent' | 'flat';
  value: number;
  scope: PromoScope;
  target: PromoTarget;
  validFrom: string;          // YYYY-MM-DD
  validTo: string;            // YYYY-MM-DD
  usageLimitTotal?: number;
  usageLimitPerCustomer?: number;
  usedCount: number;
  autoApply: boolean;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PromoRedemption {
  id: string;
  promoId: string;
  userId?: string;
  customerPhone?: string;
  bookingId?: string;
  jobId?: string;
  discountAmount: number;
  createdAt: Timestamp;
}

// ─── EMPLOYEES / ATTENDANCE / PAYROLL ────────────────────────────────────────

export type EmployeeRole = 'detailer' | 'washer' | 'manager' | 'helper';

export interface EmployeeSalaryConfig {
  type: 'monthly' | 'per_day';
  monthlyBase?: number;
  perDayRate?: number;
}

export interface Employee {
  id: string;
  name: string;
  phone: string;
  /** Google account email - lets the employee sign in on their own phone */
  email?: string;
  /** Firebase auth uid, linked on the employee's first sign-in */
  authUid?: string;
  role: EmployeeRole;
  pinHash: string;            // SHA-256 hex of PIN, never the raw PIN
  active: boolean;
  salary: EmployeeSalaryConfig;
  joinedAt: string;           // YYYY-MM-DD
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type AttendanceStatus = 'present' | 'half_day' | 'leave';

/** One break window inside a shift; endAt missing = currently on break. */
export interface AttendanceBreak {
  startAt: Timestamp;
  endAt?: Timestamp;
}

/** Where/what a check-in came from - captured automatically, best-effort. */
export interface AttendanceMeta {
  lat?: number;
  lng?: number;
  accuracy?: number;          // metres
  device?: string;            // trimmed user-agent
  ip?: string;
}

export interface AttendanceRecord {
  id: string;                 // `${date}_${employeeId}` - deterministic, idempotent check-in
  employeeId: string;
  employeeName: string;
  date: string;               // YYYY-MM-DD
  checkInAt: Timestamp;
  checkOutAt?: Timestamp;
  status: AttendanceStatus;
  note?: string;
  /** Check-in → working → break → working → check-out */
  breaks?: AttendanceBreak[];
  checkInMeta?: AttendanceMeta;
  /** Manager audit trail - who reopened / forced out / corrected times */
  reopenedById?: string;
  reopenedByName?: string;
  forcedOutById?: string;
  forcedOutByName?: string;
  editedById?: string;
  editedByName?: string;
}

export interface PayrollAdjustment {
  amount: number;
  date: string;               // YYYY-MM-DD
  note?: string;
}

export interface PayrollRecord {
  id: string;                 // `${month}_${employeeId}`
  employeeId: string;
  employeeName: string;
  month: string;              // YYYY-MM
  daysPresent: number;
  halfDays: number;
  leaves: number;
  baseAmount: number;
  advances: PayrollAdjustment[];
  deductions: PayrollAdjustment[];
  netPayable: number;
  status: 'draft' | 'paid';
  paidAt?: Timestamp;
  paidVia?: 'upi' | 'cash';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── WALK-IN JOBS (kiosk "Store Mode") ───────────────────────────────────────

/** Lifecycle: checked_in → in_progress → quality_check → ready_for_delivery
 *  → completed (= delivered/handover; payment-gated). 'completed' stays the
 *  terminal value so revenue/receivables queries are unchanged. */
export type JobStatus =
  | 'checked_in' | 'in_progress' | 'quality_check'
  | 'ready_for_delivery' | 'completed' | 'cancelled';

export interface JobServiceItem {
  serviceId: string;
  serviceName: string;
  category: string;
  price: number;              // price at time of sale (editable at kiosk)
}

export interface JobPhoto {
  url: string;
  path: string;
  kind: 'before' | 'during' | 'after';
}

export interface JobStatusEntry {
  status: JobStatus;
  at: Timestamp;
  byEmployeeId: string;
  byEmployeeName: string;
  /** Assignment changes are logged here too, alongside status transitions */
  note?: string;
}

export interface PaymentRecord {
  id: string;                 // crypto.randomUUID()
  amount: number;
  method: 'upi' | 'cash';
  transactionId?: string;
  receivedById: string;
  receivedByName: string;
  at: Timestamp;
  date: string;               // YYYY-MM-DD - daily-closing bucket
}

export interface JobAssignment {
  employeeId: string;
  employeeName: string;
  role: 'lead' | 'helper';
  assignedAt: Timestamp;
  assignedById: string;
  assignedByName: string;
  removedAt?: Timestamp;
  removedById?: string;
}

export interface Job {
  id: string;
  source: 'walk_in' | 'booking';
  bookingId?: string;
  /**
   * THE AUTHORITATIVE CAR. Inherited from the booking at creation, never
   * derived from `vehicleRegNo` — a registration is a display snapshot, and
   * joining on one put a "Honda City" booking in the BMW's room. Absent for a
   * walk-in whose car was never in anyone's garage, and absent then means
   * UNKNOWN: nothing may look up another vehicle by matching the plate.
   */
  vehicleId?: string;
  customerId?: string;        // the booking's owner, or a phone match for a walk-in
  customerName: string;
  customerPhone: string;
  vehicleName: string;
  vehicleRegNo: string;
  serviceItems: JobServiceItem[];
  bay?: 1 | 2 | 3;
  status: JobStatus;
  discount?: BookingDiscount;
  /** A membership wash paid for this visit - the deduction happened in the same
   *  commit as the job, so this is the audit trail for the wash that was spent. */
  usedMembershipWash?: boolean;
  membershipId?: string;
  subtotal: number;
  totalAmount: number;
  paymentMethod?: 'upi' | 'cash';
  paymentStatus: 'pending' | 'collected';
  transactionId?: string;
  /** Payment ledger - every rupee received, who took it and when.
   *  paymentStatus/amountPaid are derived: collected ⇔ amountPaid ≥ totalAmount. */
  payments?: PaymentRecord[];
  /** Denormalized Σ payments - receivables query: completed jobs with amountPaid < totalAmount */
  amountPaid?: number;
  invoiceId?: string;
  createdByEmployeeId: string;
  createdByEmployeeName: string;
  /** Who works this job. History preserved via removedAt (reassignment = soft-remove + add). */
  assignments: JobAssignment[];
  /** Denormalized ACTIVE assignee ids - for array-contains queries + rules */
  assignedIds: string[];
  statusHistory: JobStatusEntry[];
  /** Before/after work photos, shown on the shared invoice */
  photos?: JobPhoto[];
  /** Staff-only remarks: pre-existing damage, customer requests */
  notes?: string;
  date: string;               // YYYY-MM-DD, for today's job-board query
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
}

// ─── QUOTES (premium-service pipeline) ───────────────────────────────────────

export type QuoteStatus = 'requested' | 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';

export interface QuoteLineItem {
  name: string;
  detail?: string;            // film brand, coverage, coats…
  amount: number;
}

export interface Quote {
  id: string;
  customerName: string;
  customerPhone: string;
  customerId?: string;        // registered customer if known
  vehicleName: string;
  serviceCategory: string;    // PPF / Ceramic / …
  items: QuoteLineItem[];
  total: number;
  validUntil?: string;        // YYYY-MM-DD
  status: QuoteStatus;
  notes?: string;             // internal
  customerMessage?: string;   // what the customer asked for
  /** Operational link - set when an accepted quote is started as a job. */
  jobId?: string;
  createdById?: string;
  createdByName?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── FOLLOW-UP TASKS ─────────────────────────────────────────────────────────

export interface FollowUpTask {
  id: string;
  note: string;
  dueDate: string;            // YYYY-MM-DD
  customerName?: string;
  customerPhone?: string;
  refType?: 'quote' | 'job' | 'booking';
  refId?: string;
  done: boolean;
  createdByName: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
}

// ─── CUSTOMER FEEDBACK (private, from the invoice rating) ────────────────────

export interface CustomerFeedback {
  id: string;
  rating: number;             // 1-5
  comment?: string;
  invoiceId?: string;
  customerName?: string;
  customerPhone?: string;
  createdAt: Timestamp;
}

// ─── EXPENSES ────────────────────────────────────────────────────────────────

export type ExpenseCategory =
  | 'rent' | 'electricity' | 'water' | 'materials' | 'equipment'
  | 'maintenance' | 'marketing' | 'transport' | 'refreshments' | 'other';

export interface Expense {
  id: string;
  amount: number;
  category: ExpenseCategory;
  note?: string;
  paidVia: 'cash' | 'upi' | 'bank';
  vendor?: string;
  date: string;               // YYYY-MM-DD
  month: string;              // YYYY-MM - report bucket
  enteredById: string;
  enteredByName: string;
  createdAt: Timestamp;
}

// ─── DAILY CLOSING ───────────────────────────────────────────────────────────

export interface DailyClosing {
  id: string;                 // doc id == YYYY-MM-DD
  date: string;
  cashExpected: number;       // Σ cash payments recorded that day
  upiExpected: number;
  cashCounted: number;        // physical drawer count
  variance: number;           // counted − expected (negative = short)
  cashExpenses: number;       // cash expenses that day (reduce the drawer)
  note?: string;
  jobsCompleted: number;
  closedById: string;
  closedByName: string;
  closedAt: Timestamp;
}

// ─── INVOICES ────────────────────────────────────────────────────────────────

export interface InvoiceLineItem {
  name: string;
  qty: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;      // e.g. AMZ-2026-0001
  jobId?: string;
  bookingId?: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  vehicleName: string;
  vehicleRegNo: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  discount?: { label: string; amount: number };
  gst?: { rate: number; amount: number; gstin?: string };
  total: number;
  paymentMethod: 'upi' | 'cash';
  paymentStatus: 'pending' | 'paid';
  /** Before/after photos copied from the job at invoice time */
  photos?: JobPhoto[];
  publicToken: string;        // shareable /invoice/{id}?t= link
  createdByEmployeeId?: string;
  createdByEmployeeName?: string;
  createdAt: Timestamp;
}

// ─── INVENTORY ───────────────────────────────────────────────────────────────

export type InventoryUnit = 'ml' | 'ft' | 'pcs' | 'gm';
export type InventoryCategory = 'ppf_film' | 'ceramic' | 'wash' | 'interior' | 'other';

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  unit: InventoryUnit;
  stockQty: number;
  lowStockThreshold: number;
  costPerUnit: number;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface InventoryTxn {
  id: string;
  itemId: string;
  itemName: string;
  type: 'purchase' | 'consumption' | 'adjustment';
  qtyDelta: number;           // +purchase, -consumption
  refType?: 'job' | 'booking';
  refId?: string;
  note?: string;
  costTotal?: number;
  byEmployeeId?: string;
  createdAt: Timestamp;
}

export interface ServiceRecipe {
  serviceId: string;          // doc ID == serviceId
  serviceName: string;
  items: { itemId: string; itemName: string; qty: number; unit: InventoryUnit }[];
  updatedAt: Timestamp;
}

// ─── BUY / SELL CARS ─────────────────────────────────────────────────────────

export type CarFuel = 'petrol' | 'diesel' | 'cng' | 'electric';
export type CarTransmission = 'manual' | 'automatic';
export type CarListingStatus = 'available' | 'reserved' | 'sold';
export type LeadStatus = 'new' | 'contacted' | 'closed';

export interface CarPhoto {
  url: string;
  path: string;               // Firebase Storage path (for deletion)
}

export interface CarListing {
  id: string;
  title: string;              // "2021 Hyundai Creta SX"
  make: string;
  model: string;
  year: number;
  price: number;
  kmDriven: number;
  fuel: CarFuel;
  transmission: CarTransmission;
  ownership: number;          // 1st/2nd/3rd owner
  color: string;
  regNo?: string;             // admin-only, masked publicly
  /**
   * The car in someone's garage this listing is for, when it is one of ours.
   * Without it a listing has no service record to show and screen 17's
   * "Its record with us" cannot be produced at all — which is the correct
   * behaviour for a trade-in the studio has never touched.
   */
  vehicleId?: string;
  /** Whose garage `vehicleId` lives in. Needed to read the consent flag. */
  vehicleOwnerId?: string;
  description: string;
  photos: CarPhoto[];
  status: CarListingStatus;
  featured: boolean;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CarLead {
  id: string;
  listingId: string;
  listingTitle: string;
  type: 'inquiry' | 'viewing';
  userId?: string;
  name: string;
  phone: string;
  message?: string;
  preferredDate?: string;
  preferredTime?: string;
  status: LeadStatus;
  adminNotes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SellRequest {
  id: string;
  userId: string;
  name: string;
  phone: string;
  make: string;
  model: string;
  year: number;
  kmDriven: number;
  expectedPrice?: number;
  description?: string;
  photos: CarPhoto[];
  status: LeadStatus;
  adminNotes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── THE VISIT (the anchor) ──────────────────────────────────────────────────

/**
 * THE ANCHOR (Constitution Art. 3 · docs/VISIT-OBJECT.md).
 *
 * One service event. Append-only while it runs, SEALED on completion - after
 * `sealedAt` nothing that references it can be rewritten. `Booking` + `Job`
 * collapse into this; until that migration completes a Visit is derived from
 * the pair (lib/services/visits.ts) and verified against it.
 */
export type VisitStatus = 'requested' | 'agreed' | 'open' | 'sealed' | 'cancelled';

export interface VisitService {
  serviceId: string;
  name: string;
  category: string;
  price: number;
}

/**
 * The terms of a promise AS SOLD, copied onto the visit at seal.
 *
 * This is the whole reason the anchor exists. Warranties used to be resolved
 * by looking up the live `services` catalogue on every read, so editing a
 * warranty string in admin silently rewrote what past customers had been
 * promised. A captured term cannot be rewritten by a later catalogue edit.
 */
export interface CapturedTerm {
  kind: ProtectionKind;
  provider?: string;
  plan?: string;
  coverage?: string;
  term: Term;
  /** how this term came to exist - see Protection.termsSource */
  source: TermsSource;
}

export interface Visit {
  id: string;
  vehicleId: string;
  locationId: string;
  source: 'requested' | 'walk_in';
  /** who authored it, per Art. 6 */
  authoredBy: 'system' | 'studio' | 'customer';

  requestedFor?: { date: string; time: string };
  services: VisitService[];
  discount?: BookingDiscount;
  amounts: { subtotal: number; discount: number; total: number };

  /** append-only while open - see JOURNEY-STAGES.md */
  stages: VisitStage[];
  bay?: number;

  /** what this visit promised, frozen at seal */
  termsCaptured: CapturedTerm[];

  /**
   * THE DAY THE WORK WAS DONE — snapshotted at seal, never the record's own
   * date. `createdAt` is when the document was written, which for a backfill
   * is years after the fact. See `os/visit.visitDateOf`, which reads this
   * first and derives it for visits sealed before the field existed.
   */
  servicedOn?: string;

  status: VisitStatus;
  /** once set, the record is permanent */
  sealedAt?: Timestamp;

  /** the pair this was derived from, during the migration window */
  bookingId?: string;
  jobId?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** One recorded moment of the transformation (docs/JOURNEY-STAGES.md). */
export type VisitStageName =
  | 'received' | 'condition_recorded' | 'deep_clean'
  | 'surface_prep' | 'paint_corrected' | 'film_applied'
  | 'protection_applied' | 'coating_applied'
  | 'final_inspection' | 'ready';

export interface VisitStage {
  stage: VisitStageName;
  at: Timestamp;
  /** the studio's own sentence - rendered verbatim, never with a byline */
  note?: string;
  media: { url: string; kind: 'photo' | 'video' }[];
  /** recorded for the studio, NEVER rendered customer-side (Art. 8) */
  byEmployeeId?: string;
}

// ─── MOMENT (the atom of memory) ─────────────────────────────────────────────

/**
 * One photograph, clip or note, with a time and an author (Constitution Art. 3
 * and Art. 10, as amended 2026-07-25).
 *
 * A Moment belongs to the VEHICLE for the life of the car, not to the job that
 * produced it. That is the whole distinction: the studio's arrival shot and the
 * owner's photograph from a mountain road are the same atom, differing only by
 * `authorKind`. The Media Library is a VIEW over these - there is no second
 * media store and no per-job gallery.
 *
 * `visitId` is optional on purpose. A stage photo carries one, so "what did you
 * actually do?" is answerable from any image; a road-trip photo carries none,
 * because it exists for the car, not for anything AutoModz did.
 */
export type MomentKind = 'photo' | 'video' | 'note';
export type MomentAuthor = 'studio' | 'owner';

export interface MomentMedia {
  url: string;
  kind: 'photo' | 'video';
  /** poster frame for a clip */
  poster?: string;
}

export interface Moment {
  id: string;
  vehicleId: string;
  /** the work that produced it, when work did */
  visitId?: string;
  at: Timestamp;
  kind: MomentKind;
  media: MomentMedia[];
  caption?: string;
  authorKind: MomentAuthor;
  createdAt?: Timestamp;
}

// ─── PROTECTION (stored) ─────────────────────────────────────────────────────

/**
 * Everything that shields a car - physical, financial and legal alike
 * (docs/AUTOMODZ-LIVING-STATES.md §2). A new kind is data, not code: if a
 * new kind needs a new card, the kind is wrong.
 */
export type ProtectionKind =
  // physical - created by our own work
  | 'ppf' | 'ceramic' | 'glass' | 'interior'
  // legal
  | 'warranty' | 'puc' | 'rc'
  // financial
  | 'insurance' | 'fastag'
  // relational
  | 'membership';

export type ProtectionClass = 'physical' | 'legal' | 'financial' | 'relational';

export const PROTECTION_CLASS: Record<ProtectionKind, ProtectionClass> = {
  ppf: 'physical', ceramic: 'physical', glass: 'physical', interior: 'physical',
  warranty: 'legal', puc: 'legal', rc: 'legal',
  insurance: 'financial', fastag: 'financial',
  membership: 'relational',
};

/** The customer-facing word. Never a catalogue SKU. */
export const PROTECTION_TITLE: Record<ProtectionKind, string> = {
  ppf: 'Paint protection film',
  ceramic: 'Ceramic coating',
  glass: 'Glass coating',
  interior: 'Interior protection',
  warranty: 'Warranty',
  puc: 'Pollution certificate',
  rc: 'Registration',
  insurance: 'Insurance',
  fastag: 'FASTag',
  membership: 'Membership',
};

/**
 * `captured`      - the term was frozen at the moment it was sold. Trustworthy.
 * `reconstructed` - inferred from the catalogue during the one-time migration,
 *                   the last moment that was legitimate. Never permitted again.
 * `declared`      - the owner (or the studio on their behalf) entered it, e.g.
 *                   an insurance policy that AutoModz did not sell.
 */
export type TermsSource = 'captured' | 'reconstructed' | 'declared';

export interface Protection {
  id: string;
  vehicleId: string;
  locationId?: string;
  kind: ProtectionKind;
  /** "ICICI Lombard", "Garware Platinum" */
  provider?: string;
  /** "Comprehensive", "Lifetime warranty" */
  plan?: string;
  /** "Full body" */
  coverage?: string;
  /** installed / issued, YYYY-MM-DD */
  since?: string;
  term: Term;
  /** the work that created it - required when studio-applied. Opens its Chapter. */
  visitId?: string;
  /** View Original. Never a primary surface. */
  document?: { url: string; label: string };
  termsSource: TermsSource;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MembershipState {
  subscription: Subscription | null;
  isActive: boolean;
  isExpired: boolean;
  washesRemaining: number;
  daysRemaining: number;
  planConfig: MembershipPlanConfig | null;
}

// ─── PLAN CATALOGUE ──────────────────────────────────────────────────────────

export const MEMBERSHIP_PLANS: MembershipPlanConfig[] = [
  {
    id: 'Silver',
    price: 1499,
    washesPerMonth: 4,
    label: 'Silver',
    color: '#9CA3AF',
    perks: [
      '4 Regular Washes / month',
      '10% off on all other services',
      'Priority booking slots',
    ],
  },
  {
    id: 'Gold',
    price: 2999,
    washesPerMonth: 8,
    label: 'Gold',
    color: '#EAB308',
    perks: [
      '8 Premium Washes / month',
      '15% off on all other services',
      'Priority booking slots',
      'Free tyre dressing every visit',
    ],
  },
  {
    id: 'Platinum',
    price: 5999,
    washesPerMonth: 16,
    label: 'Platinum',
    color: '#A78BFA',
    perks: [
      '16 Detail SPA Washes / month',
      '20% off on all other services',
      'Priority booking slots',
      'Free interior steam clean / month',
      'Dedicated service advisor',
    ],
  },
];

// ─── MID-VISIT APPROVAL (design screen 12) ───────────────────────────────────

/**
 * THE STUDIO FOUND SOMETHING, AND IT COSTS MORE.
 *
 * Design screen 12: "We found something under the film · Extra stage +₹6,000 ·
 * Extra time +2 hours · same day", with Approve and "Skip it · film as
 * planned". It is the only place in the product where a customer agrees to
 * spend more money after the work has started, which makes it the one object
 * where every guarantee has to hold at once:
 *
 *   · Only the OWNER may approve or decline. The studio may withdraw its own
 *     request and the clock may retire it, but neither can produce an approval
 *     — see `APPROVAL_ACTORS` in lib/os/lifecycle.ts.
 *   · The customer approves A FIGURE, not a percentage or a promise. Both the
 *     state before and the state after are frozen at the moment of asking, so
 *     the total they tapped is the total that is applied.
 *   · Once responded it is immutable. A resolved request cannot be resolved
 *     again, which is what makes a double tap cost nothing.
 *   · `requestedByEmployeeId` is recorded for the studio and NEVER rendered
 *     customer-side (Art. 8 — no individual is ever named).
 */
export type ApprovalStatus = 'requested' | 'approved' | 'declined' | 'expired' | 'cancelled';

export interface ApprovalEvidence {
  url: string;
  /** "Rear quarter", "Under light" — where the photograph was taken. */
  caption: string;
}

export interface Approval {
  id: string;
  jobId: string;
  bookingId?: string;
  visitId?: string;
  customerId: string;
  vehicleId: string;
  vehicleName: string;
  /** "We found something under the film" — the studio's own sentence. */
  reason: string;
  /** Why it matters, and what happens if it is left. */
  detail?: string;
  photos: ApprovalEvidence[];
  /** The work proposed, as a priced line. Never a free-text charge. */
  proposed: { label: string; price: number; minutes: number };
  /** Both are ≥ 0 and both are frozen at the moment of asking. */
  priceDelta: number;
  timeDeltaMinutes: number;
  /** What the visit stood at when the studio asked. */
  before: StoredBreakdown;
  /** What it becomes if approved. The figure the customer actually taps. */
  after: StoredBreakdown;
  status: ApprovalStatus;
  /** Recorded for the studio. NEVER rendered on a customer surface. */
  requestedByEmployeeId?: string;
  requestedAt: Timestamp;
  respondedAt?: Timestamp;
  /** After this the request retires itself — a bay cannot wait for ever. */
  expiresAt?: Timestamp;
}
