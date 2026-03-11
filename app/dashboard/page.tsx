'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Plus, Car, Calendar, Clock, ChevronRight, Truck, Shield, Sparkles, Droplets, Zap, Bell, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useAppStore } from '@/lib/store';
import { formatCurrency, formatDate, formatTime, getStatusColor, getStatusLabel, getCategoryIcon } from '@/lib/utils';
import { getUserSubscription } from '@/lib/firebaseService';
import { MEMBERSHIP_PLANS, type Subscription, type MembershipPlan } from '@/lib/types';

// helper used for dashboard calculation
const daysLeft = (endDate: string) => {
  const diff = new Date(endDate + 'T23:59:59').getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
};

const SERVICES = [
  { cat: 'PPF',     icon: '🛡️', label: 'Paint Protection Film',  sub: 'from ₹1,45,000', accent: '#FF4500', href: '/dashboard/booking?cat=PPF' },
  { cat: 'Ceramic', icon: '💎', label: 'Ceramic Coating',         sub: 'from ₹10,000',   accent: '#60A5FA', href: '/dashboard/booking?cat=Ceramic' },
  { cat: 'Washing', icon: '🚿', label: 'Wash & Detail',           sub: 'from ₹500',      accent: '#34D399', href: '/dashboard/booking?cat=Washing' },
  { cat: 'Coating', icon: '✨', label: 'Teflon & Glass',          sub: 'from ₹1,200',    accent: '#A78BFA', href: '/dashboard/booking?cat=Coating' },
];

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: i * 0.06 },
});

