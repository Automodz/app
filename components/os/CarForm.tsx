'use client';
/**
 * The car form (P2D1 §C10 moment 3 · `?sheet=car-form`).
 *
 * The car as its owner says it, its plate, and - when the studio's image
 * service is configured - its portrait. Nothing else: no colour swatches and
 * no body-type grid, because the photograph carries what a dropdown only
 * pretended to. The same form adds a car during onboarding and edits one
 * from Papers; it owns the write, the host just listens.
 */
import { useRef, useState } from 'react';
import type { Vehicle } from '@/lib/types';
import { addVehicle, updateVehicle } from '@/lib/firebaseService';
import { uploadImage } from '@/lib/services/storage';
import { useAppStore } from '@/lib/store';
import Field from './Field';
import Action from './Action';
import IdentityPlate from './IdentityPlate';
import { Title, Body, Whisper } from './text';

interface CarFormProps {
  /** pass a vehicle to edit it; omit to add one */
  editing?: Vehicle | null;
  /** onboarding words the form differently - it is the first car, not another */
  first?: boolean;
  onSaved: (vehicle: Vehicle) => void;
}

export default function CarForm({ editing, first = false, onSaved }: CarFormProps) {
  const { user, vehicles, addVehicleToStore, setVehicles } = useAppStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(editing?.name ?? '');
  const [plate, setPlate] = useState(editing?.registrationNumber ?? '');
  const [photo, setPhoto] = useState<string | undefined>(editing?.photo);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = name.trim().length > 1 && plate.trim().length > 3;

  const pickPhoto = async (file: File) => {
    setUploading(true); setError(null);
    try {
      const { url } = await uploadImage(`vehicles/${user?.uid ?? 'new'}-${Date.now()}`, file);
      setPhoto(url);
    } catch {
      // uploads are optional - the plate is a first-class portrait
      setError('That photo didn’t reach us. The car looks good without one too.');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!user || !ready) return;
    setBusy(true); setError(null);
    const data = {
      name: name.trim(),
      registrationNumber: plate.trim().toUpperCase(),
      ...(photo ? { photo } : {}),
    };
    try {
      if (editing) {
        await updateVehicle(user.uid, editing.id, data);
        const next = { ...editing, ...data };
        setVehicles(vehicles.map(v => (v.id === editing.id ? next : v)));
        onSaved(next);
      } else {
        const id = await addVehicle(user.uid, data as Omit<Vehicle, 'id' | 'createdAt'>);
        const next = { ...data, id } as Vehicle;
        addVehicleToStore(next);
        onSaved(next);
      }
    } catch {
      setError('That didn’t reach the studio - try again.');
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 'var(--st-inset)', paddingBottom: 'var(--st-breath)' }}>
      <Title>{editing ? 'The car' : first ? 'The car' : 'Another car'}</Title>

      <Field
        label="What is it?"
        value={name}
        onChange={setName}
        placeholder="Mercedes-AMG C 43"
        autoFocus
      />
      <Field
        label="Registration"
        value={plate}
        onChange={setPlate}
        placeholder="GJ01AB1234"
        kind="data"
      />

      {(name.trim().length > 1 || plate.trim().length > 3) && (
        <div style={{ position: 'relative', aspectRatio: '3 / 2', borderRadius: 'var(--st-r-sheet)', overflow: 'hidden' }}>
          {photo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={photo} alt={`The ${name || 'car'}`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            : <IdentityPlate name={name || 'Your car'} registration={plate.trim().toUpperCase()} variant="band" />}
        </div>
      )}

      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={e => { const f = e.target.files?.[0]; if (f) pickPhoto(f); }}
          style={{ display: 'none' }}
        />
        <Action onClick={() => fileRef.current?.click()} loading={uploading}>
          {photo ? 'Change the photo' : 'Add a photo'}
        </Action>
        <Whisper style={{ marginTop: 'var(--st-hair)' }}>
          A front three-quarter, in good light - it becomes your home screen.
        </Whisper>
      </div>

      {error && <Body tone="ink-2">{error}</Body>}

      <Action
        variant="primary"
        onClick={save}
        loading={busy}
        disabled={!ready}
        disabledReason={!ready ? 'The car’s name and plate come first.' : undefined}
      >
        {editing ? 'Save' : 'Add the car'}
      </Action>
    </div>
  );
}
