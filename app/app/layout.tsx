'use client';
/**
 * The customer product shell (Constitution P1). No navigation chrome — the
 * Glance never gains chrome; the Capsule is the only fixed element and it
 * belongs to the page. This layout only guards auth and loads the objects.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import {
  getVehicles, getUserBookings, subscribeUserBookings,
} from '@/lib/firebaseService';
import { isDevUser, DEV_VEHICLE, DEV_ACTIVE_BOOKING, DEV_COMPLETED_BOOKING, DEV_CERAMIC_BOOKING } from '@/lib/cx/devseed';
import { Whisper } from '@/components/os/text';

export default function AppLayout({ children }: { children: React.ReactNode }) {
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
      .catch(err => console.error('[app] load failed:', err));
    return () => { if (unsubscribe) unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, authLoading]);

  // Cold start: cached truth renders instantly; the only wait is auth itself,
  // and it renders as paper + the wordmark caption (design E2), never a spinner.
  if (authLoading || !user) return (
    <div className="studio" style={{
      minHeight: '100vh', background: 'var(--st-paper)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Whisper style={{ fontFamily: 'var(--st-display)', letterSpacing: '0.08em' }}>AUTOMODZ</Whisper>
    </div>
  );

  return (
    <div className="studio" style={{ minHeight: '100vh', background: 'var(--st-paper)' }}>
      {children}
    </div>
  );
}
