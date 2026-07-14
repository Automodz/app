'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { IndianRupee, CheckCircle2 } from 'lucide-react';
import { createSellRequest } from '@/lib/firebaseService';
import PhotoUploader from '@/components/cars/PhotoUploader';
import { useAppStore } from '@/lib/store';
import type { CarPhoto } from '@/lib/types';

export default function SellCarPage() {
  const router = useRouter();
  const { user } = useAppStore();
  const [form, setForm] = useState({
    make: '', model: '', year: '', kmDriven: '', expectedPrice: '', description: '', phone: user?.phone ?? '',
  });
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<CarPhoto[]>([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const addFiles = async (added: File[]) => {
    const next = [...files, ...added].slice(0, 6);
    setFiles(next);
    setPreviews(next.map((f, i) => ({ url: URL.createObjectURL(f), path: `local-${i}` })));
  };
  const removePreview = async (photo: CarPhoto) => {
    const idx = previews.findIndex(p => p.path === photo.path);
    if (idx < 0) return;
    const next = files.filter((_, i) => i !== idx);
    setFiles(next);
    setPreviews(next.map((f, i) => ({ url: URL.createObjectURL(f), path: `local-${i}` })));
  };

  const submit = async () => {
    if (!user) { toast.error('Sign in to send a sell request'); return; }
    if (!form.make.trim() || !form.model.trim() || !Number(form.year)) {
      toast.error('Make, model and year are required'); return;
    }
    if (form.phone.replace(/\D/g, '').length < 10) { toast.error('10-digit phone required'); return; }
    setSending(true);
    try {
      await createSellRequest({
        userId: user.uid, name: user.name, phone: form.phone,
        make: form.make.trim(), model: form.model.trim(),
        year: Number(form.year), kmDriven: Number(form.kmDriven) || 0,
        expectedPrice: Number(form.expectedPrice) || undefined,
        description: form.description.trim() || undefined,
        files,
      });
      setDone(true);
    } catch (e) { console.error(e); toast.error('Could not send - try again'); }
    setSending(false);
  };

  if (done) return (
    <div className="px-5 pt-16 max-w-md mx-auto text-center">
      <CheckCircle2 size={44} className="mx-auto mb-4" style={{ color: 'var(--success)' }} />
      <h1 className="font-display font-800 text-xl mb-2" style={{ color: 'var(--chrome)' }}>REQUEST SENT</h1>
      <p className="font-body text-sm mb-8" style={{ color: 'var(--steel)' }}>
        Our team will inspect the details and call you with a valuation - usually within 24 hours.
      </p>
      <button onClick={() => router.push('/dashboard')} className="btn-ember px-8 py-3.5">Back to Home</button>
    </div>
  );

  return (
    <div className="px-5 pt-6 max-w-lg mx-auto">
      <h1 className="font-display font-800 text-2xl mb-1" style={{ color: 'var(--chrome)' }}>SELL MY CAR</h1>
      <p className="text-sm font-body mb-6" style={{ color: 'var(--steel)' }}>
        Share your car&apos;s details - we&apos;ll call back with a fair valuation.
      </p>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="data-label block mb-1">Make</label>
            <input className="input" value={form.make} onChange={e => setForm({ ...form, make: e.target.value })} placeholder="Maruti" />
          </div>
          <div>
            <label className="data-label block mb-1">Model</label>
            <input className="input" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="Swift ZXi" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="data-label block mb-1">Year</label>
            <input className="input" inputMode="numeric" maxLength={4} value={form.year}
              onChange={e => setForm({ ...form, year: e.target.value.replace(/\D/g, '') })} placeholder="2019" />
          </div>
          <div>
            <label className="data-label block mb-1">KM driven</label>
            <input className="input" inputMode="numeric" value={form.kmDriven}
              onChange={e => setForm({ ...form, kmDriven: e.target.value.replace(/\D/g, '') })} placeholder="55000" />
          </div>
        </div>
        <div>
          <label className="data-label block mb-1">Expected price (optional)</label>
          <div className="relative">
            <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--steel)' }} />
            <input className="input pl-8" inputMode="numeric" value={form.expectedPrice}
              onChange={e => setForm({ ...form, expectedPrice: e.target.value.replace(/\D/g, '') })} placeholder="450000" />
          </div>
        </div>
        <div>
          <label className="data-label block mb-1">Contact number</label>
          <input className="input" inputMode="numeric" maxLength={10} value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} placeholder="Your mobile" />
        </div>
        <div>
          <label className="data-label block mb-1">Condition & notes (optional)</label>
          <textarea className="input" rows={3} value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Single owner, full service history, new tyres…" />
        </div>
        <div>
          <label className="data-label block mb-2">Photos ({files.length}/6)</label>
          <PhotoUploader photos={previews} onUpload={addFiles} onRemove={removePreview} max={6} />
        </div>
        <button onClick={submit} disabled={sending} className="btn-ember w-full py-3.5 mt-2">
          {sending ? 'Sending…' : 'Request Valuation'}
        </button>
      </div>
    </div>
  );
}
