'use client';
/**
 * Home — "How is my car?" answered in one screen. Not a dashboard.
 *
 * Hero: the primary vehicle, full-bleed. If a visit is live, the hero IS
 * the tracker preview (the Live Activity strip stays hidden here — one
 * surface, never two). Otherwise it shows the ownership state derived
 * from the passport: Protected / Needs attention / All good.
 *
 * Below: today's recommendation (only when a record justifies it), recent
 * memories, a passport preview, and the next visit — upcoming or a Book
 * CTA. Everything derives from bookings × jobs × catalog via passport.ts.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Bell, ChevronRight, Plus, Shield, Sparkles, Gem, Tag, CalendarPlus } from 'lucide-react';
import Link from 'next/link';

import { useAppStore } from '@/lib/store';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';
import { getUserSubscription, getJobsForCustomer, getServices, STATIC_SERVICES } from '@/lib/firebaseService';
import type { Job, Service, Subscription } from '@/lib/types';
import { derivePassport, type Recommendation } from '@/lib/cx/passport';
import type { ProtectionKind } from '@/lib/cx/protection';
import { deriveCare, etaLine, BOOKING_STAGE, visitPhase } from '@/lib/cx/care';
import { daysLeft, WANING_DAYS } from '@/lib/os/term';
import { activeVisit } from '@/components/cx/CxLiveActivity';
import { useVisitJob } from '@/components/cx/useVisitJob';
import { isDevUser, DEV_JOBS } from '@/lib/cx/devseed';
import { DUR, EASE, STAGGER } from '@/lib/cx/motion';
import { MEDIA, serviceMedia } from '@/lib/media';

const mono10 = { fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.14em', color: 'var(--faint)', textTransform: 'uppercase' as const };
const body12 = { fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--steel)' };

const KIND_ICON: Record<ProtectionKind, typeof Shield> = { PPF: Shield, Ceramic: Sparkles, Coating: Gem };

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DUR.base, ease: EASE, delay },
});

export default function HomePage() {
  const router = useRouter();
  const { user, vehicles, bookings, unreadCount } = useAppStore();

  const [membership, setMembership] = useState<Subscription | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [services, setServices] = useState<Service[]>(STATIC_SERVICES);

  useEffect(() => { getServices().then(setServices).catch(() => {}); }, []);

  useEffect(() => {
    if (!user) return;
    getUserSubscription(user.uid)
      .then(sub => setMembership(sub?.status === 'active' ? sub : null))
      .catch(() => setMembership(null));
    if (isDevUser(user.uid)) { setJobs(Object.values(DEV_JOBS)); return; }
    getJobsForCustomer(user.uid).then(setJobs).catch(() => setJobs([]));
  }, [user?.uid]);

  const visit = activeVisit(bookings);
  const job = useVisitJob(visit);

  // Primary vehicle: the one in the studio, else the first in the garage.
  const primary = useMemo(() => {
    if (visit) return vehicles.find(v => v.id === visit.vehicleId) ?? vehicles[0] ?? null;
    return vehicles[0] ?? null;
  }, [visit, vehicles]);

  const passport = useMemo(
    () => primary ? derivePassport(primary, bookings, jobs, services) : null,
    [primary, bookings, jobs, services],
  );

  const care = visit ? deriveCare(visit, job) : null;
  const eta = care ? etaLine(care) : null;

  const upcoming = useMemo(() =>
    bookings
      .filter(b => ['proposed', 'agreed'].includes(visitPhase(b.status)))
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0] ?? null,
  [bookings]);

  // Today's recommendation — one card, only when a record justifies it.
  const todayRec: Recommendation | null = useMemo(() => {
    if (passport?.recommendations[0]) return passport.recommendations[0];
    if (membership) {
      const washesLeft = membership.washesTotal - membership.washesUsed;
      if (washesLeft > 0) return {
        id: 'member-wash', title: 'Your monthly wash is available',
        why: `${washesLeft} of ${membership.washesTotal} ${membership.plan} washes left this period — already paid for.`,
        category: 'Washing', urgent: false,
      };
      const left = Math.max(0, daysLeft(membership.endDate));
      if (left <= WANING_DAYS) return {
        id: 'member-renew', title: `Your membership renews in ${left} days`,
        why: `The ${membership.plan} plan ends ${formatDate(membership.endDate)}.`,
        category: 'Washing', urgent: false,
      };
    }
    return null;
  }, [passport, membership]);

  const memories = (passport?.memories ?? []).filter(m => m.photos.length > 0).slice(0, 4);

  // Ownership state, when nothing is live
  const ownership = passport
    ? passport.recommendations.some(r => r.urgent)
      ? { label: 'Needs attention', line: 'A little care would go a long way.', color: '#E8C476' }
      : passport.protection.some(p => p.active)
      ? { label: 'Protected', line: 'Resting easy under its protection.', color: '#7ED9A0' }
      : { label: 'All good', line: 'Ready whenever you are.', color: '#fff' }
    : null;

  const heroImg = memories[0]?.photos.find(p => p.kind === 'after')?.url
    ?? serviceMedia(passport?.completed[0]?.serviceCategory, 'ceramic');

  return (
    <div className="min-h-screen" style={{ background: 'var(--void)' }}>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ minHeight: primary ? 430 : 360 }}>
        <div className="absolute inset-0">
          <Image src={primary ? heroImg : MEDIA.services.ppf} alt="" fill priority className="object-cover" sizes="100vw" />
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to top, rgba(6,7,9,0.95) 0%, rgba(6,7,9,0.45) 55%, rgba(6,7,9,0.5) 100%)',
          }} />
        </div>

        <div className="relative z-10 px-4 pt-5 pb-7 flex flex-col max-w-lg mx-auto w-full" style={{ minHeight: 'inherit' }}>
          {/* top row */}
          <div className="flex items-center justify-between">
            <div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>
                {greeting()},
              </p>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '19px', color: '#fff', letterSpacing: '0.01em' }}>
                {user?.name?.split(' ')[0] || 'Driver'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => router.push('/dashboard/notifications')} aria-label="Notifications"
                className="relative w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.16)' }}>
                <Bell size={16} style={{ color: '#fff' }} />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full" style={{ background: '#7ED9A0' }} />
                )}
              </button>
              <button onClick={() => router.push('/dashboard/profile')} aria-label="Profile"
                className="w-10 h-10 rounded-2xl flex items-center justify-center overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.16)' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '14px', color: '#fff' }}>
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </button>
            </div>
          </div>

          <div className="flex-1" />

          {!primary ? (
            /* garage empty — the beginning, not an error */
            <motion.div {...rise(0)}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '30px', letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.1 }}>
                Your garage<br />starts here.
              </h1>
              <p style={{ ...body12, fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginTop: '8px' }}>
                Add your car and it gets a passport of its own.
              </p>
              <button onClick={() => router.push('/dashboard/vehicles')}
                className="mt-5 inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl"
                style={{ background: '#fff', color: '#0b0c0e', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px' }}>
                <Plus size={16} /> Add your car
              </button>
            </motion.div>
          ) : visit && care ? (
            /* live visit — the hero IS the tracker preview */
            <motion.button {...rise(0)} onClick={() => router.push(`/dashboard/care/${visit.id}`)}
              className="text-left w-full">
              <p className="flex items-center gap-2 mb-2" style={{ ...mono10, color: 'rgba(255,255,255,0.75)' }}>
                <span className="relative flex w-1.5 h-1.5">
                  <span className="absolute inline-flex w-full h-full rounded-full animate-ping opacity-70" style={{ background: '#7ED9A0' }} />
                  <span className="relative inline-flex w-1.5 h-1.5 rounded-full" style={{ background: '#7ED9A0' }} />
                </span>
                LIVE FROM THE STUDIO
              </p>
              <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '30px', letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.05 }}>
                {visit.vehicleName}
              </h1>
              <p className="mt-2.5" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', color: '#fff' }}>
                {care.stage.line}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                {care.technician && (
                  <span style={{ ...body12, color: 'rgba(255,255,255,0.7)' }}>With {care.technician}</span>
                )}
                {eta && <span style={{ ...body12, color: 'rgba(255,255,255,0.7)' }}>{eta}</span>}
              </div>
              <div className="mt-4 h-[5px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.18)' }}>
                <motion.div className="h-full rounded-full"
                  initial={false}
                  animate={{ width: `${Math.round(care.progress * 100)}%` }}
                  transition={{ duration: DUR.slow, ease: EASE }}
                  style={{ background: '#7ED9A0' }} />
              </div>
              <p className="mt-3 inline-flex items-center gap-1" style={{ ...body12, color: 'rgba(255,255,255,0.75)' }}>
                Follow the visit <ChevronRight size={13} />
              </p>
            </motion.button>
          ) : (
            /* ownership state */
            <motion.button {...rise(0)} onClick={() => router.push(`/dashboard/vehicles/${primary.id}`)}
              className="text-left w-full">
              {ownership && (
                <p className="flex items-center gap-2 mb-2" style={{ ...mono10, color: ownership.color }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: ownership.color }} />
                  {ownership.label.toUpperCase()}
                </p>
              )}
              <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '30px', letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.05 }}>
                {primary.name}
              </h1>
              <p className="font-mono mt-1.5" style={{ fontSize: 11, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.6)' }}>
                {primary.registrationNumber}
              </p>
              {ownership && (
                <p className="mt-2.5" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', color: 'rgba(255,255,255,0.9)' }}>
                  {ownership.line}
                </p>
              )}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {passport?.protection.map(p => {
                  const Icon = KIND_ICON[p.kind];
                  return (
                    <span key={p.kind} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono"
                      style={{
                        fontSize: 9.5, letterSpacing: '0.1em',
                        color: p.active ? '#7ED9A0' : '#E8C476',
                        background: 'rgba(6,7,9,0.5)', backdropFilter: 'blur(8px)',
                        border: `1px solid ${p.active ? 'rgba(126,217,160,0.4)' : 'rgba(232,196,118,0.4)'}`,
                      }}>
                      <Icon size={10} /> {p.kind.toUpperCase()}
                    </span>
                  );
                })}
              </div>
            </motion.button>
          )}
        </div>
      </div>

      {/* ── BODY ─────────────────────────────────────────────────────── */}
      <div className="px-4 py-6 max-w-lg mx-auto space-y-7">

        {/* Today's recommendation */}
        {todayRec && (
          <motion.button {...rise(0)}
            onClick={() => router.push(`/dashboard/booking?cat=${todayRec.category}${primary ? `&vehicleId=${primary.id}` : ''}`)}
            className={`w-full rounded-3xl p-5 text-left flex items-start gap-3 ${todayRec.urgent ? 'card-ember' : 'card'}`}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-2"
              style={{ background: todayRec.urgent ? 'var(--warning)' : 'var(--success)' }} />
            <span className="flex-1 min-w-0">
              <p style={{ ...mono10, marginBottom: '6px' }}>Today</p>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', color: 'var(--chrome)' }}>
                {todayRec.title}
              </p>
              <p style={{ ...body12, marginTop: '4px', lineHeight: 1.5 }}>{todayRec.why}</p>
            </span>
            <ChevronRight size={15} className="shrink-0 mt-1" style={{ color: 'var(--steel)' }} />
          </motion.button>
        )}

        {/* Recent memories */}
        {memories.length > 0 && (
          <motion.div {...rise(0.05)}>
            <p style={{ ...mono10, marginBottom: '12px' }}>Recent memories</p>
            <div className="space-y-3">
              {memories.map((m, i) => {
                const cover = m.photos.find(p => p.kind === 'after') ?? m.photos[0];
                return (
                  <motion.button key={m.booking.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + i * STAGGER, duration: DUR.base, ease: EASE }}
                    onClick={() => router.push(`/dashboard/care/${m.booking.id}`)}
                    className="relative w-full rounded-3xl overflow-hidden text-left -mx-0"
                    style={{ height: 210, border: '1px solid var(--border)' }}>
                    <Image src={cover.url} alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, 512px" />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(6,7,9,0.88) 0%, rgba(6,7,9,0.1) 55%)' }} />
                    <div className="absolute bottom-0 inset-x-0 p-5">
                      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '17px', color: '#fff' }}>
                        {m.booking.serviceName}
                      </p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '11.5px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
                        {formatDate(m.booking.scheduledDate)}{m.technician ? ` · by ${m.technician}` : ''} · {formatCurrency(m.booking.totalAmount)}
                      </p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Passport preview */}
        {primary && passport && (
          <motion.button {...rise(0.1)}
            onClick={() => router.push(`/dashboard/vehicles/${primary.id}`)}
            className="card w-full rounded-3xl p-5 text-left flex items-center gap-4">
            <span className="text-center shrink-0 w-14">
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '24px', display: 'block',
                color: passport.score.grade === 'Excellent' || passport.score.grade === 'Good' ? 'var(--chrome)' : 'var(--warning)',
              }}>
                {passport.score.value}
              </span>
              <span style={{ ...mono10, fontSize: '7.5px' }}>Care Score</span>
            </span>
            <span className="flex-1 min-w-0">
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', color: 'var(--chrome)' }}>
                {primary.name}’s passport
              </p>
              <p style={{ ...body12, marginTop: '3px' }}>
                {passport.protection.filter(p => p.active).length > 0
                  ? `${passport.protection.filter(p => p.active).length} protection layer${passport.protection.filter(p => p.active).length > 1 ? 's' : ''} active`
                  : 'Protection, history and documents'}
                {vehicles.length > 1 ? ` · ${vehicles.length} cars in the garage` : ''}
              </p>
            </span>
            <ChevronRight size={15} className="shrink-0" style={{ color: 'var(--steel)' }} />
          </motion.button>
        )}

        {/* Next visit */}
        <motion.div {...rise(0.15)}>
          {upcoming ? (
            <button onClick={() => router.push(`/dashboard/care/${upcoming.id}`)}
              className="card-ember w-full rounded-3xl p-5 text-left flex items-center gap-4">
              <span className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--cavern)' }}>
                <CalendarPlus size={18} style={{ color: 'var(--chrome)' }} />
              </span>
              <span className="flex-1 min-w-0">
                <p style={{ ...mono10, marginBottom: '4px' }}>{BOOKING_STAGE[upcoming.status].label}</p>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', color: 'var(--chrome)' }}>
                  {upcoming.serviceName}
                </p>
                <p style={{ ...body12, marginTop: '2px' }}>
                  {upcoming.vehicleName} · {formatDate(upcoming.scheduledDate)} at {formatTime(upcoming.scheduledTime)}
                </p>
              </span>
              <ChevronRight size={15} className="shrink-0" style={{ color: 'var(--steel)' }} />
            </button>
          ) : primary && (
            <button onClick={() => router.push('/dashboard/booking')}
              className="w-full py-4 rounded-2xl flex items-center justify-center gap-2"
              style={{
                background: 'var(--accent-grad)', boxShadow: '0 4px 24px var(--accent-glow)',
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px',
                letterSpacing: '0.04em', color: 'var(--on-accent)',
              }}>
              <Plus size={17} /> Book your next visit
            </button>
          )}
        </motion.div>

        {/* quiet explore row */}
        <Link href="/dashboard/cars" className="flex items-center gap-3 px-1 py-1">
          <Tag size={14} style={{ color: 'var(--steel)' }} />
          <span style={{ ...body12, flex: 1 }}>Cars for sale — hand-picked, detailed by us</span>
          <ChevronRight size={13} style={{ color: 'var(--steel)' }} />
        </Link>
      </div>
    </div>
  );
}
