'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Car, Calendar, User, Plus } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import InstallPrompt from '@/components/pwa/InstallPrompt';
import {
  getVehicles,
  getUserBookings,
  getUserNotifications,
  subscribeUserBookings,
} from '@/lib/firebaseService';

// Exactly 5 tabs - Book is the centre special button
const NAV = [
  { href: '/dashboard',          icon: Home,     label: 'Home'    },
  { href: '/dashboard/history',  icon: Calendar, label: 'History' },
  { href: '/dashboard/booking',  icon: null,     label: 'Book',   special: true },
  { href: '/dashboard/vehicles', icon: Car,      label: 'Garage'  },
  { href: '/dashboard/profile',  icon: User,     label: 'Profile' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const {
    user, authLoading,
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

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--void)' }}>
      <main className="flex-1 safe-page safe-scroll-nav">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}>
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <InstallPrompt />

      {/* Bottom navigation - 5 tabs */}
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
        <div className="flex items-center justify-around max-w-lg mx-auto px-2 pt-2 pb-1">
          {NAV.map(({ href, icon: Icon, label, special }) => {
            const isActive = pathname === href ||
              (href !== '/dashboard' && pathname.startsWith(href));

            if (special) return (
              <Link key={href} href={href}>
                <motion.div
                  whileTap={{ scale: 0.84 }}
                  className="relative -mt-8 w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'var(--accent-grad)',
                    boxShadow: '0 4px 24px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.25)',
                  }}>
                  <Plus size={22} style={{ color: 'var(--on-accent)' }} />
                  <div className="absolute inset-0 rounded-2xl animate-ember-pulse pointer-events-none" />
                </motion.div>
              </Link>
            );

            return (
              <Link key={href} href={href}>
                <motion.div
                  whileTap={{ scale: 0.84 }}
                  className="flex flex-col items-center gap-0.5 px-3 py-1 min-w-[52px]">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                    style={{ background: isActive ? 'var(--accent-mist)' : 'transparent' }}>
                    {Icon && (
                      <Icon size={18} style={{ color: isActive ? 'var(--ember)' : 'var(--steel)' }} />
                    )}
                  </div>
                  <span style={{
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
        </div>
      </nav>
    </div>
  );
}
