'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Plus, ChevronRight, Zap, Bell, Clock, CheckCircle, Car, Tag, Gift } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

import { useAppStore } from '@/lib/store';
import {
  formatCurrency,
  formatDate,
  formatTime,
  getStatusColor,
  getStatusLabel,
} from '@/lib/utils';
import ServiceIcon, { PlanIcon } from '@/components/ui/ServiceIcon';

import { getUserSubscription, getServices } from '@/lib/firebaseService';
import { MEMBERSHIP_PLANS, type Subscription } from '@/lib/types';
import GaugeRing from '@/components/ui/GaugeRing';
import HeroMedia from '@/components/ui/HeroMedia';
import { MEDIA } from '@/lib/media';

const SERVICES = [
  { cat: 'PPF',     img: MEDIA.services.ppf,     label: 'Paint Protection',  sub: 'from ₹1,45,000', href: '/dashboard/booking?cat=PPF' },
  { cat: 'Ceramic', img: MEDIA.services.ceramic, label: 'Ceramic Coating',   sub: 'from ₹10,000',   href: '/dashboard/booking?cat=Ceramic' },
  { cat: 'Washing', img: MEDIA.services.washing, label: 'Wash & Detail',     sub: 'from ₹500',      href: '/dashboard/booking?cat=Washing' },
  { cat: 'Coating', img: MEDIA.services.coating, label: 'Teflon & Glass',    sub: 'from ₹1,200',    href: '/dashboard/booking?cat=Coating' },
];

// Content-first: no hidden initial - content is visible immediately.
const stagger = (_i: number) => ({
  initial: false as const,
  animate: { opacity: 1, y: 0 },
});

