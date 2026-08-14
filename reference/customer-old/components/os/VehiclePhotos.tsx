'use client';
/**
 * The car's gallery editor (ownership fundamentals).
 *
 * The owner controls their car's photographs completely: add several at once
 * from the camera OR the library, drag them into the order they want, drop one,
 * and decide which is the cover. The first photograph is the cover - it becomes
 * the Glance's hero - so the order *is* the meaning, and dragging is the whole
 * interaction. Uploads run in parallel and each one lands as it finishes.
 *
 * Deliberately NOT `capture="environment"`: forcing the camera denied every
 * owner the photo they already had. Without it the OS offers both.
 */
import { useRef, useState } from 'react';
import { Reorder, useReducedMotion } from 'framer-motion';
import { uploadImage } from '@/lib/services/storage';
import { useOnline } from './useOnline';
import Action from './Action';
import { Body, Whisper } from './text';

interface VehiclePhotosProps {
  photos: string[];
  onChange: (next: string[]) => void;
  /** namespaces the upload path */
  uid?: string;
}

export default function VehiclePhotos({ photos, onChange, uid }: VehiclePhotosProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const online = useOnline();
  const reduced = useReducedMotion();
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // uploads resolve out of order; always append to the freshest list
  const photosRef = useRef(photos);
  photosRef.current = photos;

  const addFiles = async (files: FileList) => {
    const list = Array.from(files);
    if (!list.length) return;
    if (!online) { setError('You’re offline - reconnect to add photos.'); return; }
    setError(null);
    setPending(n => n + list.length);

    // each upload lands the moment it finishes, so the grid fills progressively
    await Promise.all(list.map(async file => {
      try {
        const { url } = await uploadImage(`vehicles/${uid ?? 'new'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, file);
        onChange([...photosRef.current, url]);
      } catch {
        setError('One photo didn’t reach us. The others are safe.');
      } finally {
        setPending(n => Math.max(0, n - 1));
      }
    }));
  };

  const remove = (url: string) => onChange(photos.filter(p => p !== url));
  const makeCover = (url: string) => onChange([url, ...photos.filter(p => p !== url)]);

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
        style={{ display: 'none' }}
      />

      {photos.length > 0 && (
        <Reorder.Group
          axis="x"
          values={photos}
          onReorder={onChange}
          as="ul"
          style={{
            display: 'flex', gap: 'var(--st-line)', listStyle: 'none',
            padding: 0, margin: '0 0 var(--st-gap)', overflowX: 'auto', scrollbarWidth: 'none',
          }}
        >
          {photos.map((url, i) => (
            <Reorder.Item
              key={url}
              value={url}
              drag={reduced ? false : 'x'}
              whileDrag={{ scale: 1.06, zIndex: 2 }}
              style={{
                position: 'relative', flex: '0 0 auto', listStyle: 'none',
                width: 108, height: 108, borderRadius: 'var(--st-r-card)',
                overflow: 'hidden', cursor: reduced ? 'default' : 'grab',
                background: 'var(--st-gallery)', touchAction: 'none',
                boxShadow: 'var(--st-hold)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url} alt={i === 0 ? 'Cover photo' : `Photo ${i + 1}`} draggable={false}
                style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
              />

              {i === 0 && (
                <span style={{
                  position: 'absolute', left: 6, bottom: 6,
                  background: 'var(--st-glass-on-photo)', color: 'var(--st-over)',
                  backdropFilter: 'var(--st-glass-blur)', WebkitBackdropFilter: 'var(--st-glass-blur)',
                  borderRadius: 'var(--st-r-pill)', padding: '3px 8px',
                  fontFamily: 'var(--st-data)', fontSize: 10, letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>
                  Cover
                </span>
              )}

              {i !== 0 && (
                <button
                  type="button"
                  onPointerDownCapture={e => e.stopPropagation()}
                  onClick={() => makeCover(url)}
                  aria-label="Make this the cover"
                  style={{
                    position: 'absolute', left: 6, bottom: 6, border: 'none', cursor: 'pointer',
                    background: 'var(--st-glass-on-photo)', color: 'var(--st-over)',
                    backdropFilter: 'var(--st-glass-blur)', WebkitBackdropFilter: 'var(--st-glass-blur)',
                    borderRadius: 'var(--st-r-pill)', padding: '3px 8px',
                    fontFamily: 'var(--st-data)', fontSize: 10, letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Cover
                </button>
              )}

              <button
                type="button"
                onPointerDownCapture={e => e.stopPropagation()}
                onClick={() => remove(url)}
                aria-label={`Remove photo ${i + 1}`}
                style={{
                  position: 'absolute', top: 6, right: 6, width: 26, height: 26,
                  display: 'grid', placeItems: 'center', border: 'none', cursor: 'pointer',
                  borderRadius: 999, color: 'var(--st-over)',
                  background: 'var(--st-glass-on-photo)',
                  backdropFilter: 'var(--st-glass-blur)', WebkitBackdropFilter: 'var(--st-glass-blur)',
                }}
              >
                <svg aria-hidden width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </Reorder.Item>
          ))}

          {pending > 0 && (
            <li style={{
              flex: '0 0 auto', width: 108, height: 108, borderRadius: 'var(--st-r-card)',
              display: 'grid', placeItems: 'center', listStyle: 'none',
            }} className="st-skeleton">
              <Whisper>{pending}</Whisper>
            </li>
          )}
        </Reorder.Group>
      )}

      {photos.length === 0 && pending > 0 && (
        <div className="st-skeleton" style={{
          width: 108, height: 108, borderRadius: 'var(--st-r-card)',
          display: 'grid', placeItems: 'center', marginBottom: 'var(--st-gap)',
        }}>
          <Whisper>{pending}</Whisper>
        </div>
      )}

      <Action onClick={() => fileRef.current?.click()} loading={pending > 0 && photos.length === 0}>
        {photos.length ? 'Add more photos' : 'Add photos'}
      </Action>

      <Whisper style={{ marginTop: 'var(--st-hair)' }}>
        {photos.length > 1
          ? 'Drag to reorder - the first is your home screen.'
          : 'Camera or library. A front three-quarter, in good light - it becomes your home screen.'}
      </Whisper>

      {error && (
        <div role="status" aria-live="polite" style={{ marginTop: 'var(--st-breath)' }}>
          <Body tone="ink-2">{error}</Body>
        </div>
      )}
    </div>
  );
}
