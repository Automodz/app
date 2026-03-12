'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Car, Edit3, Trash2, X, Check, Loader2, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { addVehicle, updateVehicle, deleteVehicle, getVehicles } from '@/lib/firebaseService';
import { useAppStore } from '@/lib/store';
import type { Vehicle } from '@/lib/types';
import { formatDate } from '@/lib/utils';

const CATEGORIES: Vehicle['category'][] = ['Hatchback', 'Sedan', 'Compact SUV', 'Full SUV', 'Luxury'];
const COLORS = ['White', 'Black', 'Silver', 'Grey', 'Red', 'Blue', 'Brown', 'Green', 'Orange', 'Yellow', 'Other'];
const emptyForm = { name: '', registrationNumber: '', category: 'Sedan' as Vehicle['category'], color: '', notes: '' };

export default function VehiclesPage() {
  const router = useRouter();
  const { user, vehicles, addVehicleToStore, removeVehicleFromStore, setVehicles, bookings } = useAppStore();
  const isDemo = user?.role === 'demo';

  // Refresh from Firestore every time this page is opened
  useEffect(() => {
    if (!user || isDemo) return;
    getVehicles(user.uid).then(setVehicles).catch(() => {});
  }, [user?.uid]);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Vehicle | null>(null);
  const [form, setForm]         = useState(emptyForm);
  const [loading, setLoading]   = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const update   = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const openAdd  = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (v: Vehicle) => {
    setEditing(v);
    setForm({ name: v.name, registrationNumber: v.registrationNumber, category: v.category, color: v.color || '', notes: v.notes || '' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.name.trim() || !form.registrationNumber.trim()) {
      toast.error('Vehicle name and registration are required.');
      return;
    }
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
    } catch {
      toast.error('Failed to save vehicle. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (v: Vehicle) => {
    if (!user) return;
    setDeleting(v.id);
    try {
      if (!isDemo) await deleteVehicle(user.uid, v.id);
      removeVehicleFromStore(v.id);
      toast.success('Vehicle removed');
    } catch {
      toast.error('Failed to delete vehicle.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--void)' }}>

      {/* Header */}
      <div className="sticky top-0 z-20 glass-nav px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.88 }} onClick={() => router.back()}
              className="w-9 h-9 rounded-2xl card flex items-center justify-center">
              <ChevronLeft size={16} style={{ color: 'var(--pewter)' }} />
            </motion.button>
            <div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', color: 'var(--chrome)', letterSpacing: '0.06em' }}>
                MY GARAGE
              </h1>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--muted)', marginTop: '1px' }}>
                {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.88 }} onClick={openAdd}
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--ember)', boxShadow: '0 4px 18px rgba(255,69,0,0.40)' }}>
            <Plus size={18} style={{ color: 'white' }} />
          </motion.button>
        </div>
      </div>

      <div className="px-4 py-6">
        {vehicles.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-float"
              style={{ background: 'rgba(255,69,0,0.10)' }}>
              <Car size={36} style={{ color: 'var(--ember)' }} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '24px', color: 'var(--chrome)', letterSpacing: '0.06em', marginBottom: '8px' }}>
              EMPTY GARAGE
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--muted)', marginBottom: '32px' }}>
              Add your vehicles to start booking services
            </p>
            <button onClick={openAdd} className="btn-ember rounded-xl px-8 py-3">
              ADD VEHICLE
            </button>
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.07 } } }}
            className="space-y-3">
            {vehicles.map(v => {
              const history = bookings
                .filter(b => b.vehicleId === v.id)
                .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
              const last = history[0];

              return (
              <motion.div
                key={v.id}
                variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } } }}
                className="card rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(255,69,0,0.10)' }}>
                    <Car size={20} style={{ color: 'var(--ember)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', color: 'var(--chrome)', letterSpacing: '0.03em' }}>
                      {v.name}
                    </p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                      {v.category} · {v.registrationNumber}
                    </p>
                    {last && (
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--steel)', marginTop: '2px' }}>
                        Last: {last.serviceName} · {formatDate(last.scheduledDate)}
                      </p>
                    )}
                    {v.color && (
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--steel)', marginTop: '2px' }}>
                        {v.color}{v.notes ? ` · ${v.notes}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.button whileTap={{ scale: 0.88 }} onClick={() => openEdit(v)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: 'var(--cavern)', border: '1px solid var(--border)' }}>
                      <Edit3 size={14} style={{ color: 'var(--muted)' }} />
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.88 }} onClick={() => handleDelete(v)}
                      disabled={!!deleting}
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                      style={{ background: 'rgba(255,59,92,0.10)', border: '1px solid rgba(255,59,92,0.15)' }}>
                      {deleting === v.id
                        ? <div className="w-4 h-4 loader-ring" />
                        : <Trash2 size={14} style={{ color: 'var(--signal-red)' }} />}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            );})}
          </motion.div>
        )}
      </div>

      {/* Add / Edit bottom sheet */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(8px)' }} />

            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="fixed bottom-0 inset-x-0 z-50 rounded-t-3xl overflow-y-auto max-h-[92vh]"
              style={{ background: 'var(--deep)', borderTop: '1px solid var(--border-2)' }}>

              <div className="p-5">
                <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--border-2)' }} />
                <div className="flex items-center justify-between mb-6">
                  <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', color: 'var(--chrome)', letterSpacing: '0.06em' }}>
                    {editing ? 'EDIT VEHICLE' : 'ADD VEHICLE'}
                  </h2>
                  <button onClick={() => setShowForm(false)}
                    className="w-9 h-9 rounded-2xl flex items-center justify-center"
                    style={{ background: 'var(--cavern)', border: '1px solid var(--border)' }}>
                    <X size={16} style={{ color: 'var(--muted)' }} />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Name */}
                  <div>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em', color: 'var(--faint)', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Vehicle Name *
                    </p>
                    <input type="text" placeholder="e.g. My Maruti Swift"
                      value={form.name} onChange={e => update('name', e.target.value)}
                      className="input" />
                  </div>

                  {/* Registration */}
                  <div>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em', color: 'var(--faint)', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Registration Number *
                    </p>
                    <input type="text" placeholder="e.g. GJ01AB1234"
                      value={form.registrationNumber}
                      onChange={e => update('registrationNumber', e.target.value.toUpperCase())}
                      className="input"
                      style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }} />
                  </div>

                  {/* Category */}
                  <div>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em', color: 'var(--faint)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Category
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES.map(c => (
                        <button key={c} onClick={() => update('category', c)}
                          className="px-3 py-1.5 rounded-xl transition-all"
                          style={{
                            background:  form.category === c ? 'var(--ember)' : 'var(--cavern)',
                            color:       form.category === c ? 'white' : 'var(--muted)',
                            border:      `1px solid ${form.category === c ? 'var(--ember)' : 'var(--border-2)'}`,
                            fontFamily:  'var(--font-body)',
                            fontSize:    '12px',
                            fontWeight:  500,
                            boxShadow:   form.category === c ? '0 2px 10px rgba(255,69,0,0.3)' : 'none',
                          }}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color */}
                  <div>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em', color: 'var(--faint)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Color
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {COLORS.map(c => (
                        <button key={c} onClick={() => update('color', c)}
                          className="px-3 py-1.5 rounded-xl transition-all"
                          style={{
                            background: form.color === c ? 'var(--ember)' : 'var(--cavern)',
                            color:      form.color === c ? 'white' : 'var(--muted)',
                            border:     `1px solid ${form.color === c ? 'var(--ember)' : 'var(--border-2)'}`,
                            fontFamily: 'var(--font-body)',
                            fontSize:   '12px',
                            fontWeight:  500,
                            boxShadow:  form.color === c ? '0 2px 10px rgba(255,69,0,0.3)' : 'none',
                          }}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em', color: 'var(--faint)', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Notes (optional)
                    </p>
                    <input type="text" placeholder="e.g. Daily driver"
                      value={form.notes} onChange={e => update('notes', e.target.value)}
                      className="input" />
                  </div>

                  {/* Submit */}
                  <div className="pt-2 pb-6">
                    <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={loading}
                      className="btn-ember w-full py-4 rounded-2xl flex items-center justify-center gap-2">
                      {loading
                        ? <Loader2 size={16} className="animate-spin" />
                        : <><Check size={16} /> {editing ? 'UPDATE VEHICLE' : 'ADD TO GARAGE'}</>}
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