'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Calendar, Users, Settings, Clock, Menu, X, LogOut, Sun, Moon, ChevronRight
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { logoutUser } from '@/lib/firebaseService';

const NAV = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/schedule', icon: Clock, label: 'Schedule' },
  { href: '/admin/bookings', icon: Calendar, label: 'Bookings' },
  { href: '/admin/customers', icon: Users, label: 'Customers' },
  { href: '/admin/settings', icon: Settings, label: 'Settings' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, authLoading, setUser, theme, toggleTheme } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/auth/login'); return; }
    if (!authLoading && user && user.role !== 'admin') router.push('/dashboard');
  }, [user, authLoading, router]);

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
    sessionStorage.removeItem('demo-user');
    router.push('/');
  };

  if (authLoading || !user) {
    return <div className="min-h-screen bg-main flex items-center justify-center"><div className="w-10 h-10 loader-ring" /></div>;
  }
  if (user.role !== 'admin') return null;

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center font-display font-900 text-sm text-foreground">A</div>
            <div>
              <div className="font-display font-900 text-sm text-foreground tracking-widest">AUTOMODZ</div>
              <div className="text-orange-500 text-[10px] font-body tracking-widest uppercase">Admin Panel</div>
            </div>
          </div>
          <button onClick={toggleTheme} className="w-7 h-7 glass rounded-lg flex items-center justify-center">
            {theme === 'dark' ? <Sun size={12} className="text-orange-500" /> : <Moon size={12} className="text-orange-500" />}
          </button>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link key={href} href={href} onClick={() => setSidebarOpen(false)}>
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${isActive ? 'bg-orange-500/10 border border-orange-500/20' : 'hover:bg-white/4'}`}>
                <Icon size={15} className={isActive ? 'text-orange-500' : 'text-muted'} />
                <span className={`font-body text-sm ${isActive ? 'text-foreground font-500' : 'text-muted'}`}>{label}</span>
                {isActive && <ChevronRight size={11} className="text-orange-500 ml-auto" />}
              </div>
            </Link>
          );
        })}
      </nav>
      <div className="p-4" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
            <span className="font-display font-700 text-xs text-foreground">{user.name?.charAt(0)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-body text-xs text-foreground font-500 truncate">{user.name}</div>
            <div className="text-orange-500 text-[10px] font-body">Administrator</div>
          </div>
        </div>
        <button onClick={handleLogout} className="w-full flex items-center gap-2 text-muted hover:text-red-400 transition-colors text-xs font-body py-1">
          <LogOut size={12} /> Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-main flex">
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/60 z-30 lg:hidden" />
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-col glass-dark" style={{ borderRight: '1px solid var(--border)', minHeight: '100vh', position: 'sticky', top: 0, height: '100vh' }}>
        <Sidebar />
      </aside>

      {/* Mobile sidebar */}
      <motion.aside
        animate={{ x: sidebarOpen ? 0 : '-100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 250 }}
        className="lg:hidden fixed left-0 top-0 bottom-0 w-60 glass-dark z-40 flex flex-col"
        style={{ borderRight: '1px solid var(--border)' }}
      >
        <Sidebar />
      </motion.aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="lg:hidden glass-dark px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setSidebarOpen(true)} className="w-8 h-8 glass rounded-lg flex items-center justify-center">
            <Menu size={15} className="text-foreground" />
          </button>
          <span className="font-display font-900 text-sm text-foreground tracking-widest">ADMIN</span>
          <button onClick={toggleTheme} className="w-8 h-8 glass rounded-lg flex items-center justify-center">
            {theme === 'dark' ? <Sun size={14} className="text-orange-500" /> : <Moon size={14} className="text-orange-500" />}
          </button>
        </div>
        <main className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div key={pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              className="p-4 md:p-6 max-w-5xl mx-auto w-full">
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
