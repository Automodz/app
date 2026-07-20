'use client';
/**
 * Vehicle Passport — one car, one identity. An Apple-Wallet-pass feeling:
 * hero with the car's name and Care Score, premium protection cards, the
 * LIFE of the car as a timeline, smart recommendations that explain why,
 * memories with photos, documents, and a Book Care CTA that already knows
 * what the car needs. Everything derived by lib/cx/passport.ts — no stored
 * duplicates, no fake metrics.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ChevronLeft, ChevronRight, Shield, Sparkles, Gem, FileText,
  CalendarPlus, Edit3, Trash2, Camera, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/lib/store';
import { getServices, getJobsForCustomer, deleteVehicle, STATIC_SERVICES } from '@/lib/firebaseService';
import { formatCurrency, formatDate, getDurationLabel } from '@/lib/utils';
import type { Job, Service } from '@/lib/types';
import { derivePassport } from '@/lib/cx/passport';
import { PROTECTION_LABEL, type ProtectionKind } from '@/lib/cx/protection';
import { isDevUser, DEV_JOBS } from '@/lib/cx/devseed';
import { DUR, EASE, STAGGER } from '@/lib/cx/motion';
import CxSheet from '@/components/cx/CxSheet';
import CxButton from '@/components/cx/CxButton';
import CxVehicleForm from '@/components/cx/CxVehicleForm';
import { serviceMedia } from '@/lib/media';

const mono10 = { fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.14em', color: 'var(--faint)', textTransform: 'uppercase' as const };
const body12 = { fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--steel)' };

const KIND_ICON: Record<ProtectionKind, typeof Shield> = { PPF: Shield, Ceramic: Sparkles, Coating: Gem };

const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DUR.base, ease: EASE, delay },
});

const gradeColor = (grade: string) =>
  grade === 'Excellent' ? 'var(--success)'
  : grade === 'Good' ? 'var(--chrome)'
  : grade === 'Needs attention' ? 'var(--warning)'
  : 'var(--danger)';

export default function PassportPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user, vehicles, bookings, removeVehicleFromStore } = useAppStore();

  const vehicle = vehicles.find(v => v.id === id) ?? null;
  const [services, setServices] = useState<Service[]>(STATIC_SERVICES);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);

  useEffect(() => {
    getServices().then(setServices).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    if (isDevUser(user.uid)) { setJobs(Object.values(DEV_JOBS)); return; }
    getJobsForCustomer(user.uid).then(setJobs).catch(() => setJobs([]));
  }, [user?.uid]);

  const passport = useMemo(
    () => vehicle ? derivePassport(vehicle, bookings, jobs, services) : null,
    [vehicle, bookings, jobs, services],
  );

  const handleDelete = async () => {
    if (!user || !vehicle) return;
    setDeleting(true);
    try {
      await deleteVehicle(user.uid, vehicle.id);
      removeVehicleFromStore(vehicle.id);
      toast.success(`${vehicle.name} left the garage`);
      router.push('/dashboard/vehicles');
    } catch {
      toast.error('We couldn’t remove it — try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (!vehicle || !passport) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-8 text-center"
      style={{ background: 'var(--void)' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', color: 'var(--chrome)' }}>
        That car isn’t in your garage.
      </p>
      <CxButton intent="secondary" onClick={() => router.push('/dashboard/vehicles')}>Back to the garage</CxButton>
    </div>
  );

  const { protection, life, score, recommendations, memories, stats, documents, photosByKind, completed } = passport;
  const yearsWithUs = vehicle.createdAt?.toDate
    ? Math.max(0, (Date.now() - vehicle.createdAt.toDate().getTime()) / (365 * 86400000))
    : null;

  // Book Care already knows: top recommendation's category, else the last service.
  const topRec = recommendations[0] ?? null;
  const lastDone = completed[0] ?? null;
  const bookHref = topRec
    ? `/dashboard/booking?cat=${topRec.category}&vehicleId=${vehicle.id}`
    : lastDone
    ? `/dashboard/booking?vehicleId=${vehicle.id}&serviceId=${lastDone.serviceId}`
    : `/dashboard/booking?vehicleId=${vehicle.id}`;

  return (
    <div className="min-h-screen pb-28" style={{ background: 'var(--void)' }}>

      {/* ── HERO: the pass ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ minHeight: 360 }}>
        <div className="absolute inset-0">
          <Image src={serviceMedia(lastDone?.serviceCategory)} alt="" fill priority className="object-cover" sizes="100vw" />
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to top, rgba(6,7,9,0.95) 0%, rgba(6,7,9,0.5) 55%, rgba(6,7,9,0.35) 100%)',
          }} />
        </div>

        <div className="relative z-10 px-4 pt-4 pb-6 flex flex-col" style={{ minHeight: 'inherit' }}>
          <div className="flex items-center justify-between">
            <button onClick={() => router.back()} aria-label="Back"
              className="w-9 h-9 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.16)' }}>
              <ChevronLeft size={15} style={{ color: '#fff' }} />
            </button>
            <button onClick={() => setEditOpen(true)} aria-label="Edit vehicle"
              className="w-9 h-9 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.16)' }}>
              <Edit3 size={14} style={{ color: '#fff' }} />
            </button>
          </div>

          <div className="flex-1" />

          <motion.div {...rise(0)} className="max-w-lg mx-auto w-full">
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '32px', letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.02 }}>
                  {vehicle.name}
                </h1>
                <p className="font-mono mt-1.5" style={{ fontSize: 11, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.62)' }}>
                  {vehicle.registrationNumber} · {vehicle.category.toUpperCase()}{vehicle.color ? ` · ${vehicle.color.toUpperCase()}` : ''}
                </p>
              </div>
              {/* Care Score — the identity */}
              <button onClick={() => setScoreOpen(true)} className="shrink-0 text-center px-3.5 py-2.5 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.18)' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '26px', lineHeight: 1, color: gradeColor(score.grade) }}>
                  {score.value}
                </p>
                <p className="mt-1" style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>
                  {score.grade}
                </p>
              </button>
            </div>

            {/* badges + tenure */}
            <motion.div {...rise(0.08)} className="flex items-center gap-2 mt-3.5 flex-wrap">
              {protection.map(p => {
                const Icon = KIND_ICON[p.kind];
                return (
                  <span key={p.kind} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono"
                    style={{
                      fontSize: 9.5, letterSpacing: '0.1em',
                      color: p.active ? '#7ED9A0' : '#E8C476',
                      background: 'rgba(6,7,9,0.5)', backdropFilter: 'blur(8px)',
                      border: `1px solid ${p.active ? 'rgba(126,217,160,0.4)' : 'rgba(232,196,118,0.4)'}`,
                    }}>
                    <Icon size={10} /> {p.kind.toUpperCase()} {p.active ? 'PROTECTED' : 'EXPIRED'}
                  </span>
                );
              })}
              {stats.lastVisit && (
                <span style={{ ...body12, color: 'rgba(255,255,255,0.65)' }}>
                  Last visit {formatDate(stats.lastVisit)}
                </span>
              )}
              {yearsWithUs !== null && (
                <span style={{ ...body12, color: 'rgba(255,255,255,0.65)' }}>
                  · {yearsWithUs < 1 ? `${Math.max(1, Math.round(yearsWithUs * 12))} months` : `${yearsWithUs.toFixed(1)} years`} with AutoModz
                </span>
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* ── BODY ───────────────────────────────────────────────────────── */}
      <div className="px-4 py-6 max-w-lg mx-auto space-y-7">

        {/* Smart recommendations */}
        {recommendations.length > 0 && (
          <motion.div {...rise(0)}>
            <p style={{ ...mono10, marginBottom: '12px' }}>What it needs</p>
            <div className="space-y-2.5">
              {recommendations.map((r, i) => (
                <motion.button key={r.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * STAGGER, duration: DUR.base, ease: EASE }}
                  onClick={() => router.push(`/dashboard/booking?cat=${r.category}&vehicleId=${vehicle.id}`)}
                  className={`w-full rounded-2xl p-4 text-left flex items-start gap-3 ${r.urgent ? 'card-ember' : 'card'}`}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-2"
                    style={{ background: r.urgent ? 'var(--warning)' : 'var(--steel)' }} />
                  <span className="flex-1 min-w-0">
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', color: 'var(--chrome)' }}>
                      {r.title}
                    </p>
                    <p style={{ ...body12, marginTop: '3px', lineHeight: 1.5 }}>{r.why}</p>
                  </span>
                  <ChevronRight size={15} className="shrink-0 mt-1" style={{ color: 'var(--steel)' }} />
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Protection cards */}
        {protection.length > 0 && (
          <motion.div {...rise(0.05)}>
            <p style={{ ...mono10, marginBottom: '12px' }}>Protection</p>
            <div className="space-y-2.5">
              {protection.map(p => {
                const Icon = KIND_ICON[p.kind];
                const left = p.until ? Math.ceil((p.until.getTime() - Date.now()) / 86400000) : null;
                return (
                  <div key={p.kind} className="rounded-3xl p-5"
                    style={{
                      background: `color-mix(in srgb, ${p.active ? 'var(--success)' : 'var(--warning)'} 5%, var(--cavern))`,
                      border: `1px solid color-mix(in srgb, ${p.active ? 'var(--success)' : 'var(--warning)'} 20%, transparent)`,
                    }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--smoke)' }}>
                          <Icon size={18} style={{ color: p.active ? 'var(--success)' : 'var(--warning)' }} />
                        </span>
                        <div className="min-w-0">
                          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14.5px', color: 'var(--chrome)' }}>
                            {PROTECTION_LABEL[p.kind]}
                          </p>
                          <p style={{ ...body12, marginTop: '1px' }} className="truncate">{p.service}</p>
                        </div>
                      </div>
                      <span className="shrink-0 px-2.5 py-1 rounded-full font-mono" style={{
                        fontSize: 9, letterSpacing: '0.1em',
                        color: p.active ? 'var(--success)' : 'var(--warning)',
                        border: `1px solid color-mix(in srgb, ${p.active ? 'var(--success)' : 'var(--warning)'} 30%, transparent)`,
                      }}>
                        {p.active ? 'PROTECTED' : 'EXPIRED'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      {([
                        ['Applied', formatDate(p.applied)],
                        ['Valid until', p.until ? p.until.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Lifetime'],
                        ['Remaining', left === null ? '—' : left > 0 ? `${left} days` : 'Lapsed'],
                      ] as [string, string][]).map(([l, v]) => (
                        <div key={l}>
                          <p style={{ ...mono10, fontSize: '8.5px' }}>{l}</p>
                          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '12.5px', color: 'var(--chrome)', marginTop: '2px' }}>{v}</p>
                        </div>
                      ))}
                    </div>
                    {(!p.active || (left !== null && left <= 60)) && (
                      <button onClick={() => router.push(`/dashboard/booking?cat=${p.kind}&vehicleId=${vehicle.id}`)}
                        className="mt-4 font-mono px-3.5 py-2.5 rounded-xl"
                        style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--ember)', background: 'var(--accent-mist)', border: '1px solid var(--accent-haze)' }}>
                        RENEW PROTECTION
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Life timeline */}
        {life.length > 0 && (
          <motion.div {...rise(0.1)}>
            <p style={{ ...mono10, marginBottom: '14px' }}>Its life with us</p>
            <div className="relative pl-5" style={{ borderLeft: '1px solid var(--border-2)' }}>
              {life.map((e, i) => (
                <motion.div key={e.key}
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * STAGGER, duration: DUR.base, ease: EASE }}
                  className="relative pb-5 last:pb-0">
                  <span className="absolute rounded-full" style={{
                    left: -25.5, top: 4, width: 11, height: 11,
                    background: 'var(--chrome)', border: '2.5px solid var(--void)',
                  }} />
                  <div className="flex items-baseline justify-between gap-3">
                    <button
                      disabled={!e.bookingId}
                      onClick={() => e.bookingId && router.push(`/dashboard/care/${e.bookingId}`)}
                      className="text-left min-w-0"
                      style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '13.5px', color: 'var(--chrome)' }}>
                      {e.title}
                    </button>
                    <p className="shrink-0" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--faint)' }}>
                      {formatDate(e.date)}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Statistics — all derived */}
        <motion.div {...rise(0.15)}>
          <p style={{ ...mono10, marginBottom: '12px' }}>The numbers</p>
          <div className="grid grid-cols-2 gap-2.5">
            {([
              ['Visits', String(stats.visits)],
              ['Invested', stats.invested >= 100000 ? `₹${(stats.invested / 100000).toFixed(1)}L` : formatCurrency(stats.invested)],
              ['Days protected', stats.daysProtected !== null ? String(stats.daysProtected) : '—'],
              ['Most chosen', stats.topService ?? '—'],
              ['Usual hands', stats.favoriteTechnician ?? '—'],
              ['Avg. turnaround', stats.avgTurnaroundMin !== null ? getDurationLabel(stats.avgTurnaroundMin) : '—'],
            ] as [string, string][]).map(([l, v]) => (
              <div key={l} className="card rounded-2xl px-4 py-3.5">
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '16px', color: 'var(--chrome)' }} className="truncate">{v}</p>
                <p style={{ ...body12, fontSize: '10.5px', marginTop: '2px' }}>{l}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Memories */}
        {memories.length > 0 && (
          <motion.div {...rise(0.2)}>
            <p style={{ ...mono10, marginBottom: '12px' }}>Memories</p>
            <div className="flex gap-3 overflow-x-auto no-scroll pb-2 -mx-4 px-4 snap-x">
              {memories.map(m => {
                const cover = m.photos.find(p => p.kind === 'after') ?? m.photos[0] ?? null;
                return (
                  <button key={m.booking.id}
                    onClick={() => router.push(`/dashboard/care/${m.booking.id}`)}
                    className="snap-start shrink-0 w-[240px] rounded-3xl overflow-hidden text-left relative"
                    style={{ height: 190, border: '1px solid var(--border)' }}>
                    {cover ? (
                      <Image src={cover.url} alt="" fill className="object-cover" sizes="240px" />
                    ) : (
                      <div className="absolute inset-0" style={{ background: 'var(--cavern)' }} />
                    )}
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(6,7,9,0.88) 0%, rgba(6,7,9,0.15) 60%)' }} />
                    <div className="absolute bottom-0 inset-x-0 p-4">
                      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', color: '#fff' }}>
                        {m.booking.serviceName}
                      </p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
                        {formatDate(m.booking.scheduledDate)}{m.technician ? ` · by ${m.technician}` : ''}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Photo journey */}
        {documents.photoCount > 0 ? (
          <motion.div {...rise(0.25)}>
            <p style={{ ...mono10, marginBottom: '12px' }}>The journey in photos</p>
            <div className="space-y-4">
              {(['before', 'during', 'after'] as const).map(kind => {
                const list = photosByKind[kind];
                if (list.length === 0) return null;
                return (
                  <div key={kind}>
                    <p style={{ ...mono10, fontSize: '8.5px', marginBottom: '8px' }}>{kind}</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {list.map(p => (
                        <div key={p.path} className="relative h-32 rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                          <Image src={p.url} alt={`${kind} photo`} fill className="object-cover" sizes="50vw" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : completed.length > 0 && (
          <div className="rounded-3xl p-7 text-center" style={{ background: 'var(--cavern)', border: '1px dashed var(--border-strong)' }}>
            <Camera size={20} className="mx-auto mb-2.5" style={{ color: 'var(--steel)' }} />
            <p style={{ ...body12, lineHeight: 1.6 }}>Its photo story starts on the next visit.</p>
          </div>
        )}

        {/* Documents */}
        {(documents.invoices.length > 0 || documents.warranties.length > 0) && (
          <motion.div {...rise(0.3)} className="card rounded-3xl p-5">
            <p style={{ ...mono10, marginBottom: '12px' }}>Documents</p>
            {documents.invoices.map(inv => (
              <button key={inv.id} onClick={() => router.push(`/invoice/${inv.id}`)}
                className="w-full flex items-center gap-3 py-2.5 text-left"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <FileText size={14} style={{ color: 'var(--steel)' }} />
                <span className="flex-1 min-w-0">
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '13px', color: 'var(--chrome)' }}>
                    Invoice · {inv.name}
                  </span>
                  <span style={{ ...body12, display: 'block' }}>{formatDate(inv.date)}</span>
                </span>
                <ChevronRight size={14} style={{ color: 'var(--steel)' }} />
              </button>
            ))}
            {documents.warranties.map(w => (
              <div key={w.kind} className="flex items-center gap-3 py-2.5 last:pb-0"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <Shield size={14} style={{ color: w.active ? 'var(--success)' : 'var(--warning)' }} />
                <span className="flex-1 min-w-0">
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '13px', color: 'var(--chrome)' }}>
                    {w.warranty} warranty · {w.service}
                  </span>
                  <span style={{ ...body12, display: 'block' }}>
                    {w.active ? `Valid until ${w.until?.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}` : 'Expired'}
                  </span>
                </span>
              </div>
            ))}
          </motion.div>
        )}

        {/* Remove — quiet, at the very end */}
        <button onClick={() => setConfirmDelete(true)}
          className="w-full py-2 text-center"
          style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--faint)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
          Remove {vehicle.name} from the garage
        </button>
      </div>

      {/* ── Book Care CTA ─────────────────────────────────────────────── */}
      <div className="fixed left-0 right-0 z-[60] px-4 py-3 glass-nav"
        style={{ borderTop: '1px solid var(--border)', bottom: 'var(--bottom-nav-h)' }}>
        <div className="max-w-lg mx-auto">
          <CxButton onClick={() => router.push(bookHref)}>
            <CalendarPlus size={16} />
            {topRec ? `Book care — ${topRec.category === 'Washing' ? 'it needs a wash' : 'renew its protection'}` : 'Book Care'}
          </CxButton>
        </div>
      </div>

      {/* ── Care Score breakdown ── */}
      <CxSheet open={scoreOpen} onClose={() => setScoreOpen(false)} title="Care Score">
        <div className="text-center pt-1 mb-5">
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '44px', lineHeight: 1, color: gradeColor(score.grade) }}>
            {score.value}
          </p>
          <p style={{ ...mono10, marginTop: '6px' }}>{score.grade}</p>
        </div>
        <div className="space-y-2 pb-4">
          {score.reasons.map(r => (
            <div key={r.label} className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: 'var(--cavern)', border: '1px solid var(--border)' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--pewter)' }}>{r.label}</p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: r.delta > 0 ? 'var(--success)' : 'var(--steel)' }}>
                {r.delta > 0 ? `+${r.delta}` : '0'}
              </p>
            </div>
          ))}
        </div>
      </CxSheet>

      {/* ── Edit ── */}
      <CxSheet open={editOpen} onClose={() => setEditOpen(false)} tall title="Edit vehicle">
        <CxVehicleForm editing={vehicle} onSaved={() => setEditOpen(false)} onClose={() => setEditOpen(false)} />
      </CxSheet>

      {/* ── Remove confirm ── */}
      <CxSheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Remove vehicle">
        <div className="text-center pt-2 pb-4">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{ background: 'color-mix(in srgb, var(--danger) 12%, transparent)' }}>
            <Trash2 size={20} style={{ color: 'var(--danger)' }} />
          </div>
          <p className="font-display font-700 text-[16px] mb-1" style={{ color: 'var(--chrome)' }}>
            Remove {vehicle.name}?
          </p>
          <p className="font-body text-[13px] mb-5" style={{ color: 'var(--muted)' }}>
            Its service history stays saved, but the vehicle leaves your garage.
          </p>
          <div className="flex gap-2">
            <CxButton intent="secondary" onClick={() => setConfirmDelete(false)}>Keep it</CxButton>
            <CxButton intent="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 size={15} className="animate-spin" /> : 'Remove'}
            </CxButton>
          </div>
        </div>
      </CxSheet>
    </div>
  );
}
