'use client';
/**
 * EVERYTHING A CUSTOMER CAN CHANGE ABOUT THEMSELVES.
 *
 * Source: reference/customer-old/app/app/you/page.tsx
 *
 * ONE PROFILE, ONE PREFERENCE SOURCE, ONE REFERRAL, ONE DELETION. Each control
 * writes through the service that already owns it:
 *
 *   name / phone / preferences → `updateUserProfile` (the one profile writer)
 *   push on this device        → `services/push` (enable / disable / state)
 *   referral code and sharing  → `services/referrals`
 *   deleting the account       → `POST /api/account/delete`
 *
 * Nothing computes anything. `NotificationPrefs` has four booleans and they are
 * the only preference store in the product — `lib/server/retention.ts` reads
 * exactly these when deciding whether to send, so a switch turned off here is
 * honoured by the job that would have sent it.
 *
 * A CLIENT ISLAND inside the server-rendered room: only these controls need a
 * browser session, so only these carry one.
 */
import { useEffect, useState } from 'react';
import { currentUid, idToken } from '@/lib/clientSession';
import { getUserProfile } from '@/lib/firebaseService';
import type { User } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { updateUserProfile } from '@/lib/services/auth';
import { enablePush, disablePush, pushEnabled, pushSupported } from '@/lib/services/push';
import { getMyReferralCode, referralShareLink, referralWhatsAppLink } from '@/lib/services/referrals';
import type { NotificationPrefs, SavedAddress } from '@/lib/types';
import { BottomSheet, Heading, Text, Button, OfflineNote, useOnline } from '@/components/system';
import {
  color, space, INSET, MEASURE, HAIRLINE, TARGET_MIN, radius,
  type as typeScale,
} from '@/design';

/** The studio's word for each refusal an address can meet. */
const ADDRESS_FAULT: Record<string, string> = {
  'label-required': 'Give it a name — "Home", "Office".',
  'line1-required': 'We need the flat or building.',
  'area-required': 'Which area is it in?',
  'city-required': 'Which city?',
  'pincode-invalid': 'That pincode does not look right — six digits.',
  'phone-invalid': 'That number does not look right — ten digits.',
  'too-long': 'That is longer than we can store. Shorten it a little.',
  'too-many-addresses': 'That is as many as we keep. Remove one first.',
  'address-in-use': 'A visit is booked to that address. Move or cancel it first.',
};

/** The four preferences, in the customer's words. There is no fifth. */
const PREFS: { key: keyof NotificationPrefs; label: string; detail: string }[] = [
  { key: 'serviceReminders', label: 'Service reminders', detail: 'When a car is due for care.' },
  { key: 'membershipReminders', label: 'Membership', detail: 'When a cycle is ending.' },
  { key: 'promotions', label: 'Offers', detail: 'Occasional, and never often.' },
  { key: 'whatsapp', label: 'WhatsApp', detail: 'Let the studio message you there.' },
];

export type SettingsPanel =
  | 'profile' | 'notifications' | 'referral' | 'delete'
  /* Design screen 19's own rows. */
  | 'addresses' | 'payment' | 'privacy';

/** A car, as the privacy panel needs it. Consent belongs to the car (§consent). */
export interface ConsentCar {
  id: string;
  name: string;
  registration: string;
  granted: boolean;
}

