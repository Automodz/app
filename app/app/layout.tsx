'use client';
/**
 * The customer product shell (Constitution P1). No navigation chrome - the
 * Glance never gains chrome; the Capsule is the only fixed element and it
 * belongs to the page. This layout only guards auth and loads the objects.
 */
import { useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import {
  getVehicles, getUserBookings, subscribeUserBookings,
} from '@/lib/firebaseService';
import { isDevUser, DEV_VEHICLE, DEV_ACTIVE_BOOKING, DEV_COMPLETED_BOOKING, DEV_CERAMIC_BOOKING } from '@/lib/cx/devseed';
import { Whisper } from '@/components/os/text';
import OfflineBar from '@/components/os/OfflineBar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const {
    user, authLoading, setVehicles, setBookings,
    initialDataLoaded, setInitialDataLoaded,
  } = useAppStore();

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/auth/login'); return; }
    if (user.role === 'admin') router.replace('/admin');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (authLoading || !user) return;

    // a new signed-in user starts unloaded; the shell waits on the loading
    // frame until the first fetch settles, so the garage is never judged empty
    // against data that simply hasn't arrived yet
    setInitialDataLoaded(false);

    if (isDevUser(user.uid)) {
      setVehicles([DEV_VEHICLE]);
      setBookings([DEV_ACTIVE_BOOKING, DEV_COMPLETED_BOOKING, DEV_CERAMIC_BOOKING]);
      setInitialDataLoaded(true);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    Promise.all([getVehicles(user.uid), getUserBookings(user.uid)])
      .then(([v, b]) => {
        setVehicles(v);
        setBookings(b);
        unsubscribe = subscribeUserBookings(user.uid, setBookings);
      })
      .catch(err => console.error('[app] load failed:', err))
      .finally(() => setInitialDataLoaded(true));
    return () => { if (unsubscribe) unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, authLoading]);

  // Cold start: the shell holds on paper + the wordmark caption (design E2,
  // never a spinner) through auth *and* the first data load, so the Glance,
  // welcome and visit/chapter surfaces only ever render against real data -
  // never a flash of the empty garage or a false "not in this garage".
  if (authLoading || !user || !initialDataLoaded) return (
    <div className="studio" style={{
      minHeight: '100vh', background: 'var(--st-paper)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Whisper style={{ fontFamily: 'var(--st-display)', letterSpacing: '0.08em' }}>AUTOMODZ</Whisper>
    </div>
  );

  return (
    // reducedMotion="user" makes every framer animation under the customer
    // tree honour the OS setting (transform/reveal off, opacity kept) - one
    // reusable guard instead of per-component checks.
    <MotionConfig reducedMotion="user">
      <div className="studio" style={{ minHeight: '100vh', background: 'var(--st-paper)' }}>
        <OfflineBar />
        {children}
      </div>
    </MotionConfig>
  );
}
