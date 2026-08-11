'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Save, Loader2, RefreshCw, Package, Database } from 'lucide-react';
import toast from 'react-hot-toast';
import { getServices, seedServices, getResourceConfig, setWashCapacity } from '@/lib/firebaseService';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatCurrency } from '@/lib/utils';
import ServiceIcon from '@/components/ui/ServiceIcon';
import { ScopeEditor } from '@/components/workspace/ScopeEditor';
import type { Service } from '@/lib/types';
import ErrorState from '@/components/ui/ErrorState';

export default function AdminSettingsPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [durations, setDurations] = useState<Record<string, string>>({});
  const [washCap, setWashCap] = useState('3');
  const [washSaving, setWashSaving] = useState(false);

  const load = () => {
    setLoadError(false);
    setLoading(true);
    getServices()
      .then(s => {
        const sorted = s.sort((a, b) => a.category.localeCompare(b.category) || a.order - b.order);
        setServices(sorted);
        const p: Record<string, string> = {};
        const dur: Record<string, string> = {};
        sorted.forEach(sv => { p[sv.id] = sv.price.toString(); dur[sv.id] = String(sv.duration ?? 60); });
        setPrices(p);
        setDurations(dur);
      })
      .catch(e => { console.error('services load failed', e); setLoadError(true); })
      .finally(() => setLoading(false));
    getResourceConfig().then(c => setWashCap(String(c.washCapacity))).catch(() => {});
  };
  useEffect(load, []);

  const saveWashCap = async () => {
    const n = parseInt(washCap);
    if (isNaN(n) || n < 1 || n > 10) return toast.error('Wash capacity must be 1–10');
    setWashSaving(true);
    try {
      await setWashCapacity(n);
      toast.success('Wash capacity updated - availability recalculates immediately');
    } catch { toast.error('Failed to update'); }
    finally { setWashSaving(false); }
  };

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
    const dur = parseInt(durations[svc.id]);
    if (isNaN(p) || p < 0) return toast.error('Invalid price');
    if (isNaN(dur) || dur < 15) return toast.error('Duration must be at least 15 minutes');
    setSaving(svc.id);
    try {
      await updateDoc(doc(db, 'services', svc.id), { price: p, duration: dur });
      setServices(services.map(s => s.id === svc.id ? { ...s, price: p, duration: dur } : s));
      toast.success('Service updated - bookings use the new duration immediately');
    } catch { toast.error('Failed to update'); }
    finally { setSaving(null); }
  };

  const cats = [...new Set(services.map(s => s.category))];

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display font-900 text-2xl text-foreground tracking-wide">SETTINGS</h1>
        <p className="text-muted text-sm font-body">Manage services and pricing</p>
      </div>

      {/* Studio resources - what the booking engine schedules against */}
      <div className="card-dark mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Package size={20} className="text-white" />
          <div>
            <div className="font-display font-800 text-sm text-foreground tracking-wide">Studio Resources</div>
            <div className="text-muted text-xs font-body">Two physical resources - the calendar blocks around real occupancy</div>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl sm:col-span-2" style={{ background: 'var(--background-2)' }}>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted">Protection Bay</p>
            <p className="font-body text-sm text-foreground mt-1">1 vehicle <span className="text-muted text-xs">· PPF, ceramic, graphene, coating, correction - one active job; the rest wait</span></p>
          </div>
          <div className="p-3 rounded-xl flex items-center justify-between gap-2" style={{ background: 'var(--background-2)' }}>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted">Wash Capacity</p>
              <p className="font-body text-xs text-muted mt-1">simultaneous cars</p>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={10} value={washCap}
                onChange={e => setWashCap(e.target.value)}
                className="w-16 input-dark text-sm py-1.5 px-2 text-right" />
              <button onClick={saveWashCap} disabled={washSaving}
                className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
                {washSaving ? <Loader2 size={12} className="animate-spin text-foreground" /> : <Save size={12} className="text-foreground" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DB Init */}
      <div className="card-dark mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Database size={20} className="text-white" />
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
      ) : loadError ? (
        <ErrorState onRetry={load} />
      ) : (
        <div className="space-y-6">
          {cats.map(cat => (
            <div key={cat} className="card-dark">
              <div className="flex items-center gap-2 mb-4">
                <ServiceIcon category={cat} size={18} style={{ color: 'var(--chrome)' }} />
                <h2 className="font-display font-800 text-sm text-foreground tracking-widest uppercase">{cat}</h2>
              </div>
              <div className="space-y-3">
                {services.filter(s => s.category === cat).map(svc => (
                  <motion.div key={svc.id} className="flex items-center gap-3 p-3 rounded-xl flex-wrap"
                    style={{ background: 'var(--background-2)' }}>
                    <div className="flex-1 min-w-0">
                      <div className="font-body text-sm text-foreground font-500 truncate">{svc.name}</div>
                      {svc.brand && <div className="text-muted text-xs font-body">{svc.brand}</div>}
                    </div>
                    <div className="text-muted text-xs font-body hidden sm:block">{formatCurrency(svc.price)}</div>
                    <div className="flex items-center gap-2">
                      <input type="number" value={durations[svc.id] || ''}
                        onChange={e => setDurations(d => ({ ...d, [svc.id]: e.target.value }))}
                        title="Duration (minutes) - drives bay blocking on the calendar"
                        className="w-20 input-dark text-sm py-1.5 px-2 text-right" />
                      <span className="text-muted text-xs font-body">min</span>
                      <span className="text-muted text-sm font-body ml-1">₹</span>
                      <input type="number" value={prices[svc.id] || ''}
                        onChange={e => setPrices(p => ({ ...p, [svc.id]: e.target.value }))}
                        className="w-24 input-dark text-sm py-1.5 px-2 text-right" />
                      <button onClick={() => handleSave(svc)} disabled={saving === svc.id}
                        className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
                        {saving === svc.id
                          ? <Loader2 size={12} className="animate-spin text-foreground" />
                          : <Save size={12} className="text-foreground" />}
                      </button>
                    </div>
                    {/* WHAT THE CUSTOMER CHOOSES ON THE QUOTE SCREEN (design
                        07). A coverage nobody has described cannot be picked,
                        so this is the admin counterpart that makes that screen
                        more than a single-option chooser. */}
                    <ScopeEditor
                      service={svc}
                      onSaved={patch => setServices(list =>
                        list.map(s => (s.id === svc.id ? { ...s, ...patch } : s)))}
                    />
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
