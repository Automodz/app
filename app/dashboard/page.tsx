'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Plus, ChevronRight, Truck, Zap, Bell } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

import { useAppStore } from '@/lib/store';
import {
  formatCurrency,
  formatDate,
  formatTime,
  getStatusColor,
  getStatusLabel,
  getCategoryIcon
} from '@/lib/utils';

import { getUserSubscription } from '@/lib/firebaseService';
import { MEMBERSHIP_PLANS, type Subscription } from '@/lib/types';

const PLAN_ICONS: Record<string, string> = {
  basic: '🧼',
  pro: '✨',
  elite: '👑'
};

const SERVICES = [
  { cat: 'PPF', icon: '🛡', label: 'Paint Protection Film', sub: 'from ₹1,45,000', accent: '#FF4500', href: '/dashboard/booking?cat=PPF' },
  { cat: 'Ceramic', icon: '✱', label: 'Ceramic Coating', sub: 'from ₹10,000', accent: '#60A5FA', href: '/dashboard/booking?cat=Ceramic' },
  { cat: 'Washing', icon: '💧', label: 'Wash & Detail', sub: 'from ₹500', accent: '#34D399', href: '/dashboard/booking?cat=Washing' },
  { cat: 'Coating', icon: '◆', label: 'Teflon & Glass', sub: 'from ₹1,200', accent: '#A78BFA', href: '/dashboard/booking?cat=Coating' }
];

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay: i * 0.06 }
});

