'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, CalendarDays, Users, CreditCard,
  Settings, Menu, X, LogOut, Zap, Shield,
  Wrench, UserCog, Package, BadgePercent, Car, FileText, CalendarClock, Clock,
  Images, BarChart3, Wallet, LockKeyhole, FileSpreadsheet, Search, Plus, UserPlus,
  Store,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import Wordmark from '@/components/ui/Wordmark';
import CommandPalette, { type Command } from '@/components/ui/CommandPalette';

// Navigation is organised around workflows, not Firestore collections.
// The Front Desk is not a nav item - it is a sibling OPERATING MODE with its
// own chrome (/store), reached through the mode switch at the top of the
// sidebar. Active Jobs lives inside the Workspace, the single live floor view.
const NAV_GROUPS: { group: string; items: { href: string; label: string; icon: typeof LayoutDashboard }[] }[] = [
  {
    group: 'TODAY',
    items: [
      { href: '/admin',          label: 'Workspace', icon: Wrench },
      { href: '/admin/schedule', label: 'Schedule',  icon: CalendarDays },
    ],
  },
  {
    group: 'WORK',
    items: [
      { href: '/admin/bookings', label: 'Bookings', icon: CalendarClock },
      { href: '/admin/quotes',   label: 'Quotes',   icon: FileSpreadsheet },
    ],
  },
  {
    group: 'CUSTOMERS',
    items: [
      { href: '/admin/cars/leads',    label: 'Leads',       icon: UserPlus },
      { href: '/admin/customers',     label: 'Customers',   icon: Users },
      { href: '/admin/subscriptions', label: 'Memberships', icon: CreditCard },
    ],
  },
  {
    group: 'BUSINESS',
    items: [
      { href: '/admin/invoices',  label: 'Invoices',    icon: FileText },
      { href: '/admin/expenses',  label: 'Expenses',    icon: Wallet },
      { href: '/admin/close',     label: 'Daily Close', icon: LockKeyhole },
      { href: '/admin/reports',   label: 'Reports',     icon: BarChart3 },
      { href: '/admin/inventory', label: 'Inventory',   icon: Package },
    ],
  },
  {
    group: 'TEAM',
    items: [
      { href: '/admin/employees',  label: 'Employees',  icon: UserCog },
      { href: '/store/attendance', label: 'Attendance', icon: Clock },
    ],
  },
  {
    group: 'MARKETING',
    items: [
      { href: '/admin/promos',  label: 'Promotions',  icon: BadgePercent },
      { href: '/admin/gallery', label: 'Gallery',     icon: Images },
      { href: '/admin/cars',    label: 'Marketplace', icon: Car },
    ],
  },
  {
    group: 'SETTINGS',
    items: [
      { href: '/admin/settings', label: 'Services', icon: Settings },
    ],
  },
];

