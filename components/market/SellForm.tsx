'use client';
/**
 * THE OFFER FORM.
 *
 * Photographs go through `uploadImage` — the same signed-upload path the
 * Garage and the studio use, which asks the server for a signature bound to
 * one `public_id` under `sellRequests/{uid}/`. There is no second uploader
 * here and no unsigned preset.
 *
 * The submission itself goes to `POST /api/cars/sell`; nothing is written to
 * Firestore from the browser, because the studio has to be told and a client
 * write cannot guarantee that.
 */
import { useState } from 'react';
import { Photograph } from '@/components/os/Photograph';
import { authedFetch, currentUid } from '@/lib/clientSession';
import { useRouter } from 'next/navigation';
import { color, space, radius, HAIRLINE } from '@/design';
import { Heading, Text, Button } from '@/components/system';
import type { CarPhoto } from '@/lib/types';

const MAX_PHOTOS = 6;

export function SellForm({ garage }: { garage: { id: string; name: string }[] }) {
  const router = useRouter();
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [km, setKm] = useState('');
  const [price, setPrice] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<CarPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* One of the customer's own cars fills the three fields it can answer. The
     year is not stored on a garage vehicle, so it stays for them to type. */
  const fillFrom = (label: string) => {
    const [first, ...rest] = label.trim().split(' ');
    setMake(first ?? '');
    setModel(rest.join(' '));
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setUploading(true);
    try {
      const { uploadImage } = await import('@/lib/services/storage');
      const uid = await currentUid();
      if (!uid) throw new Error('signed-out');

      const room = Math.max(0, MAX_PHOTOS - photos.length);
      const next: CarPhoto[] = [];
      for (const file of Array.from(files).slice(0, room)) {
        next.push(await uploadImage(
          `sellRequests/${uid}/${crypto.randomUUID()}`, file,
        ));
      }
      setPhotos(p => [...p, ...next]);
    } catch (e) {
      /* A file too large to decode is a different fact from a failed upload,
         and only one of them the customer can do anything about. */
      setError(e instanceof Error && e.message === 'file-too-large'
        ? 'One of those is too large. Pick a smaller photograph.'
        : 'Those photographs didn’t upload. You can send the car without them.');
    } finally {
      setUploading(false);
    }
  };

  const send = async () => {
    setError(null);
    if (!make.trim() || !model.trim()) return setError('Which car is it?');
    if (!/^\d{4}$/.test(year.trim())) return setError('Which year is it?');
    if (!name.trim()) return setError('We need a name to come back to.');
    if (phone.replace(/\D/g, '').length < 10) return setError('That number looks short.');

    setSending(true);
    try {
      
      const res = await authedFetch('/api/cars/sell', {
        method: 'POST',
        body: JSON.stringify({
          make, model,
          year: Number(year),
          kmDriven: Number(km || 0),
          expectedPrice: price ? Number(price) : undefined,
          description: description || undefined,
          name, phone, photos,
        }),
      });
      if (!res.ok) throw new Error('failed');
      setSent(true);
      /* The offer joins the list above without a reload. */
      router.refresh();
    } catch (e) {
      setError(e instanceof Error && e.message === 'signed-out'
        ? 'Sign in again and we will take it from there.'
        : 'That didn’t send. Try again, or message the studio.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div style={{ marginTop: space.gap }}>
        <Heading level="title">We have it</Heading>
        <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
          Someone will look at the {year} {make} {model} and come back to you on
          {' '}{phone}.
        </Text>
        <div style={{ marginTop: space.gap }}>
          <Button tier="quiet" onClick={() => { setSent(false); setMake(''); setModel('');
            setYear(''); setKm(''); setPrice(''); setDescription(''); setPhotos([]); }}>
            Offer another car
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: space.gap }}>
      {garage.length > 0 ? (
        <div style={{ marginBottom: space.gap }}>
          <Text role="whisper" tone="ink3">One of yours?</Text>
          <div style={{ display: 'flex', gap: space.breath, flexWrap: 'wrap',
            marginTop: space.hair }}>
            {garage.map(v => (
              <Button key={v.id} tier="quiet" onClick={() => fillFrom(v.name)}>
                {v.name}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <Field label="Make" value={make} onChange={setMake} />
      <Field label="Model" value={model} onChange={setModel} />
      <Field label="Year" value={year} onChange={setYear} inputMode="numeric" />
      <Field label="Kilometres driven" value={km} onChange={setKm} inputMode="numeric" />
      <Field label="What you want for it (optional)" value={price}
        onChange={setPrice} inputMode="numeric" />
      <Field label="Anything we should know" value={description}
        onChange={setDescription} multiline />
      <Field label="Your name" value={name} onChange={setName} autoComplete="name" />
      <Field label="Phone" value={phone} onChange={setPhone}
        inputMode="numeric" autoComplete="tel" />

      <div style={{ marginTop: space.gap }}>
        <Text role="whisper" tone="ink3">
          Photographs ({photos.length} of {MAX_PHOTOS})
        </Text>
        <div style={{ display: 'flex', gap: space.breath, flexWrap: 'wrap',
          marginTop: space.hair, alignItems: 'center' }}>
          {photos.map(p => (
            <div key={p.path} style={{ position: 'relative' }}>
              {/* Deliberately not next/image: a just-uploaded Cloudinary URL is
                  not in the configured remote patterns until the page reloads,
                  and the optimiser would refuse it. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span style={{ position: 'relative', display: 'block', width: 72, height: 54 }}>
                <Photograph src={p.url} alt="" sizes="72px" radius={radius.chip} />
              </span>
              <button
                type="button"
                onClick={() => setPhotos(list => list.filter(x => x.path !== p.path))}
                aria-label="Remove this photograph"
                style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 24, height: 24, borderRadius: radius.pill,
                  border: 'none', background: color.ink, color: color.paper,
                  cursor: 'pointer', lineHeight: '24px', padding: 0,
                }}
              >×</button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS ? (
            <label style={{
              minHeight: 44, display: 'inline-flex', alignItems: 'center',
              paddingInline: space.gap, borderRadius: radius.chip,
              border: `${HAIRLINE}px solid ${color.edge}`, cursor: 'pointer',
              color: color.ink2, fontSize: 14,
            }}>
              {uploading ? 'Adding…' : 'Add photographs'}
              <input type="file" accept="image/*" multiple hidden
                disabled={uploading}
                onChange={e => { void addPhotos(e.target.files); e.target.value = ''; }} />
            </label>
          ) : null}
        </div>
      </div>

      {error ? (
        <Text role="body" tone="ink" style={{ marginTop: space.gap }}>{error}</Text>
      ) : null}

      <div style={{ marginTop: space.gap }}>
        <Button tier="forward" onClick={send} disabled={sending || uploading}>
          {sending ? 'Sending…' : 'Offer us this car'}
        </Button>
      </div>
    </div>
  );
}

function Field(
  { label, value, onChange, multiline, ...rest }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    multiline?: boolean;
    inputMode?: 'numeric';
    autoComplete?: string;
  },
) {
  const style = {
    width: '100%',
    minHeight: 48,
    marginTop: space.hair,
    padding: space.breath,
    borderRadius: radius.chip,
    border: `${HAIRLINE}px solid ${color.edge}`,
    background: 'transparent',
    color: color.ink,
    /* 16px or larger, or iOS zooms the page when the field takes focus. */
    fontSize: 17,
    outline: 'none',
  } as const;

  return (
    <label style={{ display: 'block', marginTop: space.gap }}>
      <Text role="whisper" tone="ink3" as="span">{label}</Text>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
          style={{ ...style, resize: 'vertical' }} {...rest} />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)}
          style={style} {...rest} />
      )}
    </label>
  );
}
