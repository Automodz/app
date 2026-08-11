'use client';
/**
 * WHICH CAR THIS LISTING IS — the admin operation behind design screen 17.
 *
 * A listing is only able to show "its record with us" when the studio has said
 * which car in which garage it actually is. Without that there is no history
 * to show, and that is the correct behaviour for a trade-in the studio has
 * never touched — screen 17 simply draws nothing.
 *
 * ── LINKING IS NOT CONSENT, AND THIS SCREEN SAYS SO ──────────────────────
 * Nothing here publishes anything. Consent belongs to the car and only its
 * owner may grant it, from their own settings. So the control reports back
 * whether the owner HAS consented — otherwise the studio links a car, sees no
 * record appear, and assumes the feature is broken.
 *
 * ── AND THE PAIR IS PROVEN, NOT TAKEN ────────────────────────────────────
 * The server reads `users/{ownerId}/vehicles/{vehicleId}` before writing
 * anything. A mistyped pair is refused here rather than becoming a link that
 * publishes the wrong customer's history.
 */
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link2, Link2Off, Loader2 } from 'lucide-react';
import { idToken } from '@/lib/clientSession';
import type { CarListing } from '@/lib/types';

const FAULT: Record<string, string> = {
  'vehicle-not-in-that-garage': 'That car is not in that customer’s garage. Check both ids.',
  'both-required': 'Both the car and its owner are needed — half a link finds nothing.',
  'listing-not-found': 'This listing no longer exists.',
  'admin-only': 'Only the owner account can link a listing to a car.',
};

export function ListingVehicleLink(
  { listing, onLinked }: { listing: CarListing; onLinked?: () => void },
) {
  const [vehicleId, setVehicleId] = useState(listing.vehicleId ?? '');
  const [ownerId, setOwnerId] = useState(listing.vehicleOwnerId ?? '');
  const [busy, setBusy] = useState(false);

  const send = async (clear: boolean) => {
    setBusy(true);
    try {
      const token = await idToken();
      if (!token) throw new Error('not-signed-in');
      const res = await fetch('/api/cars/link', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.id,
          vehicleId: clear ? '' : vehicleId.trim(),
          vehicleOwnerId: clear ? '' : ownerId.trim(),
        }),
      });
      const b = await res.json().catch(() => ({})) as
        { error?: string; linked?: boolean; ownerConsented?: boolean };
      if (!res.ok) {
        toast.error(FAULT[b.error ?? ''] ?? 'Could not save that link.');
        return;
      }
      if (clear) {
        setVehicleId(''); setOwnerId('');
        toast.success('Unlinked — the listing shows no record.');
      } else {
        toast.success(b.ownerConsented
          ? 'Linked. The owner has consented, so the record will show.'
          : 'Linked. The owner has NOT consented, so no record will show.');
      }
      onLinked?.();
    } catch {
      toast.error('Could not save that link. Check the connection.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--dark)', border: '1px solid var(--border)' }}>
      <div>
        <span className="data-label block">Its record with us</span>
        <p className="font-body mt-1" style={{ fontSize: 11.5, color: 'var(--steel)' }}>
          Which car in which garage. Linking only says WHICH car — whether its
          record may be shown is the owner&rsquo;s decision, made in their own
          settings.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="data-label block mb-1">Vehicle id</label>
          <input
            className="input" value={vehicleId}
            onChange={e => setVehicleId(e.target.value)}
            placeholder="vehicle document id"
          />
        </div>
        <div>
          <label className="data-label block mb-1">Owner uid</label>
          <input
            className="input" value={ownerId}
            onChange={e => setOwnerId(e.target.value)}
            placeholder="customer uid"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => send(false)}
          disabled={busy || !vehicleId.trim() || !ownerId.trim()}
          className="btn-ember flex-1 py-2.5 inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
          Link this car
        </button>
        {listing.vehicleId ? (
          <button
            onClick={() => send(true)}
            disabled={busy}
            className="py-2.5 px-3 rounded-xl inline-flex items-center gap-2"
            style={{ border: '1px solid var(--border)', color: 'var(--steel)' }}
          >
            <Link2Off size={13} /> Unlink
          </button>
        ) : null}
      </div>
    </div>
  );
}
