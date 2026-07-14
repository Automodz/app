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