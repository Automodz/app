'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { BadgePercent, Plus, X, Power } from 'lucide-react';
import { createPromo, updatePromo, listPromos, getServices } from '@/lib/firebaseService';
import { formatCurrency } from '@/lib/utils';
import type { Promo, Service } from '@/lib/types';

const CATEGORIES = ['PPF', 'Washing', 'Ceramic', 'Coating'];

const emptyForm = {
  code: '', label: '', type: 'percent' as 'percent' | 'flat', value: '',
  scopeKind: 'all' as 'all' | 'category' | 'services',
  categories: [] as string[], serviceIds: [] as string[],
  targetKind: 'all' as 'all' | 'customers', userIdsCsv: '',
  validFrom: new Date().toISOString().slice(0, 10),
  validTo: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
  usageLimitTotal: '', usageLimitPerCustomer: '',
  autoApply: true,
};

export default function AdminPromosPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Promo | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => { setPromos(await listPromos()); setLoading(false); };
  useEffect(() => { load(); getServices().then(setServices); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (p: Promo) => {
    setEditing(p);
    setForm({
      code: p.code, label: p.label, type: p.type, value: String(p.value),
      scopeKind: p.scope.kind,
      categories: p.scope.kind === 'category' ? p.scope.categories : [],
      serviceIds: p.scope.kind === 'services' ? p.scope.serviceIds : [],
      targetKind: p.target.kind,
      userIdsCsv: p.target.kind === 'customers' ? p.target.userIds.join(', ') : '',
      validFrom: p.validFrom, validTo: p.validTo,
      usageLimitTotal: p.usageLimitTotal?.toString() ?? '',
      usageLimitPerCustomer: p.usageLimitPerCustomer?.toString() ?? '',
      autoApply: p.autoApply,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.label.trim() || !Number(form.value)) {
      toast.error('Code, label and value are required'); return;
    }
    if (form.scopeKind === 'category' && form.categories.length === 0) { toast.error('Pick at least one category'); return; }
    if (form.scopeKind === 'services' && form.serviceIds.length === 0) { toast.error('Pick at least one service'); return; }
    const scope =
      form.scopeKind === 'all' ? { kind: 'all' as const } :
      form.scopeKind === 'category' ? { kind: 'category' as const, categories: form.categories } :
      { kind: 'services' as const, serviceIds: form.serviceIds };
    const target =
      form.targetKind === 'all' ? { kind: 'all' as const } :
      { kind: 'customers' as const, userIds: form.userIdsCsv.split(',').map(s => s.trim()).filter(Boolean) };
    const data = {
      code: form.code, label: form.label.trim(), type: form.type, value: Number(form.value),
      scope, target, validFrom: form.validFrom, validTo: form.validTo,
      ...(form.usageLimitTotal ? { usageLimitTotal: Number(form.usageLimitTotal) } : {}),
      ...(form.usageLimitPerCustomer ? { usageLimitPerCustomer: Number(form.usageLimitPerCustomer) } : {}),
      autoApply: form.autoApply, active: true,
    };
    setSaving(true);
    try {
      if (editing) { await updatePromo(editing.id, data); toast.success('Promo updated'); }
      else { await createPromo(data); toast.success('Promo created'); }
      setShowForm(false); await load();
    } catch (e) { console.error(e); toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (p: Promo) => {
    await updatePromo(p.id, { active: !p.active });
    toast.success(p.active ? 'Promo disabled' : 'Promo enabled');
    await load();
  };

  const chip = (label: string, selected: boolean, onClick: () => void) => (
    <button key={label} onClick={onClick}
      className="px-3 py-2 rounded-xl data-label"
      style={{
        background: selected ? 'var(--accent-mist)' : 'var(--dark)',
        border: selected ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
        color: selected ? 'var(--ember)' : 'var(--steel)',
      }}>{label}</button>
  );

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-800 text-2xl" style={{ color: 'var(--chrome)' }}>PROMOS</h1>
          <p className="text-sm font-body" style={{ color: 'var(--steel)' }}>
            {promos.filter(p => p.active).length} active · applied best-of with membership discounts
          </p>
        </div>
        <button onClick={openCreate} className="btn-ember flex items-center gap-2 px-4 py-2.5 text-sm">
          <Plus size={15} /> New Promo
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 shimmer rounded-2xl" />)}</div>
      ) : promos.length === 0 ? (
        <div className="card text-center py-14">
          <BadgePercent size={26} className="mx-auto mb-3" style={{ color: 'var(--steel)' }} />
          <p className="font-body" style={{ color: 'var(--steel)' }}>No promos yet. Create discounts per service, category, or customer.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {promos.map((p, i) => (
            <motion.div key={p.id} initial={false} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }} className="card-dark" style={{ opacity: p.active ? 1 : 0.5 }}>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-700 text-sm px-2 py-0.5 rounded-lg"
                      style={{ background: 'var(--smoke)', color: 'var(--chrome)' }}>{p.code}</span>
                    <span className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>{p.label}</span>
                    {p.autoApply && <span className="data-label" style={{ color: 'var(--success)' }}>auto</span>}
                  </div>
                  <p className="text-xs font-body mt-1" style={{ color: 'var(--steel)' }}>
                    {p.type === 'percent' ? `${p.value}% off` : `${formatCurrency(p.value)} off`}
                    {' · '}
                    {p.scope.kind === 'all' ? 'all services' : p.scope.kind === 'category' ? p.scope.categories.join(', ') : `${p.scope.serviceIds.length} services`}
                    {' · '}
                    {p.target.kind === 'all' ? 'everyone' : `${p.target.userIds.length} customer(s)`}
                    {' · '}
                    {p.validFrom} → {p.validTo}
                    {' · used '}{p.usedCount}{p.usageLimitTotal ? `/${p.usageLimitTotal}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleActive(p)} title={p.active ? 'Disable' : 'Enable'}
                    className="w-9 h-9 flex items-center justify-center rounded-xl"
                    style={{ background: 'var(--dark)', color: p.active ? 'var(--success)' : 'var(--steel)' }}>
                    <Power size={14} />
                  </button>
                  <button onClick={() => openEdit(p)} className="btn-ghost px-4 py-2 text-xs">Edit</button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
              onClick={() => setShowForm(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-5 max-w-lg mx-auto max-h-[92vh] overflow-y-auto"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-700 text-lg" style={{ color: 'var(--chrome)' }}>
                  {editing ? 'EDIT PROMO' : 'NEW PROMO'}
                </h2>
                <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-lg"
                  style={{ background: 'var(--dark)', color: 'var(--steel)' }}><X size={14} /></button>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="data-label block mb-1">Code</label>
                    <input className="input uppercase" value={form.code}
                      onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="WASH15" />
                  </div>
                  <div>
                    <label className="data-label block mb-1">Label (shown to customer)</label>
                    <input className="input" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="15% off washing" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="data-label block mb-1">Type</label>
                    <div className="flex gap-2">
                      {chip('% off', form.type === 'percent', () => setForm({ ...form, type: 'percent' }))}
                      {chip('₹ flat', form.type === 'flat', () => setForm({ ...form, type: 'flat' }))}
                    </div>
                  </div>
                  <div>
                    <label className="data-label block mb-1">{form.type === 'percent' ? 'Percent' : 'Amount (₹)'}</label>
                    <input className="input" inputMode="numeric" value={form.value}
                      onChange={e => setForm({ ...form, value: e.target.value.replace(/\D/g, '') })} placeholder={form.type === 'percent' ? '15' : '500'} />
                  </div>
                </div>
                <div>
                  <label className="data-label block mb-1">Applies to</label>
                  <div className="flex gap-2 mb-2">
                    {chip('All services', form.scopeKind === 'all', () => setForm({ ...form, scopeKind: 'all' }))}
                    {chip('Categories', form.scopeKind === 'category', () => setForm({ ...form, scopeKind: 'category' }))}
                    {chip('Specific services', form.scopeKind === 'services', () => setForm({ ...form, scopeKind: 'services' }))}
                  </div>
                  {form.scopeKind === 'category' && (
                    <div className="flex gap-2 flex-wrap">
                      {CATEGORIES.map(c => chip(c, form.categories.includes(c), () =>
                        setForm({ ...form, categories: form.categories.includes(c) ? form.categories.filter(x => x !== c) : [...form.categories, c] })))}
                    </div>
                  )}
                  {form.scopeKind === 'services' && (
                    <div className="flex gap-2 flex-wrap max-h-40 overflow-y-auto">
                      {services.map(s => chip(s.name, form.serviceIds.includes(s.id), () =>
                        setForm({ ...form, serviceIds: form.serviceIds.includes(s.id) ? form.serviceIds.filter(x => x !== s.id) : [...form.serviceIds, s.id] })))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="data-label block mb-1">Target customers</label>
                  <div className="flex gap-2 mb-2">
                    {chip('Everyone', form.targetKind === 'all', () => setForm({ ...form, targetKind: 'all' }))}
                    {chip('Specific customers', form.targetKind === 'customers', () => setForm({ ...form, targetKind: 'customers' }))}
                  </div>
                  {form.targetKind === 'customers' && (
                    <input className="input" value={form.userIdsCsv}
                      onChange={e => setForm({ ...form, userIdsCsv: e.target.value })}
                      placeholder="Customer UIDs, comma-separated (assign from Customer page)" />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="data-label block mb-1">Valid from</label>
                    <input className="input" type="date" value={form.validFrom} onChange={e => setForm({ ...form, validFrom: e.target.value })} />
                  </div>
                  <div>
                    <label className="data-label block mb-1">Valid to</label>
                    <input className="input" type="date" value={form.validTo} onChange={e => setForm({ ...form, validTo: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="data-label block mb-1">Total usage limit</label>
                    <input className="input" inputMode="numeric" value={form.usageLimitTotal}
                      onChange={e => setForm({ ...form, usageLimitTotal: e.target.value.replace(/\D/g, '') })} placeholder="Unlimited" />
                  </div>
                  <div>
                    <label className="data-label block mb-1">Per-customer limit</label>
                    <input className="input" inputMode="numeric" value={form.usageLimitPerCustomer}
                      onChange={e => setForm({ ...form, usageLimitPerCustomer: e.target.value.replace(/\D/g, '') })} placeholder="Unlimited" />
                  </div>
                </div>
                <button onClick={() => setForm({ ...form, autoApply: !form.autoApply })}
                  className="flex items-center justify-between w-full px-3 py-3 rounded-xl"
                  style={{ background: 'var(--dark)', border: '1px solid var(--border)' }}>
                  <span className="text-sm font-body" style={{ color: 'var(--chrome)' }}>Auto-apply at checkout (no code needed)</span>
                  <span className="data-label" style={{ color: form.autoApply ? 'var(--success)' : 'var(--steel)' }}>
                    {form.autoApply ? 'ON' : 'OFF'}
                  </span>
                </button>
                <button onClick={handleSave} disabled={saving} className="btn-ember w-full py-3 mt-1">
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Promo'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
