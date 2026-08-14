'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Car, Plus, X, Inbox, Star } from 'lucide-react';
import {
  createCarListing, updateCarListing, getAllCarListings,
  uploadListingPhotos, deleteListingPhoto,
} from '@/lib/firebaseService';
import PhotoUploader from '@/components/cars/PhotoUploader';
import { formatCurrency } from '@/lib/utils';
import { ListingVehicleLink } from '@/components/workspace/ListingVehicleLink';
import type { CarListing, CarFuel, CarTransmission, CarListingStatus, CarPhoto } from '@/lib/types';

const FUELS: CarFuel[] = ['petrol', 'diesel', 'cng', 'electric'];
const TRANSMISSIONS: CarTransmission[] = ['manual', 'automatic'];
const STATUSES: CarListingStatus[] = ['available', 'reserved', 'sold'];

const emptyForm = {
  title: '', make: '', model: '', year: '', price: '', kmDriven: '',
  fuel: 'petrol' as CarFuel, transmission: 'manual' as CarTransmission,
  ownership: '1', color: '', regNo: '', description: '', featured: false,
};

export default function AdminCarsPage() {
  const [listings, setListings] = useState<CarListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CarListing | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => { setListings(await getAllCarListings()); setLoading(false); };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (l: CarListing) => {
    setEditing(l);
    setForm({
      title: l.title, make: l.make, model: l.model, year: String(l.year),
      price: String(l.price), kmDriven: String(l.kmDriven),
      fuel: l.fuel, transmission: l.transmission, ownership: String(l.ownership),
      color: l.color, regNo: l.regNo ?? '', description: l.description, featured: l.featured,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.make.trim() || !form.model.trim() || !Number(form.year) || !Number(form.price)) {
      toast.error('Make, model, year and price are required'); return;
    }
    const title = form.title.trim() || `${form.year} ${form.make} ${form.model}`;
    const data = {
      title, make: form.make.trim(), model: form.model.trim(),
      year: Number(form.year), price: Number(form.price), kmDriven: Number(form.kmDriven) || 0,
      fuel: form.fuel, transmission: form.transmission, ownership: Number(form.ownership) || 1,
      color: form.color.trim(), description: form.description.trim(),
      featured: form.featured, active: true,
      ...(form.regNo.trim() ? { regNo: form.regNo.trim().toUpperCase() } : {}),
    };
    setSaving(true);
    try {
      if (editing) {
        await updateCarListing(editing.id, data);
        toast.success('Listing updated');
      } else {
        const id = await createCarListing({ ...data, status: 'available' });
        const created = { id, ...data, status: 'available' as const, photos: [] as CarPhoto[] };
        setEditing(created as CarListing);
        toast.success('Listing created - add photos below');
        await load();
        setSaving(false);
        return; // keep drawer open for photos
      }
      setShowForm(false); await load();
    } catch (e) { console.error(e); toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const handleUpload = async (files: File[]) => {
    if (!editing) return;
    try {
      const added = await uploadListingPhotos(editing.id, files);
      const photos = [...(editing.photos ?? []), ...added];
      await updateCarListing(editing.id, { photos });
      setEditing({ ...editing, photos });
      await load();
      toast.success(`${added.length} photo(s) added`);
    } catch (e) { console.error(e); toast.error('Upload failed - is Firebase Storage enabled?'); }
  };

  const handleRemovePhoto = async (photo: CarPhoto) => {
    if (!editing) return;
    const remaining = editing.photos.filter(p => p.path !== photo.path);
    await deleteListingPhoto(editing.id, photo, remaining);
    setEditing({ ...editing, photos: remaining });
    await load();
  };

  const setStatus = async (l: CarListing, status: CarListingStatus) => {
    await updateCarListing(l.id, { status });
    toast.success(`Marked ${status}`);
    await load();
  };

  const chip = (label: string, selected: boolean, onClick: () => void) => (
    <button key={label} onClick={onClick} className="px-3 py-2 rounded-xl data-label"
      style={{
        background: selected ? 'var(--accent-mist)' : 'var(--dark)',
        border: selected ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
        color: selected ? 'var(--ember)' : 'var(--steel)',
      }}>{label}</button>
  );

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display font-800 text-2xl" style={{ color: 'var(--chrome)' }}>CARS FOR SALE</h1>
          <p className="text-sm font-body" style={{ color: 'var(--steel)' }}>
            {listings.filter(l => l.status === 'available').length} available · showcase + leads
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/cars/leads" className="btn-ghost flex items-center gap-2 px-4 py-2.5 text-sm">
            <Inbox size={14} /> Leads
          </Link>
          <button onClick={openCreate} className="btn-ember flex items-center gap-2 px-4 py-2.5 text-sm">
            <Plus size={15} /> List a Car
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 shimmer rounded-2xl" />)}</div>
      ) : listings.length === 0 ? (
        <div className="card text-center py-14">
          <Car size={26} className="mx-auto mb-3" style={{ color: 'var(--steel)' }} />
          <p className="font-body" style={{ color: 'var(--steel)' }}>No cars listed yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((l, i) => (
            <motion.div key={l.id} initial={false} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }} className="card-dark">
              <div className="flex items-center gap-4 flex-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {l.photos[0] ? <img src={l.photos[0].url} alt="" className="w-20 h-14 rounded-xl object-cover" />
                  : <div className="w-20 h-14 rounded-xl flex items-center justify-center" style={{ background: 'var(--dark)' }}>
                      <Car size={18} style={{ color: 'var(--steel)' }} /></div>}
                <div className="flex-1 min-w-0">
                  <p className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>
                    {l.title} {l.featured && <Star size={12} className="inline" style={{ color: 'var(--ember)' }} />}
                  </p>
                  <p className="text-xs font-body mt-0.5" style={{ color: 'var(--steel)' }}>
                    {formatCurrency(l.price)} · {(l.kmDriven / 1000).toFixed(0)}k km · {l.fuel} · {l.photos.length} photos
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {STATUSES.map(s => (
                    <button key={s} onClick={() => setStatus(l, s)}
                      className="px-2.5 py-1.5 rounded-lg data-label"
                      style={{
                        background: l.status === s
                          ? s === 'available' ? 'color-mix(in srgb, var(--success) 15%, transparent)' : s === 'reserved' ? 'color-mix(in srgb, var(--steel) 15%, transparent)' : 'color-mix(in srgb, var(--danger) 15%, transparent)'
                          : 'var(--dark)',
                        color: l.status === s
                          ? s === 'available' ? 'var(--success)' : s === 'reserved' ? 'var(--steel)' : 'var(--danger)'
                          : 'var(--steel)',
                        border: '1px solid var(--border)',
                      }}>{s}</button>
                  ))}
                </div>
                <button onClick={() => openEdit(l)} className="btn-ghost px-4 py-2 text-xs">Edit</button>
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
                  {editing ? 'EDIT LISTING' : 'NEW LISTING'}
                </h2>
                <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-lg"
                  style={{ background: 'var(--dark)', color: 'var(--steel)' }}><X size={14} /></button>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="data-label block mb-1">Make</label>
                    <input className="input" value={form.make} onChange={e => setForm({ ...form, make: e.target.value })} placeholder="Hyundai" />
                  </div>
                  <div>
                    <label className="data-label block mb-1">Model</label>
                    <input className="input" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="Creta SX" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="data-label block mb-1">Year</label>
                    <input className="input" inputMode="numeric" value={form.year} onChange={e => setForm({ ...form, year: e.target.value.replace(/\D/g, '') })} placeholder="2021" />
                  </div>
                  <div>
                    <label className="data-label block mb-1">Price (₹)</label>
                    <input className="input" inputMode="numeric" value={form.price} onChange={e => setForm({ ...form, price: e.target.value.replace(/\D/g, '') })} placeholder="1250000" />
                  </div>
                  <div>
                    <label className="data-label block mb-1">KM driven</label>
                    <input className="input" inputMode="numeric" value={form.kmDriven} onChange={e => setForm({ ...form, kmDriven: e.target.value.replace(/\D/g, '') })} placeholder="42000" />
                  </div>
                </div>
                <div>
                  <label className="data-label block mb-1">Fuel</label>
                  <div className="flex gap-2 flex-wrap">
                    {FUELS.map(f => chip(f, form.fuel === f, () => setForm({ ...form, fuel: f })))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="data-label block mb-1">Transmission</label>
                    <div className="flex gap-2">
                      {TRANSMISSIONS.map(t => chip(t, form.transmission === t, () => setForm({ ...form, transmission: t })))}
                    </div>
                  </div>
                  <div>
                    <label className="data-label block mb-1">Owner #</label>
                    <div className="flex gap-2">
                      {['1', '2', '3'].map(o => chip(`${o}${o === '1' ? 'st' : o === '2' ? 'nd' : 'rd'}`, form.ownership === o, () => setForm({ ...form, ownership: o })))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="data-label block mb-1">Colour</label>
                    <input className="input" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} placeholder="Polar White" />
                  </div>
                  <div>
                    <label className="data-label block mb-1">Reg no (private)</label>
                    <input className="input uppercase" value={form.regNo} onChange={e => setForm({ ...form, regNo: e.target.value.toUpperCase() })} placeholder="GJ01AB1234" />
                  </div>
                </div>
                <div>
                  <label className="data-label block mb-1">Description</label>
                  <textarea className="input" rows={3} value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Condition, service history, highlights…" />
                </div>
                <button onClick={() => setForm({ ...form, featured: !form.featured })}
                  className="flex items-center justify-between w-full px-3 py-3 rounded-xl"
                  style={{ background: 'var(--dark)', border: '1px solid var(--border)' }}>
                  <span className="text-sm font-body" style={{ color: 'var(--chrome)' }}>Featured (shown first)</span>
                  <span className="data-label" style={{ color: form.featured ? 'var(--ember)' : 'var(--steel)' }}>
                    {form.featured ? 'ON' : 'OFF'}
                  </span>
                </button>

                {editing && (
                  <div>
                    <label className="data-label block mb-2">Photos ({editing.photos?.length ?? 0}/8)</label>
                    <PhotoUploader photos={editing.photos ?? []} onUpload={handleUpload} onRemove={handleRemovePhoto} />
                  </div>
                )}

                {/* WHICH CAR IN WHICH GARAGE - design screen 17's "Its record
                    with us". Linking says which car; it does NOT grant
                    permission to publish anything. Consent belongs to the car
                    and only its owner may give it. */}
                {editing && <ListingVehicleLink listing={editing} onLinked={load} />}

                <button onClick={handleSave} disabled={saving} className="btn-ember w-full py-3 mt-1">
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create & Add Photos'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
