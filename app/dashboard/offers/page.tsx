'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { BadgePercent, Sparkles, ChevronRight, Zap } from 'lucide-react';
import { getActivePromos, getUserSubscription, membershipDiscountPct } from '@/lib/firebaseService';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import type { Promo, Subscription } from '@/lib/types';

export default function OffersPage() {
  const { user } = useAppStore();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [membership, setMembership] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const today = new Date().toISOString().split('T')[0];
    Promise.all([getActivePromos(), getUserSubscription(user.uid)])
      .then(([all, sub]) => {
        setPromos(all.filter(p =>
          p.validFrom <= today && p.validTo >= today &&
          (p.usageLimitTotal == null || p.usedCount < p.usageLimitTotal) &&
          (p.target.kind === 'all' || p.target.userIds.includes(user.uid))
        ));
        if (sub?.status === 'active' && sub.endDate >= today) setMembership(sub);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const scopeLabel = (p: Promo) =>
    p.scope.kind === 'all' ? 'All services'
      : p.scope.kind === 'category' ? p.scope.categories.join(' · ')
      : 'Selected services';

  return (
    <div className="px-5 pt-6 max-w-lg mx-auto">
      <h1 className="font-display font-800 text-2xl mb-1" style={{ color: 'var(--chrome)' }}>OFFERS</h1>
      <p className="text-sm font-body mb-6" style={{ color: 'var(--steel)' }}>
        Discounts applied automatically at checkout - best one wins.
      </p>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 shimmer rounded-2xl" />)}</div>
      ) : (
        <div className="space-y-3">
          {membership && (
            <motion.div initial={false} animate={{ opacity: 1, y: 0 }}
              className="card-ember rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--smoke)' }}>
                  <Zap size={18} style={{ color: 'var(--ember)' }} />
                </div>
                <div className="flex-1">
                  <p className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>
                    {membership.plan} Membership · {membershipDiscountPct(membership.plan)}% off
                  </p>
                  <p className="text-xs font-body mt-0.5" style={{ color: 'var(--steel)' }}>
                    On all non-wash services until {formatDate(membership.endDate)} - auto-applied
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {promos.map((p, i) => (
            <motion.div key={p.id} initial={false} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }} className="card-dark">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--success) 12%, transparent)' }}>
                  <BadgePercent size={18} style={{ color: 'var(--success)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>{p.label}</p>
                    {p.target.kind === 'customers' && (
                      <span className="data-label flex items-center gap-1" style={{ color: 'var(--ember)' }}>
                        <Sparkles size={9} /> For you
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-body mt-0.5" style={{ color: 'var(--steel)' }}>
                    {p.type === 'percent' ? `${p.value}% off` : `${formatCurrency(p.value)} off`} · {scopeLabel(p)} · till {formatDate(p.validTo)}
                  </p>
                  {!p.autoApply && (
                    <p className="font-mono text-xs mt-1" style={{ color: 'var(--ember)' }}>
                      Use code: {p.code}
                    </p>
                  )}
                </div>
                <Link href="/dashboard/booking" className="shrink-0">
                  <ChevronRight size={16} style={{ color: 'var(--steel)' }} />
                </Link>
              </div>
            </motion.div>
          ))}

          {!membership && promos.length === 0 && (
            <div className="card text-center py-14">
              <BadgePercent size={26} className="mx-auto mb-3" style={{ color: 'var(--steel)' }} />
              <p className="font-body text-sm" style={{ color: 'var(--steel)' }}>
                No offers right now - check back soon, or grab a membership for 10–20% off every service.
              </p>
              <Link href="/dashboard/subscriptions" className="btn-ember inline-block px-6 py-3 mt-4 text-sm">
                View Memberships
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
