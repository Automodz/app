import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export const getAdminStats = async () => {
  const [bookings, users] = await Promise.all([
    getDocs(collection(db, 'bookings')),
    getDocs(collection(db, 'users')),
  ]);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayCount = bookings.docs.filter(d => {
    const ts = d.data().createdAt?.toDate?.();
    return ts && ts >= today;
  }).length;
  const revenue = bookings.docs
    .filter(d => d.data().status === 'completed')
    .reduce((s, d) => s + (d.data().totalAmount || 0), 0);
  return {
    totalBookings:   bookings.size,
    todayBookings:   todayCount,
    totalCustomers:  users.size,
    revenue,
  };
};