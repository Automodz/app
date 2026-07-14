'use client';
import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useAppStore();
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    // Keep the class in sync too - the pre-hydration script and any
    // class-keyed styles rely on it.
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
  }, [theme]);
  return <>{children}</>;
}
