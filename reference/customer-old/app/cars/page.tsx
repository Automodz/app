'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Zap, Car, ArrowLeft, Search } from 'lucide-react';
import { getActiveCarListings } from '@/lib/firebaseService';
import CarCard from '@/components/cars/CarCard';
import ErrorState from '@/components/ui/ErrorState';
import Wordmark from '@/components/ui/Wordmark';
import type { CarListing } from '@/lib/types';

const BUDGETS = [
  { label: 'Any budget', min: 0, max: Infinity },
  { label: 'Under ₹5L', min: 0, max: 500000 },
  { label: '₹5–10L', min: 500000, max: 1000000 },
  { label: '₹10–20L', min: 1000000, max: 2000000 },
  { label: '₹20L+', min: 2000000, max: Infinity },
];

export default function PublicCarsPage() {
  const [listings, setListings] = useState<CarListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [fuel, setFuel] = useState('all');
  const [budget, setBudget] = useState(0);

  const load = () => {
    setLoadError(false);
    setLoading(true);
    getActiveCarListings()
      .then(l => setListings(l))
      .catch(e => { console.error('cars load failed', e); setLoadError(true); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    const b = BUDGETS[budget];
    return listings.filter(c =>
      (fuel === 'all' || c.fuel === fuel) &&
      c.price >= b.min && c.price <= b.max &&
      (!search || `${c.make} ${c.model} ${c.title}`.toLowerCase().includes(search.toLowerCase()))
    );
  }, [listings, search, fuel, budget]);

  return (
    <div className="min-h-screen bg-mesh" style={{ overflowX: 'clip' }}>
      <header className="sticky top-0 z-30 px-5 py-4 glass-nav flex items-center gap-3"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <Link href="/" className="w-9 h-9 flex items-center justify-center rounded-xl"
          style={{ background: 'var(--dark)', color: 'var(--steel)' }}>
          <ArrowLeft size={15} />
        </Link>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--accent-grad)' }}>
          <Zap size={15} style={{ color: 'var(--on-accent)' }} />
        </div>
        <div>
          <Wordmark height={16} />
          <p className="data-label" style={{ color: 'var(--ember)' }}>Cars for Sale</p>
        </div>
      </header>

      <div className="px-5 py-6 max-w-4xl mx-auto">
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--steel)' }} />
          <input className="input pl-9 text-sm" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search make or model…" />
        </div>
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {['all', 'petrol', 'diesel', 'cng', 'electric'].map(f => (
            <button key={f} onClick={() => setFuel(f)}
              className="px-3.5 py-2 rounded-xl data-label whitespace-nowrap"
              style={{
                background: fuel === f ? 'var(--accent-mist)' : 'var(--dark)',
                border: fuel === f ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
                color: fuel === f ? 'var(--ember)' : 'var(--steel)',
              }}>{f === 'all' ? 'All fuel' : f}</button>
          ))}
        </div>
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {BUDGETS.map((b, i) => (
            <button key={b.label} onClick={() => setBudget(i)}
              className="px-3.5 py-2 rounded-xl data-label whitespace-nowrap"
              style={{
                background: budget === i ? 'var(--accent-mist)' : 'var(--dark)',
                border: budget === i ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
                color: budget === i ? 'var(--ember)' : 'var(--steel)',
              }}>{b.label}</button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="aspect-[4/3] shimmer rounded-2xl" />)}
          </div>
        ) : loadError ? (
          <ErrorState onRetry={load} />
        ) : filtered.length === 0 ? (
          <div className="card text-center py-16">
            <Car size={28} className="mx-auto mb-3" style={{ color: 'var(--steel)' }} />
            <p className="font-body" style={{ color: 'var(--steel)' }}>
              {listings.length === 0 ? 'New stock arriving soon - check back!' : 'No cars match those filters.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(c => <CarCard key={c.id} car={c} />)}
          </div>
        )}

        <div className="card-ember rounded-2xl p-5 mt-8 text-center">
          <p className="font-display font-700 text-base mb-1" style={{ color: 'var(--chrome)' }}>
            Want to sell your car?
          </p>
          <p className="text-sm font-body mb-4" style={{ color: 'var(--steel)' }}>
            Get a fair valuation from the AutoModz team - sign in and send us your car&apos;s details.
          </p>
          <Link href="/dashboard/sell-car" className="btn-ember inline-block px-6 py-3 text-sm">
            Sell My Car
          </Link>
        </div>
      </div>
    </div>
  );
}
