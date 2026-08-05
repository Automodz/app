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
import { useAppStore } from '@/lib/store';
import { updateUserProfile } from '@/lib/services/auth';
import { enablePush, disablePush, pushEnabled, pushSupported } from '@/lib/services/push';
import { getMyReferralCode, referralShareLink, referralWhatsAppLink } from '@/lib/services/referrals';
import type { NotificationPrefs } from '@/lib/types';
import { BottomSheet, Heading, Text, Button, OfflineNote, useOnline } from '@/components/system';
import {
  color, space, INSET, MEASURE, HAIRLINE, TARGET_MIN, radius,
  type as typeScale,
} from '@/design';

/** The four preferences, in the customer's words. There is no fifth. */
const PREFS: { key: keyof NotificationPrefs; label: string; detail: string }[] = [
  { key: 'serviceReminders', label: 'Service reminders', detail: 'When a car is due for care.' },
  { key: 'membershipReminders', label: 'Membership', detail: 'When a cycle is ending.' },
  { key: 'promotions', label: 'Offers', detail: 'Occasional, and never often.' },
  { key: 'whatsapp', label: 'WhatsApp', detail: 'Let the studio message you there.' },
];

export type SettingsPanel = 'profile' | 'notifications' | 'referral' | 'delete';

export function AccountSettings({
  panel, onClose,
}: {
  panel: SettingsPanel | null;
  onClose: () => void;
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

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? '');
    setPhone(user.phone ?? '');
    setPrefs({
      serviceReminders: user.notificationPrefs?.serviceReminders ?? true,
      membershipReminders: user.notificationPrefs?.membershipReminders ?? true,
      promotions: user.notificationPrefs?.promotions ?? true,
      whatsapp: user.notificationPrefs?.whatsapp ?? true,
    });
  }, [user]);

  useEffect(() => {
    if (!panel) return;
    setError(null);
    setSaved(false);
    setConfirmText('');
    setCopied(false);
  }, [panel]);

  /* Push is a property of THIS DEVICE, not of the account — a customer signed
     in on a phone and a laptop may want it on one and not the other. */
  useEffect(() => {
    if (panel !== 'notifications') return;
    setPush(!pushSupported() ? 'unsupported' : pushEnabled() ? 'on' : 'off');
  }, [panel]);

  useEffect(() => {
    if (panel !== 'referral' || !user || code) return;
    void getMyReferralCode(user).then(setCode).catch(() => setCode(null));
  }, [panel, user, code]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const next = { name: name.trim() || user.name, phone: phone.trim() };
      await updateUserProfile(user.uid, next);
      setUser({ ...user, ...next });
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
    if (!user) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try {
      await updateUserProfile(user.uid, { notificationPrefs: next });
      setUser({ ...user, notificationPrefs: next });
    } catch {
      /* Put it back, so the switch never claims something the server refused. */
      setPrefs(prefs);
      setError('That didn’t save. Check your connection.');
    }
  };

  const togglePush = async () => {
    if (!user || push === 'unsupported') return;
    setPushBusy(true);
    setPushErr(null);
    try {
      if (push === 'on') {
        await disablePush(user.uid);
        setPush('off');
      } else {
        const ok = await enablePush(user.uid);
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
      const token = await auth.currentUser?.getIdToken(true);
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

  const label =
    panel === 'profile' ? 'Your details'
      : panel === 'notifications' ? 'Notifications'
        : panel === 'referral' ? 'Invite a friend'
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
