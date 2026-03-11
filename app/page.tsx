'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';

export default function HomePage() {
  const router = useRouter();
  const { user, authLoading } = useAppStore();

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/auth/login');
      }
    }
  }, [user, authLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--void)' }}>
      <div className="w-10 h-10 loader-ring" />
    </div>
  );
}
