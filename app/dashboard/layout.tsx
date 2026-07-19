'use client';
/**
 * Customer shell V3 — CAR · CARE · CLUB + Book.
 * Three places and one action, replacing the evolved five-tab bar:
 *   Car   /dashboard               ownership home (garage, marketplace, profile live under it)
 *   Care  /dashboard/history       every visit — live, upcoming, past
 *   Club  /dashboard/subscriptions membership, offers, referral
 *   Book  /dashboard/booking       the accent action, not a fake tab
 * A Live Activity strip docks above the bar whenever a vehicle is inside
 * the studio — the visit follows the customer everywhere.
 */
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Car, Sparkles, Crown, Plus } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import InstallPrompt from '@/components/pwa/InstallPrompt';
import CxLiveActivity, { activeVisit } from '@/components/cx/CxLiveActivity';
import { DUR, EASE } from '@/lib/cx/motion';
import { isDevUser, DEV_VEHICLE, DEV_ACTIVE_BOOKING, DEV_COMPLETED_BOOKING } from '@/lib/cx/devseed';
import {
  getVehicles,
  getUserBookings,
  getUserNotifications,
  subscribeUserBookings,
} from '@/lib/firebaseService';

const TABS = [
  {
    href: '/dashboard', icon: Car, label: 'Car',
    owns: ['/dashboard/vehicles', '/dashboard/cars', '/dashboard/sell-car', '/dashboard/profile', '/dashboard/notifications'],
  },
  {
    href: '/dashboard/history', icon: Sparkles, label: 'Care',
    owns: [],
  },
  {
    href: '/dashboard/subscriptions', icon: Crown, label: 'Club',
    owns: ['/dashboard/offers', '/dashboard/refer'],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const {
    user, authLoading, bookings,
    setVehicles, setBookings, setNotifications, setUnreadCount,
  } = useAppStore();

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/auth/login'); return; }
    if (user.role === 'admin') router.replace('/admin');
  }, [user, authLoading]);

  // Load user data once per uid
  useEffect(() => {
    if (authLoading || !user) return;

    // Dev shim (companion to AuthContext's): mock dev users can't read
    // Firestore, so seed a garage + visits so the Live Activity, booking
    // flow and Care tracker are exercisable locally.
    if (isDevUser(user.uid)) {
      setVehicles([DEV_VEHICLE]);
      setBookings([DEV_ACTIVE_BOOKING, DEV_COMPLETED_BOOKING]);
      return;
    }

    let unsubscribeBookings: (() => void) | undefined;

    Promise.all([
      getVehicles(user.uid),
      getUserBookings(user.uid),
      getUserNotifications(user.uid),
    ]).then(([v, b, n]) => {
      setVehicles(v);
      setBookings(b);
      setNotifications(n);
      setUnreadCount(n.filter(x => !x.read).length);

      unsubscribeBookings = subscribeUserBookings(user.uid, (next) => {
        setBookings(next);
      });
    }).catch((err) => {
      console.error('[Dashboard] Failed to load user data:', err);
    });

    return () => {
      if (unsubscribeBookings) unsubscribeBookings();
    };
  }, [user?.uid, authLoading]);

  if (authLoading || !user) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ background: 'var(--void)' }}>
      <div className="w-12 h-12 loader-ring" />
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '11px',
        letterSpacing: '0.12em', color: 'var(--faint)',
      }}>
        LOADING SYSTEM
      </span>
    </div>
  );

  const visit = activeVisit(bookings);
  // The tracker screen shows the full story itself — no strip on top of it.
  const showLive = !!visit && !pathname.startsWith('/dashboard/care');
  const isBooking = pathname.startsWith('/dashboard/booking');

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--void)' }}>
      <main className="flex-1 safe-page safe-scroll-nav"
        style={showLive ? { paddingBottom: 'calc(var(--bottom-nav-h) + 92px)' } : undefined}>
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR.fast, ease: EASE }}>
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <InstallPrompt />

      {/* Bottom bar — Live Activity strip + CAR·CARE·CLUB + Book */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 safe-bottom-bar"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(32px) saturate(160%)',
          WebkitBackdropFilter: 'blur(32px) saturate(160%)',
          borderTop: '1px solid var(--border)',
        }}>
        <div className="h-px"
          style={{ background: 'linear-gradient(90deg, transparent, var(--border-2), transparent)' }} />

        {showLive && (
          <div style={{ borderBottom: '1px solid var(--border)' }}>
            <CxLiveActivity visit={visit} />
          </div>
        )}

        <div className="flex items-center max-w-lg mx-auto px-3 pt-2 pb-1 gap-1">
          {TABS.map(({ href, icon: Icon, label, owns }) => {
            const isActive = !isBooking && (
              pathname === href ||
              (href !== '/dashboard' && pathname.startsWith(href)) ||
              owns.some(o => pathname.startsWith(o))
            );

            return (
              <Link key={href} href={href} className="flex-1">
                <motion.div
                  whileTap={{ scale: 0.96 }}
                  className="relative flex flex-col items-center gap-0.5 py-1.5 rounded-xl">
                  {isActive && (
                    <motion.div
                      layoutId="cx-tab-pill"
                      className="absolute inset-0 rounded-xl"
                      style={{ background: 'var(--accent-mist)' }}
                      transition={{ duration: DUR.base, ease: EASE }}
                    />
                  )}
                  <Icon size={17} className="relative z-10"
                    style={{ color: isActive ? 'var(--ember)' : 'var(--steel)' }} />
                  <span className="relative z-10" style={{
                    fontFamily:    'var(--font-body)',
                    fontSize:      '10px',
                    fontWeight:    500,
                    letterSpacing: '0.04em',
                    color:         isActive ? 'var(--ember)' : 'var(--steel)',
                  }}>
                    {label}
                  </span>
                </motion.div>
              </Link>
            );
          })}

          {/* Book — the one action */}
          <Link href="/dashboard/booking" className="flex-1">
            <motion.div
              whileTap={{ scale: 0.96 }}
              className="mx-1 h-11 rounded-xl flex items-center justify-center gap-1.5"
              style={{
                background: 'var(--accent-grad)',
                boxShadow: isBooking ? '0 4px 20px var(--accent-glow)' : 'none',
              }}>
              <Plus size={15} style={{ color: 'var(--on-accent)' }} />
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 700,
                fontSize: '11.5px', letterSpacing: '0.05em', color: 'var(--on-accent)',
              }}>
                Book
              </span>
            </motion.div>
          </Link>
        </div>
      </nav>
    </div>
  );
}
