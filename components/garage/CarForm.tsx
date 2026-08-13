'use client';
/**
 * THE CAR FORM — add a car, or correct one.
 *
 * Source: reference/customer-old/components/os/CarForm.tsx
 *         docs/AUTOMODZ-OS-ARCHITECTURE.md §1, §6
 *
 * WRITES THROUGH `/api/vehicle`, AND THE ID IS NOT ITS TO CHOOSE.
 *
 * It used to call `addVehicle` / `updateVehicle`, which wrote to Firestore
 * directly at `users/{uid}/vehicles/{id}` — and because the rules allowed a
 * customer to write anywhere under their own uid, a browser could CREATE a
 * document at any id it liked. `ownsVehicle()` is the ownership primitive for
 * protections, visits and declarations, so squatting another customer's
 * vehicle id was an ownership claim over their car's whole record.
 *
 * The server allocates the id now. The checks below survive as the CUSTOMER's
 * copy — a mistake answered in the field rather than by a round trip — and the
 * server runs the same ones, including the duplicate plate, because a customer
 * with two records for one car has two histories for one car.
 *
 * It is a CLIENT ISLAND. The Garage renders on the server and stays there; only
 * this needs a browser session, so only this carries one. That is why it lives
 * in `components/garage/` rather than `components/screens/` — it is not a
 * renderer of a projection, it is an act.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { authedFetch } from '@/lib/clientSession';
import type { Vehicle } from '@/lib/types';
import { BottomSheet, Heading, Text, Button } from '@/components/system';
import {
  color, space, INSET, MEASURE, HAIRLINE, TARGET_MIN, radius,
  type as typeScale,
} from '@/design';

/** Every way the studio can refuse, in the customer's words. */
const REFUSAL: Record<string, string> = {
  'name-required': 'The car needs a name — “Mercedes-AMG C 43”.',
  'registration-required': 'The registration, as it reads on the plate.',
  'registration-taken': 'That car is already in your garage.',
  'not-found': 'We could not find that car in your garage.',
  'not-configured': 'The studio cannot be reached just now. Try again shortly.',
};

/** The plate as it is STORED — the customer's own spacing survives. */
const normPlate = (s: string) => s.toUpperCase().replace(/\s+/g, ' ').trim();

/** The plate as it is COMPARED — "GJ01AB8539" and "GJ01 AB 8539" are one car.
 *  The same rule the server uses (`lib/server/vehicleService.plateKey`). */
const plateKey = (s: string) => s.toUpperCase().replace(/\s+/g, '');

/**
 * WHAT THE FORM NEEDS OF A CAR — not a whole `Vehicle`.
 *
 * The Garage projects a small editable shape and this reads exactly five
 * fields of it. Asking for a full `Vehicle` forced every caller to cast a
 * projection back into a domain object, which is the projection boundary being
 * crossed in the wrong direction (ARCHITECTURE §1).
 */
export type EditableCar =
  Pick<Vehicle, 'id' | 'name' | 'registrationNumber'>
  & Partial<Pick<Vehicle, 'odometer' | 'year'>>;

export interface CarFormProps {
  open: boolean;
  onClose: () => void;
  /** The car being corrected, or null when this is a new one. */
  editing?: EditableCar | null;
}

export function CarForm({ open, onClose, editing = null }: CarFormProps) {
  const router = useRouter();
  const { vehicles, addVehicleToStore, updateVehicleInStore } = useAppStore();

  const [name, setName] = useState('');
  const [plate, setPlate] = useState('');
  /* The car's own room draws these (design 1d) and nothing could set them, so
     the tiles were dead the day they were designed. Both optional: an owner
     who does not want to keep their odometer here simply leaves it, and the
     room draws one tile or none instead of a zero. */
  const [odometer, setOdometer] = useState('');
  const [year, setYear] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [plateErr, setPlateErr] = useState<string | null>(null);

  /* Reopening on a different car must not show the previous car's answers. */
  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setPlate(editing?.registrationNumber ?? '');
    setOdometer(editing?.odometer ? String(editing.odometer) : '');
    setYear(editing?.year ? String(editing.year) : '');
    setError(null);
    setNameErr(null);
    setPlateErr(null);
  }, [open, editing]);

  const duplicate = (p: string) =>
    vehicles.some(v => v.id !== editing?.id && plateKey(v.registrationNumber) === plateKey(p));

  const save = async () => {
    /* NOT `user` FROM THE STORE. The Garage renders on the SERVER and mounts no
       `AuthProvider`, so the store's user is always null here — and this method
       opened with `if (!user) return`, which meant pressing "Add the car" did
       nothing at all, silently, for every customer. A car could not be added to
       the garage from the garage. See lib/clientSession.ts. */
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
      /* An emptied field must REMOVE the number, not leave the old one
         standing — the server deletes what arrives empty. Anything
         unparseable is treated as empty: a car whose odometer reads "about
         40k" has no odometer. */
      const res = await authedFetch('/api/vehicle', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...(editing ? { vehicleId: editing.id } : {}),
          name: name.trim(),
          registrationNumber: p,
          year,
          odometer,
        }),
      });

      if (res.status === 401) {
        setError('Your session has expired. Sign in again and we\u2019ll keep this.');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: '' })) as { error?: string };
        if (body.error === 'registration-taken') {
          setPlateErr('That car is already in your garage.');
        } else {
          setError(REFUSAL[body.error ?? ''] ?? 'That didn\u2019t save. Your connection, most likely — try again.');
        }
        return;
      }

      const saved = await res.json() as { vehicleId: string; name: string; registrationNumber: string };
      const data = { name: saved.name, registrationNumber: saved.registrationNumber };
      if (editing) updateVehicleInStore(editing.id, data);
      else addVehicleToStore({ ...data, id: saved.vehicleId } as Vehicle);

      onClose();
      /* The Garage renders on the server, so the new car only appears once the
         server has been asked again. */
      router.refresh();
    } catch {
      setError('That didn\u2019t save. Your connection, most likely — try again.');
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
          {/* Both optional, and said so — an unlabelled optional field reads
              as a requirement nobody explained. `inputMode` gives a phone the
              number pad without forbidding "41,208". */}
          <Field
            label="Year (optional)"
            value={year}
            onChange={setYear}
            autoComplete="off"
            inputMode="numeric"
          />
          <Field
            label="Odometer, in kilometres (optional)"
            value={odometer}
            onChange={setOdometer}
            autoComplete="off"
            inputMode="numeric"
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
  label, value, onChange, error, autoComplete, inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  autoComplete?: string;
  inputMode?: 'numeric';
}) {
  return (
    <label style={{ display: 'block' }}>
      <Text role="whisper" tone="ink3" as="span">{label}</Text>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
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
