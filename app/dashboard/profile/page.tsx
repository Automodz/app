'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ChevronRight, LogOut, Bell, Car, Calendar, Sun, Moon, MapPin, Phone, Shield } from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { logoutUser } from '@/lib/firebaseService';
import { useAppStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';

export default function ProfilePage() {
  const router = useRouter();
  const { user, vehicles, bookings, setUser, theme, toggleTheme, setVehicles, setBookings, setNotifications } = useAppStore();
  const [loggingOut, setLoggingOut] = useState(false);
  const isDemo = user?.role === 'demo';

  const completed  = bookings.filter(b => b.status === 'completed');
  const totalSpent = completed.reduce((s, b) => s + b.totalAmount, 0);
  const firstName  = user?.name?.split(' ')[0] || 'User';

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      if (isDemo) sessionStorage.removeItem('demo-user');
      else await logoutUser();
      setUser(null); setVehicles([]); setBookings([]); setNotifications([]);
      router.push('/');
    } catch { toast.error('Logout failed'); }
    finally { setLoggingOut(false); }
  };

  const STATS = [
    { l: 'Services',    v: completed.length,      suffix: '' },
    { l: 'Vehicles',    v: vehicles.length,        suffix: '' },
    { l: 'Total Spent', v: totalSpent >= 1000 ? `${(totalSpent/1000).toFixed(0)}K` : String(totalSpent), suffix: '₹' },
  ];

  const MENU = [
    { icon: Car,      label: 'My Garage',       sub: `${vehicles.length} vehicle${vehicles.length!==1?'s':''}`,   href: '/dashboard/vehicles' },
    { icon: Calendar, label: 'Service History',  sub: `${completed.length} completed`,                            href: '/dashboard/history' },
    { icon: Bell,     label: 'Notifications',    sub: 'Booking & service alerts',                                 href: '/dashboard/notifications' },
  ];

  const stagger = { container: { animate: { transition: { staggerChildren: 0.06 } } }, item: { initial: { opacity:0, y:12 }, animate: { opacity:1, y:0, transition: { duration:0.38, ease:[0.22,1,0.36,1] } } } };

  return (
    <div className="min-h-screen bg-mesh">
      {/* Hero */}
      <div className="relative overflow-hidden px-4 pt-14 pb-8">
        <div className="absolute inset-0 bg-grid opacity-[0.025]" />
        <div className="absolute top-0 inset-x-0 h-48 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 100% at 50% -20%, rgba(255,69,0,0.14) 0%, transparent 70%)' }} />

        <div className="relative z-10 flex items-start justify-between mb-6">
          <motion.div className="flex items-center gap-4"
            initial={{ opacity:0, y:-12 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.45, ease:[0.22,1,0.36,1] }}>
            {/* Avatar */}
            <div className="relative shrink-0">
              {user?.photoURL && !isDemo ? (
                <div className="w-16 h-16 rounded-2xl overflow-hidden ring-orange">
                  <Image src={user.photoURL} alt={user.name} width={64} height={64} className="object-cover" referrerPolicy="no-referrer" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #FF4500 0%, #FF7A35 100%)', boxShadow: '0 4px 24px rgba(255,69,0,0.35)' }}>
                  <span className="font-display font-800 text-2xl text-white">{firstName.charAt(0).toUpperCase()}</span>
                </div>
              )}
              {isDemo && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--plasma)', border: '2px solid var(--bg)' }}>
                  <span className="text-white text-[9px] font-display font-800">D</span>
                </div>
              )}
            </div>
            <div>
              <h1 className="font-display font-800 text-2xl text-white tracking-wide">{user?.name}</h1>
              <p className="font-body text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{user?.email}</p>
              {isDemo && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-body text-xs mt-1"
                  style={{ background: 'rgba(255,69,0,0.12)', color: 'var(--plasma-hi)', border: '1px solid rgba(255,107,0,0.25)' }}>
                  ✨ Demo Account
                </span>
              )}
            </div>
          </motion.div>

          {/* Theme toggle */}
          <motion.button
            initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.1 }}
            onClick={toggleTheme}
            whileTap={{ scale:0.88 }}
            className="w-10 h-10 glass rounded-2xl flex items-center justify-center"
          >
            {theme === 'dark' ? <Sun size={15} style={{ color:'var(--plasma-hi)' }}/> : <Moon size={15} style={{ color:'var(--plasma-hi)' }}/>}
          </motion.button>
        </div>

        {/* Stats */}
        <motion.div className="grid grid-cols-3 gap-3"
          initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.18, duration:0.4 }}>
          {STATS.map((s, i) => (
            <motion.div key={s.l} className="card-holo rounded-2xl p-3 text-center"
              initial={{ opacity:0, scale:0.88 }} animate={{ opacity:1, scale:1 }}
              transition={{ delay: 0.2 + i * 0.06 }}>
              <p className="font-display font-800 text-xl gradient-text">{s.suffix}{s.v}</p>
              <p className="font-body text-xs mt-0.5" style={{ color:'var(--muted)' }}>{s.l}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      <div className="px-4 space-y-4 pb-8">
        {/* Menu */}
        <motion.div variants={stagger.container} initial="initial" animate="animate"
          className="card rounded-2xl overflow-hidden" style={{ padding:0 }}>
          {MENU.map((item, i) => (
            <motion.button key={item.label} variants={stagger.item}
              onClick={() => router.push(item.href)}
              className="w-full flex items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-white/[0.02]"
              style={{ borderBottom: i < MENU.length-1 ? '1px solid var(--border)' : 'none' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background:'rgba(255,69,0,0.10)' }}>
                <item.icon size={17} style={{ color:'var(--plasma-hi)' }}/>
              </div>
              <div className="flex-1">
                <p className="font-body text-sm font-500 text-white">{item.label}</p>
                <p className="font-body text-xs mt-0.5" style={{ color:'var(--muted)' }}>{item.sub}</p>
              </div>
              <ChevronRight size={14} style={{ color:'var(--dust)' }}/>
            </motion.button>
          ))}
        </motion.div>

        {/* Visit */}
        <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.32 }}
          className="card rounded-2xl p-4 space-y-3">
          <p className="font-mono text-xs tracking-[0.15em] uppercase" style={{ color:'var(--dust)' }}>Visit Us</p>
          <a href={process.env.NEXT_PUBLIC_GOOGLE_MAPS_URL||'#'} target="_blank" rel="noopener noreferrer"
            className="flex items-start gap-3 transition-opacity hover:opacity-80">
            <MapPin size={14} style={{ color:'var(--plasma-hi)' }} className="mt-0.5 shrink-0"/>
            <span className="font-body text-sm" style={{ color:'var(--fg-2)' }}>Bhairavnath Rd, Maninagar, Ahmedabad 380028</span>
          </a>
          <a href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER||'919876543210'}`}
            target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <Phone size={14} style={{ color:'var(--plasma-hi)' }} className="shrink-0"/>
            <span className="font-body text-sm" style={{ color:'var(--fg-2)' }}>Chat on WhatsApp</span>
          </a>
        </motion.div>

        {/* Logout */}
        <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.38 }}>
          <motion.button onClick={handleLogout} disabled={loggingOut} whileTap={{ scale:0.97 }}
            className="w-full rounded-2xl py-4 flex items-center justify-center gap-2 font-display font-800 tracking-wider text-sm transition-all"
            style={{ border:'1px solid rgba(255,59,92,0.22)', background:'rgba(255,59,92,0.06)', color:'#FF6680' }}>
            <LogOut size={15}/>
            {loggingOut ? 'SIGNING OUT...' : isDemo ? 'EXIT DEMO' : 'SIGN OUT'}
          </motion.button>
        </motion.div>

        <p className="text-center font-body text-xs pb-2" style={{ color:'var(--dust)', opacity:0.5 }}>
          AutoModz v3.0 · Maninagar, Ahmedabad
        </p>
      </div>
    </div>
  );
}
