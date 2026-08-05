'use client';
/**
 * TEMPORARY (P1) - shell for the surviving legacy surfaces (booking P2,
 * tracker P3, history P4, garage/passport P5, club P6). Auth guard + object
 * loading only: the bottom nav, Live Activity strip and home died with the
 * Glance (/app). Each remaining route deletes with its replacing phase;
 * this layout dies with the last of them.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import {
  getVehicles, getUserBookings, subscribeUserBookings,
} from '@/lib/firebaseService';
import { isDevUser, DEV_VEHICLE, DEV_ACTIVE_BOOKING, DEV_COMPLETED_BOOKING, DEV_CERAMIC_BOOKING } from '@/lib/cx/devseed';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, authLoading, setVehicles, setBookings } = useAppStore();

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/auth/login'); return; }
    if (user.role === 'admin') router.replace('/admin');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (authLoading || !user) return;

    if (isDevUser(user.uid)) {
      setVehicles([DEV_VEHICLE]);
      setBookings([DEV_ACTIVE_BOOKING, DEV_COMPLETED_BOOKING, DEV_CERAMIC_BOOKING]);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    Promise.all([getVehicles(user.uid), getUserBookings(user.uid)])
      .then(([v, b]) => {
        setVehicles(v);
        setBookings(b);
        unsubscribe = subscribeUserBookings(user.uid, setBookings);
      })
      .catch(err => console.error('[dashboard] load failed:', err));
    return () => { if (unsubscribe) unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, authLoading]);

  if (authLoading || !user) return (
    <div className="min-h-screen" style={{ background: 'var(--void)' }} />
  );

  return (
    <div className="min-h-screen" style={{ background: 'var(--void)' }}>
      <main className="safe-page safe-scroll">{children}</main>
    </div>
  );
}
