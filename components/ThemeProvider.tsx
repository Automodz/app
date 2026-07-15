'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/lib/store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useAppStore();
  const pathname = usePathname();
  // The marketing homepage is always dark — the light/dark toggle only governs
  // the admin + user app. Everywhere else follows the user's stored theme.
  const effective = pathname === '/' ? 'dark' : theme;
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', effective);
    // Keep the class in sync too - the pre-hydration script and any
    // class-keyed styles rely on it.
    root.classList.toggle('dark', effective === 'dark');
    root.classList.toggle('light', effective === 'light');
  }, [effective]);
  return <>{children}</>;
}
