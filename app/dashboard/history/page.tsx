'use client';
/**
 * Care — the story of every visit, not a transaction log.
 * "Now" holds anything live or upcoming; below it each completed visit is
 * a photo-first story card (image, service, technician, protection earned,
 * investment) grouped by year. Tap enters the Live Care tracker.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ChevronRight, Shield } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';
import { getJobsForCustomer, getServices, STATIC_SERVICES } from '@/lib/firebaseService';
import type { Booking, Job, Service } from '@/lib/types';
import { BOOKING_STAGE, TONE_COLOR } from '@/lib/cx/care';
import { isDevUser, DEV_JOBS } from '@/lib/cx/devseed';
import { DUR, EASE, STAGGER } from '@/lib/cx/motion';
import { MEDIA } from '@/lib/media';

const mono10 = { fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.14em', color: 'var(--faint)', textTransform: 'uppercase' as const };
const body12 = { fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--steel)' };

const mediaFor = (category: string): string =>
  (MEDIA.services as Record<string, string>)[category.toLowerCase()] ?? MEDIA.services.washing;

const LIVE = ['pending', 'confirmed', 'vehicle_received', 'in_progress', 'quality_check', 'ready_for_delivery'];

export default function CarePage() {
  const router = useRouter();
  const { user, bookings } = useAppStore();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [services, setServices] = useState<Service[]>(STATIC_SERVICES);

  useEffect(() => { getServices().then(setServices).catch(() => {}); }, []);
  useEffect(() => {
    if (!user) return;
    if (isDevUser(user.uid)) { setJobs(Object.values(DEV_JOBS)); return; }
    getJobsForCustomer(user.uid).then(setJobs).catch(() => setJobs([]));
  }, [user?.uid]);

  const jobByBooking = useMemo(
    () => new Map(jobs.filter(j => j.bookingId).map(j => [j.bookingId!, j])),
    [jobs],
  );
  const warrantyByName = useMemo(
    () => new Map(services.map(s => [s.name, s.warranty])),
    [services],
  );

  const now = useMemo(() =>
    bookings
      .filter(b => LIVE.includes(b.status))
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)),
  [bookings]);

  const storiesByYear = useMemo(() => {
    const done = bookings
      .filter(b => ['completed', 'cancelled'].includes(b.status))
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
    const years = new Map<string, Booking[]>();
    done.forEach(b => {
      const y = b.scheduledDate.slice(0, 4);
      years.set(y, [...(years.get(y) ?? []), b]);
    });
    return [...years.entries()];
  }, [bookings]);

  const empty = now.length === 0 && storiesByYear.length === 0;

  return (
    <div className="min-h-screen" style={{ background: 'var(--void)' }}>

      {/* Header */}
      <div className="sticky top-0 z-20 glass-nav px-4 py-4">
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', color: 'var(--chrome)', letterSpacing: '0.06em' }}>
          CARE
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--muted)', marginTop: '1px' }}>
          Every visit, told as it happened
        </p>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-8">
        {empty && (
          <div className="relative rounded-3xl overflow-hidden" style={{ height: 300 }}>
            <Image src={MEDIA.services.ceramic} alt="" fill className="object-cover" sizes="100vw" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(6,7,9,0.92) 0%, rgba(6,7,9,0.35) 60%)' }} />
            <div className="absolute bottom-0 inset-x-0 p-6">
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '22px', color: '#fff', lineHeight: 1.15 }}>
                We’re looking forward to<br />caring for your vehicle.
              </p>
              <button onClick={() => router.push('/dashboard/booking')}
                className="mt-4 inline-flex items-center gap-2 px-5 py-3 rounded-2xl"
                style={{ background: '#fff', color: '#0b0c0e', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13.5px' }}>
                Book its first visit
              </button>
            </div>
          </div>
        )}

        {/* Now */}
        {now.length > 0 && (
          <div>
            <p style={{ ...mono10, marginBottom: '12px' }}>Now</p>
            <div className="space-y-2.5">
              {now.map((b, i) => {
                const stage = BOOKING_STAGE[b.status];
                const active = !['pending', 'confirmed'].includes(b.status);
                return (
                  <motion.button key={b.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * STAGGER, duration: DUR.base, ease: EASE }}
                    onClick={() => router.push(`/dashboard/care/${b.id}`)}
                    className={`w-full rounded-2xl p-4 text-left ${active ? 'card-ember' : 'card'}`}>
                    <div className="flex items-center gap-3">
                      <span className="relative flex w-2 h-2 shrink-0">
                        {active && (
                          <span className="absolute inline-flex w-full h-full rounded-full animate-ping opacity-60"
                            style={{ background: TONE_COLOR[stage.tone] }} />
                        )}
                        <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: TONE_COLOR[stage.tone] }} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', color: 'var(--chrome)' }}>
                          {b.vehicleName} · {stage.label}
                        </p>
                        <p style={{ ...body12, marginTop: '2px' }}>
                          {b.serviceName} · {formatDate(b.scheduledDate)} at {formatTime(b.scheduledTime)}
                        </p>
                      </span>
                      <ChevronRight size={15} className="shrink-0" style={{ color: 'var(--steel)' }} />
                    </div>
                    {active && (
                      <div className="mt-3 h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--border-2)' }}>
                        <div className="h-full rounded-full" style={{
                          width: `${Math.round(stage.base * 100)}%`, background: TONE_COLOR[stage.tone],
                        }} />
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        {/* The story, year by year */}
        {storiesByYear.map(([year, visits]) => (
          <div key={year}>
            <p style={{ ...mono10, marginBottom: '14px' }}>{year}</p>
            <div className="space-y-4">
              {visits.map((b, i) => {
                if (b.status === 'cancelled') return (
                  <p key={b.id} className="px-1" style={{ ...body12, color: 'var(--faint)' }}>
                    {formatDate(b.scheduledDate)} — {b.serviceName} was cancelled.
                  </p>
                );
                const job = jobByBooking.get(b.id);
                const photo = job?.photos?.find(p => p.kind === 'after') ?? job?.photos?.[0];
                const tech = job?.assignments?.filter(a => !a.removedAt && a.role === 'lead')[0]?.employeeName;
                const warranty = warrantyByName.get(b.serviceName);
                return (
                  <motion.button key={b.id}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * STAGGER, duration: DUR.base, ease: EASE }}
                    onClick={() => router.push(`/dashboard/care/${b.id}`)}
                    className="relative w-full rounded-3xl overflow-hidden text-left"
                    style={{ height: 230, border: '1px solid var(--border)' }}>
                    <Image src={photo?.url ?? mediaFor(b.serviceCategory)} alt="" fill className="object-cover"
                      sizes="(max-width: 768px) 100vw, 512px" />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(6,7,9,0.9) 0%, rgba(6,7,9,0.12) 55%)' }} />
                    <div className="absolute bottom-0 inset-x-0 p-5">
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.6)' }}>
                        {formatDate(b.scheduledDate).toUpperCase()} · {b.vehicleName.toUpperCase()}
                      </p>
                      <p className="mt-1" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '19px', color: '#fff' }}>
                        {b.serviceName}
                      </p>
                      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-1.5">
                        {tech && (
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'rgba(255,255,255,0.72)' }}>
                            by {tech}
                          </span>
                        )}
                        {warranty && (
                          <span className="inline-flex items-center gap-1" style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: '#7ED9A0' }}>
                            <Shield size={10} /> {warranty} protection earned
                          </span>
                        )}
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'rgba(255,255,255,0.72)' }}>
                          {formatCurrency(b.totalAmount)}
                        </span>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