const daysLeft = (endDate: string) => {
  const diff = new Date(endDate + 'T23:59:59').getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
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

    const inProgress = bookings.filter(b =>
      ['vehicle_received', 'in_progress', 'quality_check', 'ready_for_delivery'].includes(b.status)
    );

    const completed = bookings.filter(b => b.status === 'completed');

    return { upcoming, inProgress, completed };

  }, [bookings]);

  const totalSpent = completed.reduce((s, b) => s + b.totalAmount, 0);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const planConfig =
    membership
      ? MEMBERSHIP_PLANS.find(p => p.id === membership.plan) ?? null
      : null;

  const washesRemaining =
    membership ? membership.washesTotal - membership.washesUsed : 0;

  const daysRemaining =
    membership ? daysLeft(membership.endDate) : 0;

  const isMemberActive =
    membership?.status === 'active' && daysRemaining > 0;

  return (

    <div className="min-h-screen pb-6" style={{ background: 'var(--void)' }}>

      <div className="relative overflow-hidden px-4 pt-14 pb-8">

        <div className="relative z-10">

          <div className="flex items-center justify-between mb-5">

            <motion.div {...stagger(0)} className="flex-1 min-w-0">

              <p className="text-xs text-gray-400 mb-1">
                {greeting()},
              </p>

              <h1 className="text-2xl font-bold text-white">
                {user?.name?.split(' ')[0] || 'Driver'}
              </h1>

              {isDemo && (
                <div className="inline-flex items-center gap-2 mt-2 px-2 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs">
                  <Zap size={10} />
                  DEMO MODE
                </div>
              )}

            </motion.div>

            {isMemberActive && planConfig && (

              <motion.div
                {...stagger(0.08)}
                className="ml-4 p-3 rounded-xl border flex flex-col items-start"
                style={{
                  background: `${planConfig.color}10`,
                  borderColor: `${planConfig.color}40`
                }}
              >

                <div className="flex items-center gap-2">

                  <span className="text-lg">
                    {PLAN_ICONS?.[planConfig.id] ?? '⭐'}
                  </span>

                  <div>

                    <p
                      className="font-bold text-sm"
                      style={{ color: planConfig.color }}
                    >
                      {planConfig.label} member
                    </p>

                    <p className="text-xs text-gray-400">
                      {washesRemaining} wash{washesRemaining !== 1 ? 'es' : ''}
                      {' · '}
                      {daysRemaining}d left
                    </p>

                  </div>

                </div>

                <button
                  onClick={() => router.push('/dashboard/subscriptions')}
                  className="text-xs mt-2"
                  style={{ color: planConfig.color }}
                >
                  Manage
                </button>

              </motion.div>

            )}

            <div className="flex items-center gap-2">

              <motion.button
                {...stagger(0.05)}
                onClick={() => router.push('/dashboard/notifications')}
                className="relative w-11 h-11 rounded-xl flex items-center justify-center border border-gray-700"
              >

                <Bell size={18} />

                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-orange-500" />
                )}

              </motion.button>

              <motion.div {...stagger(0.08)}>

                {user?.photoURL && !isDemo ? (

                  <div className="relative w-11 h-11 rounded-xl overflow-hidden">

                    <Image
                      src={user.photoURL}
                      alt={user.name}
                      fill
                      className="object-cover"
                    />

                  </div>

                ) : (

                  <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-orange-500 text-white font-bold">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>

                )}

              </motion.div>

            </div>

          </div>

          <motion.div {...stagger(0.1)} className="grid grid-cols-3 gap-3">

            {[
              { label: 'SERVICES', value: completed.length },
              { label: 'VEHICLES', value: vehicles.length },
              {
                label: 'SPENT',
                value:
                  totalSpent >= 100000
                    ? `₹${(totalSpent / 100000).toFixed(1)}L`
                    : totalSpent >= 1000
                    ? `₹${(totalSpent / 1000).toFixed(0)}K`
                    : `₹${totalSpent}`
              }
            ].map(s => (

              <div
                key={s.label}
                className="rounded-xl p-3 text-center bg-black/40 border border-gray-800"
              >

                <p className="text-lg font-bold text-white">
                  {s.value}
                </p>

                <p className="text-xs text-gray-400 mt-1">
                  {s.label}
                </p>

              </div>

            ))}

          </motion.div>

        </div>

      </div>

      <div className="px-4 space-y-6">

        {inProgress.length > 0 && (

          <motion.button
            {...stagger(0)}
            onClick={() => router.push('/dashboard/history')}
            className="w-full rounded-xl p-4 text-left border border-orange-500/20 bg-orange-500/10"
          >

            <div className="flex items-center gap-3">

              <div className="text-xl">
                {getCategoryIcon(inProgress[0].serviceCategory)}
              </div>

              <div className="flex-1">

                <p className="text-sm text-orange-400 mb-1">
                  LIVE · IN PROGRESS
                </p>

                <p className="font-semibold text-white">
                  {inProgress[0].serviceName}
                </p>

                <p className="text-xs text-gray-400">
                  {inProgress[0].vehicleName}
                </p>

              </div>

              <ChevronRight size={16} />

            </div>

          </motion.button>

        )}

        <motion.button
          {...stagger(0.05)}
          onClick={() => router.push('/dashboard/booking')}
          className="w-full py-4 rounded-xl bg-orange-500 text-white font-semibold flex items-center justify-center gap-2"
        >
          <Plus size={18} />
          BOOK A SERVICE
        </motion.button>

        <motion.div {...stagger(0.1)}>

          <div className="flex items-center justify-between mb-3">

            <h2 className="text-sm text-white font-semibold uppercase">
              Services
            </h2>

            <Link href="/dashboard/booking" className="text-xs text-orange-400 flex items-center gap-1">
              All <ChevronRight size={12} />
            </Link>

          </div>

          <div className="grid grid-cols-2 gap-3">

            {SERVICES.map((s, i) => (

              <motion.button
                key={s.cat}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.07 }}
                onClick={() => router.push(s.href)}
                className="rounded-xl p-4 text-left bg-black/40 border border-gray-800"
              >

                <div className="text-xl mb-2">
                  {s.icon}
                </div>

                <p className="text-sm font-semibold text-white">
                  {s.label}
                </p>

                <p className="text-xs text-gray-400">
                  {s.sub}
                </p>

              </motion.button>

            ))}

          </div>

        </motion.div>

      </div>

    </div>

  );

}