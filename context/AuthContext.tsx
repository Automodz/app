'use client';
import { createContext, useEffect, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserProfile, getVehicles, getUserBookings, getUserNotifications, DEMO_VEHICLES, DEMO_BOOKINGS, DEMO_NOTIFICATIONS } from '@/lib/firebaseService';
import { useAppStore } from '@/lib/store';

const AuthContext = createContext<null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { setUser, setAuthLoading, setVehicles, setBookings, setNotifications, setUnreadCount } = useAppStore();

  const loadUserData = async (uid: string) => {
    if (uid === 'demo-user') {
      setVehicles(DEMO_VEHICLES);
      setBookings(DEMO_BOOKINGS);
      setNotifications(DEMO_NOTIFICATIONS);
      setUnreadCount(DEMO_NOTIFICATIONS.filter(n => !n.read).length);
      return;
    }
    try {
      const [vehicles, bookings, notifications] = await Promise.all([
        getVehicles(uid), getUserBookings(uid), getUserNotifications(uid),
      ]);
      setVehicles(vehicles); setBookings(bookings); setNotifications(notifications);
      setUnreadCount(notifications.filter(n => !n.read).length);
    } catch {}
  };

  useEffect(() => {
    const demoUser = typeof window !== 'undefined' ? sessionStorage.getItem('demo-user') : null;
    if (demoUser) {
      const u = JSON.parse(demoUser);
      setUser(u);
      loadUserData('demo-user');
      setAuthLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (fu) => {
      if (fu) {
        try {
          const profile = await getUserProfile(fu.uid);
          setUser(profile);
          if (profile) await loadUserData(profile.uid);
        } catch { setUser(null); }
      } else { setUser(null); }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  return <AuthContext.Provider value={null}>{children}</AuthContext.Provider>;
};
