'use client';
import { createContext, useEffect, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserProfile } from '@/lib/firebaseService';
import { useAppStore } from '@/lib/store';

const AuthContext = createContext<null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { setUser, setAuthLoading } = useAppStore();

  useEffect(() => {
    // Demo user bypass — no Firebase call needed
    const demoUser = typeof window !== 'undefined'
      ? sessionStorage.getItem('demo-user')
      : null;

    if (demoUser) {
      try {
        setUser(JSON.parse(demoUser));
      } catch {
        sessionStorage.removeItem('demo-user');
      }
      setAuthLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await getUserProfile(firebaseUser.uid);
          setUser(profile);
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