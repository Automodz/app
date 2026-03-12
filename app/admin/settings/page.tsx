'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Save, Loader2, RefreshCw, Package, Database } from 'lucide-react';
import toast from 'react-hot-toast';
import { getServices, seedServices } from '@/lib/firebaseService';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatCurrency, getCategoryIcon } from '@/lib/utils';
import type { Service } from '@/lib/types';

export default function AdminSettingsPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({});

  useEffect(() => {
    getServices().then(s => {
      const sorted = s.sort((a, b) => a.category.localeCompare(b.category) || a.order - b.order);
      setServices(sorted);
      const p: Record<string, string> = {};
      sorted.forEach(sv => { p[sv.id] = sv.price.toString(); });
      setPrices(p);
      setLoading(false);
    });
  }, []);

  const handleSeed = async () => {
    if (!confirm('Add all default services to Firestore?')) return;
    setSeeding(true);
    try {
      await seedServices();
      toast.success('Services seeded! Refresh the page.');
    } catch { toast.error('Seeding failed'); }
    finally { setSeeding(false); }
  };

  const handleSave = async (svc: Service) => {
    const p = parseInt(prices[svc.id]);
    if (isNaN(p) || p < 0) return toast.error('Invalid price');
    setSaving(svc.id);
    try {
      await updateDoc(doc(db, 'services', svc.id), { price: p });
      setServices(services.map(s => s.id === svc.id ? { ...s, price: p } : s));
      toast.success('Price updated!');
    } catch { toast.error('Failed to update'); }
    finally { setSaving(null); }
  };

  const cats = [...new Set(services.map(s => s.category))];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display font-900 text-2xl text-foreground tracking-wide">SETTINGS</h1>
        <p className="text-muted text-sm font-body">Manage services and pricing</p>
      </div>

      {/* DB Init */}
      <div className="card-dark mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Database size={20} className="text-orange-500" />
          <div>
            <div className="font-display font-800 text-sm text-foreground tracking-wide">Initialize Services</div>
            <div className="text-muted text-xs font-body">Seed all default services into Firestore</div>
          </div>
        </div>
        <button onClick={handleSeed} disabled={seeding}
          className="btn-primary text-xs py-2 px-4 font-display font-800 tracking-widest flex items-center gap-2">
          {seeding ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {seeding ? 'SEEDING...' : 'SEED SERVICES'}
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-14 shimmer rounded-xl" />)}</div>
      ) : (
        <div className="space-y-6">
          {cats.map(cat => (
            <div key={cat} className="card-dark">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">{getCategoryIcon(cat)}</span>
                <h2 className="font-display font-800 text-sm text-foreground tracking-widest uppercase">{cat}</h2>
              </div>
              <div className="space-y-3">
                {services.filter(s => s.category === cat).map(svc => (
                  <motion.div key={svc.id} className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: 'var(--background-2)' }}>
                    <div className="flex-1 min-w-0">
                      <div className="font-body text-sm text-foreground font-500 truncate">{svc.name}</div>
                      {svc.brand && <div className="text-muted text-xs font-body">{svc.brand}</div>}
                    </div>
                    <div className="text-muted text-xs font-body hidden sm:block">{formatCurrency(svc.price)}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted text-sm font-body">₹</span>
                      <input type="number" value={prices[svc.id] || ''}
                        onChange={e => setPrices(p => ({ ...p, [svc.id]: e.target.value }))}
                        className="w-24 input-dark text-sm py-1.5 px-2 text-right" />
                      <button onClick={() => handleSave(svc)} disabled={saving === svc.id}
                        className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shrink-0 glow-orange">
                        {saving === svc.id
                          ? <Loader2 size={12} className="animate-spin text-foreground" />
                          : <Save size={12} className="text-foreground" />}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
