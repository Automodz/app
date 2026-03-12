import { Timestamp } from 'firebase/firestore';

export interface User {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  photoURL?: string;
  role: 'customer' | 'admin' | 'demo';
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
  pickupAddress?: string;
  totalAmount: number;
  scheduledDate: string;
  scheduledTime: string;
  status: BookingStatus;
  paymentMethod: 'upi' | 'cash';
  paymentStatus: 'pending' | 'verified' | 'failed';
  transactionId?: string;
  adminNotes?: string;
  // membership fields — set when a wash is deducted from an active subscription
  usedMembershipWash?: boolean;
  membershipId?: string;
  cancelledAt?: Timestamp;
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