export function AccountSettings({
  panel, onClose, cars = [],
}: {
  panel: SettingsPanel | null;
  onClose: () => void;
  /** Only the privacy panel uses these; consent is per car, never per account. */
  cars?: ConsentCar[];
}) {
  const online = useOnline();
  const { user, setUser } = useAppStore();

  /* ── the profile ── */
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── preferences ── */
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    serviceReminders: true, membershipReminders: true, promotions: true, whatsapp: true,
  });

  /* ── push, per device ── */
  const [push, setPush] = useState<'unsupported' | 'off' | 'on'>('off');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushErr, setPushErr] = useState<string | null>(null);

  /* ── referral ── */
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /* ── deletion ── */
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  /* ── saved addresses (design 08 and 19) ── */
  const [addresses, setAddresses] = useState<SavedAddress[] | null>(null);
  const [editing, setEditing] = useState<Partial<SavedAddress> | null>(null);
  const [addrBusy, setAddrBusy] = useState(false);

  /* ── the payment address ── */
  const [vpa, setVpa] = useState('');
  const [vpaBusy, setVpaBusy] = useState(false);

  /* ── consent, per car ── */
  const [consent, setConsent] = useState<Record<string, boolean>>({});
  const [consentBusy, setConsentBusy] = useState<string | null>(null);

  /**
   * THE ACCOUNT, READ FROM THE ACCOUNT.
   *
   * This filled itself from `user` in the client store — and `/you` renders on
   * the SERVER and mounts no `AuthProvider`, so that user is always null here.
   * The fields opened blank whatever the customer's name actually was, saving
   * returned at `if (!user)` without writing anything, and every notification
   * switch did the same: it moved on screen and changed nothing.
   */
  const [account, setAccount] = useState<User | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const uid = await currentUid();
      if (!uid || cancelled) return;
      const p = await getUserProfile(uid).catch(() => null);
      if (!p || cancelled) return;
      setAccount(p);
      setName(p.name ?? '');
      setPhone(p.phone ?? '');
      setPrefs({
        serviceReminders: p.notificationPrefs?.serviceReminders ?? true,
        membershipReminders: p.notificationPrefs?.membershipReminders ?? true,
        promotions: p.notificationPrefs?.promotions ?? true,
        whatsapp: p.notificationPrefs?.whatsapp ?? true,
      });
      setVpa(p.upiVpa ?? '');
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!panel) return;
    setError(null);
    setSaved(false);
    setConfirmText('');
    setCopied(false);
    setEditing(null);
  }, [panel]);

  /* Consent is per CAR and is read from the car, so opening this panel shows
     what is actually true rather than what was true when the room rendered. */
  useEffect(() => {
    if (panel !== 'privacy') return;
    setConsent(Object.fromEntries(cars.map(c => [c.id, c.granted])));
  }, [panel, cars]);

  /* The saved addresses, read through the same endpoint that writes them, so
     the list a customer sees is the list the booking sheet will offer. */
  useEffect(() => {
    if (panel !== 'addresses' || addresses) return;
    let live = true;
    void (async () => {
      const token = await idToken();
      if (!token || !live) return;
      const res = await fetch('/api/addresses', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok || !live) { if (live) setAddresses([]); return; }
      const b = await res.json() as { addresses: SavedAddress[] };
      if (live) setAddresses(b.addresses ?? []);
    })();
    return () => { live = false; };
  }, [panel, addresses]);

  /* Push is a property of THIS DEVICE, not of the account — a customer signed
     in on a phone and a laptop may want it on one and not the other. */
  useEffect(() => {
    if (panel !== 'notifications') return;
    setPush(!pushSupported() ? 'unsupported' : pushEnabled() ? 'on' : 'off');
  }, [panel]);

  useEffect(() => {
    /* Against the loaded account. Guarded on the store's user this never ran
       on `/you` — the referral panel opened and stayed empty for ever, which
       reads as the studio having no referral programme. */
    if (panel !== 'referral' || !account || code) return;
    void getMyReferralCode(account).then(setCode).catch(() => setCode(null));
  }, [panel, account, code]);

  const saveProfile = async () => {
    if (!account) return;
    setSaving(true);
    setError(null);
    try {
      const next = { name: name.trim() || account.name, phone: phone.trim() };
      await updateUserProfile(account.uid, next);
      setAccount({ ...account, ...next });
      if (user) setUser({ ...user, ...next });
      setSaved(true);
    } catch {
      setError('That didn’t save. Try again in a moment.');
    } finally {
      setSaving(false);
    }
  };

  /* A preference is written the moment it is touched. A "Save" button here
     would mean a customer who turns something off and closes the sheet is
     still sent it — the one outcome this screen exists to prevent. */
  const togglePref = async (key: keyof NotificationPrefs) => {
    if (!account) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try {
      await updateUserProfile(account.uid, { notificationPrefs: next });
      setAccount({ ...account, notificationPrefs: next });
      if (user) setUser({ ...user, notificationPrefs: next });
    } catch {
      /* Put it back, so the switch never claims something the server refused. */
      setPrefs(prefs);
      setError('That didn’t save. Check your connection.');
    }
  };

  const togglePush = async () => {
    /* The account, not the store's user — see the note on the load above.
       Guarded on `user` this switch did nothing on a customer room, which is
       the one place it is ever offered. */
    if (!account || push === 'unsupported') return;
    setPushBusy(true);
    setPushErr(null);
    try {
      if (push === 'on') {
        await disablePush(account.uid);
        setPush('off');
      } else {
        const ok = await enablePush(account.uid);
        setPush(ok ? 'on' : 'off');
        if (!ok) setPushErr('Your browser refused notifications. Allow them in its settings, then try again.');
      }
    } catch {
      setPushErr('That didn’t work. Try again in a moment.');
    } finally {
      setPushBusy(false);
    }
  };

  const share = async () => {
    if (!code) return;
    const url = referralShareLink(code);
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'AutoModz', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      /* Sharing cancelled, or no clipboard. The link is on screen either way. */
    }
  };

  const destroy = async () => {
    setDeleting(true);
    setError(null);
    try {
      const [{ auth }] = await Promise.all([import('@/lib/firebase')]);
      const token = await idToken(true);
      if (!token) throw new Error('not-signed-in');

      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string })?.error === 'staff-account'
          ? 'A staff account can’t be deleted here. Speak to the studio.'
          : 'That didn’t complete. Nothing was removed — try again.');
        return;
      }

      /* The account is gone; the local session must go with it or the app
         keeps rendering a customer who no longer exists. */
      const { signOut } = await import('firebase/auth');
      await signOut(auth).catch(() => {});
      await fetch('/api/session', { method: 'DELETE' }).catch(() => {});
      /* A document load, for the same reason as signing out — and more so:
         every cached payload here belongs to an account that no longer
         exists. */
      useAppStore.getState().clearSession();
      window.location.replace('/');
    } catch {
      setError('That didn’t complete. Nothing was removed — try again.');
    } finally {
      setDeleting(false);
    }
  };

  /* ── SAVED ADDRESSES ──
     Every write goes through the one endpoint: keeping exactly one default is
     a write to documents the request never names, and refusing to delete an
     address a van is due at needs a query. Neither is expressible in rules. */
  const saveAddress = async () => {
    if (!editing) return;
    setAddrBusy(true);
    setError(null);
    try {
      const token = await idToken();
      if (!token) throw new Error('not-signed-in');
      const res = await fetch('/api/addresses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(ADDRESS_FAULT[(b as { error?: string }).error ?? ''] ?? 'That didn’t save.');
        return;
      }
      setEditing(null);
      setAddresses(null);   // re-read, so the default the server chose is what shows
    } catch {
      setError('That didn’t save. Check your connection.');
    } finally {
      setAddrBusy(false);
    }
  };

  const removeAddress = async (id: string) => {
    setAddrBusy(true);
    setError(null);
    try {
      const token = await idToken();
      if (!token) throw new Error('not-signed-in');
      const res = await fetch(`/api/addresses?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(ADDRESS_FAULT[(b as { error?: string }).error ?? ''] ?? 'That didn’t remove.');
        return;
      }
      setAddresses(null);
    } catch {
      setError('That didn’t remove. Check your connection.');
    } finally {
      setAddrBusy(false);
    }
  };

  /* ── THE PAYMENT ADDRESS ──
     Validated on the server, because a malformed one is a customer tapping
     "Pay" at the counter and their bank application refusing to open. */
  const saveVpa = async () => {
    setVpaBusy(true);
    setError(null);
    try {
      const token = await idToken();
      if (!token) throw new Error('not-signed-in');
      const res = await fetch('/api/profile/preferences', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ upiVpa: vpa }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError((b as { error?: string }).error === 'vpa-invalid'
          ? 'That doesn’t look like a UPI address. They read like name@bank.'
          : 'That didn’t save. Try again in a moment.');
        return;
      }
      if (account) setAccount({ ...account, upiVpa: vpa.trim().toLowerCase() });
      setSaved(true);
    } catch {
      setError('That didn’t save. Check your connection.');
    } finally {
      setVpaBusy(false);
    }
  };

  /* ── CONSENT ──
     Through the engine that already owns it. There is exactly one consent
     path in this product and this is a caller of it, never a second one. */
  const toggleConsent = async (vehicleId: string) => {
    if (!account) return;
    const next = !consent[vehicleId];
    setConsentBusy(vehicleId);
    setError(null);
    setConsent(c => ({ ...c, [vehicleId]: next }));
    try {
      const { setPublicHistoryConsent } = await import('@/lib/services/vehicles');
      await setPublicHistoryConsent(account.uid, vehicleId, next);
    } catch {
      setConsent(c => ({ ...c, [vehicleId]: !next }));
      setError('That didn’t save. Check your connection.');
    } finally {
      setConsentBusy(null);
    }
  };

  const label =
    panel === 'profile' ? 'Your details'
      : panel === 'notifications' ? 'Notifications'
        : panel === 'referral' ? 'Invite a friend'
          : panel === 'addresses' ? 'Pickup addresses'
            : panel === 'payment' ? 'Payment method'
              : panel === 'privacy' ? 'Your car’s record'
                : 'Delete your account';

  return (
    <BottomSheet open={panel !== null} onClose={onClose} label={label}>
      <div style={{ paddingInline: INSET, maxWidth: MEASURE + INSET * 2, marginInline: 'auto', width: '100%' }}>
        <Heading level="title">{label}</Heading>

        <OfflineNote inline caption="You’re offline. Changes need a connection." />

        {/* ── YOUR DETAILS ─────────────────────────────────────────────── */}
        {panel === 'profile' ? (
          <>
            <div style={{ marginTop: INSET, display: 'grid', gap: space.gap }}>
              <Field label="Name" value={name} onChange={setName} autoComplete="name" />
              <Field label="Phone" value={phone} onChange={setPhone} autoComplete="tel" type="tel" />
            </div>
            <Text role="whisper" tone="ink3" style={{ marginTop: space.gap }}>
              Your email comes from the account you signed in with and can&rsquo;t be changed here.
            </Text>
            {saved ? (
              <Text role="body" tone="ink" aria-live="polite" style={{ marginTop: space.line }}>
                Saved.
              </Text>
            ) : null}
            <div style={{ marginTop: space.rest, display: 'flex', gap: space.gap, flexWrap: 'wrap' }}>
              <Button tier="primary" onClick={saveProfile} loading={saving} disabled={!online || saving}>
                Save
              </Button>
              <Button tier="quiet" onClick={onClose}>Done</Button>
            </div>
          </>
        ) : null}

        {/* ── NOTIFICATIONS ────────────────────────────────────────────── */}
        {panel === 'notifications' ? (
          <>
            <div style={{ marginTop: INSET }}>
              {PREFS.map((p, i) => (
                <Switch
                  key={p.key}
                  label={p.label}
                  detail={p.detail}
                  on={prefs[p.key]}
                  first={i === 0}
                  onToggle={() => togglePref(p.key)}
                />
              ))}
            </div>

            <div style={{ marginTop: space.rest }}>
              <Text role="data" tone="ink3">On this device</Text>
              {push === 'unsupported' ? (
                <Text role="body" tone="ink2" style={{ marginTop: space.breath }}>
                  This browser can&rsquo;t show notifications.
                </Text>
              ) : (
                <Switch
                  label="Push notifications"
                  detail="Only this device. Others are set separately."
                  on={push === 'on'}
                  first
                  busy={pushBusy}
                  onToggle={togglePush}
                />
              )}
              {pushErr ? (
                <Text role="whisper" tone="ink2" aria-live="polite" style={{ marginTop: space.breath }}>
                  {pushErr}
                </Text>
              ) : null}
            </div>

            <div style={{ marginTop: space.rest }}>
              <Button tier="quiet" onClick={onClose}>Done</Button>
            </div>
          </>
        ) : null}

        {/* ── REFERRAL ─────────────────────────────────────────────────── */}
        {panel === 'referral' ? (
          <>
            <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
              Share your code. When someone joins with it, you both get looked after.
            </Text>
            {code ? (
              <>
                <div style={{
                  marginTop: space.gap, padding: INSET,
                  borderRadius: radius.card, background: color.surface,
                  border: `${HAIRLINE}px solid ${color.edge}`,
                }}>
                  <Text role="data" tone="ink">{code}</Text>
                </div>
                {copied ? (
                  <Text role="whisper" tone="ink3" aria-live="polite" style={{ marginTop: space.breath }}>
                    Link copied.
                  </Text>
                ) : null}
                <div style={{ marginTop: space.rest, display: 'flex', gap: space.gap, flexWrap: 'wrap' }}>
                  <Button tier="primary" onClick={share}>Share the link</Button>
                  <Button tier="forward" href={referralWhatsAppLink(code, name)}>WhatsApp</Button>
                </div>
              </>
            ) : (
              <Text role="body" tone="ink2" style={{ marginTop: space.gap }}>
                Preparing your code&hellip;
              </Text>
            )}
            <div style={{ marginTop: space.rest }}>
              <Button tier="quiet" onClick={onClose}>Done</Button>
            </div>
          </>
        ) : null}


        {/* ── SAVED ADDRESSES ──────────────────────────────────────────
            Design 08's "Bodakdev · Home" and 19's "2 saved". Structured,
            because a driver needs the parts and a single line can be neither
            validated nor corrected. */}
        {panel === 'addresses' ? (
          editing ? (
            <>
              <div style={{ marginTop: INSET, display: 'grid', gap: space.gap }}>
                <Field label="Name it" value={editing.label ?? ''}
                  onChange={v => setEditing(e => ({ ...e, label: v }))} autoComplete="off" />
                <Field label="Flat, building" value={editing.line1 ?? ''}
                  onChange={v => setEditing(e => ({ ...e, line1: v }))} autoComplete="address-line1" />
                <Field label="Street (optional)" value={editing.line2 ?? ''}
                  onChange={v => setEditing(e => ({ ...e, line2: v }))} autoComplete="address-line2" />
                <Field label="Area" value={editing.area ?? ''}
                  onChange={v => setEditing(e => ({ ...e, area: v }))} autoComplete="address-level3" />
                <Field label="City" value={editing.city ?? ''}
                  onChange={v => setEditing(e => ({ ...e, city: v }))} autoComplete="address-level2" />
                <Field label="Pincode" value={editing.pincode ?? ''}
                  onChange={v => setEditing(e => ({ ...e, pincode: v }))}
                  autoComplete="postal-code" type="tel" />
                <Field label="Who the driver asks for (optional)" value={editing.contactName ?? ''}
                  onChange={v => setEditing(e => ({ ...e, contactName: v }))} autoComplete="name" />
                <Field label="Their number (optional)" value={editing.contactPhone ?? ''}
                  onChange={v => setEditing(e => ({ ...e, contactPhone: v }))}
                  autoComplete="tel" type="tel" />
              </div>
              <div style={{ marginTop: space.rest, display: 'flex', gap: space.gap, flexWrap: 'wrap' }}>
                <Button tier="primary" onClick={saveAddress} loading={addrBusy} disabled={!online || addrBusy}>
                  Save this address
                </Button>
                <Button tier="quiet" onClick={() => setEditing(null)}>Back</Button>
              </div>
            </>
          ) : (
            <>
              <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
                Where the studio collects from and brings your car back to.
              </Text>
              {addresses === null ? (
                <Text role="body" tone="ink3" style={{ marginTop: space.gap }}>
                  Reading your addresses&hellip;
                </Text>
              ) : addresses.length === 0 ? (
                <Text role="body" tone="ink2" style={{ marginTop: space.gap }}>
                  None saved yet. Add one and every visit after this remembers it.
                </Text>
              ) : (
                <div style={{ marginTop: space.gap }}>
                  {addresses.map((a, i) => (
                    <div key={a.id} style={{
                      paddingBlock: space.gap,
                      borderTop: i === 0 ? undefined : `${HAIRLINE}px solid ${color.edge}`,
                    }}>
                      <Text role="body" tone="ink">
                        {a.label}{a.isDefault ? ' · default' : ''}
                      </Text>
                      <Text role="whisper" tone="ink3" style={{ marginTop: space.hair }}>
                        {[a.line1, a.line2, a.area, `${a.city} ${a.pincode}`].filter(Boolean).join(', ')}
                      </Text>
                      <div style={{ marginTop: space.breath, display: 'flex', gap: space.gap, flexWrap: 'wrap' }}>
                        <Button tier="quiet" onClick={() => setEditing(a)}>Edit</Button>
                        <Button tier="quiet" onClick={() => removeAddress(a.id)} disabled={addrBusy}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: space.rest, display: 'flex', gap: space.gap, flexWrap: 'wrap' }}>
                <Button tier="primary" onClick={() => setEditing({ city: 'Ahmedabad' })}>
                  Add an address
                </Button>
                <Button tier="quiet" onClick={onClose}>Done</Button>
              </div>
            </>
          )
        ) : null}

        {/* ── PAYMENT METHOD ───────────────────────────────────────────
            Design 19's "UPI · HDFC". It decides which application opens at
            handover; it never decides what is owed. */}
        {panel === 'payment' ? (
          <>
            <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
              The studio is paid by UPI at handover. Save your address and the
              right application opens with the studio&rsquo;s figure already in it.
            </Text>
            <div style={{ marginTop: INSET }}>
              <Field label="Your UPI address" value={vpa} onChange={setVpa} autoComplete="off" />
            </div>
            <Text role="whisper" tone="ink3" style={{ marginTop: space.breath }}>
              Like name@okhdfc. Only you can see it, and the amount is always
              the studio&rsquo;s &mdash; never one this app works out.
            </Text>
            {saved ? (
              <Text role="body" tone="ink" aria-live="polite" style={{ marginTop: space.line }}>
                Saved.
              </Text>
            ) : null}
            <div style={{ marginTop: space.rest, display: 'flex', gap: space.gap, flexWrap: 'wrap' }}>
              <Button tier="primary" onClick={saveVpa} loading={vpaBusy} disabled={!online || vpaBusy}>
                Save
              </Button>
              <Button tier="quiet" onClick={onClose}>Done</Button>
            </div>
          </>
        ) : null}

        {/* ── THE CAR'S RECORD ─────────────────────────────────────────
            Consent to publish a car's service history on a listing anyone can
            open. Per CAR, because it belongs to the car and must outlive any
            listing. Absent means no, and nobody is grandfathered in. */}
        {panel === 'privacy' ? (
          <>
            <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
              If you ever sell a car through the studio, its record here &mdash;
              how long it has been looked after, how many visits, what protects
              it &mdash; can be shown on the listing. Never your name, your
              number or what you paid.
            </Text>
            {cars.length === 0 ? (
              <Text role="body" tone="ink2" style={{ marginTop: space.gap }}>
                Nothing to decide yet &mdash; you have no cars in your garage.
              </Text>
            ) : (
              <div style={{ marginTop: INSET }}>
                {cars.map((c, i) => (
                  <Switch
                    key={c.id}
                    label={c.name}
                    detail={`${c.registration} · ${consent[c.id] ? 'shown on a listing' : 'private'}`}
                    on={consent[c.id] === true}
                    first={i === 0}
                    busy={consentBusy === c.id}
                    onToggle={() => toggleConsent(c.id)}
                  />
                ))}
              </div>
            )}
            <Text role="whisper" tone="ink3" style={{ marginTop: space.gap }}>
              Turning it off takes effect immediately, including on a listing
              that is already up.
            </Text>
            <div style={{ marginTop: space.rest }}>
              <Button tier="quiet" onClick={onClose}>Done</Button>
            </div>
          </>
        ) : null}

        {/* ── DELETING ─────────────────────────────────────────────────── */}
        {panel === 'delete' ? (
          <>
            <Text role="body" tone="ink" style={{ marginTop: space.line }}>
              This removes your profile, your cars and their photographs, and signs
              you out everywhere. It cannot be undone.
            </Text>
            <Text role="body" tone="ink2" style={{ marginTop: space.gap }}>
              Records the studio must keep by law &mdash; invoices and completed
              visits &mdash; stay, with your name and contact details removed so
              they no longer identify you.
            </Text>
            <div style={{ marginTop: space.gap }}>
              <Button tier="forward" href="/privacy">What exactly is removed</Button>
            </div>

            {/* Typing the word is the confirmation. A second "are you sure"
                button is dismissed without reading; a word must be meant. */}
            <div style={{ marginTop: space.rest }}>
              <Field
                label="Type DELETE to confirm"
                value={confirmText}
                onChange={setConfirmText}
                autoComplete="off"
              />
            </div>

            <div style={{ marginTop: space.rest, display: 'flex', gap: space.gap, flexWrap: 'wrap' }}>
              <Button
                tier="primary"
                onClick={destroy}
                loading={deleting}
                disabled={confirmText.trim().toUpperCase() !== 'DELETE' || !online || deleting}
              >
                Delete my account
              </Button>
              <Button tier="quiet" onClick={onClose}>Keep my account</Button>
            </div>
          </>
        ) : null}

        {error ? (
          <Text role="body" tone="ink2" aria-live="polite" style={{ marginTop: space.gap }}>
            {error}
          </Text>
        ) : null}
      </div>
    </BottomSheet>
  );
}

/** One switch. §21.6 — its state is `aria-checked`, not a colour. */
function Switch({
  label, detail, on, first, busy, onToggle,
}: {
  label: string;
  detail: string;
  on: boolean;
  first: boolean;
  busy?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-busy={busy || undefined}
      onClick={onToggle}
      disabled={busy}
      style={{
        appearance: 'none',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space.gap,
        textAlign: 'left',
        background: 'transparent',
        border: 0,
        borderTop: first ? undefined : `${HAIRLINE}px solid ${color.edge}`,
        paddingBlock: space.gap,
        minHeight: TARGET_MIN,
        cursor: busy ? 'default' : 'pointer',
      }}
    >
      <span>
        <Text role="body" tone="ink" as="span">{label}</Text>
        <Text role="whisper" tone="ink3" style={{ marginTop: space.hair }}>{detail}</Text>
      </span>
      {/* The word carries the state as well as the shape (§21.6). */}
      <span style={{ display: 'flex', alignItems: 'center', gap: space.breath, flexShrink: 0 }}>
        <Text role="data" tone={on ? 'ink' : 'ink3'} as="span">{on ? 'On' : 'Off'}</Text>
        <span
          aria-hidden
          style={{
            width: space.rest, height: space.gap + space.hair,
            borderRadius: radius.pill,
            background: on ? color.ink : 'transparent',
            border: `${HAIRLINE}px solid ${on ? color.ink : color.edge}`,
            position: 'relative',
            transition: 'background 120ms',
          }}
        >
          <span style={{
            position: 'absolute', top: 1, bottom: 1,
            left: on ? undefined : 2, right: on ? 2 : undefined,
            width: space.line, borderRadius: radius.pill,
            background: on ? color.paper : color.ink3,
          }} />
        </span>
      </span>
    </button>
  );
}

/** One field. The label sits above — a placeholder is not a label (§21.6). */
function Field({
  label, value, onChange, type = 'text', autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label style={{ display: 'block' }}>
      <Text role="whisper" tone="ink3" as="span">{label}</Text>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        type={type}
        autoComplete={autoComplete}
        style={{
          display: 'block',
          width: '100%',
          minHeight: TARGET_MIN,
          marginTop: space.hair,
          padding: `${space.breath}px 0`,
          background: 'transparent',
          border: 'none',
          borderBottom: `${HAIRLINE}px solid ${color.edge}`,
          borderRadius: radius.chip,
          fontFamily: typeScale.body.family,
          fontSize: typeScale.body.size,
          color: color.ink,
          outline: 'none',
        }}
      />
    </label>
  );
}
