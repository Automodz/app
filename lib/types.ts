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
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
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
  createdAt: Timestamp;
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
  createdAt: Timestamp;
}

export type BookingStatus =
  | 'pending' | 'confirmed' | 'vehicle_received'
  | 'in_progress' | 'quality_check' | 'ready_for_delivery'
  | 'completed' | 'cancelled';

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
  pickupAddress?: string;
  totalAmount: number;
  scheduledDate: string;
  scheduledTime: string;
  status: BookingStatus;
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
  type: 'booking_update' | 'promotion' | 'reminder' | 'membership';
  read: boolean;
  bookingId?: string;
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
  washesTotal: number;
  washesUsed: number;
  paymentMethod: 'upi' | 'cash';
  transactionId?: string;
  adminNotes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
  customerId?: string;        // users uid when phone-matched
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
