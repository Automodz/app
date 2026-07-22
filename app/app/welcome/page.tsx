'use client';
/**
 * ONBOARDING - `/app/welcome` (P2D1 §C10 · P2D3 C-14), once.
 *
 * Four moments, forward only, no step dots and no tutorial: a welcome, the
 * person, the car, and the portrait. It exists to produce a photographed -
 * or at least named - car, so that the Glance has something true to open on.
 * The last moment hands over by assembling the Glance over the car itself.
 *
 * It never returns: a garage with a car in it is proof enough that this has
 * been done, and the local flag covers the case of a customer who skipped
 * the car entirely.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { updateUserProfile } from '@/lib/firebaseService';
import { rise } from '@/lib/os/motion';
import { markWelcomed } from '@/lib/os/welcome';
import CarForm from '@/components/os/CarForm';
import Field from '@/components/os/Field';
import Action from '@/components/os/Action';
import { Display, Body, Whisper } from '@/components/os/text';

type Moment = 'welcome' | 'you' | 'car';

export default function WelcomePage() {
  const router = useRouter();
  const { user, vehicles, setUser } = useAppStore();

  const [moment, setMoment] = useState<Moment>('welcome');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? '');
    setPhone(user.phone ?? '');
  }, [user]);

  // a garage that already holds a car has been through this
  useEffect(() => {
    if (vehicles.length > 0) { markWelcomed(); router.replace('/app'); }
  }, [vehicles.length, router]);

  const leave = () => { markWelcomed(); router.replace('/app'); };

  const saveYou = async () => {
    if (!user) return;
    setSaving(true);
    const next = { name: name.trim() || user.name, phone: phone.trim() };
    try {
      await updateUserProfile(user.uid, next);
      setUser({ ...user, ...next });
    } catch { /* the studio can ask again; the car matters more */ }
    setSaving(false);
    setMoment('car');
  };

  if (!user) return null;

  return (
    <main style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center',
      padding: 'calc(env(safe-area-inset-top) + var(--st-rest)) var(--st-inset) calc(env(safe-area-inset-bottom) + var(--st-rest))',
      maxWidth: 560, marginLeft: 'auto', marginRight: 'auto', width: '100%',
    }}>
      {moment === 'welcome' && (
        <motion.section {...rise}>
          <Display>Welcome to AutoModz.</Display>
          <Body tone="ink-2" style={{ marginTop: 'var(--st-gap)' }}>
            This is where your car will live - its care, its protection, its story.
            It starts with the car.
          </Body>
          <div style={{ marginTop: 'var(--st-rest)' }}>
            <Action variant="primary" onClick={() => setMoment('you')}>Begin</Action>
          </div>
        </motion.section>
      )}

      {moment === 'you' && (
        <motion.section {...rise} style={{ display: 'grid', gap: 'var(--st-inset)' }}>
          <Display>You</Display>
          <Field label="Your name" value={name} onChange={setName} autoFocus />
          <Field label="Phone" value={phone} onChange={setPhone} kind="phone" placeholder="9512605088" />
          <Whisper>The studio calls this number when your car is ready.</Whisper>
          <Action variant="primary" onClick={saveYou} loading={saving}>That’s me</Action>
        </motion.section>
      )}

      {moment === 'car' && (
        <motion.section {...rise} style={{ display: 'grid', gap: 'var(--st-gap)' }}>
          <CarForm first onSaved={leave} />
          <Action onClick={leave}>Later</Action>
        </motion.section>
      )}
    </main>
  );
}
