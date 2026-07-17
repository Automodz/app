'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Zap, ArrowLeft } from 'lucide-react';
import PinPad from '@/components/store/PinPad';
import { listEmployees, verifyPin } from '@/lib/firebaseService';
import { useAppStore } from '@/lib/store';
import ErrorState from '@/components/ui/ErrorState';
import Wordmark from '@/components/ui/Wordmark';
import type { Employee } from '@/lib/types';

export default function StoreLockScreen() {
  const router = useRouter();
  const { user, kioskEmployee, setKioskEmployee } = useAppStore();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = () => {
    setLoadError(false);
    setLoading(true);
    listEmployees()
      .then(list => setEmployees(list))
      .catch(e => { console.error('employees load failed', e); setLoadError(true); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  useEffect(() => {
    if (kioskEmployee) router.replace('/store/board');
  }, [kioskEmployee, router]);

  const handlePin = async (pin: string): Promise<boolean> => {
    if (!selected) return false;
    const ok = await verifyPin(selected, pin);
    if (!ok) { toast.error('Wrong PIN'); return false; }
    setKioskEmployee({ id: selected.id, name: selected.name, role: selected.role });
    router.replace('/store/board');
    return true;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 bg-mesh" style={{ overflowX: 'clip' }}>
      <div className="flex items-center gap-3 mb-10">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--accent-grad)', boxShadow: '0 8px 24px var(--accent-glow)' }}>
          <Zap size={22} style={{ color: 'var(--on-accent)' }} />
        </div>
        <div>
          <Wordmark height={24} className="mx-auto" />
          <p className="data-label flex items-center gap-1.5" style={{ color: 'var(--ember)' }}>
            <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: 'var(--ember)' }} />
            Front Desk · Staff Sign-In
          </p>
        </div>
      </div>

      {loading ? (
        <div className="w-10 h-10 loader-ring" />
      ) : loadError ? (
        <div className="w-full max-w-md"><ErrorState message="Couldn't load the staff list." onRetry={load} /></div>
      ) :!selected ? (
        <div className="w-full max-w-2xl">
          <p className="data-label text-center mb-6" style={{ color: 'var(--steel)' }}>Who&apos;s working?</p>
          {employees.length === 0 ? (
            <div className="card text-center py-10">
              <p className="font-body text-sm" style={{ color: 'var(--steel)' }}>
                No employees yet - add your team in Admin → Employees.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {employees.map((e, i) => (
                <motion.button key={e.id} initial={false} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }} onClick={() => setSelected(e)}
                  className="card-dark flex flex-col items-center py-8 active:scale-95 transition-transform">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3"
                    style={{ background: 'var(--smoke)' }}>
                    <span className="font-display font-800 text-2xl" style={{ color: 'var(--ember)' }}>
                      {e.name.charAt(0)}
                    </span>
                  </div>
                  <p className="font-body font-600 text-base" style={{ color: 'var(--chrome)' }}>{e.name}</p>
                  <p className="data-label mt-1" style={{ color: 'var(--steel)' }}>{e.role}</p>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <motion.div initial={false} animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center">
          <button onClick={() => setSelected(null)}
            className="flex items-center gap-2 mb-6 data-label" style={{ color: 'var(--steel)' }}>
            <ArrowLeft size={13} /> All staff
          </button>
          <p className="font-body font-600 text-lg mb-1" style={{ color: 'var(--chrome)' }}>{selected.name}</p>
          <PinPad onSubmit={handlePin} label="Enter your PIN" />
        </motion.div>
      )}

      {!selected && (
        <button onClick={() => router.replace(user?.role === 'admin' ? '/admin' : '/dashboard')}
          className="mt-10 data-label cursor-pointer px-4 py-3 rounded-xl transition-colors"
          style={{ color: 'var(--steel)' }}>
          ← Exit Front Desk
        </button>
      )}
    </div>
  );
}
