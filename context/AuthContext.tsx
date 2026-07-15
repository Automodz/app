'use client';
import { createContext, useEffect, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserProfile, ensureUserProfile, linkEmployeeRole } from '@/lib/firebaseService';
import { useAppStore } from '@/lib/store';

const AuthContext = createContext<null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { setUser, setAuthLoading } = useAppStore();

  useEffect(() => {
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
        try {
          const profile = await getUserProfile(firebaseUser.uid) ?? await ensureUserProfile(firebaseUser);
          // Reconciles employee promotion/revocation on every session restore
          setUser(await linkEmployeeRole(profile));
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });

    return unsub;
  }, []);

  return <AuthContext.Provider value={null}>{children}</AuthContext.Provider>;
};