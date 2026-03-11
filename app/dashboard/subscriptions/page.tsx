'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, Check, Loader2, Copy, Shield,
  Droplets, Zap, Clock, AlertTriangle, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/lib/store';
import {
  getUserSubscription, createSubscription, checkAndExpireSubscription,
  DEMO_SUBSCRIPTION,
} from '@/lib/firebaseService';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  MEMBERSHIP_PLANS, type Subscription, type MembershipPlan,
  type MembershipPlanConfig,
} from '@/lib/types';

// ─── helpers ─────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0];
const addDays = (d: string, n: number) => {
  const dt = new Date(d + 'T12:00:00');
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().split('T')[0];
};
const daysLeft = (endDate: string) => {
  const diff = new Date(endDate + 'T23:59:59').getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
};

const PLAN_ICONS: Record<MembershipPlan, string> = {
  Silver: '🥈', Gold: '🥇', Platinum: '💜',
};

// ─── sub-components ──────────────────────────────────────────────────────────

function WashBar({ used, total, color }: { used: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const remaining = total - used;
  return (
    <div>
      <div className="flex justify-between mb-2">
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.1em', color: 'var(--faint)' }}>
          WASHES USED
        </span>
        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '13px', color }}>
          {used} / {total}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--cavern)' }}>
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{ background: pct >= 90 ? '#EF4444' : color }}
        />
      </div>
      <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '12px', color: 'var(--steel)', marginTop: '6px' }}>
        {remaining > 0 ? `${remaining} wash${remaining !== 1 ? 'es' : ''} remaining` : 'All washes used this period'}
      </p>
    </div>
  );
}

