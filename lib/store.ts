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

  /* ── session continuity (persisted) ───────────────────────────────────
     The customer is never asked to sign in again, and never lands back on
     car #1 at the top of the page. The cached session renders instantly on
     a cold launch while Firebase revalidates behind it. */

  /** true once the persisted session has been read off disk */
  hydrated: boolean;
  setHydrated: (v: boolean) => void;

  /** the car they were last looking at, by id */
  selectedVehicleId: string | null;
  setSelectedVehicleId: (id: string | null) => void;

  /** the last customer surface they had open, restored on cold launch */
  lastRoute: string | null;
  setLastRoute: (r: string | null) => void;

  /** wipes every trace of the customer - sign-out and session expiry */
  clearSession: () => void;

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

      hydrated: false,
      setHydrated: (hydrated) => set({ hydrated }),

      selectedVehicleId: null,
      setSelectedVehicleId: (selectedVehicleId) => set({ selectedVehicleId }),

      lastRoute: null,
      setLastRoute: (lastRoute) => set({ lastRoute }),

      // sign-out / expiry / a different account: nothing of the last customer
      // may survive on a shared device
      clearSession: () => set({
        user: null, vehicles: [], bookings: [], notifications: [], unreadCount: 0,
        selectedVehicleId: null, lastRoute: null,
      }),

      kioskEmployee: null,
      setKioskEmployee: (kioskEmployee) => {
        try {
          if (kioskEmployee) sessionStorage.setItem('automodz-kiosk', JSON.stringify(kioskEmployee));
          else sessionStorage.removeItem('automodz-kiosk');
        } catch {}
        set({ kioskEmployee });
      },
    }),
    {
      name: 'automodz-v5',
      /* The session, kept on disk so a cold launch renders the customer's own
         garage instantly instead of a loading screen. Firebase remains the
         authority: this is cached *display* truth, revalidated on every launch
         and wiped the moment auth reports no one (clearSession).
         Jobs are deliberately not cached - their Firestore Timestamps are read
         with non-optional .toDate(), which JSON cannot round-trip. */
      partialize: (s) => ({
        theme: s.theme,
        user: s.user,
        vehicles: s.vehicles,
        bookings: s.bookings,
        selectedVehicleId: s.selectedVehicleId,
        lastRoute: s.lastRoute,
      }),
      /* Hydration is manual (skipHydration) so the server-rendered HTML and the
         first client paint always agree; AuthProvider rehydrates in its first
         effect, one tick later - far inside the 300ms budget and with no
         hydration mismatch. */
      skipHydration: true,
      onRehydrateStorage: () => (state) => { state?.setHydrated(true); },
    }
  )
);
