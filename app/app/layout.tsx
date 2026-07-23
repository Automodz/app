'use client';
/**
 * The customer product shell (Constitution P1). No navigation chrome - the
 * Glance never gains chrome; the Capsule is the only fixed element and it
 * belongs to the page. This layout guards auth and owns the garage's whole
 * loading lifecycle (P1): first load, empty account, offline, studio outage.
 *
 * The rule the shell keeps: a surface only ever renders against real data.
 * Until the first fetch settles it holds the loading breath; if the fetch
 * fails and there is nothing cached to fall back on, it shows a calm, human
 * failure with Retry and a way to reach the studio - never the empty garage,
 * never a browser error. Cached truth from an earlier success is preserved:
 * a later failure keeps the garage on screen (with the offline line) instead
 * of tearing it down.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import {
  getVehicles, getUserBookings, subscribeUserBookings,
} from '@/lib/firebaseService';
import { isDevUser, DEV_VEHICLE, DEV_ACTIVE_BOOKING, DEV_COMPLETED_BOOKING, DEV_CERAMIC_BOOKING, DEV_DECLINED_BOOKING } from '@/lib/cx/devseed';
import OfflineBar from '@/components/os/OfflineBar';
import { StudioLoading, StudioError, bootReveal } from '@/components/os/StudioBoot';

type BootStatus = 'loading' | 'ready' | 'error';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, authLoading, vehicles, setVehicles, setBookings } = useAppStore();

  const [status, setStatus] = useState<BootStatus>('loading');
  const [errorKind, setErrorKind] = useState<'offline' | 'server'>('server');
  const unsubRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // carry where they were headed through the door, so a shared deep link
      // (a chapter, a live visit) returns them there after signing in
      const here = typeof window !== 'undefined'
        ? window.location.pathname + window.location.search : '/app';
      const q = here && here !== '/app' ? `?redirect=${encodeURIComponent(here)}` : '';
      router.replace(`/auth/login${q}`);
      return;
    }
    if (user.role === 'admin') router.replace('/admin');
  }, [user, authLoading, router]);

  /* the garage load, as a callable so Retry re-runs exactly the same path.
     it settles the boot status: ready on success, error (offline vs studio
     outage) on failure - unless earlier truth is already on screen, which is
     kept rather than replaced by a failure. */
  const load = useCallback(() => {
    if (!user) return;
    unsubRef.current?.();
    unsubRef.current = undefined;
    setStatus('loading');

    if (isDevUser(user.uid)) {
      setVehicles([DEV_VEHICLE]);
      setBookings([DEV_ACTIVE_BOOKING, DEV_COMPLETED_BOOKING, DEV_CERAMIC_BOOKING, DEV_DECLINED_BOOKING]);
      setStatus('ready');
      return;
    }

    Promise.all([getVehicles(user.uid), getUserBookings(user.uid)])
      .then(([v, b]) => {
        setVehicles(v);
        setBookings(b);
        unsubRef.current = subscribeUserBookings(user.uid, setBookings);
        setStatus('ready');
      })
      .catch(err => {
        console.error('[app] load failed:', err);
        // an outage while the customer is online is ours; otherwise it's the
        // connection - two different promises, told differently
        setErrorKind(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'server');
        // cached truth from an earlier success stays; a fresh, empty garage
        // becomes the failure surface rather than a false "no cars"
        setStatus(useAppStore.getState().vehicles.length > 0 ? 'ready' : 'error');
      });
  }, [user, setVehicles, setBookings]);

  useEffect(() => {
    if (authLoading || !user) return;
    load();
    return () => { unsubRef.current?.(); unsubRef.current = undefined; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, authLoading]);

  // auth itself, then the first garage load - one calm breath, never a spinner
  if (authLoading || !user) return <StudioLoading />;

  if (status === 'loading') return <StudioLoading caption="Opening your garage" />;

  // a fresh load that failed with nothing to show: the trustworthy failure,
  // never the empty garage
  if (status === 'error' && vehicles.length === 0) {
    return <StudioError kind={errorKind} onRetry={load} />;
  }

  return (
    // reducedMotion="user" makes every framer animation under the customer
    // tree honour the OS setting (transform/reveal off, opacity kept) - one
    // reusable guard instead of per-component checks.
    <MotionConfig reducedMotion="user">
      <motion.div {...bootReveal} className="studio" style={{ minHeight: '100vh', background: 'var(--st-paper)' }}>
        <OfflineBar />
        {children}
      </motion.div>
    </MotionConfig>
  );
}
