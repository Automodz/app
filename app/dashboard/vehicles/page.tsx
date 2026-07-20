'use client';
/**
 * The Garage — a stack of passes, not a list. Each vehicle renders as a
 * wallet-pass card (photo, name, Care Score, protection badges) and opens
 * its full Passport (/dashboard/vehicles/[id]). All detail, stats and
 * actions live on the Passport; this screen only holds the stack and the
 * add-vehicle sheet.
 */
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Plus, Car, ChevronLeft, Shield, Sparkles, Gem } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getVehicles, getServices, STATIC_SERVICES } from '@/lib/firebaseService';
import { useAppStore } from '@/lib/store';
import type { Service } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { derivePassport } from '@/lib/cx/passport';
import type { ProtectionKind } from '@/lib/cx/protection';
import { DUR, EASE, STAGGER } from '@/lib/cx/motion';
import CxSheet from '@/components/cx/CxSheet';
import CxVehicleForm from '@/components/cx/CxVehicleForm';
import { MEDIA } from '@/lib/media';

const KIND_ICON: Record<ProtectionKind, typeof Shield> = { PPF: Shield, Ceramic: Sparkles, Coating: Gem };

const passMedia = (category: string | undefined): string =>
  (MEDIA.services as Record<string, string>)[(category ?? 'washing').toLowerCase()] ?? MEDIA.services.washing;

const gradeColor = (grade: string) =>
  grade === 'Excellent' ? '#7ED9A0'
  : grade === 'Good' ? '#fff'
  : grade === 'Needs attention' ? '#E8C476'
  : '#E88C76';

export default function GaragePage() {
  const router = useRouter();
  const { user, vehicles, bookings, setVehicles } = useAppStore();

  const [services, setServices] = useState<Service[]>(STATIC_SERVICES);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (!user) return;
    getVehicles(user.uid).then(setVehicles).catch(() => {});
    getServices().then(setServices).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Score/protection/last-visit need only bookings × catalog — the pass
  // stack deliberately skips the jobs query; the Passport does the rest.
  const passes = useMemo(() => vehicles.map(v => {
    const p = derivePassport(v, bookings, [], services);
    return { vehicle: v, score: p.score, protection: p.protection, lastVisit: p.stats.lastVisit, lastCat: p.completed[0]?.serviceCategory };
  }), [vehicles, bookings, services]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--void)' }}>

      {/* Header */}
      <div className="sticky top-0 z-20 glass-nav px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.92 }} onClick={() => router.back()}
              className="w-9 h-9 rounded-2xl card flex items-center justify-center">
              <ChevronLeft size={16} style={{ color: 'var(--pewter)' }} />
            </motion.button>
            <div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', color: 'var(--chrome)', letterSpacing: '0.06em' }}>
                MY GARAGE
              </h1>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--muted)', marginTop: '1px' }}>
                {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.92 }} onClick={() => setShowAdd(true)} aria-label="Add vehicle"
            className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--ember)', boxShadow: '0 4px 18px var(--accent-glow)' }}>
            <Plus size={18} style={{ color: 'var(--on-accent)' }} />
          </motion.button>
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        {vehicles.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-float"
              style={{ background: 'var(--smoke)' }}>
              <Car size={36} style={{ color: 'var(--ember)' }} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '24px', color: 'var(--chrome)', letterSpacing: '0.06em', marginBottom: '8px' }}>
              EMPTY GARAGE
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--muted)', marginBottom: '32px' }}>
              Add your car — it gets a passport of its own
            </p>
            <button onClick={() => setShowAdd(true)} className="btn-ember rounded-xl px-8 py-3">
              ADD VEHICLE
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {passes.map(({ vehicle: v, score, protection, lastVisit, lastCat }, i) => (
              <motion.button
                key={v.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * STAGGER, duration: DUR.base, ease: EASE }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push(`/dashboard/vehicles/${v.id}`)}
                className="relative w-full rounded-3xl overflow-hidden text-left"
                style={{ height: 200, border: '1px solid var(--border)' }}>
                <Image src={passMedia(lastCat)} alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, 512px" />
                <div className="absolute inset-0" style={{
                  background: 'linear-gradient(to top, rgba(6,7,9,0.92) 0%, rgba(6,7,9,0.35) 55%, rgba(6,7,9,0.25) 100%)',
                }} />

                {/* score chip */}
                <div className="absolute top-4 right-4 text-center px-3 py-2 rounded-2xl"
                  style={{ background: 'rgba(6,7,9,0.5)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.14)' }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '18px', lineHeight: 1, color: gradeColor(score.grade) }}>
                    {score.value}
                  </p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.65)', marginTop: '2px', textTransform: 'uppercase' }}>
                    Care Score
                  </p>
                </div>

                <div className="absolute bottom-0 inset-x-0 p-5">
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '22px', letterSpacing: '-0.01em', color: '#fff' }}>
                    {v.name}
                  </p>
                  <p className="font-mono mt-0.5" style={{ fontSize: 10.5, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.62)' }}>
                    {v.registrationNumber}
                  </p>
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    {protection.map(p => {
                      const Icon = KIND_ICON[p.kind];
                      return (
                        <span key={p.kind} className="inline-flex items-center gap-1 px-2 py-1 rounded-full font-mono"
                          style={{
                            fontSize: 8.5, letterSpacing: '0.08em',
                            color: p.active ? '#7ED9A0' : '#E8C476',
                            background: 'rgba(6,7,9,0.5)', backdropFilter: 'blur(8px)',
                            border: `1px solid ${p.active ? 'rgba(126,217,160,0.35)' : 'rgba(232,196,118,0.35)'}`,
                          }}>
                          <Icon size={9} /> {p.kind.toUpperCase()}
                        </span>
                      );
                    })}
                    {lastVisit && (
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                        Last visit {formatDate(lastVisit)}
                      </span>
                    )}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Add vehicle */}
      <CxSheet open={showAdd} onClose={() => setShowAdd(false)} tall title="Add vehicle">
        <CxVehicleForm
          onSaved={v => { setShowAdd(false); router.push(`/dashboard/vehicles/${v.id}`); }}
          onClose={() => setShowAdd(false)}
        />
      </CxSheet>
    </div>
  );
}
