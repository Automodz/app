'use client';
import { createContext, useEffect, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserProfile, ensureUserProfile, linkEmployeeRole } from '@/lib/firebaseService';
import { useAppStore } from '@/lib/store';

const AuthContext = createContext<null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { setUser, setAuthLoading } = useAppStore();

  // sign-out and session expiry both land here as a null user; wipe the cached
  // session (memory *and* disk) so the next person on a shared device never
  // sees the last customer's cars or visits
  const clearSession = () => useAppStore.getState().clearSession();

  useEffect(() => {
    /* Read the persisted session off disk before anything else. It is
       synchronous-ish (localStorage) and lands within a tick, so a returning
       customer's own garage is on screen immediately - no splash, no "opening
       your garage", no reset to car #1. Firebase then revalidates behind it. */
    /* The session is read off disk synchronously, before anything can write to
       it - so where the customer was is known on the very first frame, and no
       later restore can clobber a fresh write. Business objects are not here:
       Firestore's own cache serves those (lib/firebase.ts). */
    useAppStore.getState().restoreSession();

    // ── DEV-ONLY auth shim ────────────────────────────────────────────────
    // Lets local design work render the auth-guarded surfaces without a real
    // Google session. Gated by NODE_ENV=development AND an explicit localStorage
    // flag ('automodz-devauth' = 'customer' | 'employee' | 'admin'). Never runs
    // in production builds; touches no real auth logic.
    if (process.env.NODE_ENV === 'development') {
      let devRole: string | null = null;
      try { devRole = localStorage.getItem('automodz-devauth'); } catch {}
      if (devRole === 'customer' || devRole === 'employee' || devRole === 'admin') {
        setUser({
          uid: `dev-${devRole}`,
          name: devRole === 'admin' ? 'Studio Owner' : devRole === 'employee' ? 'Bay Detailer' : 'Aarav Mehta',
          email: `${devRole}@dev.automodz.local`,
          role: devRole,
          ...(devRole === 'employee' ? { employeeId: 'dev-emp-1' } : {}),
        });
        setAuthLoading(false);
        return; // skip the Firebase listener entirely
      }
    }

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // a different account signed in on this device: the cached garage is
        // not theirs, so drop it before the new profile lands
        const cachedUser = useAppStore.getState().user;
        if (cachedUser && cachedUser.uid !== firebaseUser.uid) clearSession();

        try {
          const profile = await getUserProfile(firebaseUser.uid) ?? await ensureUserProfile(firebaseUser);
          // Reconciles employee promotion/revocation on every session restore
          setUser(await linkEmployeeRole(profile));
        } catch {
          /* Firebase says this session is valid; only the profile read failed
             (offline, a blip). Signing them out here would break the product's
             promise, so the cached session stands and the next launch retries.
             With no cache there is nothing to stand on - fall back to the door. */
          if (useAppStore.getState().user?.uid !== firebaseUser.uid) clearSession();
        }
      } else {
        // the one true sign-out: no Firebase session (logged out, revoked,
        // disabled). Everything cached goes with it.
        clearSession();
      }
      setAuthLoading(false);
    });

    return unsub;
  }, []);

  return <AuthContext.Provider value={null}>{children}</AuthContext.Provider>;
};