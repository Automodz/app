'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Plus, ChevronRight, Zap, Bell, Clock, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

import { useAppStore } from '@/lib/store';
import {
  formatCurrency,
  formatDate,
  formatTime,
  getStatusColor,
  getStatusLabel,
  getCategoryIcon,
  getStatusStep,
} from '@/lib/utils';

import { getUserSubscription } from '@/lib/firebaseService';
import { MEMBERSHIP_PLANS, type Subscription } from '@/lib/types';

// Keys match MembershipPlan type: 'Silver' | 'Gold' | 'Platinum'
const PLAN_ICONS: Record<string, string> = {
  Silver:   '🥈',
  Gold:     '🥇',
  Platinum: '💎',
};

const SERVICES = [
  { cat: 'PPF',     icon: '🛡', label: 'Paint Protection',  sub: 'from ₹1,45,000', href: '/dashboard/booking?cat=PPF' },
  { cat: 'Ceramic', icon: '✱', label: 'Ceramic Coating',   sub: 'from ₹10,000',   href: '/dashboard/booking?cat=Ceramic' },
  { cat: 'Washing', icon: '💧', label: 'Wash & Detail',     sub: 'from ₹500',      href: '/dashboard/booking?cat=Washing' },
  { cat: 'Coating', icon: '◆', label: 'Teflon & Glass',    sub: 'from ₹1,200',    href: '/dashboard/booking?cat=Coating' },
];

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay: i * 0.06 },
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
  const isDemo = user?.role === 'demo';

  const [membership, setMembership] = useState<Subscription | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(false);

  useEffect(() => {
    if (!user || isDemo) return;
    setMembershipLoading(true);
    getUserSubscription(user.uid)
      .then(setMembership)
      .catch(() => setMembership(null))
      .finally(() => setMembershipLoading(false));
  }, [user, isDemo]);

  const { upcoming, inProgress, completed } = useMemo(() => {
    const upcoming = bookings
      .filter(b => ['pending', 'confirmed'].includes(b.status))
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

    const inProgress = bookings
      .filter(b =>
        ['vehicle_received', 'in_progress', 'quality_check', 'ready_for_delivery'].includes(b.status),
      )
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

    const completed = bookings
      .filter(b => b.status === 'completed')
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));

    return { upcoming, inProgress, completed };
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
          style={{ background: 'radial-gradient(ellipse 80% 100% at 50% -20%, rgba(255,69,0,0.10) 0%, transparent 70%)' }} />

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
              {isDemo && (
                <div className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(255,69,0,0.12)', border: '1px solid rgba(255,69,0,0.25)' }}>
                  <Zap size={10} style={{ color: 'var(--ember)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.12em', color: 'var(--ember)' }}>
                    DEMO MODE
                  </span>
                </div>
              )}
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

              {/* Avatar */}
              <motion.div {...stagger(0.08)}>
                {user?.photoURL && !isDemo ? (
                  <div className="relative w-11 h-11 rounded-xl overflow-hidden"
                    style={{ border: '1.5px solid var(--border-2)' }}>
                    <Image src={user.photoURL} alt={user.name} fill className="object-cover" referrerPolicy="no-referrer" />
                  </div>
                ) : (
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #FF4500, #FF6622)' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '16px', color: 'white' }}>
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
              </motion.div>
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

          {/* Membership card */}
          {isMemberActive && planConfig && !membershipLoading && (
            <motion.button
              {...stagger(0.12)}
              onClick={() => router.push('/dashboard/subscriptions')}
              className="w-full rounded-xl p-3 text-left flex items-center gap-3"
              style={{
                background: `${planConfig.color}10`,
                border: `1px solid ${planConfig.color}35`,
              }}
            >
              <span style={{ fontSize: '20px' }}>{PLAN_ICONS[planConfig.id] ?? '⭐'}</span>
              <div className="flex-1 min-w-0">
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px', color: planConfig.color }}>
                  {planConfig.label} Member
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--muted)', marginTop: '1px' }}>
                  {washesRemaining} wash{washesRemaining !== 1 ? 'es' : ''} remaining · {daysRemaining}d left
                </p>
              </div>
              <ChevronRight size={14} style={{ color: planConfig.color, flexShrink: 0 }} />
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
            background: 'linear-gradient(135deg, #FF4500 0%, #FF6622 50%, #FF4500 100%)',
            backgroundSize: '200% auto',
            boxShadow: '0 4px 24px rgba(255,69,0,0.38)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '14px',
            letterSpacing: '0.09em',
            color: 'white',
          }}
        >
          <Plus size={18} />
          BOOK A SERVICE
        </motion.button>

        {/* In-progress live banner */}
        {inProgress.length > 0 && (
          <motion.button
            {...stagger(0.04)}
            onClick={() => router.push('/dashboard/history')}
            className="w-full rounded-xl p-4 text-left"
            style={{ background: 'rgba(255,69,0,0.08)', border: '1px solid rgba(255,69,0,0.22)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(255,69,0,0.15)' }}>
                <span style={{ fontSize: '16px' }}>{getCategoryIcon(inProgress[0].serviceCategory)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="animate-ember-pulse inline-block w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--ember)' }} />
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.12em', color: 'var(--ember)' }}>
                    LIVE · IN PROGRESS
                  </p>
                </div>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', color: 'var(--chrome)' }}>
                  {inProgress[0].serviceName}
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--muted)' }}>
                  {inProgress[0].vehicleName}
                </p>
              </div>
              <ChevronRight size={16} style={{ color: 'var(--ember)', flexShrink: 0 }} />
            </div>
          </motion.button>
        )}

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
              <Link href="/dashboard/history"
                style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--ember)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                All <ChevronRight size={12} />
              </Link>
            </div>
            <div className="space-y-2.5">
              {upcoming.slice(0, 2).map(b => (
                <div key={b.id} className="card rounded-xl p-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'var(--cavern)' }}>
                    <span style={{ fontSize: '15px' }}>{getCategoryIcon(b.serviceCategory)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px', color: 'var(--chrome)' }}>
                      {b.serviceName}
                    </p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>
                      {b.vehicleName} · {formatDate(b.scheduledDate)} at {formatTime(b.scheduledTime)}
                    </p>
                  </div>
                  <span className="status-badge" style={{ background: 'rgba(255,69,0,0.10)', color: 'var(--ember)', border: '1px solid rgba(255,69,0,0.20)', fontSize: '9px' }}>
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
            <Link href="/dashboard/booking"
              style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--ember)', display: 'flex', alignItems: 'center', gap: '2px' }}>
              All <ChevronRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {SERVICES.map((s, i) => (
              <motion.button
                key={s.cat}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.07 }}
                onClick={() => router.push(s.href)}
                className="card rounded-xl p-4 text-left"
              >
                <div style={{ fontSize: '22px', marginBottom: '8px' }}>{s.icon}</div>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px', color: 'var(--chrome)' }}>
                  {s.label}
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                  {s.sub}
                </p>
              </motion.button>
            ))}
          </div>
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
                    <span style={{ fontSize: '15px' }}>{getCategoryIcon(b.serviceCategory)}</span>
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