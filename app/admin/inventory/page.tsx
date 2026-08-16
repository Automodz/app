'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Package, Plus, X, AlertTriangle, TrendingUp, SlidersHorizontal, BookOpen } from 'lucide-react';
import {
  createInventoryItem, updateInventoryItem, listInventoryItems,
  recordPurchase, adjustStock, getInventoryTxns,
} from '@/lib/firebaseService';
import { formatCurrency } from '@/lib/utils';
import type { InventoryItem, InventoryTxn, InventoryUnit, InventoryCategory } from '@/lib/types';

const UNITS: InventoryUnit[] = ['ml', 'ft', 'pcs', 'gm'];
const CATEGORIES: { id: InventoryCategory; label: string }[] = [
  { id: 'ppf_film', label: 'PPF Film' }, { id: 'ceramic', label: 'Ceramic' },
  { id: 'wash', label: 'Wash' }, { id: 'interior', label: 'Interior' }, { id: 'other', label: 'Other' },
];

const emptyForm = {
  name: '', category: 'wash' as InventoryCategory, unit: 'ml' as InventoryUnit,
  stockQty: '', lowStockThreshold: '', costPerUnit: '',
};

export default function AdminInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [txns, setTxns] = useState<InventoryTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [moveFor, setMoveFor] = useState<InventoryItem | null>(null);
  const [moveType, setMoveType] = useState<'purchase' | 'adjustment'>('purchase');
  const [moveQty, setMoveQty] = useState('');
  const [moveCost, setMoveCost] = useState('');
  const [moveNote, setMoveNote] = useState('');

  const load = async () => {
    const [i, t] = await Promise.all([listInventoryItems(), getInventoryTxns(undefined, 30)]);
    setItems(i); setTxns(t); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (item: InventoryItem) => {
    setEditing(item);
    setForm({
      name: item.name, category: item.category, unit: item.unit,
      stockQty: String(item.stockQty), lowStockThreshold: String(item.lowStockThreshold),
      costPerUnit: String(item.costPerUnit),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateInventoryItem(editing.id, {
          name: form.name.trim(), category: form.category, unit: form.unit,
          lowStockThreshold: Number(form.lowStockThreshold) || 0,
          costPerUnit: Number(form.costPerUnit) || 0,
        });
        toast.success('Item updated');
      } else {
        await createInventoryItem({
          name: form.name.trim(), category: form.category, unit: form.unit,
          stockQty: Number(form.stockQty) || 0,
          lowStockThreshold: Number(form.lowStockThreshold) || 0,
          costPerUnit: Number(form.costPerUnit) || 0,
        });
        toast.success('Item added');
      }
      setShowForm(false); await load();
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const handleMove = async () => {
    if (!moveFor) return;
    const qty = Number(moveQty);
    if (!qty) { toast.error('Enter a quantity'); return; }
    try {
      if (moveType === 'purchase') {
        await recordPurchase(moveFor.id, qty, Number(moveCost) || undefined, moveNote || undefined);
        toast.success(`+${qty} ${moveFor.unit} added`);
      } else {
        await adjustStock(moveFor.id, qty, moveNote || 'Manual adjustment');
        toast.success('Stock adjusted');
      }
      setMoveFor(null); setMoveQty(''); setMoveCost(''); setMoveNote('');
      await load();
    } catch { toast.error('Failed'); }
  };

  const lowStock = items.filter(i => i.stockQty <= i.lowStockThreshold);

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display font-800 text-2xl" style={{ color: 'var(--chrome)' }}>INVENTORY</h1>
          <p className="text-sm font-body" style={{ color: 'var(--steel)' }}>
            {items.length} items · auto-deducts when services complete
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openCreate} className="btn-ember flex items-center gap-2 px-4 py-2.5 text-sm">
            <Plus size={15} /> Add Item
          </button>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="card-dark mb-4 flex items-center gap-3"
          style={{ border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)' }}>
          <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />
          <p className="text-sm font-body" style={{ color: 'var(--danger)' }}>
            Low stock: {lowStock.map(i => i.name).join(', ')} - reorder soon.
          </p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 shimmer rounded-2xl" />)}</div>
      ) : items.length === 0 ? (
        <div className="card text-center py-14">
          <Package size={26} className="mx-auto mb-3" style={{ color: 'var(--steel)' }} />
          <p className="font-body" style={{ color: 'var(--steel)' }}>
            No inventory yet. Add the consumables you buy - PPF film, ceramic bottles, shampoo.
          </p>
        </div>
      ) : (
        <div className="space-y-3 mb-8">
          {items.map((item, i) => {
            const low = item.stockQty <= item.lowStockThreshold;
            return (
              <motion.div key={item.id} initial={false} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }} className="card-dark">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>{item.name}</span>
                      <span className="data-label" style={{ color: 'var(--steel)' }}>
                        {CATEGORIES.find(c => c.id === item.category)?.label}
                      </span>
                      {low && <span className="data-label flex items-center gap-1" style={{ color: 'var(--danger)' }}><AlertTriangle size={10} /> LOW</span>}
                    </div>
                    <p className="text-xs font-body mt-1" style={{ color: 'var(--steel)' }}>
                      {formatCurrency(item.costPerUnit)}/{item.unit} · alert at {item.lowStockThreshold} {item.unit}
                    </p>
                  </div>
                  <div className="text-right mr-2">
                    <p className="font-mono font-700 text-lg" style={{ color: low ? 'var(--danger)' : 'var(--chrome)' }}>
                      {item.stockQty} <span className="text-xs font-400" style={{ color: 'var(--steel)' }}>{item.unit}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setMoveFor(item); setMoveType('purchase'); }} title="Record purchase"
                      className="w-9 h-9 flex items-center justify-center rounded-xl"
                      style={{ background: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)' }}>
                      <TrendingUp size={14} />
                    </button>
                    <button onClick={() => { setMoveFor(item); setMoveType('adjustment'); }} title="Adjust stock"
                      className="w-9 h-9 flex items-center justify-center rounded-xl"
                      style={{ background: 'var(--dark)', color: 'var(--steel)' }}>
                      <SlidersHorizontal size={14} />
                    </button>
                    <button onClick={() => openEdit(item)} className="btn-ghost px-3 py-2 text-xs">Edit</button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Recent movements */}
      {txns.length > 0 && (
        <div className="card-dark">
          <p className="data-label mb-3" style={{ color: 'var(--steel)' }}>Recent movements</p>
          <div className="space-y-2">
            {txns.map(t => (
              <div key={t.id} className="flex items-center gap-3 text-xs font-body">
                <span className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: t.qtyDelta > 0 ? 'var(--success)' : 'var(--danger)' }} />
                <span style={{ color: 'var(--chrome)' }}>{t.itemName}</span>
                <span className="font-mono" style={{ color: t.qtyDelta > 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {t.qtyDelta > 0 ? '+' : ''}{t.qtyDelta}
                </span>
                <span style={{ color: 'var(--steel)' }}>
                  {t.type}{t.refType ? ` · ${t.refType}` : ''}{t.note ? ` · ${t.note}` : ''}
                </span>
                <span className="ml-auto font-mono" style={{ color: 'var(--steel)' }}>
                  {t.createdAt?.toDate?.().toLocaleDateString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Item form drawer */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
              onClick={() => setShowForm(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-5 max-w-lg mx-auto max-h-[90vh] overflow-y-auto"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-700 text-lg" style={{ color: 'var(--chrome)' }}>
                  {editing ? 'EDIT ITEM' : 'NEW ITEM'}
                </h2>
                <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-lg"
                  style={{ background: 'var(--dark)', color: 'var(--steel)' }}><X size={14} /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="data-label block mb-1">Name</label>
                  <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. XPEL PPF Film Roll" />
                </div>
                <div>
                  <label className="data-label block mb-1">Category</label>
                  <div className="flex gap-2 flex-wrap">
                    {CATEGORIES.map(c => (
                      <button key={c.id} onClick={() => setForm({ ...form, category: c.id })}
                        className="px-3 py-2 rounded-xl data-label"
                        style={{
                          background: form.category === c.id ? 'var(--accent-mist)' : 'var(--dark)',
                          border: form.category === c.id ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
                          color: form.category === c.id ? 'var(--ember)' : 'var(--steel)',
                        }}>{c.label}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="data-label block mb-1">Unit</label>
                    <div className="flex gap-2">
                      {UNITS.map(u => (
                        <button key={u} onClick={() => setForm({ ...form, unit: u })}
                          className="px-3 py-2 rounded-xl data-label"
                          style={{
                            background: form.unit === u ? 'var(--accent-mist)' : 'var(--dark)',
                            border: form.unit === u ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
                            color: form.unit === u ? 'var(--ember)' : 'var(--steel)',
                          }}>{u}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="data-label block mb-1">Cost per unit (₹)</label>
                    <input className="input" inputMode="numeric" value={form.costPerUnit}
                      onChange={e => setForm({ ...form, costPerUnit: e.target.value.replace(/\D/g, '') })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {!editing && (
                    <div>
                      <label className="data-label block mb-1">Opening stock</label>
                      <input className="input" inputMode="numeric" value={form.stockQty}
                        onChange={e => setForm({ ...form, stockQty: e.target.value.replace(/\D/g, '') })} />
                    </div>
                  )}
                  <div>
                    <label className="data-label block mb-1">Low-stock alert at</label>
                    <input className="input" inputMode="numeric" value={form.lowStockThreshold}
                      onChange={e => setForm({ ...form, lowStockThreshold: e.target.value.replace(/\D/g, '') })} />
                  </div>
                </div>
                <button onClick={handleSave} disabled={saving} className="btn-ember w-full py-3 mt-1">
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Purchase / adjust modal */}
      <AnimatePresence>
        {moveFor && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
              onClick={() => setMoveFor(null)} />
            <motion.div initial={false} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 top-1/4 z-50 rounded-2xl p-5 max-w-sm mx-auto"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <h3 className="font-display font-700 mb-1" style={{ color: 'var(--chrome)' }}>
                {moveType === 'purchase' ? 'Record Purchase' : 'Adjust Stock'}
              </h3>
              <p className="text-xs font-body mb-3" style={{ color: 'var(--steel)' }}>
                {moveFor.name} - current {moveFor.stockQty} {moveFor.unit}
                {moveType === 'adjustment' && ' (use negative for wastage)'}
              </p>
              <div className="space-y-2">
                <input className="input" inputMode={moveType === 'purchase' ? 'numeric' : 'text'} value={moveQty}
                  onChange={e => setMoveQty(e.target.value.replace(/[^\d-]/g, ''))}
                  placeholder={`Quantity in ${moveFor.unit}`} autoFocus />
                {moveType === 'purchase' && (
                  <input className="input" inputMode="numeric" value={moveCost}
                    onChange={e => setMoveCost(e.target.value.replace(/\D/g, ''))} placeholder="Total cost (₹, optional)" />
                )}
                <input className="input" value={moveNote} onChange={e => setMoveNote(e.target.value)}
                  placeholder="Note (optional)" />
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setMoveFor(null)} className="btn-ghost flex-1 py-2.5">Cancel</button>
                <button onClick={handleMove} className="btn-ember flex-1 py-2.5">Save</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
