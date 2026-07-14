'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, Users, Car, Calendar } from 'lucide-react';
import { getDocs, collection, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User } from '@/lib/types';
import { listWalkinCustomers, type WalkinCustomer } from '@/lib/firebaseService';
import { formatCurrency } from '@/lib/utils';

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [walkins, setWalkins] = useState<WalkinCustomer[]>([]);
  const [tab, setTab] = useState<'registered' | 'walkin'>('registered');

  useEffect(() => {
    const load = async () => {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setCustomers(snap.docs.map(d => d.data() as User).filter(u => u.role !== 'admin'));
      listWalkinCustomers().then(setWalkins).catch(() => {});
      setLoading(false);
    };
    load();
  }, []);

  const filtered = customers.filter(c =>
    !search ||
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display font-900 text-2xl text-foreground tracking-wide">CUSTOMERS</h1>
        <p className="text-muted text-sm font-body">
          {customers.length} registered · {walkins.length} walk-in only
        </p>
      </div>

      <div className="flex gap-2 mb-4">
        {([['registered', `Registered (${customers.length})`], ['walkin', `Walk-ins (${walkins.length})`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className="px-4 py-2 rounded-xl data-label transition-all"
            style={{
              background: tab === k ? 'var(--accent-mist)' : 'var(--dark)',
              border: tab === k ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
              color: tab === k ? 'var(--ember)' : 'var(--steel)',
            }}>{l}</button>
        ))}
      </div>

      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, phone..."
          className="input-dark pl-9 text-sm" />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-16 shimmer rounded-2xl" />)}
        </div>
      ) : tab === 'walkin' ? (
        <div className="space-y-3">
          {walkins
            .filter(w => !search || w.name.toLowerCase().includes(search.toLowerCase()) || w.phone.includes(search))
            .map(w => (
              <div key={w.id} className="card-dark flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <span className="font-display font-900 text-lg" style={{ color: 'var(--chrome)' }}>{w.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-body text-sm font-600" style={{ color: 'var(--chrome)' }}>{w.name}</div>
                  <div className="text-xs font-body" style={{ color: 'var(--steel)' }}>
                    {w.phone} · {w.vehicleNames.join(', ')}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono font-700 text-sm" style={{ color: 'var(--ember)' }}>{formatCurrency(w.totalSpent)}</div>
                  <div className="text-xs font-body" style={{ color: 'var(--faint)' }}>
                    {w.visits} visit{w.visits === 1 ? '' : 's'} · last {w.lastVisit}
                  </div>
                </div>
              </div>
            ))}
          {walkins.length === 0 && (
            <div className="card text-center py-14">
              <p className="font-body" style={{ color: 'var(--steel)' }}>No walk-in records yet - they build automatically at intake.</p>
            </div>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
            style={{ background: 'var(--accent-mist)', border: '1px solid var(--border-2)' }}>
            <Users size={22} style={{ color: 'var(--pewter)' }} />
          </div>
          <p className="font-display font-700 text-[15px]" style={{ color: 'var(--chrome)' }}>
            {search ? 'No matches' : 'No customers yet'}
          </p>
          <p className="font-body text-[13px] mt-1" style={{ color: 'var(--muted)' }}>
            {search ? `Nothing found for “${search}”.` : 'Customers appear here after their first sign-in.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c, i) => (
            <motion.div key={c.uid} initial={false} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }} className="card-dark">
              <Link href={`/admin/customers/${c.uid}`} className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <span className="font-display font-900 text-lg text-white">{c.name?.charAt(0) || 'U'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-body text-sm text-foreground font-600">{c.name}</div>
                  <div className="text-muted text-xs font-body">{c.email}</div>
                  <div className="text-xs font-body" style={{ color: 'var(--faint)' }}>{c.phone}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-body mt-1" style={{ color: 'var(--faint)' }}>
                    {c.createdAt?.toDate?.().toLocaleDateString('en-IN') || 'N/A'}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
