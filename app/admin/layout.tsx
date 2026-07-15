'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, CalendarDays, Users, CreditCard,
  Settings, Menu, X, LogOut, Zap, Shield,
  Store, Wrench, UserCog, Package, BadgePercent, Car, FileText, Clock,
  Images, BarChart3, Wallet, LockKeyhole, FileSpreadsheet,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import Wordmark from '@/components/ui/Wordmark';

const NAV_GROUPS: { group: string; items: { href: string; label: string; icon: typeof LayoutDashboard }[] }[] = [
  {
    group: 'OPERATE',
    items: [
      { href: '/admin',          label: 'Dashboard',  icon: LayoutDashboard },
      { href: '/store',          label: 'Store Mode', icon: Store },
      { href: '/admin/bookings', label: 'Bookings',   icon: CalendarDays },
      { href: '/admin/jobs',     label: 'Walk-Ins',   icon: Wrench },
      { href: '/admin/schedule', label: 'Schedule',   icon: Clock },
    ],
  },
  {
    group: 'PEOPLE',
    items: [
      { href: '/admin/customers', label: 'Customers', icon: Users },
      { href: '/admin/employees', label: 'Employees', icon: UserCog },
    ],
  },
  {
    group: 'MONEY',
    items: [
      { href: '/admin/quotes',        label: 'Quotes',      icon: FileSpreadsheet },
      { href: '/admin/invoices',      label: 'Invoices',    icon: FileText },
      { href: '/admin/expenses',      label: 'Expenses',    icon: Wallet },
      { href: '/admin/close',         label: 'Daily Close', icon: LockKeyhole },
      { href: '/admin/reports',       label: 'Reports',     icon: BarChart3 },
      { href: '/admin/promos',        label: 'Promos',      icon: BadgePercent },
      { href: '/admin/subscriptions', label: 'Memberships', icon: CreditCard },
    ],
  },
  {
    group: 'CATALOG',
    items: [
      { href: '/admin/settings',  label: 'Services',  icon: Settings },
      { href: '/admin/inventory', label: 'Inventory', icon: Package },
      { href: '/admin/cars',      label: 'Cars',      icon: Car },
      { href: '/admin/gallery',   label: 'Gallery',   icon: Images },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, authLoading, setUser } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'admin') router.replace('/auth/login');
  }, [user, authLoading, router]);

  if (authLoading || !user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--void)' }}>
        <div className="w-10 h-10 loader-ring" />
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    router.replace('/auth/login');
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 py-6 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--accent-grad)', boxShadow: '0 4px 16px var(--accent-glow)' }}>
            <Zap size={16} style={{ color: 'var(--on-accent)' }} />
          </div>
          <div>
            <Wordmark height={16} />
            <div className="flex items-center gap-1 mt-0.5">
              <Shield size={9} color="var(--ember)" />
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.12em', color: 'var(--ember)', textTransform: 'uppercase' }}>Admin Panel</p>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {NAV_GROUPS.map(({ group, items }) => (
          <div key={group} className="mb-4">
            <p className="px-3 mb-1.5"
              style={{
                fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.16em',
                color: 'var(--faint)',
              }}>
              {group}
            </p>
            <div className="space-y-1">
              {items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== '/admin' && pathname.startsWith(href));
                return (
                  <Link key={href} href={href} onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                    style={{
                      background: active ? 'var(--accent-mist)' : 'transparent',
                      border: active ? '1px solid var(--accent-haze)' : '1px solid transparent',
                      color: active ? 'var(--ember)' : 'var(--steel)',
                      fontFamily: 'var(--font-mono)', fontSize: '11px',
                      fontWeight: active ? 700 : 400, letterSpacing: '0.08em', textTransform: 'uppercase',
                    }}>
                    <Icon size={15} />{label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 px-3 py-2 mb-2 rounded-xl" style={{ background: 'var(--dark)' }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-mist)' }}>
            <Shield size={12} color="var(--ember)" />
          </div>
          <div className="min-w-0">
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 600, color: 'var(--chrome)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name || 'Admin'}</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--ember)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Administrator</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl transition-all"
          style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--steel)', background: 'transparent', border: '1px solid transparent' }}>
          <LogOut size={14} />Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--void)' }}>
      <aside className="hidden md:flex flex-col w-56 flex-shrink-0 sticky top-0 h-screen"
        style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 md:hidden"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              onClick={() => setSidebarOpen(false)} />
            <motion.aside initial={{ x: -240 }} animate={{ x: 0 }} exit={{ x: -240 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-56 flex flex-col md:hidden"
              style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>
              <button onClick={() => setSidebarOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg"
                style={{ background: 'var(--dark)', color: 'var(--steel)' }}>
                <X size={14} />
              </button>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center gap-3 px-4 py-3 sticky top-0 z-30"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: 'var(--dark)', color: 'var(--chrome)' }}>
            <Menu size={16} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--accent-grad)' }}>
              <Zap size={13} style={{ color: 'var(--on-accent)' }} />
            </div>
            <Wordmark height={15} />
          </div>
          <div className="flex items-center gap-1 ml-1">
            <Shield size={9} color="var(--ember)" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', color: 'var(--ember)', textTransform: 'uppercase' }}>Admin</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
