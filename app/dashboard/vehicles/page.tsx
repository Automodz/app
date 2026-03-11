'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Car, Edit3, Trash2, X, Check, Loader2, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { addVehicle, updateVehicle, deleteVehicle } from '@/lib/firebaseService';
import { useAppStore } from '@/lib/store';
import type { Vehicle } from '@/lib/types';

const CATEGORIES = ['Hatchback', 'Sedan', 'Compact SUV', 'Full SUV', 'Luxury'];
const COLORS = ['White', 'Black', 'Silver', 'Grey', 'Red', 'Blue', 'Brown', 'Green', 'Orange', 'Yellow', 'Other'];
const emptyForm = { name: '', registrationNumber: '', category: 'Sedan' as Vehicle['category'], color: '', notes: '' };

export default function VehiclesPage() {
  const router = useRouter();
  const { user, vehicles, addVehicleToStore, removeVehicleFromStore, setVehicles } = useAppStore();
  const isDemo = user?.role === 'demo';
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Vehicle | null>(null);
  const [form, setForm]         = useState(emptyForm);
  const [loading, setLoading]   = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const openAdd  = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (v: Vehicle) => { setEditing(v); setForm({ name:v.name, registrationNumber:v.registrationNumber, category:v.category, color:v.color||'', notes:v.notes||'' }); setShowForm(true); };

  const handleSave = async () => {
    if (!user) return;
    if (!form.name || !form.registrationNumber) return toast.error('Vehicle name and registration required');
    setLoading(true);
    try {
      if (isDemo) {
        if (editing) {
          setVehicles(vehicles.map(v => v.id === editing.id ? { ...v, ...form } : v));
          toast.success('Vehicle updated (demo)');
        } else {
          const newV: Vehicle = { id: 'demo-' + Date.now(), ...form, createdAt: null as any };
          addVehicleToStore(newV);
          toast.success('Vehicle added (demo)!');
        }
      } else if (editing) {
        await updateVehicle(user.uid, editing.id, form);
        setVehicles(vehicles.map(v => v.id === editing.id ? { ...v, ...form } : v));
        toast.success('Vehicle updated');
      } else {
        const id = await addVehicle(user.uid, form);
        addVehicleToStore({ id, ...form, createdAt: null as any });
        toast.success('Vehicle added!');
      }
      setShowForm(false);
    } catch { toast.error('Failed to save vehicle'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (v: Vehicle) => {
    if (!user) return;
    setDeleting(v.id);
    try {
      if (!isDemo) await deleteVehicle(user.uid, v.id);
      removeVehicleFromStore(v.id);
      toast.success('Vehicle removed');
    } catch { toast.error('Failed to delete'); }
    finally { setDeleting(null); }
  };

  const stagger = { container: { animate: { transition: { staggerChildren: 0.07 } } }, item: { initial: { opacity:0, y:14 }, animate: { opacity:1, y:0, transition: { duration:0.38, ease:[0.22,1,0.36,1] } } } };

  return (
    <div className="min-h-screen bg-mesh">
      <div className="sticky top-0 z-20 glass-nav px-4 py-4" style={{ borderBottom:'1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale:0.88 }} onClick={() => router.back()}
              className="w-9 h-9 rounded-2xl glass flex items-center justify-center">
              <ChevronLeft size={16} style={{ color:'var(--fg)' }}/>
            </motion.button>
            <div>
              <h1 className="font-display font-800 text-xl text-white tracking-wide">MY GARAGE</h1>
              <p className="font-body text-xs" style={{ color:'var(--muted)' }}>{vehicles.length} vehicle{vehicles.length!==1?'s':''}</p>
            </div>
          </div>
          <motion.button whileTap={{ scale:0.88 }} onClick={openAdd}
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background:'var(--plasma)', boxShadow:'0 4px 18px rgba(255,69,0,0.40)' }}>
            <Plus size={18} className="text-white"/>
          </motion.button>
        </div>
      </div>

      <div className="px-4 py-6">
        {vehicles.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background:'rgba(255,69,0,0.10)' }}>
              <Car size={36} style={{ color:'var(--plasma-hi)' }}/>
            </div>
            <h2 className="font-display font-800 text-2xl text-white tracking-wide mb-2">EMPTY GARAGE</h2>
            <p className="font-body text-sm mb-8" style={{ color:'var(--muted)' }}>Add your vehicles to start booking services</p>
            <button onClick={openAdd} className="btn btn-primary text-sm">ADD VEHICLE</button>
          </div>
        ) : (
          <motion.div variants={stagger.container} initial="initial" animate="animate" className="space-y-3">
            {vehicles.map(v => (
              <motion.div key={v.id} variants={stagger.item} className="card rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background:'rgba(255,69,0,0.10)' }}>
                    <Car size={20} style={{ color:'var(--plasma-hi)' }}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-700 text-base text-white tracking-wide">{v.name}</p>
                    <p className="font-body text-xs mt-0.5" style={{ color:'var(--muted)' }}>{v.category} · {v.registrationNumber}</p>
                    {v.color && <p className="font-body text-xs mt-0.5" style={{ color:'var(--dust)' }}>{v.color}{v.notes ? ` · ${v.notes}` : ''}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.button whileTap={{ scale:0.88 }} onClick={() => openEdit(v)}
                      className="w-9 h-9 rounded-xl glass flex items-center justify-center">
                      <Edit3 size={14} style={{ color:'var(--muted)' }}/>
                    </motion.button>
                    <motion.button whileTap={{ scale:0.88 }} onClick={() => handleDelete(v)}
                      disabled={!!deleting}
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                      style={{ background:'rgba(255,59,92,0.10)' }}>
                      {deleting === v.id
                        ? <div className="w-4 h-4 ring"/>
                        : <Trash2 size={14} style={{ color:'var(--signal-red)' }}/>}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Add/Edit Sheet */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              onClick={() => setShowForm(false)}
              className="fixed inset-0 z-40" style={{ background:'rgba(0,0,0,0.80)', backdropFilter:'blur(8px)' }}/>
            <motion.div
              initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
              transition={{ type:'spring', damping:30, stiffness:320 }}
              className="fixed bottom-0 inset-x-0 z-50 rounded-t-3xl overflow-y-auto max-h-[90vh]"
              style={{ background:'var(--bg-3)', borderTop:'1px solid var(--border)' }}>
              <div className="p-5">
                <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background:'var(--border-2)' }}/>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display font-800 text-xl text-white tracking-wide">
                    {editing ? 'EDIT VEHICLE' : 'ADD VEHICLE'}
                  </h2>
                  <button onClick={() => setShowForm(false)} className="w-9 h-9 rounded-2xl glass flex items-center justify-center">
                    <X size={16} style={{ color:'var(--muted)' }}/>
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="font-body text-xs mb-1.5" style={{ color:'var(--muted)' }}>Vehicle Name *</p>
                    <input type="text" placeholder="e.g. My Maruti Swift" value={form.name} onChange={e => update('name', e.target.value)} className="input"/>
                  </div>
                  <div>
                    <p className="font-body text-xs mb-1.5" style={{ color:'var(--muted)' }}>Registration Number *</p>
                    <input type="text" placeholder="e.g. GJ01AB1234" value={form.registrationNumber} onChange={e => update('registrationNumber', e.target.value.toUpperCase())} className="input font-mono"/>
                  </div>
                  <div>
                    <p className="font-body text-xs mb-2" style={{ color:'var(--muted)' }}>Category</p>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES.map(c => (
                        <button key={c} onClick={() => update('category', c)}
                          className="px-3 py-1.5 rounded-xl font-body text-xs font-500 transition-all"
                          style={{
                            background: form.category===c ? 'var(--plasma)' : 'var(--bg-4)',
                            color: form.category===c ? 'white' : 'var(--muted)',
                            border: `1px solid ${form.category===c ? 'var(--plasma)' : 'var(--border-2)'}`,
                          }}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="font-body text-xs mb-2" style={{ color:'var(--muted)' }}>Color</p>
                    <div className="flex flex-wrap gap-2">
                      {COLORS.map(c => (
                        <button key={c} onClick={() => update('color', c)}
                          className="px-3 py-1.5 rounded-xl font-body text-xs font-500 transition-all"
                          style={{
                            background: form.color===c ? 'var(--plasma)' : 'var(--bg-4)',
                            color: form.color===c ? 'white' : 'var(--muted)',
                            border: `1px solid ${form.color===c ? 'var(--plasma)' : 'var(--border-2)'}`,
                          }}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="font-body text-xs mb-1.5" style={{ color:'var(--muted)' }}>Notes (optional)</p>
                    <input type="text" placeholder="e.g. Daily driver" value={form.notes} onChange={e => update('notes', e.target.value)} className="input"/>
                  </div>
                  <div className="pt-2 pb-6">
                    <motion.button whileTap={{ scale:0.97 }} onClick={handleSave} disabled={loading}
                      className="btn btn-primary w-full py-4 text-sm rounded-2xl">
                      {loading ? <Loader2 size={16} className="animate-spin"/> : <><Check size={16}/> {editing?'UPDATE VEHICLE':'ADD TO GARAGE'}</>}
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
