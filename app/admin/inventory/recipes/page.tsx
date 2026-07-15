'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Trash2, BookOpen } from 'lucide-react';
import {
  getServices, listInventoryItems, listServiceRecipes, saveServiceRecipe,
} from '@/lib/firebaseService';
import ServiceIcon from '@/components/ui/ServiceIcon';
import type { Service, InventoryItem, ServiceRecipe } from '@/lib/types';

export default function AdminRecipesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<Record<string, ServiceRecipe>>({});
  const [loading, setLoading] = useState(true);
  const [openService, setOpenService] = useState<Service | null>(null);
  const [draft, setDraft] = useState<{ itemId: string; qty: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getServices(), listInventoryItems(), listServiceRecipes()])
      .then(([s, i, r]) => {
        setServices(s.filter(x => x.active).sort((a, b) => a.order - b.order));
        setItems(i);
        setRecipes(Object.fromEntries(r.map(x => [x.serviceId, x])));
        setLoading(false);
      });
  }, []);

  const openEditor = (s: Service) => {
    setOpenService(s);
    const existing = recipes[s.id];
    setDraft(existing
      ? existing.items.map(i => ({ itemId: i.itemId, qty: String(i.qty) }))
      : [{ itemId: items[0]?.id ?? '', qty: '' }]);
  };

  const save = async () => {
    if (!openService) return;
    const clean = draft
      .filter(d => d.itemId && Number(d.qty) > 0)
      .map(d => {
        const item = items.find(i => i.id === d.itemId)!;
        return { itemId: d.itemId, itemName: item.name, qty: Number(d.qty), unit: item.unit };
      });
    setSaving(true);
    try {
      await saveServiceRecipe({ serviceId: openService.id, serviceName: openService.name, items: clean });
      setRecipes(prev => ({
        ...prev,
        [openService.id]: { serviceId: openService.id, serviceName: openService.name, items: clean, updatedAt: null as never },
      }));
      toast.success(clean.length ? 'Recipe saved' : 'Recipe cleared');
      setOpenService(null);
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <Link href="/admin/inventory" className="flex items-center gap-2 data-label mb-4" style={{ color: 'var(--steel)' }}>
        <ArrowLeft size={13} /> Inventory
      </Link>
      <div className="mb-6">
        <h1 className="font-display font-800 text-2xl" style={{ color: 'var(--chrome)' }}>SERVICE RECIPES</h1>
        <p className="text-sm font-body" style={{ color: 'var(--steel)' }}>
          What each service consumes - stock auto-deducts when the service completes.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 shimmer rounded-2xl" />)}</div>
      ) : items.length === 0 ? (
        <div className="card text-center py-14">
          <BookOpen size={26} className="mx-auto mb-3" style={{ color: 'var(--steel)' }} />
          <p className="font-body" style={{ color: 'var(--steel)' }}>Add inventory items first, then map them to services here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((s, i) => {
            const recipe = recipes[s.id];
            const isOpen = openService?.id === s.id;
            return (
              <motion.div key={s.id} initial={false} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }} className="card-dark">
                <div className="flex items-center gap-3">
                  <ServiceIcon category={s.category} size={18} style={{ color: 'var(--chrome)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>{s.name}</p>
                    <p className="text-xs font-body mt-0.5" style={{ color: recipe?.items.length ? 'var(--success)' : 'var(--steel)' }}>
                      {recipe?.items.length
                        ? recipe.items.map(x => `${x.qty} ${x.unit} ${x.itemName}`).join(' + ')
                        : 'No recipe - nothing deducted'}
                    </p>
                  </div>
                  <button onClick={() => isOpen ? setOpenService(null) : openEditor(s)}
                    className="btn-ghost px-4 py-2 text-xs">
                    {isOpen ? 'Close' : recipe?.items.length ? 'Edit' : 'Set up'}
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-4 pt-4 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
                    {draft.map((row, idx) => {
                      const unit = items.find(x => x.id === row.itemId)?.unit ?? '';
                      return (
                        <div key={idx} className="flex items-center gap-2">
                          <select className="input flex-1 text-sm" value={row.itemId}
                            onChange={e => setDraft(d => d.map((r, j) => j === idx ? { ...r, itemId: e.target.value } : r))}>
                            {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                          </select>
                          <input className="input w-24 text-sm" inputMode="numeric" value={row.qty}
                            onChange={e => setDraft(d => d.map((r, j) => j === idx ? { ...r, qty: e.target.value.replace(/\D/g, '') } : r))}
                            placeholder="Qty" />
                          <span className="data-label w-8" style={{ color: 'var(--steel)' }}>{unit}</span>
                          <button onClick={() => setDraft(d => d.filter((_, j) => j !== idx))}
                            className="w-8 h-8 flex items-center justify-center rounded-lg"
                            style={{ background: 'var(--dark)', color: 'var(--danger)' }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setDraft(d => [...d, { itemId: items[0]?.id ?? '', qty: '' }])}
                        className="btn-ghost flex items-center gap-1.5 px-3 py-2 text-xs">
                        <Plus size={12} /> Add item
                      </button>
                      <button onClick={save} disabled={saving} className="btn-ember flex-1 py-2 text-sm">
                        {saving ? 'Saving…' : 'Save Recipe'}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
