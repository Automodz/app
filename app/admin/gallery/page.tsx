'use client';
import { useEffect, useRef, useState } from 'react';
/* eslint-disable @next/next/no-img-element */
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ImagePlus, Trash2, Loader2, Images } from 'lucide-react';
import { addGalleryImage, deleteGalleryImage, getGalleryImages, type GalleryImage } from '@/lib/firebaseService';

const CATEGORIES = ['PPF', 'Ceramic', 'Coating', 'Washing', 'Other'];

export default function AdminGalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState('PPF');
  const [caption, setCaption] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => { setImages(await getGalleryImages(false)); setLoading(false); };
  useEffect(() => { load(); }, []);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 6)) {
        await addGalleryImage(file, category, caption || undefined);
      }
      toast.success('Added to gallery');
      setCaption('');
      await load();
    } catch (e) { console.error(e); toast.error('Upload failed - check image hosting setup'); }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = async (img: GalleryImage) => {
    await deleteGalleryImage(img);
    toast.success('Removed');
    await load();
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display font-800 text-2xl" style={{ color: 'var(--chrome)' }}>GALLERY</h1>
        <p className="text-sm font-body" style={{ color: 'var(--steel)' }}>
          Showcase your best work - appears on the public landing page.
        </p>
      </div>

      {/* Upload toolbar — one calm row set; never overflows, never wraps the CTA */}
      <div className="card mb-6 overflow-hidden">
        <div className="flex gap-1.5 overflow-x-auto no-scroll pb-3 -mx-1 px-1">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className="shrink-0 px-3.5 rounded-xl data-label transition-colors"
              style={{
                minHeight: 40,
                background: category === c ? 'var(--accent-mist)' : 'var(--dark)',
                border: category === c ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
                color: category === c ? 'var(--ember)' : 'var(--steel)',
              }}>{c}</button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input className="input w-full sm:flex-1 min-w-0 text-sm" value={caption} onChange={e => setCaption(e.target.value)}
            placeholder="Caption (optional) — e.g. Full-body PPF on Thar" />
          <button onClick={() => inputRef.current?.click()} disabled={uploading}
            className="btn-ember flex items-center justify-center gap-2 px-5 py-3 text-sm shrink-0 whitespace-nowrap">
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
            {uploading ? 'Uploading…' : 'Upload photos'}
          </button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={e => handleFiles(e.target.files)} />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <div key={i} className="aspect-square shimmer rounded-2xl" />)}
        </div>
      ) : images.length === 0 ? (
        <div className="card text-center py-14">
          <Images size={26} className="mx-auto mb-3" style={{ color: 'var(--steel)' }} />
          <p className="font-body" style={{ color: 'var(--steel)' }}>No photos yet - upload your best before/after shots.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {images.map((img, i) => (
            <motion.div key={img.id} initial={false} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }} className="relative rounded-2xl overflow-hidden group aspect-square"
              style={{ background: 'var(--dark)' }}>
              <img src={img.url} alt={img.caption ?? ''} className="w-full h-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 p-2 flex items-end justify-between"
                style={{ background: 'linear-gradient(transparent, rgba(5,5,7,0.85))' }}>
                <div>
                  <p className="data-label" style={{ color: 'var(--ember)' }}>{img.category}</p>
                  {img.caption && <p className="text-xs font-body" style={{ color: 'white' }}>{img.caption}</p>}
                </div>
                <button onClick={() => remove(img)} aria-label="Remove photo"
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--danger) 20%, transparent)', color: 'var(--danger)' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
