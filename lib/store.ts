/**
 * The runtime store.
 *
 * Business objects live here for the lifetime of the tab ONLY - they are never
 * written to disk. Their offline copy is Firestore's persistent cache
 * (lib/firebase.ts), which owns freshness and invalidation; a second copy in
 * localStorage would be a duplicated source of truth that goes stale silently.
 *
 * The session slice below is different: it is ours, it has no server-side
 * owner, and it is persisted - by SessionManager, versioned and migrated.
 */
import { create } from 'zustand';
import type { User, Vehicle, Booking, Notification } from './types';
import { SessionManager, emptySession, type SessionState, type ThemeName } from './os/session';

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

  /* ── the session slice (persisted by SessionManager) ──────────────────
     Ours alone: no server owns it, so it is the one thing worth keeping on
     disk. Every write goes through `patchSession`, which saves synchronously,
     so there is no rehydration race and no second writer. */

  session: SessionState;
  /** merge a change into the session and persist it in one step */
  patchSession: (patch: Partial<SessionState>) => void;
  /** read the session off disk (migrating it) - called once, at startup */
  restoreSession: () => void;
  /** wipes every trace of the customer - sign-out, expiry, another account */
  clearSession: () => void;

  /** theme is session UI state; this is the ergonomic accessor for it */
  theme: ThemeName;
  toggleTheme: () => void;

  /** Kiosk "Store Mode": which employee is unlocked via PIN (sessionStorage, not persisted) */
  kioskEmployee: { id: string; name: string; role: string } | null;
  setKioskEmployee: (e: { id: string; name: string; role: string } | null) => void;
}

export const useAppStore = create<AppState>()(
  ((set, get) => ({
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

      /* ── the session slice ── */
      session: emptySession(),

      patchSession: (patch) => {
        const next = { ...get().session, ...patch };
        set({ session: next, theme: next.ui.theme });
        SessionManager.save(next);
      },

      restoreSession: () => {
        const restored = SessionManager.restore();
        set({ session: restored, theme: restored.ui.theme });
      },

      // sign-out / expiry / a different account: nothing of the last customer
      // may survive on a shared device - memory and disk both
      clearSession: () => {
        SessionManager.clear();
        const fresh = emptySession();
        // the interface preference is the customer's, not the account's
        fresh.ui.theme = get().session.ui.theme;
        set({
          user: null, vehicles: [], bookings: [], notifications: [], unreadCount: 0,
          session: fresh,
        });
        SessionManager.save(fresh);
      },

      theme: 'light',
      toggleTheme: () => {
        const s = get().session;
        const theme: ThemeName = s.ui.theme === 'dark' ? 'light' : 'dark';
        get().patchSession({ ui: { ...s.ui, theme } });
      },

      kioskEmployee: null,
      setKioskEmployee: (kioskEmployee) => {
        try {
          if (kioskEmployee) sessionStorage.setItem('automodz-kiosk', JSON.stringify(kioskEmployee));
          else sessionStorage.removeItem('automodz-kiosk');
        } catch {}
        set({ kioskEmployee });
      },
  }))
);