// flat list of every destination, for the top-bar title + command palette
const NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items.map(i => ({ ...i, group: g.group })));

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, authLoading, setUser } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'admin') router.replace('/auth/login');
  }, [user, authLoading, router]);

  // ⌘K / Ctrl-K opens the command palette from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // current section (longest matching nav href) → top-bar title
  const current = NAV_ITEMS
    .filter(i => pathname === i.href || (i.href !== '/admin' && pathname.startsWith(i.href)))
    .sort((a, b) => b.href.length - a.href.length)[0]
    ?? NAV_ITEMS[0];

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

  // command palette: every destination + key quick actions
  const commands: Command[] = [
    ...NAV_ITEMS.map(i => ({
      id: 'nav:' + i.href,
      label: i.label,
      group: 'Go to · ' + i.group.charAt(0) + i.group.slice(1).toLowerCase(),
      icon: i.icon,
      run: () => router.push(i.href),
    })),
    { id: 'act:frontdesk', label: 'Switch to Front Desk', group: 'Quick actions', icon: Store, run: () => router.push('/store/board') },
    { id: 'act:walkin', label: 'New walk-in', group: 'Quick actions', icon: Plus, run: () => router.push('/admin/walkin') },
    { id: 'act:close', label: 'Start daily close', group: 'Quick actions', icon: LockKeyhole, run: () => router.push('/admin/close') },
    { id: 'act:expense', label: 'Add expense', group: 'Quick actions', icon: Wallet, run: () => router.push('/admin/expenses') },
    { id: 'act:signout', label: 'Sign out', group: 'Quick actions', icon: LogOut, run: handleLogout },
  ];

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
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.12em', color: 'var(--ember)', textTransform: 'uppercase' }}>Admin OS</p>
            </div>
          </div>
        </div>

        {/* Operating-mode switch - Admin OS ⇄ Front Desk OS (Shopify-style) */}
        <div className="mt-4 grid grid-cols-2 gap-1 p-1 rounded-xl" style={{ background: 'var(--dark)', border: '1px solid var(--border)' }}>
          <span className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg"
            style={{ background: 'var(--accent-mist)', border: '1px solid var(--accent-haze)', fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.1em', color: 'var(--ember)' }}>
            <Shield size={11} /> ADMIN
          </span>
          <Link href="/store/board" onClick={() => setSidebarOpen(false)}
            className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-colors hover:bg-white/[.04]"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.1em', color: 'var(--steel)' }}>
            <Store size={11} /> FRONT DESK
          </Link>
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
                const active = href === current.href;
                return (
                  <Link key={href} href={href} onClick={() => setSidebarOpen(false)}
                    className="nav-item group relative flex items-center gap-2.5 pl-3 pr-3 py-2 rounded-lg transition-all duration-150"
                    style={{
                      background: active ? 'var(--accent-mist)' : 'transparent',
                      border: active ? '1px solid var(--accent-haze)' : '1px solid transparent',
                      color: active ? 'var(--fg)' : 'var(--pewter)',
                      fontFamily: 'var(--font-body)', fontSize: '13px',
                      fontWeight: active ? 600 : 450, letterSpacing: '0.005em',
                    }}>
                    {active && (
                      <motion.span layoutId="nav-active" aria-hidden
                        className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                        style={{ width: 3, height: 18, background: 'var(--ember)' }} />
                    )}
                    <Icon size={14} style={{ color: active ? 'var(--ember)' : 'var(--steel)' }} />{label}
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
        style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)', paddingTop: 'var(--sat)', paddingLeft: 'var(--sal)' }}>
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
              style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)', paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)', paddingLeft: 'var(--sal)' }}>
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
        {/* Desktop top bar - page context + command trigger + quick action */}
        <header className="hidden md:flex items-center gap-4 px-6 safe-header z-30"
          style={{ height: 'calc(60px + var(--sat))', background: 'color-mix(in srgb, var(--surface) 82%, transparent)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <current.icon size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <span className="font-mono" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--faint)', textTransform: 'uppercase' }}>Admin</span>
            <span style={{ color: 'var(--border-strong)' }}>/</span>
            <span className="font-display truncate" style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.01em' }}>{current.label}</span>
          </div>
          <button onClick={() => setPaletteOpen(true)}
            className="ml-auto flex items-center gap-2 pl-3 pr-2 rounded-xl transition-colors"
            style={{ height: 36, background: 'var(--fog)', border: '1px solid var(--border-2)', color: 'var(--muted)' }}>
            <Search size={13} />
            <span className="font-body" style={{ fontSize: 12.5 }}>Search…</span>
            <kbd className="inline-flex items-center px-1.5 py-0.5 rounded-md font-mono ml-4" style={{ fontSize: 10, background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--muted)' }}>⌘K</kbd>
          </button>
          <Link href="/admin/walkin"
            className="flex items-center gap-1.5 px-3.5 rounded-xl transition-transform active:scale-95"
            style={{ height: 36, background: 'var(--accent-grad)', color: 'var(--on-accent)', boxShadow: 'var(--ember-glow-sm)' }}>
            <Plus size={14} /><span className="font-display" style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.01em' }}>New walk-in</span>
          </Link>
        </header>

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 safe-header z-30"
          style={{ background: 'color-mix(in srgb, var(--surface) 88%, transparent)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: 'var(--dark)', color: 'var(--chrome)' }}>
            <Menu size={16} />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <current.icon size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <span className="font-display truncate" style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)' }}>{current.label}</span>
          </div>
          <button onClick={() => setPaletteOpen(true)}
            className="ml-auto w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: 'var(--dark)', color: 'var(--steel)' }}>
            <Search size={15} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto safe-scroll" style={{ paddingRight: 'var(--sar)' }}>{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
    </div>
  );
}
