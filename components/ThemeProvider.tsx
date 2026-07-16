'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/lib/store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useAppStore();
  const pathname = usePathname();
  // The marketing homepage is always dark. The admin + store surfaces are the
  // operations OS — always dark too (layered graphite, liquid glass). The
  // light/dark toggle only governs the customer-facing app.
  const forceDark = pathname === '/' || pathname.startsWith('/admin') || pathname.startsWith('/store');
  const effective = forceDark ? 'dark' : theme;
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
