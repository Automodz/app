'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/lib/store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useAppStore();
  const pathname = usePathname();
  // The marketing homepage is always dark. The admin + store surfaces are the
  // operations OS - always dark. The customer app (/app) is now the immersive
  // AutoModz OS: one lit, carved-from-graphite environment, always dark too, so
  // every room shares the same material (see .st-os + components/os/Ambient).
  const forceDark = pathname === '/'
    || pathname.startsWith('/admin')
    || pathname.startsWith('/store');

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