export default function DashboardPage() {
  const router = useRouter();
  const { user, vehicles, bookings, unreadCount } = useAppStore();
  const isDemo = user?.role === 'demo';

  // membership state
  const [membership, setMembership] = useState<Subscription | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(false);

  useEffect(() => {
    if (!user || isDemo) return;
    setMembershipLoading(true);
    getUserSubscription(user.uid)
      .then(setMembership)
      .catch(() => setMembership(null))
      .finally(() => setMembershipLoading(false));
  }, [user?.uid, isDemo]);

  const upcoming   = bookings.filter(b => ['pending','confirmed'].includes(b.status)).sort((a,b) => a.scheduledDate.localeCompare(b.scheduledDate));
  const inProgress = bookings.filter(b => ['vehicle_received','in_progress','quality_check','ready_for_delivery'].includes(b.status));
  const completed  = bookings.filter(b => b.status === 'completed');
  const totalSpent = completed.reduce((s, b) => s + b.totalAmount, 0);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // calculate membership-derived values
  const planConfig = membership ? MEMBERSHIP_PLANS.find(p => p.id === membership.plan) ?? null : null;
  const washesRemaining = membership ? membership.washesTotal - membership.washesUsed : 0;
  const daysRemaining = membership ? daysLeft(membership.endDate) : 0;
  const isMemberActive = membership?.status === 'active' && daysRemaining > 0;

  return (
    <div className="min-h-screen pb-6" style={{ background: 'var(--void)' }}>
      {/* ── Hero Header ─────────────────────────────────── */}
      <div className="relative overflow-hidden px-4 pt-14 pb-8">
        {/* Background layers */}
        <div className="absolute inset-0 bg-nebula" />
        <div className="absolute inset-0 bg-hex opacity-30" />
        <div className="plasma-orb w-80 h-80 -top-20 -right-20" style={{ background: 'radial-gradient(circle, rgba(255,69,0,0.12) 0%, transparent 70%)' }} />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-5">
            <motion.div {...stagger(0)} className="flex-1 min-w-0">
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.16em', color: 'var(--faint)', textTransform: 'uppercase', marginBottom: '4px' }}>
                {greeting()},
              </p>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '26px', color: 'var(--chrome)', letterSpacing: '-0.01em', lineHeight: 1 }}>
                {user?.name?.split(' ')[0] || 'Driver'}
              </h1>
              {isDemo && (
                <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(255,69,0,0.12)', border: '1px solid rgba(255,69,0,0.2)' }}>
                  <Zap size={9} style={{ color: 'var(--ember)' }} />
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '9px', letterSpacing: '0.12em', color: 'var(--ember)' }}>
                    DEMO MODE
                  </span>
                </div>
              )}
            </motion.div>

            {/* membership card */}
            {isMemberActive && planConfig && (
              <motion.div {...stagger(0.08)}
                className="ml-4 p-3 rounded-2xl flex flex-col items-start"
                style={{ background: `${planConfig.color}10`, border: `1.5px solid ${planConfig.color}40` }}>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: '20px' }}>{PLAN_ICONS[planConfig.id]}</span>
                  <div>
                    <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '14px', color: planConfig.color }}>
                      {planConfig.label} member
                    </p>
                    <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', color: 'var(--faint)', letterSpacing: '0.08em' }}>
                      {washesRemaining} wash{washesRemaining!==1?'es':''} · {daysRemaining}d left
                    </p>
                  </div>
                </div>
                <button onClick={() => router.push('/dashboard/subscriptions')}
                  className="mt-2 text-xs font-600" style={{ color: planConfig.color }}>
                  Manage
                </button>
              </motion.div>
            )}

            <div className="flex items-center gap-2">
              {/* Notif bell */}
              <motion.button {...stagger(0.05)} onClick={() => router.push('/dashboard/notifications')}
                className="relative w-11 h-11 rounded-2xl flex items-center justify-center card"
                style={{ border: '1px solid var(--border-2)' }}>
                <Bell size={17} style={{ color: 'var(--pewter)' }} />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full animate-breathe"
                    style={{ background: 'var(--ember)' }} />
                )}
              </motion.button>

              {/* Avatar */}
              <motion.div {...stagger(0.08)}>
                {user?.photoURL && !isDemo ? (
                  <div className="relative w-11 h-11 rounded-2xl overflow-hidden"
                    style={{ boxShadow: '0 0 0 2px var(--ember)', }}>
                    <Image src={user.photoURL} alt={user.name} fill className="object-cover" referrerPolicy="no-referrer" />
                  </div>
                ) : (
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #FF4500, #FF6622)', boxShadow: '0 4px 16px rgba(255,69,0,0.35)' }}>
                    <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '18px', color: 'white' }}>
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
              </motion.div>
            </div>
          </div>

          {/* Stats row */}
          <motion.div {...stagger(0.1)} className="grid grid-cols-3 gap-3">
            {[
              { label: 'SERVICES', value: completed.length },
              { label: 'VEHICLES', value: vehicles.length },
              { label: 'SPENT',    value: totalSpent >= 100000 ? `₹${(totalSpent/100000).toFixed(1)}L` : totalSpent >= 1000 ? `₹${(totalSpent/1000).toFixed(0)}K` : `₹${totalSpent}` },
            ].map(s => (
              <div key={s.label} className="card-chrome rounded-2xl p-3 text-center">
                <p className="gradient-text" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '20px', lineHeight: 1 }}>
                  {s.value}
                </p>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '9px', letterSpacing: '0.12em', color: 'var(--faint)', marginTop: '4px' }}>
                  {s.label}
                </p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      <div className="px-4 space-y-6">
        {/* ── In Progress ──────────────────────────────── */}
        {inProgress.length > 0 && (
          <motion.button {...stagger(0)} onClick={() => router.push('/dashboard/history')}
            className="w-full card-ember rounded-2xl p-4 text-left holo-surface">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl animate-breathe"
                style={{ background: 'rgba(255,69,0,0.15)' }}>
                {getCategoryIcon(inProgress[0].serviceCategory)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="w-1.5 h-1.5 rounded-full animate-breathe" style={{ background: 'var(--ember)' }} />
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '9px', letterSpacing: '0.14em', color: 'var(--ember)', textTransform: 'uppercase' }}>
                    LIVE · IN PROGRESS
                  </span>
                </div>
                <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '14px', color: 'var(--chrome)' }} className="truncate">
                  {inProgress[0].serviceName}
                </p>
                <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '12px', color: 'var(--steel)' }} className="truncate">
                  {inProgress[0].vehicleName}
                </p>
              </div>
              <ChevronRight size={15} style={{ color: 'var(--ember)', flexShrink: 0 }} />
            </div>
          </motion.button>
        )}

        {/* ── Book CTA ─────────────────────────────────── */}
        <motion.button {...stagger(0.05)} whileTap={{ scale: 0.97 }}
          onClick={() => router.push('/dashboard/booking')}
          className="btn-ember w-full rounded-2xl py-4 flex items-center justify-center gap-2"
          style={{ fontSize: '13px', letterSpacing: '0.12em' }}>
          <Plus size={17} />
          BOOK A SERVICE
        </motion.button>

        {/* ── Service Grid ─────────────────────────────── */}
        <motion.div {...stagger(0.1)}>
          <div className="flex items-center justify-between mb-3">
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '13px', letterSpacing: '0.10em', color: 'var(--chrome)', textTransform: 'uppercase' }}>
              Services
            </h2>
            <Link href="/dashboard/booking" style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', color: 'var(--ember)', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '4px' }}>
              All <ChevronRight size={11} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {SERVICES.map((s, i) => (
              <motion.button key={s.cat}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.07, duration: 0.4 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push(s.href)}
                className="card rounded-2xl p-4 text-left relative overflow-hidden holo-surface">
                <div className="text-2xl mb-3">{s.icon}</div>
                <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '13px', color: 'var(--chrome)', lineHeight: 1.2, marginBottom: '4px' }}>
                  {s.label}
                </p>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', color: 'var(--faint)', letterSpacing: '0.06em' }}>
                  {s.sub}
                </p>
                <div className="absolute bottom-0 right-0 w-16 h-16 rounded-full opacity-10"
                  style={{ background: `radial-gradient(circle, ${s.accent}, transparent)`, filter: 'blur(12px)' }} />
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* ── Upcoming Bookings ────────────────────────── */}
        {upcoming.length > 0 && (
          <motion.div {...stagger(0.18)}>
            <div className="flex items-center justify-between mb-3">
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '13px', letterSpacing: '0.10em', color: 'var(--chrome)', textTransform: 'uppercase' }}>
                Upcoming
              </h2>
              <button onClick={() => router.push('/dashboard/history')}
                style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', color: 'var(--ember)', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                All <ChevronRight size={11} />
              </button>
            </div>
            <div className="space-y-3">
              {upcoming.slice(0, 3).map((b, i) => (
                <motion.button key={b.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18 + i * 0.06 }} whileTap={{ scale: 0.98 }}
                  onClick={() => router.push('/dashboard/history')}
                  className="w-full card rounded-2xl p-4 text-left holo-surface">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                      style={{ background: 'var(--cavern)' }}>
                      {getCategoryIcon(b.serviceCategory)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '14px', color: 'var(--chrome)' }} className="truncate">
                        {b.serviceName}
                      </p>
                      <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '12px', color: 'var(--steel)' }} className="truncate">
                        {b.vehicleName}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', color: 'var(--faint)' }}>
                          {formatDate(b.scheduledDate)}
                        </span>
                        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', color: 'var(--faint)' }}>
                          {formatTime(b.scheduledTime)}
                        </span>
                        {b.pickupDropRequired && <Truck size={9} style={{ color: 'var(--ember)', flexShrink: 0 }} />}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '14px', color: 'var(--chrome)' }}>
                        {formatCurrency(b.totalAmount)}
                      </p>
                      <span className={`status-badge mt-1 ${getStatusColor(b.status)}`}>{getStatusLabel(b.status)}</span>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Vehicles ─────────────────────────────────── */}
        <motion.div {...stagger(0.26)}>
          <div className="flex items-center justify-between mb-3">
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '13px', letterSpacing: '0.10em', color: 'var(--chrome)', textTransform: 'uppercase' }}>
              My Garage
            </h2>
            <button onClick={() => router.push('/dashboard/vehicles')}
              style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', color: 'var(--ember)', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Manage <ChevronRight size={11} />
            </button>
          </div>
          {vehicles.length === 0 ? (
            <button onClick={() => router.push('/dashboard/vehicles')}
              className="w-full card rounded-2xl p-4 flex items-center gap-3 text-left"
              style={{ borderStyle: 'dashed', borderColor: 'rgba(255,69,0,0.2)' }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(255,69,0,0.08)' }}>
                <Plus size={18} style={{ color: 'var(--ember)' }} />
              </div>
              <div>
                <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '14px', color: 'var(--chrome)' }}>Add Your Vehicle</p>
                <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '12px', color: 'var(--steel)' }}>Required to book a service</p>
              </div>
            </button>
          ) : (
            <div className="flex gap-3 overflow-x-auto no-scroll pb-2">
              {vehicles.map(v => (
                <button key={v.id} onClick={() => router.push('/dashboard/vehicles')}
                  className="flex-shrink-0 card rounded-2xl p-3 flex flex-col items-center gap-2 w-28 text-center">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'var(--cavern)' }}>🚗</div>
                  <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '11px', color: 'var(--chrome)', lineHeight: 1.2 }}>{v.name}</p>
                  <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '9px', color: 'var(--faint)', letterSpacing: '0.08em' }}>{v.registrationNumber}</p>
                </button>
              ))}
              <button onClick={() => router.push('/dashboard/vehicles')}
                className="flex-shrink-0 card rounded-2xl p-3 flex flex-col items-center justify-center gap-2 w-20"
                style={{ borderStyle: 'dashed', borderColor: 'rgba(255,69,0,0.2)' }}>
                <Plus size={16} style={{ color: 'var(--ember)' }} />
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '9px', color: 'var(--ember)', letterSpacing: '0.08em' }}>ADD</p>
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
