'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ChevronRight, LogOut, Bell, Car, Calendar, Sun, Moon, MapPin, Phone, Pencil, X } from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { logoutUser, updateUserProfile } from '@/lib/firebaseService';
import { useAppStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';

export default function ProfilePage() {
  const router = useRouter();
  const {
    user, vehicles, bookings, setUser, theme, toggleTheme,
    setVehicles, setBookings, setNotifications,
  } = useAppStore();

  const [loggingOut, setLoggingOut] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const openEdit = () => {
    setEditName(user?.name || '');
    setEditPhone(user?.phone || '');
    setEditOpen(true);
  };

  const saveProfile = async () => {
    if (!user) return;
    const name = editName.trim();
    const phone = editPhone.replace(/\D/g, '');
    if (name.length < 2) { toast.error('Enter your name'); return; }
    if (phone && phone.length !== 10) { toast.error('Phone must be 10 digits'); return; }
    setSaving(true);
    try {
      await updateUserProfile(user.uid, { name, phone });
      setUser({ ...user, name, phone });
      setEditOpen(false);
      toast.success('Profile updated');
    } catch {
      toast.error('Could not save - try again');
    } finally {
      setSaving(false);
    }
  };
  const completed  = bookings.filter(b => b.status === 'completed');
  const totalSpent = completed.reduce((s, b) => s + b.totalAmount, 0);
  const firstName  = user?.name?.split(' ')[0] || 'User';

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutUser();
      setUser(null); setVehicles([]); setBookings([]); setNotifications([]);
      router.replace('/');
    } catch {
      toast.error('Logout failed. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  };

  const STATS = [
    { label: 'Services',    value: String(completed.length) },
    { label: 'Vehicles',    value: String(vehicles.length) },
    { label: 'Total Spent', value: totalSpent >= 100000
        ? `₹${(totalSpent/100000).toFixed(1)}L`
        : totalSpent >= 1000
        ? `₹${(totalSpent/1000).toFixed(0)}K`
        : formatCurrency(totalSpent) },
  ];

  const MENU = [
    { icon: Car,      label: 'My Garage',      sub: `${vehicles.length} vehicle${vehicles.length !== 1 ? 's' : ''}`, href: '/dashboard/vehicles' },
    { icon: Calendar, label: 'Service History', sub: `${completed.length} completed`,                                  href: '/dashboard/history' },
    { icon: Bell,     label: 'Notifications',   sub: 'Booking & service alerts',                                       href: '/dashboard/notifications' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--void)' }}>

      {/* Hero */}
      <div className="relative overflow-hidden px-4 pt-14 pb-8">
        <div className="absolute inset-0 bg-grid opacity-[0.025]" />
        <div className="absolute top-0 inset-x-0 h-48 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 100% at 50% -20%, rgba(255,255,255,0.14) 0%, transparent 70%)' }} />

        <div className="relative z-10 flex items-start justify-between mb-6">
          <motion.div className="flex items-center gap-4"
            initial={false} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
            <div className="relative shrink-0">
              {user?.photoURL ? (
                <div className="w-16 h-16 rounded-2xl overflow-hidden ember-ring">
                  <Image src={user.photoURL} alt={user.name} width={64} height={64}
                    className="object-cover" referrerPolicy="no-referrer" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: 'var(--accent-grad)', boxShadow: '0 4px 24px var(--accent-glow)' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '24px', color: 'var(--on-accent)' }}>
                    {firstName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '22px', color: 'var(--chrome)', letterSpacing: '0.03em' }}>
                {user?.name}
              </h1>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
                {user?.email}
              </p>
              <button onClick={openEdit}
                className="inline-flex items-center gap-1.5 mt-1.5 px-3 py-2 rounded-lg"
                style={{ background: 'var(--ash)', border: '1px solid var(--border)', color: 'var(--silver)', fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500 }}>
                <Pencil size={10} /> Edit profile
              </button>
            </div>
          </motion.div>

          <motion.button
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            onClick={toggleTheme} whileTap={{ scale: 0.88 }}
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--cavern)', border: '1px solid var(--border)' }}>
            {theme === 'dark'
              ? <Sun  size={15} style={{ color: 'var(--ember)' }} />
              : <Moon size={15} style={{ color: 'var(--ember)' }} />}
          </motion.button>
        </div>

        <motion.div className="grid grid-cols-3 gap-3"
          initial={false} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.4 }}>
          {STATS.map((s, i) => (
            <motion.div key={s.label} className="card rounded-2xl p-3 text-center"
              initial={false} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + i * 0.06 }}>
              <p className="gradient-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px' }}>
                {s.value}
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                {s.label}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      <div className="px-4 space-y-4 pb-8">

        {/* Menu */}
        <motion.div
          initial="hidden" animate="show"
          variants={{ show: { transition: { staggerChildren: 0.06 } } }}
          className="card rounded-2xl overflow-hidden" style={{ padding: 0 }}>
          {MENU.map((item, i) => (
            <motion.button key={item.label}
              variants={{ hidden: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } } }}
              onClick={() => router.push(item.href)}
              className="w-full flex items-center gap-3 px-4 py-4 text-left transition-colors"
              style={{ borderBottom: i < MENU.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--smoke)' }}>
                <item.icon size={17} style={{ color: 'var(--ember)' }} />
              </div>
              <div className="flex-1">
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 500, color: 'var(--fg-dim)' }}>
                  {item.label}
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                  {item.sub}
                </p>
              </div>
              <ChevronRight size={14} style={{ color: 'var(--steel)' }} />
            </motion.button>
          ))}
        </motion.div>

        {/* Visit us */}
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
          className="card rounded-2xl p-4 space-y-3">
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--faint)' }}>
            Visit Us
          </p>
          <a href={process.env.NEXT_PUBLIC_GOOGLE_MAPS_URL || 'https://maps.google.com'}
            target="_blank" rel="noopener noreferrer"
            className="flex items-start gap-3 py-2 transition-opacity hover:opacity-80">
            <MapPin size={14} style={{ color: 'var(--ember)', marginTop: '2px', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--fg-dim)' }}>
              Bhairavnath Rd, Maninagar, Ahmedabad 380028
            </span>
          </a>
          <a href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '919876543210'}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 py-2 transition-opacity hover:opacity-80">
            <Phone size={14} style={{ color: 'var(--ember)', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--fg-dim)' }}>
              Chat on WhatsApp
            </span>
          </a>
        </motion.div>

        {/* Sign out */}
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
          <motion.button onClick={handleLogout} disabled={loggingOut} whileTap={{ scale: 0.97 }}
            className="w-full rounded-2xl py-4 flex items-center justify-center gap-2 transition-all"
            style={{ border: '1px solid color-mix(in srgb, var(--danger) 22%, transparent)', background: 'color-mix(in srgb, var(--danger) 6%, transparent)', color: 'var(--danger)',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '13px', letterSpacing: '0.08em' }}>
            <LogOut size={15} />
            {loggingOut ? 'SIGNING OUT...' : 'SIGN OUT'}
          </motion.button>
        </motion.div>

        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--faint)', textAlign: 'center', opacity: 0.5, paddingBottom: '8px' }}>
          AutoModz · Maninagar, Ahmedabad
        </p>
      </div>

      {/* Edit profile sheet */}
      <AnimatePresence>
        {editOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
              onClick={() => setEditOpen(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="fixed bottom-0 inset-x-0 z-50 rounded-t-3xl p-5 safe-sheet glass-strong">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-700 text-lg" style={{ color: 'var(--chrome)' }}>Edit Profile</h2>
                <button onClick={() => setEditOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'var(--ash)', color: 'var(--steel)' }}>
                  <X size={14} />
                </button>
              </div>
              <label className="data-label block mb-1.5">Full name</label>
              <input className="input mb-4" value={editName} maxLength={60}
                onChange={e => setEditName(e.target.value)} placeholder="Your name" />
              <label className="data-label block mb-1.5">Phone (10 digits)</label>
              <input className="input mb-5" value={editPhone} inputMode="numeric" maxLength={10}
                onChange={e => setEditPhone(e.target.value.replace(/\D/g, ''))} placeholder="98765 43210" />
              <button onClick={saveProfile} disabled={saving} className="btn-ember w-full py-3.5 text-sm">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}