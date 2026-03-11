'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Users, Car, Calendar } from 'lucide-react';
import { getDocs, collection, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User } from '@/lib/types';

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setCustomers(snap.docs.map(d => d.data() as User).filter(u => u.role !== 'admin'));
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
    <div>
      <div className="mb-6">
        <h1 className="font-display font-900 text-2xl text-foreground tracking-wide">CUSTOMERS</h1>
        <p className="text-muted text-sm font-body">{customers.length} registered users</p>
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
      ) : (
        <div className="space-y-3">
          {filtered.map((c, i) => (
            <motion.div key={c.uid} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }} className="card-dark">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                  <span className="font-display font-900 text-lg text-orange-500">{c.name?.charAt(0) || 'U'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-body text-sm text-foreground font-600">{c.name}</div>
                  <div className="text-muted text-xs font-body">{c.email}</div>
                  <div className="text-muted/60 text-xs font-body">{c.phone}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs text-orange-500/70 tracking-widest">{c.referralCode}</div>
                  <div className="text-muted/40 text-xs font-body mt-1">
                    {c.createdAt?.toDate?.().toLocaleDateString('en-IN') || 'N/A'}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
