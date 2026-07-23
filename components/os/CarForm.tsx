'use client';
/**
 * The car form (P2D1 §C10 moment 3 · `?sheet=car-form`).
 *
 * The car as its owner says it, its plate, and - when the studio's image
 * service is configured - its portrait. Nothing else: no colour swatches and
 * no body-type grid, because the photograph carries what a dropdown only
 * pretended to. The same form adds a car during onboarding and edits one
 * from Papers; it owns the write, the host just listens.
 *
 * It also owns the honesty of that write: a plate is validated forgivingly,
 * a car already in the garage is never added twice, offline is declined
 * calmly, and a first car is welcomed in with a brief beat before the Glance
 * assembles over it.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { Vehicle } from '@/lib/types';
import { addVehicle, updateVehicle } from '@/lib/firebaseService';
import { uploadImage } from '@/lib/services/storage';
import { useAppStore } from '@/lib/store';
import { isDevUser } from '@/lib/cx/devseed';
import { useOnline } from './useOnline';
import { rise } from '@/lib/os/motion';
import Field from './Field';
import Action from './Action';
import IdentityPlate from './IdentityPlate';
import { Title, Display, Body, Whisper } from './text';

interface CarFormProps {
  /** pass a vehicle to edit it; omit to add one */
  editing?: Vehicle | null;
  /** onboarding words the form differently - it is the first car, not another */
  first?: boolean;
  onSaved: (vehicle: Vehicle) => void;
}

/** A plate as the whole system keys it: no spaces, upper case (matches normReg). */
const normPlate = (p: string) => p.replace(/\s+/g, '').toUpperCase();
/** Forgiving of every real Indian format (GJ01AB1234, 22BH1234AA): alphanumeric,
 *  plausible length, and carrying both a letter and a digit. */
const plateLooksReal = (p: string) =>
  /^[A-Z0-9]{4,12}$/.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p);

export default function CarForm({ editing, first = false, onSaved }: CarFormProps) {
  const { user, vehicles, addVehicleToStore, setVehicles } = useAppStore();
  const online = useOnline();
  const reduced = useReducedMotion();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(editing?.name ?? '');
  const [plate, setPlate] = useState(editing?.registrationNumber ?? '');
  const [photo, setPhoto] = useState<string | undefined>(editing?.photo);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [plateErr, setPlateErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<Vehicle | null>(null);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  // both fields have something in them - the button wakes, the studio checks
  // the particulars on submit rather than scolding mid-keystroke
  const ready = name.trim().length > 0 && plate.trim().length > 0;

  // editing an existing plate to one you already own is a duplicate too
  const duplicate = (p: string) =>
    vehicles.some(v => v.id !== editing?.id && normPlate(v.registrationNumber) === p);

  const editName = (v: string) => { setName(v); if (nameErr) setNameErr(null); };
  const editPlate = (v: string) => { setPlate(v); if (plateErr) setPlateErr(null); if (error) setError(null); };

  const validate = (): boolean => {
    let ok = true;
    if (name.trim().length < 2) { setNameErr('The car needs a name — “Mercedes-AMG C 43”.'); ok = false; }
    const p = normPlate(plate);
    if (!plateLooksReal(p)) { setPlateErr('That doesn’t look like a plate yet.'); ok = false; }
    else if (duplicate(p)) { setPlateErr(`The ${p} is already in your garage.`); ok = false; }
    return ok;
  };

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
    if (!user || busy) return;
    if (!validate()) return;
    if (!online) { setError('You’re offline — reconnect to add the car.'); return; }

    setBusy(true); setError(null);
    const data = {
      name: name.trim(),
      registrationNumber: normPlate(plate),
      ...(photo ? { photo } : {}),
    };

    // a new car earns a beat before the Glance assembles over it; an edit is
    // quiet and hands straight back
    const landAdded = (next: Vehicle) => {
      addVehicleToStore(next);
      if (reduced) onSaved(next); else setSaved(next);
    };

    try {
      if (editing) {
        await updateVehicle(user.uid, editing.id, data);
        const next = { ...editing, ...data };
        setVehicles(vehicles.map(v => (v.id === editing.id ? next : v)));
        onSaved(next);
      } else {
        const id = await addVehicle(user.uid, data as Omit<Vehicle, 'id' | 'createdAt'>);
        landAdded({ ...data, id } as Vehicle);
      }
    } catch {
      // dev-preview has no real Firestore session (parity with the booking
      // flows): seed the write locally so onboarding is exercisable
      if (isDevUser(user.uid)) {
        if (editing) {
          const next = { ...editing, ...data };
          setVehicles(vehicles.map(v => (v.id === editing.id ? next : v)));
          onSaved(next);
        } else {
          landAdded({ ...data, id: `dev-${Date.now()}` } as Vehicle);
        }
        return;
      }
      setError('That didn’t reach the studio — try again.');
      setBusy(false);
    }
  };

  // the success beat: hold the confirmation, then hand the car to the host
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => onSavedRef.current(saved), 900);
    return () => clearTimeout(t);
  }, [saved]);

  if (saved) {
    return (
      <motion.div
        {...rise}
        role="status"
        aria-live="polite"
        style={{ display: 'grid', gap: 'var(--st-inset)', paddingBottom: 'var(--st-breath)', textAlign: 'center', justifyItems: 'center' }}
      >
        <div style={{ width: '100%', position: 'relative', aspectRatio: '3 / 2', borderRadius: 'var(--st-r-sheet)', overflow: 'hidden' }}>
          {saved.photo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={saved.photo} alt={`The ${saved.name}`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            : <IdentityPlate name={saved.name} registration={saved.registrationNumber} variant="band" />}
        </div>
        <Display style={{ fontSize: 'clamp(24px, 7vw, 32px)' }}>The {saved.name} is in.</Display>
        <Body tone="ink-2">Welcome to the garage.</Body>
      </motion.div>
    );
  }

  const showPreview = name.trim().length > 1 || normPlate(plate).length > 3;

  return (
    <form
      onSubmit={e => { e.preventDefault(); save(); }}
      style={{ display: 'grid', gap: 'var(--st-inset)', paddingBottom: 'var(--st-breath)' }}
    >
      <Title>{editing ? 'The car' : first ? 'The car' : 'Another car'}</Title>

      <Field
        label="What is it?"
        value={name}
        onChange={editName}
        placeholder="Mercedes-AMG C 43"
        autoFocus
        autoCapitalize="words"
        autoComplete="off"
        enterKeyHint="next"
        error={nameErr ?? undefined}
      />
      <Field
        label="Registration"
        value={plate}
        onChange={editPlate}
        placeholder="GJ01AB1234"
        kind="data"
        autoCapitalize="characters"
        autoComplete="off"
        enterKeyHint="done"
        maxLength={14}
        error={plateErr ?? undefined}
      />

      {showPreview && (
        <div style={{ position: 'relative', aspectRatio: '3 / 2', borderRadius: 'var(--st-r-sheet)', overflow: 'hidden' }}>
          {photo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={photo} alt={`The ${name || 'car'}`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            : <IdentityPlate name={name || 'Your car'} registration={normPlate(plate)} variant="band" />}
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

      {error && (
        <div role="status" aria-live="polite">
          <Body tone="ink-2">{error}</Body>
        </div>
      )}

      <Action
        type="submit"
        variant="primary"
        loading={busy}
        disabled={!ready}
        disabledReason={!ready ? 'The car’s name and plate come first.' : undefined}
      >
        {editing ? 'Save' : 'Add the car'}
      </Action>
    </form>
  );
}
