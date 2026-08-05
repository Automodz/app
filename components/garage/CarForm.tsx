'use client';
/**
 * THE CAR FORM — add a car, or correct one.
 *
 * Source: reference/customer-old/components/os/CarForm.tsx
 *         docs/AUTOMODZ-OS-ARCHITECTURE.md §1, §6
 *
 * WRITES THROUGH THE EXISTING SERVICES. `addVehicle` and `updateVehicle` in
 * `lib/services/vehicles` are unchanged and unwrapped — this is a form, not a
 * second data layer. Every validation rule below is ported from the old form,
 * including the duplicate-plate check, because a customer with two records for
 * one car has two histories for one car.
 *
 * It is a CLIENT ISLAND. The Garage renders on the server and stays there; only
 * this needs a browser session, so only this carries one. That is why it lives
 * in `components/garage/` rather than `components/screens/` — it is not a
 * renderer of a projection, it is an act.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { addVehicle, updateVehicle } from '@/lib/services/vehicles';
import type { Vehicle } from '@/lib/types';
import { BottomSheet, Heading, Text, Button } from '@/components/system';
import {
  color, space, INSET, MEASURE, HAIRLINE, TARGET_MIN, radius,
  type as typeScale,
} from '@/design';

/** One plate, one shape — so two spellings of the same car cannot both exist. */
const normPlate = (s: string) => s.toUpperCase().replace(/\s+/g, ' ').trim();

export interface CarFormProps {
  open: boolean;
  onClose: () => void;
  /** The car being corrected, or null when this is a new one. */
  editing?: Vehicle | null;
}

export function CarForm({ open, onClose, editing = null }: CarFormProps) {
  const router = useRouter();
  const { user, vehicles, addVehicleToStore, updateVehicleInStore } = useAppStore();

  const [name, setName] = useState('');
  const [plate, setPlate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [plateErr, setPlateErr] = useState<string | null>(null);

  /* Reopening on a different car must not show the previous car's answers. */
  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setPlate(editing?.registrationNumber ?? '');
    setError(null);
    setNameErr(null);
    setPlateErr(null);
  }, [open, editing]);

  const duplicate = (p: string) =>
    vehicles.some(v => v.id !== editing?.id && normPlate(v.registrationNumber) === p);

  const save = async () => {
    if (!user) return;

    let ok = true;
    if (name.trim().length < 2) {
      setNameErr('The car needs a name — “Mercedes-AMG C 43”.');
      ok = false;
    }
    const p = normPlate(plate);
    if (p.length < 4) {
      setPlateErr('The registration, as it reads on the plate.');
      ok = false;
    } else if (duplicate(p)) {
      setPlateErr('That car is already in your garage.');
      ok = false;
    }
    if (!ok) return;

    setBusy(true);
    setError(null);
    try {
      const data = { name: name.trim(), registrationNumber: p };
      if (editing) {
        await updateVehicle(user.uid, editing.id, data);
        updateVehicleInStore(editing.id, data);
      } else {
        const id = await addVehicle(user.uid, data as Omit<Vehicle, 'id' | 'createdAt'>);
        addVehicleToStore({ ...data, id } as Vehicle);
      }
      onClose();
      /* The Garage renders on the server, so the new car only appears once the
         server has been asked again. */
      router.refresh();
    } catch {
      setError('That didn’t save. Your connection, most likely — try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} label={editing ? 'Correct the car' : 'Add a car'}>
      <form
        onSubmit={e => { e.preventDefault(); void save(); }}
        style={{
          paddingInline: INSET,
          maxWidth: MEASURE + INSET * 2,
          marginInline: 'auto',
          width: '100%',
        }}
      >
        <Heading level="title">{editing ? 'Correct the car' : 'Add your car'}</Heading>

        <div style={{ marginTop: INSET, display: 'grid', gap: space.gap }}>
          <Field
            label="What is it?"
            value={name}
            onChange={v => { setName(v); if (nameErr) setNameErr(null); }}
            error={nameErr}
            autoComplete="off"
          />
          <Field
            label="Registration"
            value={plate}
            onChange={v => { setPlate(v); if (plateErr) setPlateErr(null); }}
            error={plateErr}
            autoComplete="off"
          />
        </div>

        {error ? (
          <Text role="body" tone="ink2" aria-live="polite" style={{ marginTop: space.gap }}>
            {error}
          </Text>
        ) : null}

        <div style={{ marginTop: space.rest, display: 'flex', gap: space.gap, flexWrap: 'wrap' }}>
          <Button tier="primary" type="submit" loading={busy}>
            {editing ? 'Save' : 'Add the car'}
          </Button>
          <Button tier="quiet" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </BottomSheet>
  );
}

/** One field. The label sits above — a placeholder is not a label (§21.6). */
function Field({
  label, value, onChange, error, autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  autoComplete?: string;
}) {
  return (
    <label style={{ display: 'block' }}>
      <Text role="whisper" tone="ink3" as="span">{label}</Text>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        style={{
          display: 'block',
          width: '100%',
          minHeight: TARGET_MIN,
          marginTop: space.hair,
          padding: `${space.breath}px 0`,
          background: 'transparent',
          border: 'none',
          borderBottom: `${HAIRLINE}px solid ${error ? color.urgent : color.edge}`,
          borderRadius: radius.chip,
          fontFamily: typeScale.body.family,
          fontSize: typeScale.body.size,
          color: color.ink,
          outline: 'none',
        }}
      />
      {error ? (
        <Text role="whisper" tone="ink2" aria-live="polite" style={{ marginTop: space.hair }}>
          {error}
        </Text>
      ) : null}
    </label>
  );
}
