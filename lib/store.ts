import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Vehicle, Booking, Notification } from './types';

interface AppState {
  user: User | null;
  authLoading: boolean;
  setUser: (u: User | null) => void;
  setAuthLoading: (v: boolean) => void;

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
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null, authLoading: true,
      setUser: (user) => set({ user }),
      setAuthLoading: (authLoading) => set({ authLoading }),

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

      theme: 'dark',
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
    }),
    { name: 'automodz-v4', partialize: (s) => ({ theme: s.theme }) }
  )
);
