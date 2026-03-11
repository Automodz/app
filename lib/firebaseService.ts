import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs,
  getDoc, query, where, orderBy, serverTimestamp, setDoc, limit
} from 'firebase/firestore';
import { signInWithPopup, signOut, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { db, auth, googleProvider } from './firebase';
import type { User, Vehicle, Booking, Notification, Service } from './types';

// ─── ADMIN AUTH ───────────────────────────────────────────────────────────────
export const adminLogin = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

// ─── CUSTOMER AUTH (Google) ───────────────────────────────────────────────────
export const signInWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  const fu = result.user;
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'hello.automodz@gmail.com';
  const role = fu.email?.toLowerCase() === adminEmail.toLowerCase() ? 'admin' : 'customer';
  const userRef = doc(db, 'users', fu.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      uid: fu.uid, name: fu.displayName || '', email: fu.email || '',
      phone: fu.phoneNumber || '', photoURL: fu.photoURL || '', role,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(userRef, {
      name: fu.displayName || snap.data().name,
      photoURL: fu.photoURL || snap.data().photoURL || '',
      updatedAt: serverTimestamp(),
    });
  }
  return result;
};

// ─── DEMO ─────────────────────────────────────────────────────────────────────
export const signInDemo = async (): Promise<User> => ({
  uid: 'demo-user', name: 'Arjun Mehta', email: 'arjun.demo@automodz.in',
  phone: '9876543210', photoURL: '', role: 'demo',
});

export const logoutUser = () => signOut(auth);

export const getUserProfile = async (uid: string): Promise<User | null> => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as User) : null;
};

export const updateUserProfile = async (uid: string, data: Partial<User>) =>
  updateDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() });

export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);

// ─── VEHICLES ────────────────────────────────────────────────────────────────
export const addVehicle = async (uid: string, v: Omit<Vehicle, 'id' | 'createdAt'>) => {
  const r = await addDoc(collection(db, 'users', uid, 'vehicles'), { ...v, createdAt: serverTimestamp() });
  return r.id;
};
export const getVehicles = async (uid: string): Promise<Vehicle[]> => {
  if (uid === 'demo-user') return DEMO_VEHICLES;
  const snap = await getDocs(collection(db, 'users', uid, 'vehicles'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle));
};
export const updateVehicle = (uid: string, vid: string, data: Partial<Vehicle>) =>
  updateDoc(doc(db, 'users', uid, 'vehicles', vid), data);
export const deleteVehicle = (uid: string, vid: string) =>
  deleteDoc(doc(db, 'users', uid, 'vehicles', vid));

// ─── SERVICES ────────────────────────────────────────────────────────────────
export const getServices = async (): Promise<Service[]> => {
  try {
    const snap = await getDocs(collection(db, 'services'));
    if (!snap.empty) return snap.docs.map(d => ({ id: d.id, ...d.data() } as Service));
  } catch {}
  return STATIC_SERVICES;
};
export const seedServices = async () => {
  for (const s of STATIC_SERVICES)
    await addDoc(collection(db, 'services'), { ...s, active: true, createdAt: serverTimestamp() });
};

