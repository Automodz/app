import { Timestamp } from 'firebase/firestore';

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
  category: 'Hatchback' | 'Sedan' | 'Compact SUV' | 'Full SUV' | 'Luxury';
  color: string;
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

export interface AttendanceRecord {
  id: string;                 // `${date}_${employeeId}` - deterministic, idempotent check-in
  employeeId: string;
  employeeName: string;
  date: string;               // YYYY-MM-DD
  checkInAt: Timestamp;
  checkOutAt?: Timestamp;
  status: AttendanceStatus;
  note?: string;
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
