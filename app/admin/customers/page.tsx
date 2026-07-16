'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users, ChevronRight } from 'lucide-react';
import { getDocs, collection, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User } from '@/lib/types';
import { listWalkinCustomers, type WalkinCustomer } from '@/lib/firebaseService';
import { formatCurrency } from '@/lib/utils';

export default function AdminCustomersPage() {
  const router = useRouter();
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
  const filteredWalkins = walkins.filter(w =>
    !search || w.name.toLowerCase().includes(search.toLowerCase()) || w.phone.includes(search));

  const Monogram = ({ name }: { name?: string }) => (
    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
      style={{ background: 'var(--smoke)' }}>
      <span className="font-display font-700 text-xs" style={{ color: 'var(--chrome)' }}>
        {name?.charAt(0)?.toUpperCase() || 'U'}
      </span>
    </span>
  );

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="mb-5">
        <h1 className="font-display font-800 text-2xl" style={{ color: 'var(--chrome)' }}>Customers</h1>
        <p className="text-sm font-body" style={{ color: 'var(--steel)' }}>
          {customers.length} registered · {walkins.length} walk-in only
        </p>
      </div>

      <div className="flex items-center gap-3 mb-4">
        {/* Segmented control */}
        <div className="flex items-center p-0.5 rounded-xl shrink-0" style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
          {([['registered', `Registered · ${customers.length}`], ['walkin', `Walk-ins · ${walkins.length}`]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className="px-3.5 py-1.5 rounded-[10px] text-xs font-body font-500 transition-colors cursor-pointer"
              style={tab === k
                ? { background: 'var(--dark)', color: 'var(--chrome)', border: '1px solid var(--border-2)' }
                : { color: 'var(--pewter)', border: '1px solid transparent' }}>
              {l}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--steel)' }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, phone…" className="input-dark pl-9 text-sm" />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-12 shimmer rounded-xl" />)}</div>
      ) : tab === 'walkin' ? (
        filteredWalkins.length === 0 ? (
          <div className="card text-center py-14">
            <p className="font-body text-sm" style={{ color: 'var(--steel)' }}>
              {search ? `Nothing found for “${search}”.` : 'No walk-in records yet — they build automatically at intake.'}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--fog)' }}>
            {filteredWalkins.map((w, i) => (
              <div key={w.id} className="flex items-center gap-3 px-4 py-2.5"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                <Monogram name={w.name} />
                <div className="flex-1 min-w-0">
                  <p className="font-body font-600 truncate" style={{ fontSize: 13.5, color: 'var(--chrome)' }}>
                    {w.name}
                    <span className="font-400" style={{ color: 'var(--steel)' }}> · {w.phone}</span>
                  </p>
                  <p className="text-xs font-body truncate mt-0.5" style={{ color: 'var(--steel)' }}>{w.vehicleNames.join(', ')}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono font-700 text-sm" style={{ color: 'var(--chrome)' }}>{formatCurrency(w.totalSpent)}</p>
                  <p className="text-[10px] font-body" style={{ color: 'var(--faint)' }}>
                    {w.visits} visit{w.visits === 1 ? '' : 's'} · last {w.lastVisit}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Users size={22} className="mb-3" style={{ color: 'var(--steel)' }} />
          <p className="font-display font-700 text-[15px]" style={{ color: 'var(--chrome)' }}>
            {search ? 'No matches' : 'No customers yet'}
          </p>
          <p className="font-body text-[13px] mt-1" style={{ color: 'var(--muted)' }}>
            {search ? `Nothing found for “${search}”.` : 'Customers appear here after their first sign-in.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--fog)' }}>
          {filtered.map((c, i) => (
            <button key={c.uid} onClick={() => router.push(`/admin/customers/${c.uid}`)}
              className="group w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[.03] cursor-pointer"
              style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
              <Monogram name={c.name} />
              <div className="flex-1 min-w-0">
                <p className="font-body font-600 truncate" style={{ fontSize: 13.5, color: 'var(--chrome)' }}>
                  {c.name}
                  {c.phone && <span className="font-400" style={{ color: 'var(--steel)' }}> · {c.phone}</span>}
                </p>
                <p className="text-xs font-body truncate mt-0.5" style={{ color: 'var(--steel)' }}>{c.email}</p>
              </div>
              <span className="text-[11px] font-mono shrink-0" style={{ color: 'var(--faint)' }}>
                {c.createdAt?.toDate?.().toLocaleDateString('en-IN') || ''}
              </span>
              <ChevronRight size={15} className="shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--steel)' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
