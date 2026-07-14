'use client';
import { useRef, useState } from 'react';
/* eslint-disable @next/next/no-img-element */
import { ImagePlus, X, Loader2 } from 'lucide-react';
import type { CarPhoto } from '@/lib/types';

interface PhotoUploaderProps {
  photos: CarPhoto[];
  onUpload: (files: File[]) => Promise<void>;
  onRemove?: (photo: CarPhoto) => Promise<void>;
  max?: number;
}

export default function PhotoUploader({ photos, onUpload, onRemove, max = 8 }: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    const files = Array.from(list).slice(0, max - photos.length);
    if (!files.length) return;
    setBusy(true);
    try { await onUpload(files); } finally { setBusy(false); }
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {photos.map(p => (
          <div key={p.path} className="relative aspect-square rounded-xl overflow-hidden"
            style={{ background: 'var(--dark)' }}>
            <img src={p.url} alt="" className="w-full h-full object-cover" />
            {onRemove && (
              <button onClick={() => onRemove(p)}
                className="absolute top-1 right-1 w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(5,5,7,0.8)', color: '#F87171' }}>
                <X size={11} />
              </button>
            )}
          </div>
        ))}
        {photos.length < max && (
          <button onClick={() => inputRef.current?.click()} disabled={busy}
            className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1"
            style={{ background: 'var(--dark)', border: '1px dashed var(--border)', color: 'var(--steel)' }}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
            <span className="data-label">{busy ? 'Uploading' : 'Add'}</span>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden
        onChange={e => handleFiles(e.target.files)} />
    </div>
  );
}
