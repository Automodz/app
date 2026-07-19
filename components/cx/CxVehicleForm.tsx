'use client';
/**
 * CxVehicleForm — the one add/edit vehicle form. Lives inside a CxSheet
 * wherever a car joins the garage (Garage screen, booking flow). Owns the
 * Firestore write; the host just listens for onSaved.
 */
import { useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { addVehicle, updateVehicle } from '@/lib/firebaseService';
import { useAppStore } from '@/lib/store';
import type { Vehicle } from '@/lib/types';
import CxButton from '@/components/cx/CxButton';

const CATEGORIES: Vehicle['category'][] = ['Hatchback', 'Sedan', 'Compact SUV', 'Full SUV', 'Luxury'];
const COLORS = ['White', 'Black', 'Silver', 'Grey', 'Red', 'Blue', 'Brown', 'Green', 'Orange', 'Yellow', 'Other'];

const label = {
  fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em',
  color: 'var(--faint)', textTransform: 'uppercase' as const, marginBottom: '6px',
};

function Chips({ options, value, onPick }: { options: readonly string[]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(c => (
        <button key={c} onClick={() => onPick(c)}
          className="px-3 py-2 rounded-xl transition-all"
          style={{
            background: value === c ? 'var(--ember)' : 'var(--cavern)',
            color:      value === c ? 'var(--on-accent)' : 'var(--muted)',
            border:     `1px solid ${value === c ? 'var(--ember)' : 'var(--border-2)'}`,
            fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 500,
            boxShadow:  value === c ? '0 2px 10px var(--accent-glow)' : 'none',
          }}>
          {c}
        </button>
      ))}
    </div>
  );
}

export default function CxVehicleForm({ editing, onSaved, onClose }: {
  /** pass a vehicle to edit it; omit to add a new one */
  editing?: Vehicle | null;
  onSaved: (v: Vehicle) => void;
  onClose: () => void;
}) {
  const { user, vehicles, addVehicleToStore, setVehicles } = useAppStore();
  const [form, setForm] = useState({
    name: editing?.name ?? '',
    registrationNumber: editing?.registrationNumber ?? '',
    category: editing?.category ?? ('Sedan' as Vehicle['category']),
    color: editing?.color ?? '',
    notes: editing?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!user) return;
    if (!form.name.trim() || !form.registrationNumber.trim()) {
      toast.error('Your car needs a name and its registration.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateVehicle(user.uid, editing.id, form);
        const next = { ...editing, ...form };
        setVehicles(vehicles.map(v => v.id === editing.id ? next : v));
        toast.success('Details updated');
        onSaved(next);
      } else {
        const id = await addVehicle(user.uid, form);
        const v: Vehicle = { id, ...form, createdAt: Timestamp.fromDate(new Date()) };
        addVehicleToStore(v);
        toast.success(`${form.name} joined your garage`);
        onSaved(v);
      }
    } catch {
      toast.error('We couldn’t save it — try again in a moment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', color: 'var(--chrome)', letterSpacing: '0.06em' }}>
          {editing ? 'EDIT VEHICLE' : 'ADD VEHICLE'}
        </h2>
        <button onClick={onClose} aria-label="Close"
          className="w-9 h-9 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--cavern)', border: '1px solid var(--border)' }}>
          <X size={16} style={{ color: 'var(--muted)' }} />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <p style={label}>Vehicle Name *</p>
          <input type="text" placeholder="e.g. My Maruti Swift"
            value={form.name} onChange={e => update('name', e.target.value)}
            className="input" />
        </div>

        <div>
          <p style={label}>Registration Number *</p>
          <input type="text" placeholder="e.g. GJ01AB1234"
            value={form.registrationNumber}
            onChange={e => update('registrationNumber', e.target.value.toUpperCase())}
            className="input"
            style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }} />
        </div>

        <div>
          <p style={label}>Category</p>
          <Chips options={CATEGORIES} value={form.category} onPick={v => update('category', v)} />
        </div>

        <div>
          <p style={label}>Color</p>
          <Chips options={COLORS} value={form.color} onPick={v => update('color', v)} />
        </div>

        <div>
          <p style={label}>Notes (optional)</p>
          <input type="text" placeholder="e.g. Daily driver"
            value={form.notes} onChange={e => update('notes', e.target.value)}
            className="input" />
        </div>

        <div className="pt-2 pb-6">
          <CxButton onClick={handleSave} disabled={saving}>
            {saving
              ? <Loader2 size={16} className="animate-spin" />
              : <><Check size={16} /> {editing ? 'UPDATE VEHICLE' : 'ADD TO GARAGE'}</>}
          </CxButton>
        </div>
      </div>
    </div>
  );
}
