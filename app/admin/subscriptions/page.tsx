'use client';
import { useEffect, useState } from 'react';
import { CreditCard, Phone, Droplets, CalendarRange } from 'lucide-react';
import { getAllSubscriptions, updateSubscriptionStatus, expireLapsedSubscriptions } from '@/lib/firebaseService';
import type { Subscription } from '@/lib/types';

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  active:    { color: 'var(--success)', bg: 'color-mix(in srgb, var(--success) 12%, transparent)' },
  pending:   { color: 'var(--warning)', bg: 'color-mix(in srgb, var(--warning) 12%, transparent)' },
  expired:   { color: 'var(--faint)',   bg: 'var(--ash)' },
  cancelled: { color: 'var(--danger)',  bg: 'color-mix(in srgb, var(--danger) 12%, transparent)' },
};

const FILTERS = ['all', 'active', 'pending', 'expired', 'cancelled'] as const;

export default function AdminSubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');

  useEffect(() => {
    // Persist expiry for lapsed memberships first (only admin may write it), then load
    expireLapsedSubscriptions()
      .catch(() => {})
      .then(() => getAllSubscriptions())
      .then(s => setSubs(s))
      .catch(e => console.error('subscriptions load failed', e))
      .finally(() => setLoading(false));
  }, []);

  const changeStatus = async (id: string, status: Subscription['status']) => {
    try {
      await updateSubscriptionStatus(id, status);
      setSubs(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    } catch {}
  };

  const shown = filter === 'all' ? subs : subs.filter(s => s.status === filter);

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <h1 className="font-display font-800 text-2xl mb-1" style={{ color: 'var(--chrome)' }}>Memberships</h1>
      <p className="font-body text-sm mb-5" style={{ color: 'var(--muted)' }}>
        {subs.filter(s => s.status === 'active').length} active · {subs.length} total
      </p>

      {/* Status filter chips */}
      <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="shrink-0 px-4 py-2 rounded-xl font-display text-[11px] uppercase tracking-wide transition-all"
            style={{
              background: filter === f ? 'var(--accent)' : 'var(--dark)',
              color: filter === f ? 'var(--on-accent)' : 'var(--steel)',
              border: '1px solid ' + (filter === f ? 'var(--accent)' : 'var(--border-2)'),
            }}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-10 h-10 loader-ring" /></div>
      ) : shown.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
            style={{ background: 'var(--accent-mist)', border: '1px solid var(--border-2)' }}>
            <CreditCard size={22} style={{ color: 'var(--pewter)' }} />
          </div>
          <p className="font-display font-700 text-[15px]" style={{ color: 'var(--chrome)' }}>No memberships</p>
          <p className="font-body text-[13px] mt-1" style={{ color: 'var(--muted)' }}>
            {filter === 'all' ? 'Memberships purchased by customers will appear here.' : `No ${filter} memberships.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(s => {
            const st = STATUS_STYLE[s.status] ?? STATUS_STYLE.expired;
            return (
              <div key={s.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-body font-600 text-[15px] truncate" style={{ color: 'var(--chrome)' }}>{s.userName}</p>
                    <p className="font-display font-700 text-[12px] uppercase tracking-wide mt-0.5" style={{ color: 'var(--pewter)' }}>
                      {s.plan} plan · {s.paymentMethod.toUpperCase()}
                    </p>
                  </div>
                  <span className="status-badge shrink-0" style={{ color: st.color, background: st.bg }}>{s.status}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 font-body text-[12px]" style={{ color: 'var(--muted)' }}>
                  <span className="flex items-center gap-1.5"><CalendarRange size={12} />{s.startDate} → {s.endDate}</span>
                  <span className="flex items-center gap-1.5"><Droplets size={12} />{s.washesUsed}/{s.washesTotal} washes</span>
                  {s.userPhone && (
                    <a href={`tel:+91${s.userPhone}`} className="flex items-center gap-1.5" style={{ color: 'var(--silver)' }}>
                      <Phone size={12} />{s.userPhone}
                    </a>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  {s.status !== 'active' && (
                    <button onClick={() => changeStatus(s.id, 'active')}
                      className="btn-ember flex-1 py-2.5 text-xs">Activate</button>
                  )}
                  {s.status === 'active' && (
                    <button onClick={() => changeStatus(s.id, 'expired')}
                      className="btn-ghost flex-1 py-2.5 text-xs">Mark Expired</button>
                  )}
                  {(s.status === 'active' || s.status === 'expired') && (
                    <button onClick={() => changeStatus(s.id, 'cancelled')}
                      className="btn-ghost flex-1 py-2.5 text-xs" style={{ color: 'var(--danger)' }}>Cancel</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
