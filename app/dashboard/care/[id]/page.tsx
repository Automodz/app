'use client';
/**
 * Live Care — the heart of the customer app. One screen that answers:
 * where is my car, what is happening, who is working on it, when is it done.
 *
 * Everything derives from data that already exists — booking, the job's
 * statusHistory / assignments / photos / payments, and the availability
 * engine for rescheduling. No invented milestones, no fake ETA.
 *
 * Modes: upcoming (reserved) → live (in the studio) → delivery (ready /
 * home) → cancelled. The screen morphs; it is never a status page.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ChevronLeft, Check, Camera, MapPin, Phone, Star, FileText,
  CalendarClock, XCircle, RefreshCw, Truck, Wrench, Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/lib/store';
import {
  subscribeJobForBooking, cancelBooking, rescheduleBooking,
  getAvailability, fireOpsEvent, logActivity,
} from '@/lib/firebaseService';
import {
  formatCurrency, formatDate, formatTime, canCancelBooking,
  generateTimeSlots, getAvailableDates, getDurationLabel,
} from '@/lib/utils';
import type { Job, JobPhoto } from '@/lib/types';
import { deriveCare, etaLine, eventLine, fmtClock, fmtElapsed, markCareSeen } from '@/lib/cx/care';
import { isDevUser, DEV_JOBS } from '@/lib/cx/devseed';
import { DUR, EASE, STAGGER } from '@/lib/cx/motion';
import CxSheet from '@/components/cx/CxSheet';
import CxButton from '@/components/cx/CxButton';
import { COMPANY, telLink } from '@/lib/company';
import { MEDIA } from '@/lib/media';

const mono10 = { fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.14em', color: 'var(--faint)', textTransform: 'uppercase' as const };
const body12 = { fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--steel)' };

const heroMedia = (category: string): string =>
  (MEDIA.services as Record<string, string>)[category.toLowerCase()] ?? MEDIA.services.washing;

const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DUR.base, ease: EASE, delay },
});

export default function CarePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user, bookings, cancelBookingInStore } = useAppStore();

  const booking = bookings.find(b => b.id === id) ?? null;
  const [job, setJob] = useState<Job | null>(null);
  const [now, setNow] = useState(new Date());
  const [photoOpen, setPhotoOpen] = useState<number | null>(null);

  // reschedule / cancel (moved here from the old history detail sheet)
  const [reschedOpen, setReschedOpen] = useState(false);
  const [reschedDate, setReschedDate] = useState('');
  const [reschedTime, setReschedTime] = useState('');
  const [reschedSlots, setReschedSlots] = useState<string[]>([]);
  const [reschedBusy, setReschedBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!booking || !user) return;
    if (isDevUser(user.uid)) { setJob(DEV_JOBS[booking.id] ?? null); return; }
    return subscribeJobForBooking(booking.id, user.uid, setJob);
  }, [booking?.id, user?.uid]);

  // The strip's unread dot clears when the tracker is actually seen.
  useEffect(() => { if (booking) markCareSeen(booking.id, job); }, [booking?.id, job]);

  // elapsed / ETA tick
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!reschedDate || !booking) return;
    getAvailability([reschedDate], booking.serviceCategory, booking.serviceDurationMinutes ?? 60)
      .then(r => setReschedSlots(r.fullSlots[reschedDate] ?? []))
      .catch(() => setReschedSlots([]));
  }, [reschedDate, booking?.id]);

  const care = useMemo(() => booking ? deriveCare(booking, job, now) : null, [booking, job, now]);

  const photos: JobPhoto[] = job?.photos ?? [];
  const afterPhoto = photos.find(p => p.kind === 'after') ?? null;

  const timeline = useMemo(() => {
    if (!booking) return [];
    const events: { key: string; at: Date | null; title: string; line?: string; by?: string; note?: string }[] = [];
    if (booking.createdAt?.toDate) {
      events.push({ key: 'placed', at: booking.createdAt.toDate(), title: 'Visit scheduled', line: 'We received your booking.' });
    }
    (job?.statusHistory ?? []).forEach((e, i) => {
      events.push({
        key: `s${i}`, at: e.at?.toDate?.() ?? null,
        title: eventLine(e.status),
        by: e.byEmployeeName, note: e.note,
      });
    });
    return events;
  }, [booking, job]);

  /* ── actions (logic unchanged from the old sheet) ── */
  const handleReschedule = async () => {
    if (!booking || !reschedDate || !reschedTime) return;
    setReschedBusy(true);
    try {
      await rescheduleBooking(booking.id, reschedDate, reschedTime);
      const { bookings: all, setBookings } = useAppStore.getState();
      setBookings(all.map(b => b.id === booking.id
        ? { ...b, scheduledDate: reschedDate, scheduledTime: reschedTime } : b));
      setReschedOpen(false);
      toast.success(`Moved to ${formatDate(reschedDate)} · ${formatTime(reschedTime)}`);
    } catch {
      toast.error('We couldn’t move it — try again.');
    } finally {
      setReschedBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!booking) return;
    setCancelling(true);
    try {
      await cancelBooking(booking.id);
      cancelBookingInStore(booking.id);
      fireOpsEvent('booking_cancelled', booking.id);
      logActivity({
        type: 'cancelled', title: 'Cancelled by customer',
        bookingId: booking.id, customerId: booking.userId,
        actor: { id: booking.userId, name: user?.name || 'Customer' },
      });
      toast.success('Visit cancelled');
      setConfirmCancel(false);
      router.push('/dashboard/history');
    } catch {
      toast.error('Cancellation failed. Try again.');
    } finally {
      setCancelling(false);
    }
  };

  if (!booking || !care) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-8 text-center"
      style={{ background: 'var(--void)' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', color: 'var(--chrome)' }}>
        We couldn’t find that visit.
      </p>
      <CxButton intent="secondary" onClick={() => router.push('/dashboard/history')}>Back to Care</CxButton>
    </div>
  );

  const upcoming  = ['pending', 'confirmed'].includes(booking.status);
  const delivered = booking.status === 'completed' || job?.status === 'completed';
  const ready     = !delivered && (job?.status === 'ready_for_delivery' || booking.status === 'ready_for_delivery');
  const cancelled = booking.status === 'cancelled';
  const liveMode  = !upcoming && !delivered && !ready && !cancelled;
  const cancelAllowed = upcoming && canCancelBooking(booking.scheduledDate, booking.scheduledTime);
  const invoiceId = job?.invoiceId ?? booking.invoiceId;
  const eta = etaLine(care);

  const paid = booking.paymentStatus === 'verified' || job?.paymentStatus === 'collected';

  return (
    <div className="min-h-screen" style={{ background: 'var(--void)' }}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ minHeight: ready || delivered ? 380 : 340 }}>
        <div className="absolute inset-0">
          <Image
            src={ready || delivered ? (afterPhoto?.url ?? heroMedia(booking.serviceCategory)) : heroMedia(booking.serviceCategory)}
            alt="" fill priority className="object-cover" sizes="100vw" />
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to top, rgba(6,7,9,0.94) 0%, rgba(6,7,9,0.55) 55%, rgba(6,7,9,0.35) 100%)',
          }} />
        </div>

        <div className="relative z-10 px-4 pt-4 pb-6 flex flex-col" style={{ minHeight: 'inherit' }}>
          <button onClick={() => router.back()} aria-label="Back"
            className="w-9 h-9 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.16)' }}>
            <ChevronLeft size={15} style={{ color: '#fff' }} />
          </button>

          <div className="flex-1" />

          <motion.div {...rise(0)} className="max-w-lg mx-auto w-full">
            {care.live && (
              <p className="flex items-center gap-2 mb-2" style={{ ...mono10, color: 'rgba(255,255,255,0.75)' }}>
                <span className="relative flex w-1.5 h-1.5">
                  <span className="absolute inline-flex w-full h-full rounded-full animate-ping opacity-70" style={{ background: '#7ED9A0' }} />
                  <span className="relative inline-flex w-1.5 h-1.5 rounded-full" style={{ background: '#7ED9A0' }} />
                </span>
                LIVE FROM THE STUDIO{job?.bay ? ` · BAY ${job.bay}` : ''}
              </p>
            )}
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '30px', letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.05 }}>
              {booking.vehicleName}
            </h1>
            <p className="font-mono mt-1" style={{ fontSize: 11, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.6)' }}>
              {booking.vehicleRegNo} · {booking.serviceName.toUpperCase()}
            </p>

            <motion.p {...rise(0.08)} className="mt-4" style={{
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '17px', color: '#fff',
            }}>
              {cancelled ? care.stage.line
                : delivered ? 'Home, and looking its best.'
                : ready ? 'Your vehicle is ready to come home.'
                : upcoming ? care.stage.line
                : care.stage.line}
            </motion.p>

            {/* facts row */}
            <motion.div {...rise(0.14)} className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
              {care.technician && !delivered && !cancelled && (
                <span style={{ ...body12, color: 'rgba(255,255,255,0.72)' }}>
                  With {care.technician}
                </span>
              )}
              {care.elapsedMin !== null && liveMode && (
                <span style={{ ...body12, color: 'rgba(255,255,255,0.72)' }}>
                  {fmtElapsed(care.elapsedMin)} in
                </span>
              )}
              {eta && !upcoming && (
                <span style={{ ...body12, color: 'rgba(255,255,255,0.72)' }}>{eta}</span>
              )}
              {upcoming && (
                <span style={{ ...body12, color: 'rgba(255,255,255,0.72)' }}>
                  {formatDate(booking.scheduledDate)} · {formatTime(booking.scheduledTime)}
                </span>
              )}
            </motion.div>

            {/* animated progress */}
            {!cancelled && (
              <motion.div {...rise(0.2)} className="mt-4 h-[5px] rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.18)' }}>
                <motion.div className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round(care.progress * 100)}%` }}
                  transition={{ duration: DUR.slow, ease: EASE }}
                  style={{ background: delivered || ready ? '#7ED9A0' : '#fff' }} />
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>

      {/* ── BODY ─────────────────────────────────────────────────────────── */}
      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">

        {/* Delivery experience */}
        {(ready || delivered) && (
          <motion.div {...rise(0)} className="card-ember rounded-3xl p-5">
            <p style={{ ...mono10, marginBottom: '10px' }}>{ready ? 'Collection' : 'Delivered'}</p>
            {ready ? (
              <>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', color: 'var(--chrome)' }}>
                  Whenever you’re ready — we’ll bring it out.
                </p>
                <p style={{ ...body12, marginTop: '6px', lineHeight: 1.6 }}>
                  {COMPANY.address}. Open until {formatTime(COMPANY.hours.close)} today.
                  {booking.dropRequired && ' Your return drive is arranged — our driver will call before leaving.'}
                </p>
                <div className="flex gap-2 mt-4">
                  <a href={telLink()} className="flex-1">
                    <CxButton intent="secondary"><Phone size={14} /> Call the studio</CxButton>
                  </a>
                  <a href={COMPANY.mapsUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <CxButton intent="secondary"><MapPin size={14} /> Directions</CxButton>
                  </a>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', color: 'var(--chrome)' }}>
                  Thank you for trusting us with {booking.vehicleName}.
                </p>
                <p style={{ ...body12, marginTop: '6px', lineHeight: 1.6 }}>
                  Completed {formatDate(booking.scheduledDate)} · {booking.serviceName}.
                  {photos.length > 0 && ' The photos below tell the story.'}
                </p>
                <div className="flex gap-2 mt-4">
                  <a href={COMPANY.googleReviewUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <CxButton intent="secondary"><Star size={14} /> Leave a review</CxButton>
                  </a>
                  <div className="flex-1">
                    <CxButton onClick={() => router.push(`/dashboard/booking?vehicleId=${booking.vehicleId}&serviceId=${booking.serviceId}`)}>
                      <RefreshCw size={14} /> Book again
                    </CxButton>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* Upcoming: manage the reservation */}
        {upcoming && (
          <motion.div {...rise(0.05)} className="card rounded-3xl p-5">
            <p style={{ ...mono10, marginBottom: '10px' }}>Your reservation</p>
            <p style={{ ...body12, lineHeight: 1.6 }}>
              A bay is held for {booking.vehicleName} on {formatDate(booking.scheduledDate)} at {formatTime(booking.scheduledTime)}
              {' '}· about {getDurationLabel(booking.serviceDurationMinutes ?? 60)} with us.
              {booking.pickupRequired && ' We’ll collect it from you.'}
            </p>
            <div className="flex gap-2 mt-4">
              {cancelAllowed ? (
                <>
                  <div className="flex-1">
                    <CxButton intent="secondary" onClick={() => setReschedOpen(true)}>
                      <CalendarClock size={14} /> Reschedule
                    </CxButton>
                  </div>
                  <div className="flex-1">
                    <CxButton intent="danger" onClick={() => setConfirmCancel(true)}>
                      <XCircle size={14} /> Cancel
                    </CxButton>
                  </div>
                </>
              ) : (
                <p style={{ ...body12, color: 'var(--warning)' }}>
                  Changes close 4 hours before the visit — call us if you need help.
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* Timeline — the visit's journey */}
        {!cancelled && timeline.length > 0 && (
          <motion.div {...rise(0.1)}>
            <p style={{ ...mono10, marginBottom: '14px' }}>The journey</p>
            <div className="relative pl-5" style={{ borderLeft: '1px solid var(--border-2)' }}>
              {timeline.map((e, i) => {
                const isLast = i === timeline.length - 1;
                return (
                  <motion.div key={e.key}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * STAGGER, duration: DUR.base, ease: EASE }}
                    className="relative pb-5 last:pb-0">
                    <span className="absolute rounded-full" style={{
                      left: -25.5, top: 4, width: 11, height: 11,
                      background: isLast && care.live ? 'var(--success)' : 'var(--chrome)',
                      border: '2.5px solid var(--void)',
                      boxShadow: isLast && care.live ? '0 0 0 4px color-mix(in srgb, var(--success) 18%, transparent)' : 'none',
                    }} />
                    <div className="flex items-baseline justify-between gap-3">
                      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '13.5px', color: 'var(--chrome)' }}>
                        {e.title}
                      </p>
                      {e.at && (
                        <p className="shrink-0" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--faint)' }}>
                          {fmtClock(e.at)}
                        </p>
                      )}
                    </div>
                    {(e.by || e.line) && (
                      <p style={{ ...body12, marginTop: '2px' }}>{e.by ? `${e.by}` : e.line}</p>
                    )}
                    {e.note && (
                      <p className="mt-1.5 rounded-xl px-3 py-2" style={{
                        ...body12, background: 'var(--cavern)', border: '1px solid var(--border)',
                        color: 'var(--pewter)', lineHeight: 1.5,
                      }}>
                        “{e.note}”
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Live photos */}
        {!cancelled && !upcoming && (
          <motion.div {...rise(0.15)}>
            <p style={{ ...mono10, marginBottom: '14px' }}>From the studio floor</p>
            {photos.length === 0 ? (
              <div className="rounded-3xl p-8 text-center" style={{ background: 'var(--cavern)', border: '1px dashed var(--border-strong)' }}>
                <Camera size={22} className="mx-auto mb-3" style={{ color: 'var(--steel)' }} />
                <p style={{ ...body12, lineHeight: 1.6 }}>
                  Photos appear here as our team works.<br />The good ones take time.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {photos.map((p, i) => (
                  <motion.button key={p.path}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.15 + i * 0.06, duration: DUR.base, ease: EASE }}
                    onClick={() => setPhotoOpen(i)}
                    className="relative w-full h-52 rounded-3xl overflow-hidden block"
                    style={{ border: '1px solid var(--border)' }}>
                    <Image src={p.url} alt={`${p.kind} photo`} fill className="object-cover" sizes="(max-width: 768px) 100vw, 512px" />
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full font-mono"
                      style={{
                        fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
                        background: 'rgba(6,7,9,0.65)', backdropFilter: 'blur(8px)', color: '#fff',
                      }}>
                      {p.kind}
                    </span>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Work performed */}
        {(job?.serviceItems?.length ?? 0) > 0 && (
          <motion.div {...rise(0.2)} className="card rounded-3xl p-5">
            <p style={{ ...mono10, marginBottom: '12px' }}>The work</p>
            {job!.serviceItems.map(item => (
              <div key={item.serviceId} className="flex items-center justify-between py-2 first:pt-0 last:pb-0"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <span className="flex items-center gap-2.5" style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '13.5px', color: 'var(--chrome)' }}>
                  <Wrench size={13} style={{ color: 'var(--steel)' }} /> {item.serviceName}
                </span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--pewter)' }}>
                  {formatCurrency(item.price)}
                </span>
              </div>
            ))}
          </motion.div>
        )}

        {/* Payment — only when relevant */}
        {!cancelled && (
          <motion.div {...rise(0.25)} className="card rounded-3xl p-5">
            <div className="flex items-center justify-between mb-1">
              <p style={mono10}>Payment</p>
              <span className="px-2.5 py-1 rounded-full font-mono" style={{
                fontSize: 9, letterSpacing: '0.1em',
                color: paid ? 'var(--success)' : 'var(--warning)',
                background: `color-mix(in srgb, ${paid ? 'var(--success)' : 'var(--warning)'} 10%, transparent)`,
                border: `1px solid color-mix(in srgb, ${paid ? 'var(--success)' : 'var(--warning)'} 25%, transparent)`,
              }}>
                {paid ? 'PAID' : 'DUE'}
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <p style={body12}>
                {booking.usedMembershipWash ? 'Covered by membership' : booking.paymentMethod === 'upi' ? 'UPI' : 'Cash at the studio'}
                {booking.transactionId && ` · ${booking.transactionId}`}
              </p>
              <p className="gradient-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px' }}>
                {booking.totalAmount === 0 ? 'On us' : formatCurrency(booking.totalAmount)}
              </p>
            </div>
            {(job?.amountPaid ?? 0) > 0 && !paid && (
              <p style={{ ...body12, marginTop: '4px' }}>
                {formatCurrency(job!.amountPaid!)} received so far
              </p>
            )}
            {invoiceId && (
              <button onClick={() => router.push(`/invoice/${invoiceId}`)}
                className="mt-3 inline-flex items-center gap-1.5 font-mono px-3 py-2 rounded-xl"
                style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--ember)', background: 'var(--accent-mist)', border: '1px solid var(--accent-haze)' }}>
                <FileText size={11} /> VIEW INVOICE
              </button>
            )}
          </motion.div>
        )}

        {/* Visit summary */}
        <motion.div {...rise(0.3)} className="card rounded-3xl p-5">
          <p style={{ ...mono10, marginBottom: '12px' }}>Visit summary</p>
          {([
            ['Care',      booking.serviceName],
            ['Scheduled', `${formatDate(booking.scheduledDate)} · ${formatTime(booking.scheduledTime)}`],
            ['Arrival',   booking.pickupRequired || booking.dropRequired
              ? [booking.pickupRequired && 'We collect', booking.dropRequired && 'we return'].filter(Boolean).join(' & ')
              : 'You drive in'],
            ['Reference', booking.id.slice(0, 8).toUpperCase()],
          ] as [string, string][]).map(([l, v]) => (
            <div key={l} className="flex items-baseline justify-between py-2 first:pt-0 last:pb-0"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <p style={mono10}>{l}</p>
              <p className="text-right" style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600, color: 'var(--chrome)' }}>{v}</p>
            </div>
          ))}
          {booking.pickupDropRequired && (
            <p className="flex items-center gap-2 mt-3" style={{ ...body12, color: 'var(--ember)' }}>
              <Truck size={12} /> Doorstep service +{formatCurrency(booking.pickupDropFee || 100)}
            </p>
          )}
        </motion.div>

        {/* Protection note on delivery */}
        {delivered && booking.serviceCategory !== 'Washing' && (
          <motion.div {...rise(0.35)} className="rounded-3xl p-5 flex items-start gap-3"
            style={{ background: 'color-mix(in srgb, var(--success) 6%, var(--cavern))', border: '1px solid color-mix(in srgb, var(--success) 20%, transparent)' }}>
            <Shield size={17} className="shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />
            <div>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '13.5px', color: 'var(--chrome)' }}>
                {booking.serviceName} is now part of {booking.vehicleName}’s passport.
              </p>
              <p style={{ ...body12, marginTop: '3px', lineHeight: 1.5 }}>
                Its protection status and warranty live in your Garage.
              </p>
            </div>
          </motion.div>
        )}

        <div className="h-2" />
      </div>

      {/* ── Photo viewer ── */}
      <CxSheet open={photoOpen !== null} onClose={() => setPhotoOpen(null)} tall title="Photos">
        {photoOpen !== null && (
          <div className="-mx-5">
            <div className="flex overflow-x-auto snap-x snap-mandatory no-scroll">
              {photos.map(p => (
                <div key={p.path} className="snap-center shrink-0 w-full px-5">
                  <div className="relative w-full h-[52vh] rounded-3xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    <Image src={p.url} alt={`${p.kind} photo`} fill className="object-cover" sizes="100vw" />
                  </div>
                  <p className="text-center mt-3" style={mono10}>{p.kind.toUpperCase()}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CxSheet>

      {/* ── Reschedule ── */}
      <CxSheet open={reschedOpen} onClose={() => setReschedOpen(false)} tall title="Reschedule">
        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '19px', color: 'var(--chrome)', marginBottom: '4px' }}>
          Pick a new day
        </p>
        <p style={{ ...body12, marginBottom: '16px' }}>Your bay moves with you.</p>
        <div className="flex gap-2 overflow-x-auto no-scroll pb-2">
          {getAvailableDates().map(d => {
            const dt = new Date(d + 'T12:00:00');
            const sel = reschedDate === d;
            return (
              <button key={d} onClick={() => { setReschedDate(d); setReschedTime(''); }}
                className="flex-shrink-0 w-14 rounded-xl p-2 flex flex-col items-center gap-0.5"
                style={{
                  background: sel ? 'var(--ember)' : 'var(--dark)',
                  border: '1px solid ' + (sel ? 'var(--ember)' : 'var(--border-2)'),
                }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: sel ? 'var(--on-accent-dim)' : 'var(--faint)' }}>
                  {dt.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase()}
                </span>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '16px', color: sel ? 'var(--on-accent)' : 'var(--chrome)', lineHeight: 1 }}>
                  {dt.getDate()}
                </span>
              </button>
            );
          })}
        </div>
        {reschedDate && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            {generateTimeSlots(booking.serviceDurationMinutes ?? 60).map(t => {
              const sel = reschedTime === t;
              const taken = reschedSlots.includes(t) || (reschedDate === booking.scheduledDate && t === booking.scheduledTime);
              return (
                <button key={t} disabled={taken} onClick={() => setReschedTime(t)}
                  className="rounded-xl py-2.5"
                  style={{
                    background: sel ? 'var(--ember)' : 'var(--dark)',
                    border: '1px solid ' + (sel ? 'var(--ember)' : 'var(--border-2)'),
                    fontFamily: 'var(--font-body)', fontSize: '12px',
                    color: sel ? 'var(--on-accent)' : taken ? 'var(--faint)' : 'var(--pewter)',
                    opacity: taken ? 0.4 : 1,
                    textDecoration: taken ? 'line-through' : 'none',
                  }}>
                  {formatTime(t)}
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-5 pb-4">
          <CxButton onClick={handleReschedule} disabled={!reschedDate || !reschedTime || reschedBusy}>
            {reschedBusy ? 'Moving…' : <><Check size={15} /> Confirm the new slot</>}
          </CxButton>
        </div>
      </CxSheet>

      {/* ── Cancel confirm ── */}
      <CxSheet open={confirmCancel} onClose={() => setConfirmCancel(false)} title="Cancel visit">
        <div className="text-center pt-2 pb-4">
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', color: 'var(--chrome)', marginBottom: '4px' }}>
            Cancel this visit?
          </p>
          <p style={{ ...body12, marginBottom: '20px' }}>
            Your bay will be released for someone else.
          </p>
          <div className="flex gap-2">
            <CxButton intent="secondary" onClick={() => setConfirmCancel(false)}>Keep it</CxButton>
            <CxButton intent="danger" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? 'Cancelling…' : 'Yes, cancel'}
            </CxButton>
          </div>
        </div>
      </CxSheet>
    </div>
  );
}
