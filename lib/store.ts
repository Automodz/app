import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Vehicle, Booking, Notification } from './types';

interface AppState {
  user: User | null;
  authLoading: boolean;
  setUser: (u: User | null) => void;
  setAuthLoading: (v: boolean) => void;

  /** True once the first vehicles+bookings load for the signed-in user has
   *  settled (success or failure). The shell holds on the loading frame until
   *  this flips, so an owner never sees an empty garage against unloaded data. */
  initialDataLoaded: boolean;
  setInitialDataLoaded: (v: boolean) => void;

  vehicles: Vehicle[];
  setVehicles: (v: Vehicle[]) => void;
  addVehicleToStore: (v: Vehicle) => void;
  removeVehicleFromStore: (id: string) => void;
  updateVehicleInStore: (id: string, data: Partial<Vehicle>) => void;

  bookings: Booking[];
  setBookings: (b: Booking[]) => void;
  addBookingToStore: (b: Booking) => void;
  cancelBookingInStore: (id: string) => void;

  notifications: Notification[];
  setNotifications: (n: Notification[]) => void;
  unreadCount: number;
  setUnreadCount: (n: number) => void;

  theme: 'dark' | 'light';
  toggleTheme: () => void;

  /** Kiosk "Store Mode": which employee is unlocked via PIN (sessionStorage, not persisted) */
  kioskEmployee: { id: string; name: string; role: string } | null;
  setKioskEmployee: (e: { id: string; name: string; role: string } | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null, authLoading: true,
      setUser: (user) => set({ user }),
      setAuthLoading: (authLoading) => set({ authLoading }),

      initialDataLoaded: false,
      setInitialDataLoaded: (initialDataLoaded) => set({ initialDataLoaded }),

      vehicles: [],
      setVehicles: (vehicles) => set({ vehicles }),
      addVehicleToStore: (v) => set({ vehicles: [v, ...get().vehicles] }),
      removeVehicleFromStore: (id) => set({ vehicles: get().vehicles.filter(v => v.id !== id) }),
      updateVehicleInStore: (id, data) => set({ vehicles: get().vehicles.map(v => v.id === id ? { ...v, ...data } : v) }),

      bookings: [],
      setBookings: (bookings) => set({ bookings }),
      addBookingToStore: (b) => set({ bookings: [b, ...get().bookings] }),
      cancelBookingInStore: (id) => set({ bookings: get().bookings.map(b => b.id === id ? { ...b, status: 'cancelled' as const } : b) }),

      notifications: [],
      setNotifications: (notifications) => set({ notifications }),
      unreadCount: 0,
      setUnreadCount: (unreadCount) => set({ unreadCount }),

      theme: 'light',
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),

      kioskEmployee: null,
      setKioskEmployee: (kioskEmployee) => {
        try {
          if (kioskEmployee) sessionStorage.setItem('automodz-kiosk', JSON.stringify(kioskEmployee));
          else sessionStorage.removeItem('automodz-kiosk');
        } catch {}
        set({ kioskEmployee });
      },
    }),
    { name: 'automodz-v5', partialize: (s) => ({ theme: s.theme }) }
  )
);