// ─── BOOKINGS ────────────────────────────────────────────────────────────────
export const createBooking = async (booking: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>) => {
  const r = await addDoc(collection(db, 'bookings'), {
    ...booking, status: 'pending',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return r.id;
};
export const getUserBookings = async (uid: string): Promise<Booking[]> => {
  if (uid === 'demo-user') return DEMO_BOOKINGS;
  const q = query(collection(db, 'bookings'), where('userId', '==', uid), orderBy('createdAt', 'desc'));
  return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() } as Booking));
};
export const getAllBookings = async (): Promise<Booking[]> => {
  const snap = await getDocs(query(collection(db, 'bookings'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
};
export const cancelBooking = async (bookingId: string) =>
  updateDoc(doc(db, 'bookings', bookingId), {
    status: 'cancelled', cancelledAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
export const updateBookingStatus = async (id: string, status: Booking['status'], notes?: string) => {
  const data: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
  if (notes) data.adminNotes = notes;
  await updateDoc(doc(db, 'bookings', id), data);
};

export const verifyPayment = async (bookingId: string) =>
  updateDoc(doc(db, 'bookings', bookingId), {
    paymentStatus: 'verified',
    updatedAt: serverTimestamp(),
  });

/** Write a notification document to Firestore for a user */
export const writeNotification = async (
  userId: string,
  title: string,
  body: string,
  type: Notification['type'],
  bookingId?: string,
) => {
  await addDoc(collection(db, 'notifications'), {
    userId, title, body, type,
    read: false,
    ...(bookingId ? { bookingId } : {}),
    createdAt: serverTimestamp(),
  });
};

/** Status update + notification in one call — use this from admin panel */
export const updateBookingStatusWithNotification = async (
  booking: Pick<Booking, 'id' | 'userId' | 'serviceName' | 'vehicleName' | 'scheduledDate'>,
  status: Booking['status'],
  notes?: string,
) => {
  await updateBookingStatus(booking.id, status, notes);

  // Don't write notifications for demo users
  if (booking.userId === 'demo-user') return;

  const MESSAGES: Partial<Record<Booking['status'], { title: string; body: string }>> = {
    confirmed:          { title: 'Booking Confirmed', body: `Your ${booking.serviceName} for ${booking.vehicleName} on ${booking.scheduledDate} is confirmed.` },
    vehicle_received:   { title: 'Vehicle Received', body: `We have received your ${booking.vehicleName}. Work will begin shortly.` },
    in_progress:        { title: 'Service In Progress', body: `Our team is now working on your ${booking.vehicleName} — ${booking.serviceName}.` },
    quality_check:      { title: 'Quality Check', body: `Your ${booking.vehicleName} is in final quality inspection. Almost done!` },
    ready_for_delivery: { title: 'Ready for Pickup', body: `Your ${booking.vehicleName} is ready! Come collect it at AutoModz, Maninagar.` },
    completed:          { title: 'Service Completed', body: `${booking.serviceName} on your ${booking.vehicleName} is complete. Thank you for choosing AutoModz!` },
    cancelled:          { title: 'Booking Cancelled', body: `Your booking for ${booking.serviceName} (${booking.vehicleName}) has been cancelled.` },
  };

  const msg = MESSAGES[status];
  if (msg) {
    await writeNotification(booking.userId, msg.title, msg.body, 'booking_update', booking.id);
  }
};
export const getBookedSlotsForDate = async (date: string, serviceCategory: string): Promise<string[]> => {
  const q = query(collection(db, 'bookings'),
    where('scheduledDate', '==', date), where('serviceCategory', '==', serviceCategory));
  return (await getDocs(q)).docs
    .filter(d => d.data().status !== 'cancelled')
    .map(d => d.data().scheduledTime as string);
};

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
export const getUserNotifications = async (uid: string): Promise<Notification[]> => {
  if (uid === 'demo-user') return DEMO_NOTIFICATIONS;
  const q = query(collection(db, 'notifications'),
    where('userId', '==', uid), orderBy('createdAt', 'desc'), limit(20));
  return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() } as Notification));
};
export const markNotificationRead = (id: string) =>
  updateDoc(doc(db, 'notifications', id), { read: true });

// ─── ADMIN STATS ─────────────────────────────────────────────────────────────
export const getAdminStats = async () => {
  const [bookings, users] = await Promise.all([
    getDocs(collection(db, 'bookings')), getDocs(collection(db, 'users')),
  ]);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayCount = bookings.docs.filter(d => {
    const ts = d.data().createdAt?.toDate?.();
    return ts && ts >= today;
  }).length;
  const revenue = bookings.docs
    .filter(d => d.data().status === 'completed')
    .reduce((s, d) => s + (d.data().totalAmount || 0), 0);
  return { totalBookings: bookings.size, todayBookings: todayCount, totalCustomers: users.size, revenue };
};

// ═══════════════════════════════════════════════════════════════════════════════
// STATIC SERVICE CATALOGUE
// ═══════════════════════════════════════════════════════════════════════════════
export const STATIC_SERVICES: Service[] = [
  { id: 's1',  category: 'PPF',     name: 'Llumar Gloss',       brand: 'Llumar',   price: 145000, duration: 480, warranty: '5 Year',  description: 'Premium self-healing PPF — ultra-clear, gloss-enhancing, scratch resistant', popular: false, active: true, order: 1, createdAt: null as any },
  { id: 's2',  category: 'PPF',     name: 'Llumar Platinum',    brand: 'Llumar',   price: 205000, duration: 480, warranty: '10 Year', description: 'Professional-grade platinum protection. Maximum clarity with decade-long cover', popular: true,  active: true, order: 2, createdAt: null as any },
  { id: 's3',  category: 'PPF',     name: 'Llumar Valor',       brand: 'Llumar',   price: 220000, duration: 480, warranty: '12 Year', description: 'Top-tier Valor film — the last PPF your car will ever need', popular: false, active: true, order: 3, createdAt: null as any },
  { id: 's4',  category: 'Washing', name: 'Regular Wash',       brand: null,       price: 500,    duration: 45,  warranty: null,      description: 'Thorough exterior wash, rinse and dry with chamois finish', popular: false, active: true, order: 1, createdAt: null as any },
  { id: 's5',  category: 'Washing', name: 'Premium Wash',       brand: null,       price: 1000,   duration: 60,  warranty: null,      description: 'Deep clean exterior + interior wipe-down, vacuum and tyre dressing', popular: true,  active: true, order: 2, createdAt: null as any },
  { id: 's6',  category: 'Washing', name: 'Detail SPA',         brand: null,       price: 2500,   duration: 90,  warranty: null,      description: 'Full detail spa — clay bar, foam cannon, interior steam, tyre dressing', popular: true,  active: true, order: 3, createdAt: null as any },
  { id: 's7',  category: 'Washing', name: 'Dry Clean',          brand: null,       price: 4000,   duration: 120, warranty: null,      description: 'Complete dry cleaning of all interior fabrics and surfaces', popular: false, active: true, order: 4, createdAt: null as any },
  { id: 's8',  category: 'Washing', name: 'Roof Cleaning',      brand: null,       price: 800,    duration: 30,  warranty: null,      description: 'Specialised roof lining and exterior roof surface clean', popular: false, active: true, order: 5, createdAt: null as any },
  { id: 's9',  category: 'Washing', name: 'Headlight Buffing',  brand: null,       price: 400,    duration: 20,  warranty: null,      description: 'Restoration and UV sealing per headlight unit', popular: false, active: true, order: 6, createdAt: null as any },
  { id: 's10', category: 'Ceramic', name: 'Kovalent Prolong',   brand: 'Kovalent', price: 10000,  duration: 480, warranty: '2 Year',  description: 'Entry ceramic coat — hardness, hydrophobic effect and UV shield', popular: false, active: true, order: 1, createdAt: null as any },
  { id: 's11', category: 'Ceramic', name: 'Kovalent Graphene',  brand: 'Kovalent', price: 12000,  duration: 480, warranty: '3 Year',  description: 'Graphene-infused ceramic — superior heat dissipation and lasting hydrophobics', popular: true,  active: true, order: 2, createdAt: null as any },
  { id: 's12', category: 'Ceramic', name: 'Kovalent Borophene', brand: 'Kovalent', price: 14000,  duration: 480, warranty: '5 Year',  description: 'Borophene ceramic — hardest known molecular layer, 5-year coverage', popular: true,  active: true, order: 3, createdAt: null as any },
  { id: 's13', category: 'Coating', name: 'Teflon Coating',     brand: null,       price: 5000,   duration: 120, warranty: '6 Month', description: 'Teflon layer for minor scratch resistance and paint preservation', popular: false, active: true, order: 1, createdAt: null as any },
  { id: 's14', category: 'Coating', name: 'Glass Coating',      brand: null,       price: 1200,   duration: 60,  warranty: '3 Month', description: 'Crystal-clear glass coating for all windows and windshield', popular: false, active: true, order: 2, createdAt: null as any },
  { id: 's15', category: 'Coating', name: 'Maintenance Coat',   brand: null,       price: 4500,   duration: 90,  warranty: '1 Year',  description: 'Annual refresh — reinforces existing protection, adds new hydrophobic layer', popular: true,  active: true, order: 3, createdAt: null as any },
];

// ═══════════════════════════════════════════════════════════════════════════════
// RICH DEMO DATA — 4 vehicles, 8 bookings across all statuses, notifications
// ═══════════════════════════════════════════════════════════════════════════════
import { Timestamp } from 'firebase/firestore';
const ts = (daysAgo: number) => Timestamp.fromDate(new Date(Date.now() - daysAgo * 86400000));
const future = (daysAhead: number) => new Date(Date.now() + daysAhead * 86400000).toISOString().split('T')[0];
const past   = (daysAgo: number)   => new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0];

export const DEMO_VEHICLES: Vehicle[] = [
  { id: 'dv1', name: 'Maruti Swift',    registrationNumber: 'GJ01AB1234', category: 'Hatchback',   color: 'Pearl White',  notes: 'Daily driver', createdAt: ts(90) },
  { id: 'dv2', name: 'Honda City ZX',   registrationNumber: 'GJ01CD5678', category: 'Sedan',       color: 'Radiant Red',  notes: 'Weekend car',  createdAt: ts(60) },
  { id: 'dv3', name: 'Hyundai Creta',   registrationNumber: 'GJ05EF9012', category: 'Compact SUV', color: 'Titan Grey',   notes: 'Family SUV',   createdAt: ts(45) },
  { id: 'dv4', name: 'Mercedes GLC',    registrationNumber: 'GJ01ZZ0001', category: 'Luxury',      color: 'Obsidian Black', notes: 'VIP treatment', createdAt: ts(10) },
];

export const DEMO_BOOKINGS: Booking[] = [
  {
    id: 'db1', userId: 'demo-user', userName: 'Arjun Mehta',
    userPhone: '9876543210', userEmail: 'arjun.demo@automodz.in',
    vehicleId: 'dv4', vehicleName: 'Mercedes GLC', vehicleRegNo: 'GJ01ZZ0001',
    serviceId: 's2', serviceName: 'Llumar Platinum PPF', serviceCategory: 'PPF',
    serviceBasePrice: 205000, pickupDropRequired: true, pickupDropFee: 100, totalAmount: 205100,
    scheduledDate: future(2), scheduledTime: '09:00', status: 'confirmed',
    paymentMethod: 'upi', paymentStatus: 'pending', transactionId: 'GPay4521987634',
    createdAt: ts(1), updatedAt: ts(1),
  },
  {
    id: 'db2', userId: 'demo-user', userName: 'Arjun Mehta',
    userPhone: '9876543210', userEmail: 'arjun.demo@automodz.in',
    vehicleId: 'dv3', vehicleName: 'Hyundai Creta', vehicleRegNo: 'GJ05EF9012',
    serviceId: 's11', serviceName: 'Kovalent Graphene Ceramic', serviceCategory: 'Ceramic',
    serviceBasePrice: 12000, pickupDropRequired: false, pickupDropFee: 0, totalAmount: 12000,
    scheduledDate: future(5), scheduledTime: '11:00', status: 'pending',
    paymentMethod: 'cash', paymentStatus: 'pending',
    createdAt: ts(2), updatedAt: ts(2),
  },
  {
    id: 'db3', userId: 'demo-user', userName: 'Arjun Mehta',
    userPhone: '9876543210', userEmail: 'arjun.demo@automodz.in',
    vehicleId: 'dv2', vehicleName: 'Honda City ZX', vehicleRegNo: 'GJ01CD5678',
    serviceId: 's6', serviceName: 'Detail SPA', serviceCategory: 'Washing',
    serviceBasePrice: 2500, pickupDropRequired: true, pickupDropFee: 100, totalAmount: 2600,
    scheduledDate: past(1), scheduledTime: '10:00', status: 'in_progress',
    paymentMethod: 'cash', paymentStatus: 'pending',
    createdAt: ts(3), updatedAt: ts(1),
  },
  {
    id: 'db4', userId: 'demo-user', userName: 'Arjun Mehta',
    userPhone: '9876543210', userEmail: 'arjun.demo@automodz.in',
    vehicleId: 'dv1', vehicleName: 'Maruti Swift', vehicleRegNo: 'GJ01AB1234',
    serviceId: 's5', serviceName: 'Premium Wash', serviceCategory: 'Washing',
    serviceBasePrice: 1000, pickupDropRequired: false, pickupDropFee: 0, totalAmount: 1000,
    scheduledDate: past(3), scheduledTime: '09:30', status: 'completed',
    paymentMethod: 'upi', paymentStatus: 'verified', transactionId: 'PhonePe7734521889',
    createdAt: ts(8), updatedAt: ts(3),
  },
  {
    id: 'db5', userId: 'demo-user', userName: 'Arjun Mehta',
    userPhone: '9876543210', userEmail: 'arjun.demo@automodz.in',
    vehicleId: 'dv2', vehicleName: 'Honda City ZX', vehicleRegNo: 'GJ01CD5678',
    serviceId: 's12', serviceName: 'Kovalent Borophene Ceramic', serviceCategory: 'Ceramic',
    serviceBasePrice: 14000, pickupDropRequired: true, pickupDropFee: 100, totalAmount: 14100,
    scheduledDate: past(15), scheduledTime: '09:00', status: 'completed',
    paymentMethod: 'cash', paymentStatus: 'verified',
    createdAt: ts(20), updatedAt: ts(15),
  },
  {
    id: 'db6', userId: 'demo-user', userName: 'Arjun Mehta',
    userPhone: '9876543210', userEmail: 'arjun.demo@automodz.in',
    vehicleId: 'dv1', vehicleName: 'Maruti Swift', vehicleRegNo: 'GJ01AB1234',
    serviceId: 's15', serviceName: 'Maintenance Coat', serviceCategory: 'Coating',
    serviceBasePrice: 4500, pickupDropRequired: false, pickupDropFee: 0, totalAmount: 4500,
    scheduledDate: past(30), scheduledTime: '14:00', status: 'completed',
    paymentMethod: 'upi', paymentStatus: 'verified', transactionId: 'GPay9912345670',
    createdAt: ts(35), updatedAt: ts(30),
  },
  {
    id: 'db7', userId: 'demo-user', userName: 'Arjun Mehta',
    userPhone: '9876543210', userEmail: 'arjun.demo@automodz.in',
    vehicleId: 'dv3', vehicleName: 'Hyundai Creta', vehicleRegNo: 'GJ05EF9012',
    serviceId: 's7', serviceName: 'Dry Clean', serviceCategory: 'Washing',
    serviceBasePrice: 4000, pickupDropRequired: false, pickupDropFee: 0, totalAmount: 4000,
    scheduledDate: past(45), scheduledTime: '11:00', status: 'cancelled',
    paymentMethod: 'upi', paymentStatus: 'pending',
    createdAt: ts(50), updatedAt: ts(45),
  },
  {
    id: 'db8', userId: 'demo-user', userName: 'Arjun Mehta',
    userPhone: '9876543210', userEmail: 'arjun.demo@automodz.in',
    vehicleId: 'dv1', vehicleName: 'Maruti Swift', vehicleRegNo: 'GJ01AB1234',
    serviceId: 's1', serviceName: 'Llumar Gloss PPF', serviceCategory: 'PPF',
    serviceBasePrice: 145000, pickupDropRequired: true, pickupDropFee: 100, totalAmount: 145100,
    scheduledDate: past(60), scheduledTime: '09:00', status: 'completed',
    paymentMethod: 'cash', paymentStatus: 'verified',
    createdAt: ts(65), updatedAt: ts(60),
  },
];

export const DEMO_NOTIFICATIONS: Notification[] = [
  { id: 'dn1', userId: 'demo-user', title: 'Mercedes GLC Ready for Pickup', body: 'Your Llumar Platinum PPF installation is complete. Vehicle ready at 6 PM.', type: 'booking_update', read: false, bookingId: 'db1', createdAt: ts(0) },
  { id: 'dn2', userId: 'demo-user', title: 'Booking Confirmed', body: 'Your Kovalent Graphene Ceramic booking for Hyundai Creta on ' + future(5) + ' is confirmed.', type: 'booking_update', read: false, bookingId: 'db2', createdAt: ts(1) },
  { id: 'dn3', userId: 'demo-user', title: 'Honda City Detail SPA In Progress', body: 'Our team has started working on your Honda City. Estimated completion: 4 hours.', type: 'booking_update', read: true, bookingId: 'db3', createdAt: ts(1) },
  { id: 'dn4', userId: 'demo-user', title: 'How was your Premium Wash?', body: 'Your Maruti Swift Premium Wash is complete. We hope you loved the results!', type: 'reminder', read: true, bookingId: 'db4', createdAt: ts(3) },
  { id: 'dn5', userId: 'demo-user', title: 'Special Offer: 15% off PPF', body: 'Exclusive offer for loyal customers. Book any PPF service this month and save ₹15,000+', type: 'promotion', read: true, createdAt: ts(7) },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION / MEMBERSHIP
// ═══════════════════════════════════════════════════════════════════════════════
import type { Subscription, MembershipPlan } from './types';

/** Fetch the most recent active/pending subscription for a user */
export const getUserSubscription = async (uid: string): Promise<Subscription | null> => {
  if (uid === 'demo-user') return DEMO_SUBSCRIPTION;
  const q = query(
    collection(db, 'subscriptions'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const sub = { id: snap.docs[0].id, ...snap.docs[0].data() } as Subscription;
  // expire if endDate has passed
  const today = new Date().toISOString().split('T')[0];
  if (sub.status === 'active' && sub.endDate < today) {
    await updateDoc(doc(db, 'subscriptions', sub.id), {
      status: 'expired',
      updatedAt: serverTimestamp(),
    });
    return { ...sub, status: 'expired' };
  }
  return sub;
};

/** Create a new subscription document */
export const createSubscription = async (
  data: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> => {
  const ref = await addDoc(collection(db, 'subscriptions'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

/**
 * Check if the user's active subscription has expired.
 * If expired, sets status to 'expired' in Firestore.
 * Returns the updated subscription if it was expired, null otherwise.
 */
export const checkAndExpireSubscription = async (uid: string): Promise<Subscription | null> => {
  const sub = await getUserSubscription(uid);
  if (!sub || sub.status !== 'active') return null;
  const today = new Date().toISOString().split('T')[0];
  if (sub.endDate < today) {
    await updateDoc(doc(db, 'subscriptions', sub.id), {
      status: 'expired',
      updatedAt: serverTimestamp(),
    });
    return { ...sub, status: 'expired' };
  }
  return null;
};

/**
 * Decrement washesUsed by 1 when a member books a wash service.
 * Returns false if no active subscription or no washes remaining.
 */
export const deductMembershipWash = async (uid: string): Promise<{ success: boolean; subscriptionId?: string }> => {
  const sub = await getUserSubscription(uid);
  if (!sub || sub.status !== 'active') return { success: false };
  const today = new Date().toISOString().split('T')[0];
  if (sub.endDate < today) return { success: false };
  if (sub.washesUsed >= sub.washesTotal) return { success: false };
  await updateDoc(doc(db, 'subscriptions', sub.id), {
    washesUsed: sub.washesUsed + 1,
    updatedAt: serverTimestamp(),
  });
  return { success: true, subscriptionId: sub.id };
};

/** Admin: get all subscriptions */
export const getAllSubscriptions = async (): Promise<Subscription[]> => {
  const snap = await getDocs(query(collection(db, 'subscriptions'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Subscription));
};

/** Admin: update subscription status */
export const updateSubscriptionStatus = async (
  id: string,
  status: Subscription['status'],
  notes?: string,
) => {
  const data: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
  if (notes) data.adminNotes = notes;
  await updateDoc(doc(db, 'subscriptions', id), data);
};

// ─── DEMO SUBSCRIPTION ────────────────────────────────────────────────────────
export const DEMO_SUBSCRIPTION: Subscription = {
  id: 'demo-sub-1',
  userId: 'demo-user',
  userName: 'Arjun Mehta',
  userEmail: 'arjun.demo@automodz.in',
  userPhone: '9876543210',
  plan: 'Gold',
  status: 'active',
  startDate: new Date(Date.now() - 12 * 86400000).toISOString().split('T')[0],
  endDate: new Date(Date.now() + 18 * 86400000).toISOString().split('T')[0],
  washesTotal: 8,
  washesUsed: 3,
  paymentMethod: 'upi',
  transactionId: 'GPay8834521001',
  createdAt: Timestamp.fromDate(new Date(Date.now() - 12 * 86400000)),
  updatedAt: Timestamp.fromDate(new Date(Date.now() - 2 * 86400000)),
};
