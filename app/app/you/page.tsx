'use client';
/**
 * YOU - `/app/you`. The account.
 * (docs/AUTOMODZ-OS-IA.md §2 · AUTOMODZ-OS-DESIGN-LANGUAGE.md)
 *
 * The third concept: everything that supports the relationship rather than the
 * car. It is deliberately the least interesting surface in the product - the
 * car is the hero everywhere else, and plumbing that tries to be beautiful
 * just gets in the way of being found.
 *
 *   1  who you are     the monogram, the name, the way in
 *   2  your details    name and phone - the number the studio actually calls
 *   3  how we reach you  the channels, as objects rather than a settings list
 *   4  this device     install, and the one way out
 *
 * COMPOSITION ONLY: `Section`, `Panel`, `Monogram`, `TogglePill`, `Field`,
 * `Action` and the text primitives. The two things this surface needed that
 * did not exist - a preference pill and a person's mark - were extracted into
 * `components/os` first and are consumed like everything else.
 *
 * It replaces the `YouSheet` that lived inside the Home controller. A sheet
 * was the wrong container: You is an entrance (IA §2), it deserves an address,
 * and a form that saves when you dismiss it can never show that it saved.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { updateUserProfile, logoutUser } from '@/lib/firebaseService';
import { enablePush, disablePush, pushEnabled, pushSupported } from '@/lib/services/push';
import { useOnline } from '@/components/os/useOnline';
import { isDevUser } from '@/lib/cx/devseed';
import Section from '@/components/os/Section';
import Panel from '@/components/os/Panel';
import Monogram from '@/components/os/Monogram';
import TogglePill from '@/components/os/TogglePill';
import Field from '@/components/os/Field';
import Action from '@/components/os/Action';
import { Emphasis, Body, Data, Whisper } from '@/components/os/text';

type PushState = 'on' | 'off' | 'unsupported';

export default function YouPage() {
  const router = useRouter();
  const { user, setUser } = useAppStore();
  const online = useOnline();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [push, setPush] = useState<PushState>('off');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushErr, setPushErr] = useState<string | null>(null);

  const [installEvent, setInstallEvent] = useState<Event | null>(null);

  useEffect(() => {
    setName(user?.name ?? '');
    setPhone(user?.phone ?? '');
  }, [user?.uid, user?.name, user?.phone]);

  useEffect(() => {
    setPush(!pushSupported() ? 'unsupported' : pushEnabled() ? 'on' : 'off');
  }, []);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvent(e); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!user) return null;

  const prefs = {
    whatsapp: true, serviceReminders: true, membershipReminders: true, promotions: true,
    ...(user.notificationPrefs ?? {}),
  };

  const dirty = name.trim() !== (user.name ?? '') || phone.trim() !== (user.phone ?? '');

  /* A saved change SAYS SO. The sheet this replaces saved on dismiss, which
     meant the one moment worth confirming happened after the surface was
     gone (Design Language §13 - every mutation produces a success moment). */
  const save = async () => {
    if (!dirty || !name.trim()) return;
    if (!online) { setSaveErr('You’re offline — reconnect to save this.'); return; }
    setSaving(true); setSaveErr(null);
    const next = { name: name.trim(), phone: phone.trim() };
    try {
      await updateUserProfile(user.uid, next);
    } catch {
      /* the dev shim's mock uid cannot reach Firestore; every other customer
         surface falls back to local state for it (see ArrangeSheet), so the
         preview stays exercisable while a real failure still speaks up */
      if (!isDevUser(user.uid)) {
        setSaveErr('That didn’t reach us — try again.');
        setSaving(false);
        return;
      }
    }
    setUser({ ...user, ...next });
    setSaved(true);
    setTimeout(() => setSaved(false), 2600);
    setSaving(false);
  };

  const togglePref = async (key: keyof typeof prefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setUser({ ...user, notificationPrefs: next });
    try { await updateUserProfile(user.uid, { notificationPrefs: next }); } catch { /* the pill reflects the store; a failed write retries on the next tap */ }
  };

  const turnOnPush = async () => {
    if (!online) { setPushErr('You’re offline — reconnect to turn these on.'); return; }
    setPushBusy(true); setPushErr(null);
    const ok = await enablePush(user.uid);
    setPushBusy(false);
    if (ok) { setPush('on'); return; }
    setPushErr(
      typeof Notification !== 'undefined' && Notification.permission === 'denied'
        ? 'Notifications are blocked — allow them for AutoModz in your browser settings.'
        : 'That didn’t go through — try again.',
    );
  };

  const turnOffPush = async () => {
    setPushBusy(true);
    await disablePush(user.uid);
    setPushBusy(false);
    setPush('off');
  };

  return (
    <main style={{ paddingBottom: 'var(--st-content-floor)' }}>
      {/* ── 1 · WHO YOU ARE ── */}
      <Section rhythm="rest">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--st-gap)' }}>
          <Monogram name={user.name} photo={user.photoURL} />
          <div style={{ minWidth: 0 }}>
            <h1 style={{
              margin: 0, fontFamily: 'var(--st-display)', fontWeight: 620,
              fontSize: 'clamp(24px, 7vw, 30px)', letterSpacing: '-0.02em', lineHeight: 1.05,
              color: 'var(--st-ink)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {user.name || 'Your account'}
            </h1>
            {user.email && (
              /* an address is one long unbreakable token in mono - without a
                 break rule it pushes the page sideways at 320px */
              <Data tone="ink-2" style={{
                display: 'block', marginTop: 4,
                overflowWrap: 'anywhere', wordBreak: 'break-word',
              }}>
                {user.email}
              </Data>
            )}
          </div>
        </div>
      </Section>

      {/* ── 2 · YOUR DETAILS ── */}
      <Section title="Your details" rhythm="rest">
        <Panel>
          <div style={{ display: 'grid', gap: 'var(--st-gap)' }}>
            <Field label="Name" value={name} onChange={setName} autoCapitalize="words" />
            <Field label="Phone" value={phone} onChange={setPhone} kind="phone" />
            <Whisper tone="ink-2">The studio calls this number when your car is ready.</Whisper>

            {saveErr && (
              <div role="status" aria-live="polite"><Body tone="caution">{saveErr}</Body></div>
            )}

            {/* Save is absent until there is something to save, rather than
                present and inert - a disabled control with no explanation is
                the defect §13 names. Absence renders as silence (§11). */}
            {(dirty || saving || saved) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--st-inset)', flexWrap: 'wrap' }}>
                {(dirty || saving) && (
                  <Action variant="forward" onClick={save} loading={saving}>Save</Action>
                )}
                {/* the success moment, said once and then gone */}
                {saved && (
                  <span role="status" aria-live="polite">
                    <Whisper tone="ink-2">Saved.</Whisper>
                  </span>
                )}
              </div>
            )}
          </div>
        </Panel>
      </Section>

      {/* ── 3 · HOW WE REACH YOU ── */}
      <Section title="How we reach you" rhythm="rest">
        <Panel>
          <div style={{ display: 'grid', gap: 'var(--st-gap)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--st-breath)' }}>
              {push !== 'unsupported' && (
                <TogglePill
                  on={push === 'on'} busy={pushBusy} label="This device"
                  onTap={push === 'on' ? turnOffPush : turnOnPush}
                />
              )}
              <TogglePill on={prefs.whatsapp} label="WhatsApp" onTap={() => togglePref('whatsapp')} />
              <TogglePill on={prefs.serviceReminders} label="Care due" onTap={() => togglePref('serviceReminders')} />
              <TogglePill on={prefs.membershipReminders} label="Membership" onTap={() => togglePref('membershipReminders')} />
              <TogglePill on={prefs.promotions} label="Offers" onTap={() => togglePref('promotions')} />
            </div>

            {pushErr && (
              <div role="status" aria-live="polite"><Whisper tone="ink-2">{pushErr}</Whisper></div>
            )}

            <Whisper tone="ink-2">
              While the car’s in care we always message — it’s your car.
            </Whisper>
          </div>
        </Panel>
      </Section>

      {/* ── 4 · THIS DEVICE ── */}
      <Section title="This device" rhythm="rest">
        <Panel>
          <div style={{ display: 'grid', gap: 'var(--st-gap)', justifyItems: 'start' }}>
            {installEvent ? (
              <Action variant="forward"
                onClick={() => (installEvent as { prompt?: () => void }).prompt?.()}>
                Install AutoModz
              </Action>
            ) : (
              <Whisper tone="ink-2">AutoModz is installed, or this browser adds it from its own menu.</Whisper>
            )}
            <Action variant="quiet" onClick={async () => { await logoutUser(); router.replace('/auth/login'); }}>
              Sign out
            </Action>
          </div>
        </Panel>
      </Section>
    </main>
  );
}
