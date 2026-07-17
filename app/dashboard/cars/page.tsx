'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Car, Heart } from 'lucide-react';
import toast from 'react-hot-toast';
import { getActiveCarListings, getSavedCarIds, saveCar, unsaveCar } from '@/lib/firebaseService';
import CarCard from '@/components/cars/CarCard';
import { useAppStore } from '@/lib/store';
import type { CarListing } from '@/lib/types';

export default function DashboardCarsPage() {
  const { user } = useAppStore();
  const [listings, setListings] = useState<CarListing[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'all' | 'saved'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getActiveCarListings(),
      user ? getSavedCarIds(user.uid) : Promise.resolve([]),
    ]).then(([l, ids]) => {
      setListings(l); setSavedIds(new Set(ids)); setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  const toggleSave = async (car: CarListing) => {
    if (!user) { toast.error('Sign in to save cars'); return; }
    const next = new Set(savedIds);
    if (next.has(car.id)) {
      next.delete(car.id); setSavedIds(next);
      await unsaveCar(user.uid, car.id);
    } else {
      next.add(car.id); setSavedIds(next);
      await saveCar(user.uid, car.id);
      toast.success('Saved');
    }
  };

  const shown = tab === 'saved' ? listings.filter(l => savedIds.has(l.id)) : listings;

  return (
    <div className="px-5 pt-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display font-800 text-2xl" style={{ color: 'var(--chrome)' }}>CARS</h1>
          <p className="text-sm font-body" style={{ color: 'var(--steel)' }}>Hand-picked cars, detailed by us</p>
        </div>
        <Link href="/dashboard/sell-car" className="btn-ghost px-4 py-2.5 text-xs">Sell My Car</Link>
      </div>

      <div className="flex gap-2 mb-5">
        {(['all', 'saved'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2.5 rounded-xl data-label flex items-center gap-1.5"
            style={{
              background: tab === t ? 'var(--accent-mist)' : 'var(--dark)',
              border: tab === t ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
              color: tab === t ? 'var(--ember)' : 'var(--steel)',
            }}>
            {t === 'saved' && <Heart size={11} />}
            {t === 'all' ? `All (${listings.length})` : `Saved (${savedIds.size})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="aspect-[4/3] shimmer rounded-2xl" />)}
        </div>
      ) : shown.length === 0 ? (
        <div className="card text-center py-16">
          <Car size={28} className="mx-auto mb-3" style={{ color: 'var(--steel)' }} />
          <p className="font-body text-sm inline-flex items-center justify-center flex-wrap gap-1" style={{ color: 'var(--steel)' }}>
            {tab === 'saved'
              ? <>No saved cars yet - tap the <Heart size={13} className="inline" /> on a car you like.</>
              : 'New stock arriving soon.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {shown.map(c => (
            <CarCard key={c.id} car={c} hrefBase="/cars"
              saved={savedIds.has(c.id)} onToggleSave={toggleSave} />
          ))}
        </div>
      )}
    </div>
  );
}
