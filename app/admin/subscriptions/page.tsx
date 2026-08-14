'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CreditCard, Phone, Droplets, CalendarRange } from 'lucide-react';
import { getAllSubscriptions } from '@/lib/firebaseService';
import { authedFetch } from '@/lib/clientSession';
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
    /* Expiry is the nightly job's (`/api/cron/daily`), not this screen's. It
       used to run here on load, which meant whether a customer's membership
       had expired depended on somebody in the studio opening a page. */
    getAllSubscriptions()
      .then(s => setSubs(s))
      .catch(e => console.error('subscriptions load failed', e))
      .finally(() => setLoading(false));
  }, []);

  /**
   * ACTIVATING IS A SERVER WRITE, and this screen may not make it.
   *
   * `active` grants free washes and a standing discount. It also has to close
   * any other membership the customer holds in the same commit - which a
   * client write cannot do, and which is how a customer ends up with two wash
   * allowances. `firestore.rules` refuses every write here, including from an
   * admin console, so this asks `/api/membership` like everything else.
   */
  const decide = async (id: string, decision: 'activate' | 'reject') => {
    try {
      const res = await authedFetch('/api/membership', {
        method: 'PUT',
        body: JSON.stringify({ subscriptionId: id, decision }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: '' })) as { error?: string };
        toast.error(body.error || 'Could not save that');
        return;
      }
      const { status } = await res.json() as { status: Subscription['status'] };
      toast.success(status === 'active' ? 'Activated' : 'Refused');
      getAllSubscriptions().then(setSubs).catch(() => {});
    } catch { toast.error('Could not reach the server'); }
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
                {/* THE TWO ACTS THE LIFECYCLE ACTUALLY HAS.
                    "Mark Expired" and "Cancel" on an active membership were
                    offered here and are gone: expiry belongs to the clock
                    (the nightly job persists it the day a cycle ends) and
                    leaving belongs to the customer. A studio control that
                    ends somebody's paid month by hand is not a lifecycle, it
                    is an override - and `membershipTransition` refuses it. */}
                {s.status === 'pending' && (
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => decide(s.id, 'activate')}
                      className="btn-ember flex-1 py-2.5 text-xs">Payment seen · activate</button>
                    <button onClick={() => decide(s.id, 'reject')}
                      className="btn-ghost flex-1 py-2.5 text-xs" style={{ color: 'var(--danger)' }}>Refuse</button>
                  </div>
                )}
                {s.transactionId && (
                  <p className="font-body text-xs mt-3" style={{ color: 'var(--steel)' }}>
                    Customer&rsquo;s reference · {s.transactionId}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
