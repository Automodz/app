'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Zap, LayoutGrid, PlusCircle, Clock, Lock, DoorOpen, Shield } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { getEmployee } from '@/lib/firebaseService';
import { KIOSK_LOCK_TIMEOUT_MS } from '@/lib/config/storeConfig';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Wordmark from '@/components/ui/Wordmark';

const NAV = [
  { href: '/store/board',      label: 'Floor',      icon: LayoutGrid },
  { href: '/store/new',        label: 'Check-In',   icon: PlusCircle },
  { href: '/store/attendance', label: 'Attendance', icon: Clock },
];

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, authLoading, kioskEmployee, setKioskEmployee } = useAppStore();
  const [kioskRestored, setKioskRestored] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isStaff = user?.role === 'admin' || user?.role === 'employee';
  // Managers (admin/owner) run the Front Desk as a shared OS - no kiosk PIN.
  const isManager = user?.role === 'admin';
  // Employees sign in on their own phones; kiosk mode (PIN) rides on the
  // owner's admin session on the shared tablet.
  const isPersonal = user?.role === 'employee';

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isStaff) router.replace('/auth/login');
  }, [user, authLoading, isStaff, router]);

  // Personal employee session: identity comes from auth, not the PIN pad.
  useEffect(() => {
    if (!isPersonal || !user?.employeeId || kioskEmployee?.id === user.employeeId) return;
    getEmployee(user.employeeId)
      .then(e => e && setKioskEmployee({ id: e.id, name: e.name, role: e.role }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPersonal, user?.employeeId]);

  // Restore kiosk employee from sessionStorage (survives reload, not tab close)
  useEffect(() => {
    if (!kioskEmployee) {
      try {
        const saved = sessionStorage.getItem('automodz-kiosk');
        if (saved) setKioskEmployee(JSON.parse(saved));
      } catch {
        // ignore invalid saved state
      }
    }
    setKioskRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const relock = useCallback(() => {
    setKioskEmployee(null);
    router.replace('/store');
  }, [setKioskEmployee, router]);

  // Exit the Front Desk entirely: kiosk unlocks + leaves for the role's home area.
  const exitStore = useCallback(() => {
    setKioskEmployee(null);
    try { sessionStorage.removeItem('automodz-kiosk'); } catch {}
    router.replace(user?.role === 'admin' ? '/admin' : '/dashboard');
  }, [setKioskEmployee, router, user?.role]);

  // Auto-relock after inactivity - kiosk (shared tablet) only
  useEffect(() => {
    if (!kioskEmployee || isPersonal) return;
    const reset = () => {
      if (lockTimer.current) clearTimeout(lockTimer.current);
      lockTimer.current = setTimeout(relock, KIOSK_LOCK_TIMEOUT_MS);
    };
    reset();
    const events = ['pointerdown', 'keydown', 'touchstart'] as const;
    events.forEach(ev => window.addEventListener(ev, reset));
    return () => {
      if (lockTimer.current) clearTimeout(lockTimer.current);
      events.forEach(ev => window.removeEventListener(ev, reset));
    };
  }, [kioskEmployee, relock]);

  // Redirect into the lock screen when no employee is unlocked (kiosk only);
  // personal sessions land straight on the board.
  useEffect(() => {
    if (!kioskRestored || isPersonal || isManager) return;
    if (!kioskEmployee && pathname !== '/store') router.replace('/store');
  }, [kioskEmployee, kioskRestored, pathname, router, isPersonal, isManager]);

  useEffect(() => {
    if ((isPersonal || isManager) && pathname === '/store') router.replace('/store/board');
  }, [isPersonal, isManager, pathname, router]);

  if (authLoading || !user || !isStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--void)' }}>
        <div className="w-10 h-10 loader-ring" />
      </div>
    );
  }

  const isLockScreen = pathname === '/store';

  return (
    <div className="min-h-screen flex flex-col select-none" style={{ background: 'var(--void)' }}>
      {!isLockScreen && (kioskEmployee || isManager) && (
        <header className="flex items-center gap-3 px-5 py-3 safe-header z-30"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', paddingLeft: 'max(var(--sal), 20px)', paddingRight: 'max(var(--sar), 20px)' }}>
          <div className="w-9 h-9 rounded-xl hidden sm:flex items-center justify-center"
            style={{ background: 'var(--accent-grad)' }}>
            <Zap size={16} style={{ color: 'var(--on-accent)' }} />
          </div>
          <div className="mr-2">
            <Wordmark height={16} />
            <p className="data-label flex items-center gap-1.5" style={{ color: 'var(--ember)' }}>
              <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: 'var(--ember)' }} />
              Front Desk
            </p>
          </div>
          <nav className="flex items-center gap-1 flex-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link key={href} href={href}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl data-label transition-all tap-target justify-center"
                  style={{
                    background: active ? 'var(--accent-mist)' : 'transparent',
                    border: active ? '1px solid var(--accent-haze)' : '1px solid transparent',
                    color: active ? 'var(--ember)' : 'var(--steel)',
                  }}>
                  <Icon size={15} /><span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <p className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>{kioskEmployee?.name ?? user.name ?? 'Manager'}</p>
              <p className="data-label" style={{ color: 'var(--steel)' }}>{kioskEmployee?.role ?? 'Manager'}</p>
            </div>
            {!isPersonal && !isManager && (
              <button onClick={relock} title="Lock kiosk" aria-label="Lock kiosk"
                className="w-11 h-11 flex items-center justify-center rounded-xl cursor-pointer transition-colors"
                style={{ background: 'var(--dark)', color: 'var(--steel)', border: '1px solid var(--border)' }}>
                <Lock size={16} />
              </button>
            )}
            {isManager ? (
              /* managers flip modes directly - mirror of the Admin sidebar switch */
              <Link href="/admin" title="Switch to Admin OS"
                className="flex items-center gap-2 h-11 px-4 rounded-xl data-label transition-colors"
                style={{ background: 'var(--dark)', color: 'var(--steel)', border: '1px solid var(--border)' }}>
                <Shield size={14} /> <span className="hidden sm:inline">Admin</span>
              </Link>
            ) : (
              <button onClick={() => setExitOpen(true)} title="Exit Front Desk" aria-label="Exit Front Desk"
                className="w-11 h-11 flex items-center justify-center rounded-xl cursor-pointer transition-colors"
                style={{ background: 'var(--dark)', color: 'var(--steel)', border: '1px solid var(--border)' }}>
                <DoorOpen size={16} />
              </button>
            )}
          </div>
        </header>
      )}
      <main className="flex-1 safe-scroll px-safe">{children}</main>

      <ConfirmDialog
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        onConfirm={exitStore}
        title="Exit Front Desk?"
        message="Unfinished jobs stay on the board and live updates continue for other staff. You can come back anytime from /store."
        confirmLabel="Exit Front Desk"
        cancelLabel="Stay"
      />
    </div>
  );
}