const daysLeft = (endDate: string) => {
  const diff = new Date(endDate + 'T23:59:59').getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, vehicles, bookings, unreadCount } = useAppStore();

  const [membership, setMembership] = useState<Subscription | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [liveMin, setLiveMin] = useState<Record<string, number>>({});

  // Live "from ₹" prices per category (fallback: static copy in SERVICES)
  useEffect(() => {
    if (!user) return;
    getServices().then(list => {
      const min: Record<string, number> = {};
      list.filter(s => s.active).forEach(s => {
        if (!min[s.category] || s.price < min[s.category]) min[s.category] = s.price;
      });
      setLiveMin(min);
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setMembershipLoading(true);
    getUserSubscription(user.uid)
      .then(setMembership)
      .catch(() => setMembership(null))
      .finally(() => setMembershipLoading(false));
  }, [user]);

  const { upcoming, completed } = useMemo(() => {
    const upcoming = bookings
      .filter(b => ['pending', 'confirmed'].includes(b.status))
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

    const completed = bookings
      .filter(b => b.status === 'completed')
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));

    return { upcoming, completed };
  }, [bookings]);

  const totalSpent = completed.reduce((s, b) => s + b.totalAmount, 0);

  const planConfig = membership
    ? MEMBERSHIP_PLANS.find(p => p.id === membership.plan) ?? null
    : null;

  const washesRemaining = membership
    ? membership.washesTotal - membership.washesUsed
    : 0;

  const daysRemaining = membership ? daysLeft(membership.endDate) : 0;
  const isMemberActive = membership?.status === 'active' && daysRemaining > 0;

  const lastCompleted = completed[0] ?? null;
  const daysSinceLastVisit = lastCompleted
    ? daysLeft(lastCompleted.scheduledDate) * -1
    : null;

  return (
    <div className="min-h-screen pb-6" style={{ background: 'var(--void)' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden px-4 pt-14 pb-6">
        <div className="absolute inset-0 bg-grid opacity-[0.025]" />
        <div className="absolute top-0 inset-x-0 h-48 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 100% at 50% -20%, rgba(255,255,255,0.10) 0%, transparent 70%)' }} />

        <div className="relative z-10">

          {/* Top row */}
          <div className="flex items-center justify-between mb-5">
            <motion.div {...stagger(0)} className="flex-1 min-w-0">
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)' }}>
                {greeting()},
              </p>
              <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '26px', color: 'var(--chrome)', letterSpacing: '0.02em' }}>
                {user?.name?.split(' ')[0] || 'Driver'}
              </h1>
            </motion.div>

            <div className="flex items-center gap-2">
              {/* Notifications */}
              <motion.button
                {...stagger(0.05)}
                onClick={() => router.push('/dashboard/notifications')}
                className="relative w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--cavern)', border: '1px solid var(--border)' }}
              >
                <Bell size={18} style={{ color: 'var(--pewter)' }} />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full"
                    style={{ background: 'var(--ember)' }} />
                )}
              </motion.button>

              {/* Avatar → profile (profile lives under Car now) */}
              <motion.button {...stagger(0.08)} onClick={() => router.push('/dashboard/profile')} aria-label="Profile">
                {user?.photoURL ? (
                  <div className="relative w-11 h-11 rounded-xl overflow-hidden"
                    style={{ border: '1.5px solid var(--border-2)' }}>
                    <Image src={user.photoURL} alt={user.name} fill className="object-cover" referrerPolicy="no-referrer" />
                  </div>
                ) : (
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: 'var(--accent-grad)' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '16px', color: 'var(--on-accent)' }}>
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
              </motion.button>
            </div>
          </div>

          {/* Stats row */}
          <motion.div {...stagger(0.1)} className="grid grid-cols-3 gap-2.5 mb-4">
            {[
              { label: 'SERVICES', value: completed.length },
              { label: 'VEHICLES', value: vehicles.length },
              {
                label: 'SPENT',
                value: totalSpent >= 100000
                  ? `₹${(totalSpent / 100000).toFixed(1)}L`
                  : totalSpent >= 1000
                  ? `₹${(totalSpent / 1000).toFixed(0)}K`
                  : `₹${totalSpent}`,
              },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3 text-center"
                style={{ background: 'var(--cavern)', border: '1px solid var(--border)' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', color: 'var(--chrome)' }}>
                  {s.value}
                </p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.10em', color: 'var(--faint)', marginTop: '2px' }}>
                  {s.label}
                </p>
              </div>
            ))}
          </motion.div>

          {/* Membership instrument cluster - twin gauges (washes · validity) */}
          {isMemberActive && planConfig && !membershipLoading && (
            <motion.button
              {...stagger(0.12)}
              onClick={() => router.push('/dashboard/subscriptions')}
              className="card-ember glass w-full p-4 text-left overflow-hidden relative"
              style={{ borderRadius: 20 }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <PlanIcon plan={planConfig.id} size={18} style={{ color: 'var(--chrome)' }} />
                  <span className="font-display font-700 text-sm text-ember">{planConfig.label} Membership</span>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--ember)' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3">
                  <GaugeRing
                    size={78} stroke={7}
                    value={membership.washesTotal ? (washesRemaining / membership.washesTotal) * 100 : 0}
                    label={washesRemaining}
                    caption="LEFT"
                  />
                  <div>
                    <p className="data-label">WASHES</p>
                    <p className="font-body text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      of {membership.washesTotal}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <GaugeRing
                    size={78} stroke={7}
                    value={Math.min(100, (daysRemaining / 30) * 100)}
                    danger={daysRemaining <= 5}
                    label={daysRemaining}
                    caption="DAYS"
                  />
                  <div>
                    <p className="data-label">VALIDITY</p>
                    <p className="font-body text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      renews soon
                    </p>
                  </div>
                </div>
              </div>
            </motion.button>
          )}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="px-4 space-y-5">

        {/* Book CTA */}
        <motion.button
          {...stagger(0)}
          onClick={() => router.push('/dashboard/booking')}
          className="w-full py-4 rounded-xl flex items-center justify-center gap-2"
          style={{
            background: 'var(--accent-grad)',
            backgroundSize: '200% auto',
            boxShadow: '0 4px 24px var(--accent-glow)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '14px',
            letterSpacing: '0.09em',
            color: 'var(--on-accent)',
          }}
        >
          <Plus size={18} />
          BOOK A SERVICE
        </motion.button>

        {/* Upcoming bookings */}
        {upcoming.length > 0 && (
          <motion.div {...stagger(0.06)}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock size={14} style={{ color: 'var(--ember)' }} />
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.10em', color: 'var(--faint)' }}>
                  UPCOMING
                </p>
              </div>
              <Link href="/dashboard/history" className="tap-target"
                style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--ember)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }}>
                All <ChevronRight size={12} />
              </Link>
            </div>
            <div className="space-y-2.5">
              {upcoming.slice(0, 2).map(b => (
                <div key={b.id} className="card rounded-xl p-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'var(--cavern)' }}>
                    <ServiceIcon category={b.serviceCategory} size={15} style={{ color: 'var(--chrome)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px', color: 'var(--chrome)' }}>
                      {b.serviceName}
                    </p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>
                      {b.vehicleName} · {formatDate(b.scheduledDate)} at {formatTime(b.scheduledTime)}
                    </p>
                  </div>
                  <span className="status-badge" style={{ background: 'var(--smoke)', color: 'var(--chrome)', border: '1px solid var(--border-strong)', fontSize: '9px' }}>
                    {getStatusLabel(b.status)}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Services grid */}
        <motion.div {...stagger(0.08)}>
          <div className="flex items-center justify-between mb-3">
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.10em', color: 'var(--faint)' }}>
              SERVICES
            </p>
            <Link href="/dashboard/booking" className="tap-target"
              style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--ember)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }}>
              All <ChevronRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {SERVICES.map((s, i) => (
              <motion.button
                key={s.cat}
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.07 }}
                onClick={() => router.push(s.href)}
                className="relative rounded-2xl overflow-hidden text-left h-32 flex flex-col justify-end p-3.5"
                style={{ border: '1px solid var(--border)' }}
              >
                <div aria-hidden className="absolute inset-0">
                  <HeroMedia src={s.img} alt="" scrim="none"
                    overlay="linear-gradient(to top, rgba(6,7,9,0.86) 0%, rgba(6,7,9,0.34) 46%, rgba(6,7,9,0.08) 100%)" />
                </div>
                <div className="relative z-10">
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px', color: '#FFFFFF' }}>
                    {s.label}
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'rgba(255,255,255,0.82)', marginTop: '2px' }}>
                    {liveMin[s.cat] ? `from ${formatCurrency(liveMin[s.cat])}` : s.sub}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Cars & Offers quick links */}
        <motion.div {...stagger(0.09)} className="grid grid-cols-2 gap-2.5">
          {[
            { href: '/dashboard/vehicles', icon: Car, title: 'My Garage', sub: `${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'} on file` },
            { href: '/dashboard/cars', icon: Tag, title: 'Cars for Sale', sub: 'Buy & sell with AutoModz' },
          ].map(q => (
            <Link key={q.href} href={q.href} className="card rounded-2xl p-4 block">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl mb-3"
                style={{ background: 'var(--accent-mist)', border: '1px solid var(--border)' }}>
                <q.icon size={17} style={{ color: 'var(--accent)' }} />
              </span>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px', color: 'var(--chrome)' }}>
                {q.title}
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                {q.sub}
              </p>
            </Link>
          ))}
          <Link href="/dashboard/refer" className="card rounded-2xl p-4 block col-span-2">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
                style={{ background: 'var(--accent-mist)', border: '1px solid var(--border)' }}>
                <Gift size={18} style={{ color: 'var(--accent)' }} />
              </span>
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px', color: 'var(--chrome)' }}>
                  Refer a friend - give ₹200, get ₹200
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                  Share your link on WhatsApp, both of you save
                </p>
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Recent completed */}
        {completed.length > 0 && (
          <motion.div {...stagger(0.10)}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle size={14} style={{ color: 'var(--ember)' }} />
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.10em', color: 'var(--faint)' }}>
                  RECENT
                </p>
              </div>
              <Link href="/dashboard/history"
                style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--ember)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                History <ChevronRight size={12} />
              </Link>
            </div>
            <div className="space-y-2.5">
              {completed.slice(0, 2).map(b => (
                <div key={b.id} className="card rounded-xl p-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'var(--cavern)' }}>
                    <ServiceIcon category={b.serviceCategory} size={15} style={{ color: 'var(--chrome)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px', color: 'var(--chrome)' }}>
                      {b.serviceName}
                    </p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>
                      {b.vehicleName} · {formatDate(b.scheduledDate)}
                    </p>
                  </div>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px', color: 'var(--ember)', flexShrink: 0 }}>
                    {formatCurrency(b.totalAmount)}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
}