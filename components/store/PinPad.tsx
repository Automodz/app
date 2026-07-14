'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Delete } from 'lucide-react';
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '@/lib/config/storeConfig';

interface PinPadProps {
  onSubmit: (pin: string) => Promise<boolean>; // return false to shake + clear
  label?: string;
}

export default function PinPad({ onSubmit, label }: PinPadProps) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  const press = (d: string) => {
    if (busy || pin.length >= PIN_MAX_LENGTH) return;
    setPin(pin + d);
  };

  const submit = async () => {
    if (busy || pin.length < PIN_MIN_LENGTH) return;
    setBusy(true);
    const ok = await onSubmit(pin);
    if (!ok) { setShake(s => s + 1); setPin(''); }
    setBusy(false);
  };

  return (
    <div className="flex flex-col items-center">
      {label && <p className="data-label mb-4" style={{ color: 'var(--steel)' }}>{label}</p>}
      <motion.div key={shake} animate={shake ? { x: [0, -10, 10, -8, 8, 0] } : {}}
        transition={{ duration: 0.4 }} className="flex gap-3 mb-8 h-4 items-center">
        {[...Array(PIN_MAX_LENGTH)].map((_, i) => (
          <div key={i} className="w-3.5 h-3.5 rounded-full transition-all"
            style={{
              background: i < pin.length ? 'var(--ember)' : 'transparent',
              border: `2px solid ${i < pin.length ? 'var(--ember)' : 'var(--border)'}`,
              boxShadow: i < pin.length ? '0 0 12px var(--accent-glow)' : 'none',
              opacity: i < PIN_MIN_LENGTH || i < pin.length ? 1 : 0.35,
            }} />
        ))}
      </motion.div>
      <div className="grid grid-cols-3 gap-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].map(k => {
          if (k === 'del') return (
            <button key={k} onClick={() => setPin(pin.slice(0, -1))}
              className="w-20 h-20 rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
              style={{ background: 'var(--dark)', color: 'var(--steel)', border: '1px solid var(--border)' }}>
              <Delete size={22} />
            </button>
          );
          if (k === 'ok') return (
            <button key={k} onClick={submit} disabled={busy || pin.length < PIN_MIN_LENGTH}
              className="w-20 h-20 rounded-2xl flex items-center justify-center font-display font-800 text-base active:scale-95 transition-transform"
              style={{
                background: pin.length >= PIN_MIN_LENGTH ? 'var(--accent-grad)' : 'var(--dark)',
                color: pin.length >= PIN_MIN_LENGTH ? 'var(--on-accent)' : 'var(--steel)',
                border: '1px solid var(--border)',
                opacity: busy ? 0.6 : 1,
              }}>
              {busy ? '…' : 'GO'}
            </button>
          );
          return (
            <button key={k} onClick={() => press(k)}
              className="w-20 h-20 rounded-2xl font-display font-700 text-2xl active:scale-95 transition-transform"
              style={{ background: 'var(--dark)', color: 'var(--chrome)', border: '1px solid var(--border)' }}>
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
}