function PlanCard({
  plan, selected, onSelect,
}: {
  plan: MembershipPlanConfig;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onSelect}
      className="w-full rounded-2xl p-4 text-left relative overflow-hidden"
      style={{
        background: selected ? `${plan.color}14` : 'var(--card)',
        border: `1.5px solid ${selected ? plan.color : 'var(--border-2)'}`,
        transition: 'border-color 0.2s, background 0.2s',
      }}
    >
      {/* glow blob */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${plan.color}22, transparent)`, filter: 'blur(16px)' }} />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '22px' }}>{PLAN_ICONS[plan.id]}</span>
            <div>
              <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '16px', color: plan.color, letterSpacing: '0.04em' }}>
                {plan.label.toUpperCase()}
              </p>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', color: 'var(--faint)', letterSpacing: '0.08em' }}>
                {plan.washesPerMonth} WASHES / MONTH
              </p>
            </div>
          </div>
          <div className="text-right">
            <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '18px', color: 'var(--chrome)' }}>
              {formatCurrency(plan.price)}
            </p>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '9px', color: 'var(--faint)', letterSpacing: '0.08em' }}>
              /MONTH
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          {plan.perks.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                style={{ background: `${plan.color}22` }}>
                <Check size={9} style={{ color: plan.color }} />
              </div>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '12px', color: 'var(--steel)' }}>
                {p}
              </span>
            </div>
          ))}
        </div>

        {selected && (
          <div className="mt-3 flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full flex items-center justify-center"
              style={{ background: plan.color }}>
              <Check size={9} className="text-white" />
            </div>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', color: plan.color, letterSpacing: '0.1em' }}>
              SELECTED
            </span>
          </div>
        )}
      </div>
    </motion.button>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const router = useRouter();
  const { user } = useAppStore();
  const isDemo = user?.role === 'demo';
  const upiId  = process.env.NEXT_PUBLIC_UPI_ID || 'automodz@upi';

  const [sub, setSub]             = useState<Subscription | null>(null);
  const [loading, setLoading]     = useState(true);
  const [view, setView]           = useState<'dashboard' | 'plans' | 'payment' | 'done'>('dashboard');
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);
  const [payMethod, setPayMethod] = useState<'upi' | 'cash'>('upi');
  const [txnId, setTxnId]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  // load current subscription
  useEffect(() => {
    if (!user) return;
    if (isDemo) {
      setSub(DEMO_SUBSCRIPTION);
      setLoading(false);
      return;
    }
    checkAndExpireSubscription(user.uid)
      .then(updated => getUserSubscription(user.uid).then(s => setSub(updated ?? s)))
      .catch(() => getUserSubscription(user.uid).then(setSub))
      .finally(() => setLoading(false));
  }, [user?.uid]);

  const plan  = sub ? MEMBERSHIP_PLANS.find(p => p.id === sub.plan) ?? null : null;
  const days  = sub ? daysLeft(sub.endDate) : 0;
  const isActive  = sub?.status === 'active' && days > 0;
  const isExpired = !!sub && (sub.status === 'expired' || days === 0);

  const copyUpi = () => {
    navigator.clipboard.writeText(upiId).catch(() => {});
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleJoin = async () => {
    if (!user || !selectedPlan) return;
    if (payMethod === 'upi' && !txnId.trim()) {
      toast.error('Enter your UPI transaction ID');
      return;
    }
    setSubmitting(true);
    try {
      const cfg = MEMBERSHIP_PLANS.find(p => p.id === selectedPlan)!;
      const start = today();
      const end   = addDays(start, 30);
      if (!isDemo) {
        const id = await createSubscription({
          userId: user.uid, userName: user.name,
          userEmail: user.email, userPhone: user.phone || '',
          plan: selectedPlan, status: 'active',
          startDate: start, endDate: end,
          washesTotal: cfg.washesPerMonth, washesUsed: 0,
          paymentMethod: payMethod,
          transactionId: txnId.trim() || undefined,
        });
        const fresh = await getUserSubscription(user.uid);
        setSub(fresh);
      } else {
        // demo: optimistically update
        setSub(prev => prev
          ? { ...prev, plan: selectedPlan, status: 'active', startDate: start, endDate: end,
              washesTotal: cfg.washesPerMonth, washesUsed: 0 }
          : { id: 'demo-sub', userId: 'demo-user', userName: 'Arjun Mehta',
              userEmail: 'arjun.demo@automodz.in', userPhone: '9876543210',
              plan: selectedPlan, status: 'active', startDate: start, endDate: end,
              washesTotal: cfg.washesPerMonth, washesUsed: 0,
              paymentMethod: payMethod, transactionId: txnId,
              createdAt: null as any, updatedAt: null as any,
            }
        );
      }
      setView('done');
    } catch {
      toast.error('Failed to activate membership. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--void)' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 loader-ring" />
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '11px', letterSpacing: '0.12em', color: 'var(--faint)' }}>
          LOADING
        </span>
      </div>
    </div>
  );

  // ── success screen ─────────────────────────────────────────────────────────
  if (view === 'done') {
    const cfg = MEMBERSHIP_PLANS.find(p => p.id === selectedPlan)!;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: 'var(--void)' }}>
        <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 20 }}>
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6"
            style={{ background: `${cfg.color}20`, border: `2px solid ${cfg.color}` }}>
            <span style={{ fontSize: '44px' }}>{PLAN_ICONS[cfg.id]}</span>
          </div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '28px', color: 'var(--chrome)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
            Welcome to {cfg.label}!
          </h2>
          <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '14px', color: 'var(--steel)', marginBottom: '32px', lineHeight: 1.6 }}>
            Your {cfg.label} membership is {payMethod === 'cash' ? 'pending admin verification' : 'being activated'}. You can start using your washes once confirmed.
          </p>
          <button className="btn-ember w-full rounded-2xl py-4 mb-3"
            style={{ fontSize: '13px', letterSpacing: '0.12em' }}
            onClick={() => { setView('dashboard'); }}>
            VIEW MY MEMBERSHIP
          </button>
          <button className="w-full rounded-2xl py-3"
            style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '13px', color: 'var(--steel)' }}
            onClick={() => router.push('/dashboard')}>
            Back to Home
          </button>
        </motion.div>
      </div>
    );
  }

  // ── payment screen ─────────────────────────────────────────────────────────
  if (view === 'payment' && selectedPlan) {
    const cfg = MEMBERSHIP_PLANS.find(p => p.id === selectedPlan)!;
    return (
      <div className="min-h-screen" style={{ background: 'var(--void)' }}>
        <div className="sticky top-0 z-20 px-4 py-4"
          style={{ background: 'rgba(5,5,7,0.92)', backdropFilter: 'blur(24px)', borderBottom: '1px solid var(--border-2)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setView('plans')}
              className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--card)', border: '1px solid var(--border-2)' }}>
              <ChevronLeft size={16} style={{ color: 'var(--chrome)' }} />
            </button>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '18px', color: 'var(--chrome)', letterSpacing: '0.04em' }}>
              PAYMENT
            </h1>
          </div>
        </div>

        <div className="px-4 py-6 space-y-4">
          {/* summary card */}
          <div className="rounded-2xl p-4" style={{ background: `${cfg.color}10`, border: `1.5px solid ${cfg.color}40` }}>
            <div className="flex items-center gap-3">
              <span style={{ fontSize: '28px' }}>{PLAN_ICONS[cfg.id]}</span>
              <div className="flex-1">
                <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '15px', color: cfg.color }}>
                  {cfg.label.toUpperCase()} MEMBERSHIP
                </p>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', color: 'var(--faint)', letterSpacing: '0.08em' }}>
                  {cfg.washesPerMonth} WASHES · 30 DAYS
                </p>
              </div>
              <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '20px', color: 'var(--chrome)' }}>
                {formatCurrency(cfg.price)}
              </p>
            </div>
          </div>

          {/* payment method */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border-2)' }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', color: 'var(--faint)', letterSpacing: '0.1em', marginBottom: '12px' }}>
              PAYMENT METHOD
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(['upi', 'cash'] as const).map(m => (
                <button key={m} onClick={() => setPayMethod(m)}
                  className="rounded-xl py-3 flex flex-col items-center gap-1.5"
                  style={{
                    background: payMethod === m ? 'rgba(255,69,0,0.12)' : 'var(--cavern)',
                    border: `1.5px solid ${payMethod === m ? 'var(--ember)' : 'transparent'}`,
                  }}>
                  <span style={{ fontSize: '20px' }}>{m === 'upi' ? '📲' : '💵'}</span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.1em', color: payMethod === m ? 'var(--ember)' : 'var(--steel)' }}>
                    {m === 'upi' ? 'UPI' : 'CASH AT SHOP'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* UPI flow */}
          {payMethod === 'upi' && (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--card)', border: '1px solid var(--border-2)' }}>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', color: 'var(--faint)', letterSpacing: '0.1em' }}>
                UPI INSTRUCTIONS
              </p>
              <div className="rounded-xl p-3 flex items-center justify-between"
                style={{ background: 'var(--cavern)', border: '1px dashed rgba(255,69,0,0.3)' }}>
                <div>
                  <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '11px', color: 'var(--faint)', letterSpacing: '0.08em' }}>UPI ID</p>
                  <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '15px', color: 'var(--ember)' }}>{upiId}</p>
                </div>
                <button onClick={copyUpi} className="flex items-center gap-1.5 px-3 py-2 rounded-lg"
                  style={{ background: copiedUpi ? 'rgba(34,197,94,0.15)' : 'rgba(255,69,0,0.12)', border: '1px solid', borderColor: copiedUpi ? 'rgba(34,197,94,0.3)' : 'rgba(255,69,0,0.3)' }}>
                  <Copy size={13} style={{ color: copiedUpi ? '#22C55E' : 'var(--ember)' }} />
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', color: copiedUpi ? '#22C55E' : 'var(--ember)', letterSpacing: '0.08em' }}>
                    {copiedUpi ? 'COPIED' : 'COPY'}
                  </span>
                </button>
              </div>
              <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '12px', color: 'var(--steel)', lineHeight: 1.5 }}>
                Pay {formatCurrency(cfg.price)} to the UPI ID above, then enter the transaction ID below.
              </p>
              <input
                value={txnId}
                onChange={e => setTxnId(e.target.value)}
                placeholder="Enter UPI Transaction ID"
                style={{
                  width: '100%', background: 'var(--cavern)', border: '1px solid var(--border-2)',
                  borderRadius: '12px', padding: '12px 14px', color: 'var(--chrome)',
                  fontFamily: "'Space Mono', monospace", fontSize: '13px', outline: 'none',
                }}
              />
            </div>
          )}

          {/* cash note */}
          {payMethod === 'cash' && (
            <div className="rounded-xl p-3 flex items-start gap-2"
              style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)' }}>
              <AlertTriangle size={14} style={{ color: '#EAB308', marginTop: '1px', flexShrink: 0 }} />
              <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '12px', color: '#EAB308', lineHeight: 1.5 }}>
                Pay {formatCurrency(cfg.price)} at the shop. Your membership activates after admin confirmation.
              </p>
            </div>
          )}

          <button
            onClick={handleJoin}
            disabled={submitting || (payMethod === 'upi' && !txnId.trim())}
            className="btn-ember w-full rounded-2xl py-4 flex items-center justify-center gap-2"
            style={{ fontSize: '13px', letterSpacing: '0.12em', opacity: submitting ? 0.6 : 1 }}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
            {submitting ? 'ACTIVATING...' : 'ACTIVATE MEMBERSHIP'}
          </button>
        </div>
      </div>
    );
  }

  // ── plans selection screen ─────────────────────────────────────────────────
  if (view === 'plans') return (
    <div className="min-h-screen" style={{ background: 'var(--void)' }}>
      <div className="sticky top-0 z-20 px-4 py-4"
        style={{ background: 'rgba(5,5,7,0.92)', backdropFilter: 'blur(24px)', borderBottom: '1px solid var(--border-2)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setView('dashboard')}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'var(--card)', border: '1px solid var(--border-2)' }}>
            <ChevronLeft size={16} style={{ color: 'var(--chrome)' }} />
          </button>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '18px', color: 'var(--chrome)', letterSpacing: '0.04em' }}>
            CHOOSE PLAN
          </h1>
        </div>
      </div>

      <div className="px-4 py-6 space-y-3 pb-32">
        {MEMBERSHIP_PLANS.map(p => (
          <PlanCard key={p.id} plan={p} selected={selectedPlan === p.id} onSelect={() => setSelectedPlan(p.id)} />
        ))}
      </div>

      <div className="fixed bottom-0 inset-x-0 px-4 py-4 pb-8"
        style={{ background: 'rgba(5,5,7,0.96)', backdropFilter: 'blur(24px)', borderTop: '1px solid var(--border-2)' }}>
        <button
          onClick={() => selectedPlan && setView('payment')}
          disabled={!selectedPlan}
          className="btn-ember w-full rounded-2xl py-4 flex items-center justify-center gap-2"
          style={{ fontSize: '13px', letterSpacing: '0.12em', opacity: selectedPlan ? 1 : 0.4 }}>
          CONTINUE TO PAYMENT
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );

  // ── dashboard: no subscription ─────────────────────────────────────────────
  if (!sub || isExpired) return (
    <div className="min-h-screen" style={{ background: 'var(--void)' }}>
      {/* header */}
      <div className="sticky top-0 z-20 px-4 py-4"
        style={{ background: 'rgba(5,5,7,0.92)', backdropFilter: 'blur(24px)', borderBottom: '1px solid var(--border-2)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'var(--card)', border: '1px solid var(--border-2)' }}>
            <ChevronLeft size={16} style={{ color: 'var(--chrome)' }} />
          </button>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '18px', color: 'var(--chrome)', letterSpacing: '0.04em' }}>
            MEMBERSHIPS
          </h1>
        </div>
      </div>

      <div className="px-4 py-8">
        {isExpired && sub && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4 mb-6 flex items-start gap-3"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertTriangle size={16} style={{ color: '#EF4444', marginTop: '2px', flexShrink: 0 }} />
            <div>
              <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '14px', color: '#EF4444' }}>
                {plan?.label} Membership Expired
              </p>
              <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '12px', color: 'var(--steel)', marginTop: '2px' }}>
                Expired on {formatDate(sub.endDate)}. Renew to continue enjoying member benefits.
              </p>
            </div>
          </motion.div>
        )}

        {/* hero */}
        <div className="text-center py-8">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(255,69,0,0.1)', border: '1px solid rgba(255,69,0,0.2)' }}>
            <Shield size={36} style={{ color: 'var(--ember)' }} />
          </div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '26px', color: 'var(--chrome)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
            AutoModz Membership
          </h2>
          <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '14px', color: 'var(--steel)', lineHeight: 1.6 }}>
            Monthly wash plans + exclusive discounts.{'\n'}Your car, always show-ready.
          </p>
        </div>

        {/* plan highlights */}
        <div className="space-y-3 mb-8">
          {MEMBERSHIP_PLANS.map(p => (
            <div key={p.id} className="rounded-2xl p-4 flex items-center justify-between"
              style={{ background: 'var(--card)', border: '1px solid var(--border-2)' }}>
              <div className="flex items-center gap-3">
                <span style={{ fontSize: '22px' }}>{PLAN_ICONS[p.id]}</span>
                <div>
                  <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '14px', color: p.color }}>
                    {p.label}
                  </p>
                  <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', color: 'var(--faint)', letterSpacing: '0.08em' }}>
                    {p.washesPerMonth} washes
                  </p>
                </div>
              </div>
              <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '16px', color: 'var(--chrome)' }}>
                {formatCurrency(p.price)}<span style={{ fontFamily: "'Space Mono', monospace", fontSize: '9px', color: 'var(--faint)' }}>/mo</span>
              </p>
            </div>
          ))}
        </div>

        <button
          onClick={() => setView('plans')}
          className="btn-ember w-full rounded-2xl py-4 flex items-center justify-center gap-2"
          style={{ fontSize: '13px', letterSpacing: '0.12em' }}>
          <Zap size={16} />
          {isExpired ? 'RENEW MEMBERSHIP' : 'JOIN NOW'}
        </button>
      </div>
    </div>
  );

  // ── dashboard: active subscription ────────────────────────────────────────
  const washesRemaining = sub.washesTotal - sub.washesUsed;

  return (
    <div className="min-h-screen pb-10" style={{ background: 'var(--void)' }}>
      {/* header */}
      <div className="sticky top-0 z-20 px-4 py-4"
        style={{ background: 'rgba(5,5,7,0.92)', backdropFilter: 'blur(24px)', borderBottom: '1px solid var(--border-2)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'var(--card)', border: '1px solid var(--border-2)' }}>
            <ChevronLeft size={16} style={{ color: 'var(--chrome)' }} />
          </button>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '18px', color: 'var(--chrome)', letterSpacing: '0.04em' }}>
            MY MEMBERSHIP
          </h1>
        </div>
      </div>

      <div className="px-4 py-6 space-y-4">
        {/* membership hero card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-5 relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${plan?.color}18 0%, var(--card) 100%)`, border: `1.5px solid ${plan?.color}40` }}>
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, ${plan?.color}25, transparent)`, filter: 'blur(20px)' }} />

          <div className="relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span style={{ fontSize: '32px' }}>{PLAN_ICONS[sub.plan]}</span>
                <div>
                  <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '20px', color: plan?.color, letterSpacing: '0.04em' }}>
                    {sub.plan.toUpperCase()}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full animate-breathe" style={{ background: '#22C55E' }} />
                    <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', color: '#22C55E', letterSpacing: '0.1em' }}>
                      ACTIVE
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '22px', color: 'var(--chrome)' }}>
                  {days}
                </p>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '9px', color: 'var(--faint)', letterSpacing: '0.1em' }}>
                  DAYS LEFT
                </p>
              </div>
            </div>

            <WashBar used={sub.washesUsed} total={sub.washesTotal} color={plan?.color ?? 'var(--ember)'} />

            <div className="flex gap-2 mt-4">
              <div className="flex-1 rounded-xl p-2.5 text-center" style={{ background: 'var(--cavern)' }}>
                <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '15px', color: 'var(--chrome)' }}>
                  {washesRemaining}
                </p>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '9px', color: 'var(--faint)', letterSpacing: '0.08em' }}>
                  REMAINING
                </p>
              </div>
              <div className="flex-1 rounded-xl p-2.5 text-center" style={{ background: 'var(--cavern)' }}>
                <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '15px', color: 'var(--chrome)' }}>
                  {sub.washesTotal}
                </p>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '9px', color: 'var(--faint)', letterSpacing: '0.08em' }}>
                  TOTAL
                </p>
              </div>
              <div className="flex-1 rounded-xl p-2.5 text-center" style={{ background: 'var(--cavern)' }}>
                <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '15px', color: 'var(--chrome)' }}>
                  {sub.washesUsed}
                </p>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '9px', color: 'var(--faint)', letterSpacing: '0.08em' }}>
                  USED
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* validity dates */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="rounded-2xl p-4 grid grid-cols-2 gap-3"
          style={{ background: 'var(--card)', border: '1px solid var(--border-2)' }}>
          {[
            { label: 'START DATE', value: formatDate(sub.startDate), icon: '📅' },
            { label: 'END DATE',   value: formatDate(sub.endDate),   icon: '⏳' },
          ].map(item => (
            <div key={item.label}>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '9px', color: 'var(--faint)', letterSpacing: '0.1em', marginBottom: '4px' }}>
                {item.label}
              </p>
              <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '13px', color: 'var(--chrome)' }}>
                {item.icon} {item.value}
              </p>
            </div>
          ))}
        </motion.div>

        {/* plan perks */}
        {plan && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border-2)' }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', color: 'var(--faint)', letterSpacing: '0.1em', marginBottom: '12px' }}>
              YOUR BENEFITS
            </p>
            <div className="space-y-2.5">
              {plan.perks.map((perk, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: `${plan.color}22` }}>
                    <Check size={10} style={{ color: plan.color }} />
                  </div>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '13px', color: 'var(--steel)' }}>
                    {perk}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* low washes warning */}
        {washesRemaining <= 1 && washesRemaining >= 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-xl p-3 flex items-start gap-2"
            style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)' }}>
            <AlertTriangle size={14} style={{ color: '#EAB308', marginTop: '2px', flexShrink: 0 }} />
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '12px', color: '#EAB308', lineHeight: 1.5 }}>
              {washesRemaining === 0
                ? 'All membership washes used. Book extra washes at regular pricing.'
                : 'Only 1 wash remaining this month.'}
            </p>
          </motion.div>
        )}

        {/* expiry warning */}
        {days <= 5 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-xl p-3 flex items-start gap-2"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <Clock size={14} style={{ color: '#EF4444', marginTop: '2px', flexShrink: 0 }} />
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '12px', color: '#EF4444', lineHeight: 1.5 }}>
              Membership expires in {days} day{days !== 1 ? 's' : ''}. Renew to keep your benefits.
            </p>
          </motion.div>
        )}

        {/* CTA */}
        <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push('/dashboard/booking?cat=Washing')}
          className="btn-ember w-full rounded-2xl py-4 flex items-center justify-center gap-2"
          style={{ fontSize: '13px', letterSpacing: '0.12em' }}>
          <Droplets size={16} />
          BOOK A WASH
        </motion.button>
      </div>
    </div>
  );
}
