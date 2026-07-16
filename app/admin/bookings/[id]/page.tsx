'use client';
/**
 * Booking Operational Workspace — the single source of truth for one job.
 *
 * A Booking (commercial truth) and its Job (operational truth) are a permanent
 * 1:1. This one page shows the booking in COMMERCIAL mode; at vehicle check-in
 * it creates the linked Job and expands IN PLACE into OPERATIONAL mode — same
 * page, no context switch. The operator never thinks "booking vs job"; they
 * just manage the car in front of them.
 *
 * Every section here is fully wired to real services. Sections whose data model
 * doesn't exist yet (checklist, materials, QC, comments, WhatsApp log) are NOT
 * shown — they arrive, fully built, in following increments.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Phone, MessageCircle, Loader2, CheckCircle2, Clock, Car, User as UserIcon,
  IndianRupee, FileText, CalendarClock, LogIn, Camera, Users, Plus, X, ShieldCheck, Zap,
} from 'lucide-react';
import {
  getBooking, updateBookingStatusWithNotification, updateBookingStatus, verifyPayment,
  createInvoiceForBooking, getInvoice, buildInvoiceWhatsAppLink, invoicePublicUrl,
  saveBookingAdminNotes, rescheduleBooking, createJobFromBooking, getJob,
  updateJobStatus, setJobAssignees, addJobPhoto, listEmployees,
  logActivity, listBookingActivity, type ActivityEvent, type ActivityType,
} from '@/lib/firebaseService';
import { formatCurrency, formatDate, formatTime, getStatusLabel } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import type { Booking, BookingStatus, Job, JobStatus, Employee } from '@/lib/types';
import ServiceIcon from '@/components/ui/ServiceIcon';
import ErrorState from '@/components/ui/ErrorState';

const EASE = [0.22, 1, 0.36, 1] as const;

// commercial stage order (the booking's lifecycle)
const BOOKING_STAGES: BookingStatus[] = [
  'pending', 'confirmed', 'vehicle_received', 'in_progress',
  'quality_check', 'ready_for_delivery', 'completed',
];
// operational stage order (the job's lifecycle) + mirror to booking status
const JOB_STAGES: { status: JobStatus; label: string; booking: BookingStatus }[] = [
  { status: 'checked_in',        label: 'Checked in',   booking: 'vehicle_received' },
  { status: 'in_progress',       label: 'In progress',  booking: 'in_progress' },
  { status: 'quality_check',     label: 'Quality check', booking: 'quality_check' },
  { status: 'ready_for_delivery', label: 'Ready',        booking: 'ready_for_delivery' },
  { status: 'completed',         label: 'Delivered',    booking: 'completed' },
];

const wa = (phone: string) => `https://wa.me/${phone.startsWith('91') ? phone : '91' + phone}`;

export default function BookingWorkspace() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAppStore();
  const actor = { id: user?.uid ?? 'admin', name: user?.name || 'Admin' };

  const [booking, setBooking] = useState<Booking | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(false); setLoading(true);
    try {
      const b = await getBooking(id);
      if (!b) { setError(true); return; }
      setBooking(b);
      const [j, acts] = await Promise.all([
        b.jobId ? getJob(b.jobId) : Promise.resolve(null),
        listBookingActivity(id).catch(() => [] as ActivityEvent[]),
      ]);
      setJob(j);
      setActivity(acts);
    } catch (e) {
      console.error('workspace load failed', e); setError(true);
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const refreshJob = useCallback(async (jobId: string) => {
    try { setJob(await getJob(jobId)); } catch {}
  }, []);
  const reloadActivity = useCallback(async () => {
    try { setActivity(await listBookingActivity(id)); } catch {}
  }, [id]);

  // every meaningful action writes one timeline event — the heartbeat
  const record = useCallback(async (type: ActivityType, title: string, meta?: Record<string, unknown>) => {
    await logActivity({ type, title, bookingId: id, jobId: booking?.jobId, customerId: booking?.userId, actor, meta });
    reloadActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, booking?.jobId, booking?.userId]);

  // ── commercial actions ──
  const confirmBooking = async () => {
    if (!booking) return;
    setBusy('confirm');
    try {
      await updateBookingStatusWithNotification(booking, 'confirmed');
      setBooking({ ...booking, status: 'confirmed' });
      record('confirmed', 'Booking confirmed');
      toast.success('Booking confirmed');
    } catch { toast.error('Could not confirm'); } finally { setBusy(null); }
  };

  const checkIn = async () => {
    if (!booking) return;
    setBusy('checkin');
    try {
      const jobId = await createJobFromBooking(booking, actor);
      await logActivity({ type: 'checked_in', title: 'Vehicle checked in', bookingId: booking.id, jobId, customerId: booking.userId, actor });
      const [b, j, acts] = await Promise.all([getBooking(booking.id), getJob(jobId), listBookingActivity(booking.id).catch(() => [] as ActivityEvent[])]);
      if (b) setBooking(b);
      setJob(j);
      setActivity(acts);
      toast.success('Vehicle checked in — job opened');
    } catch (e) { console.error(e); toast.error('Check-in failed'); } finally { setBusy(null); }
  };

  const doVerifyPayment = async () => {
    if (!booking) return;
    setBusy('pay');
    try {
      await verifyPayment(booking.id);
      setBooking({ ...booking, paymentStatus: 'verified' });
      record('payment', 'Payment verified', { amount: booking.totalAmount });
      toast.success('Payment verified');
    } catch { toast.error('Could not verify'); } finally { setBusy(null); }
  };

  const doInvoice = async () => {
    if (!booking) return;
    setBusy('invoice');
    try {
      const inv = booking.invoiceId ? await getInvoice(booking.invoiceId) : await createInvoiceForBooking(booking);
      if (!inv) throw new Error('missing');
      if (!booking.invoiceId) { setBooking({ ...booking, invoiceId: inv.id }); record('invoice', 'Invoice generated', { invoiceNumber: inv.invoiceNumber }); }
      window.open(invoicePublicUrl(inv), '_blank');
      setTimeout(() => window.open(buildInvoiceWhatsAppLink(inv), '_blank'), 400);
    } catch { toast.error('Invoice failed'); } finally { setBusy(null); }
  };

  const cancel = async () => {
    if (!booking) return;
    setBusy('cancel');
    try {
      await updateBookingStatusWithNotification(booking, 'cancelled');
      setBooking({ ...booking, status: 'cancelled' });
      record('cancelled', 'Booking cancelled');
      toast.success('Booking cancelled');
    } catch { toast.error('Could not cancel'); } finally { setBusy(null); }
  };

  // ── operational (job) actions ──
  const advanceJob = async (status: JobStatus, mirror: BookingStatus) => {
    if (!job || !booking) return;
    setBusy('stage:' + status);
    try {
      await updateJobStatus(job.id, status, actor);
      updateBookingStatus(booking.id, mirror).catch(() => {}); // keep commercial truth in sync
      setBooking(b => b ? { ...b, status: mirror } : b);
      record(status === 'completed' ? 'delivered' : 'stage', 'Stage · ' + getStatusLabel(mirror));
      await refreshJob(job.id);
      toast.success('Stage → ' + getStatusLabel(mirror));
    } catch { toast.error('Could not update stage'); } finally { setBusy(null); }
  };

  if (loading) return <WorkspaceSkeleton />;
  if (error || !booking) return <div className="p-6 max-w-3xl"><ErrorState onRetry={load} message="Couldn't load this booking." /></div>;

  const stageIdx = BOOKING_STAGES.indexOf(booking.status);
  const canCheckIn = !booking.jobId && !['cancelled', 'completed'].includes(booking.status);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* header */}
      <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 mb-4 font-mono" style={{ fontSize: 11, letterSpacing: '0.06em', color: 'var(--muted)' }}>
        <ArrowLeft size={13} /> BOOKINGS
      </button>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
        className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-3.5 min-w-0">
          <span className="grid place-items-center rounded-2xl shrink-0" style={{ width: 52, height: 52, background: 'var(--smoke)', border: '1px solid var(--border-strong)', color: 'var(--chrome)' }}>
            <ServiceIcon category={booking.serviceCategory} size={24} />
          </span>
          <div className="min-w-0">
            <h1 className="font-display truncate" style={{ fontSize: 'clamp(22px,4vw,30px)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--fg)', lineHeight: 1.05 }}>{booking.userName}</h1>
            <p className="font-body mt-0.5 truncate" style={{ fontSize: 14, color: 'var(--muted)' }}>{booking.serviceName} · {booking.vehicleName} · {booking.vehicleRegNo}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StageBadge booking={booking} hasJob={!!job} />
          <span className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg)' }}>{formatCurrency(booking.totalAmount)}</span>
        </div>
      </motion.div>

      {/* commercial stage rail */}
      <Section title="Progress" delay={0.04}>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {BOOKING_STAGES.map((s, i) => {
            const done = i <= stageIdx && booking.status !== 'cancelled';
            const current = i === stageIdx;
            return (
              <div key={s} className="flex items-center gap-1.5 shrink-0">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
                  style={{ background: current ? 'var(--accent-mist)' : 'transparent', border: `1px solid ${done ? 'var(--border-strong)' : 'var(--border)'}` }}>
                  {done ? <CheckCircle2 size={13} style={{ color: current ? 'var(--fg)' : 'var(--muted)' }} /> : <Clock size={13} style={{ color: 'var(--faint)' }} />}
                  <span className="font-mono whitespace-nowrap" style={{ fontSize: 9.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: done ? 'var(--fg-dim)' : 'var(--faint)' }}>{getStatusLabel(s)}</span>
                </div>
                {i < BOOKING_STAGES.length - 1 && <span style={{ width: 8, height: 1, background: 'var(--border-strong)' }} />}
              </div>
            );
          })}
        </div>
      </Section>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        {/* ── left: details ── */}
        <div className="lg:col-span-2 space-y-4">
          <Section title="Overview" delay={0.06}>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
              <Field icon={UserIcon} label="Customer" value={booking.userName} sub={booking.userPhone} />
              <Field icon={Car} label="Vehicle" value={booking.vehicleName} sub={booking.vehicleRegNo} />
              <Field icon={ServiceIconAsField(booking.serviceCategory)} label="Service" value={booking.serviceName} sub={booking.serviceCategory} />
              <Field icon={CalendarClock} label="Appointment" value={formatDate(booking.scheduledDate)} sub={formatTime(booking.scheduledTime)} />
              <Field icon={IndianRupee} label="Amount" value={formatCurrency(booking.totalAmount)} sub={booking.paymentMethod.toUpperCase()} />
              <Field icon={booking.paymentStatus === 'verified' ? CheckCircle2 : Clock}
                label="Payment" value={booking.paymentStatus === 'verified' ? 'Verified' : 'Pending'}
                sub={booking.usedMembershipWash ? 'Membership wash' : booking.transactionId ? 'UPI · ' + booking.transactionId.slice(-6) : undefined}
                tone={booking.paymentStatus === 'verified' ? 'good' : 'warn'} />
            </div>
            {booking.usedMembershipWash && (
              <div className="mt-4 rounded-xl px-3 py-2.5 inline-flex items-center gap-2" style={{ background: 'var(--accent-mist)', border: '1px solid var(--border-strong)' }}>
                <Zap size={13} style={{ color: 'var(--fg)' }} />
                <span className="font-body" style={{ fontSize: 12.5, color: 'var(--fg-dim)' }}>Covered by membership plan — one wash deducted.</span>
              </div>
            )}
          </Section>

          {/* ── OPERATIONAL MODE (evolves in place once the vehicle is checked in) ── */}
          {job ? (
            <>
              <OperationalStage job={job} busy={busy} onAdvance={advanceJob} />
              <AssigneesSection job={job} actor={actor} record={record} onChange={() => refreshJob(job.id)} />
              <PhotosSection job={job} record={record} onChange={() => refreshJob(job.id)} />
            </>
          ) : (
            <Section title="Operational workspace" delay={0.1}>
              <div className="flex flex-col items-center text-center py-8">
                <span className="grid place-items-center rounded-2xl mb-3" style={{ width: 48, height: 48, background: 'var(--smoke)', border: '1px solid var(--border-strong)', color: 'var(--muted)' }}>
                  <LogIn size={22} />
                </span>
                <p className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>Not checked in yet</p>
                <p className="font-body mt-1 max-w-xs" style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--muted)' }}>
                  When the vehicle arrives, check it in to open the operational job — assignments, photos, progress and delivery all live here.
                </p>
                {canCheckIn && (
                  <button onClick={checkIn} disabled={busy === 'checkin'}
                    className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl transition-transform active:scale-95"
                    style={{ background: 'var(--accent-grad)', color: 'var(--on-accent)', boxShadow: 'var(--ember-glow-sm)' }}>
                    {busy === 'checkin' ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />}
                    <span className="font-display" style={{ fontSize: 13.5, fontWeight: 700 }}>Check in vehicle</span>
                  </button>
                )}
              </div>
            </Section>
          )}

          {/* Activity — the heartbeat. Always visible, every action lands here. */}
          <ActivitySection booking={booking} events={activity} />
        </div>

        {/* ── right: actions ── */}
        <div className="space-y-4">
          <Section title="Actions" delay={0.08}>
            <div className="space-y-2">
              {booking.status === 'pending' && (
                <ActionBtn onClick={confirmBooking} busy={busy === 'confirm'} icon={CheckCircle2} label="Confirm booking" primary />
              )}
              {canCheckIn && (
                <ActionBtn onClick={checkIn} busy={busy === 'checkin'} icon={LogIn} label="Check in vehicle" primary={booking.status !== 'pending'} />
              )}
              {booking.paymentStatus !== 'verified' && (
                <ActionBtn onClick={doVerifyPayment} busy={busy === 'pay'} icon={ShieldCheck} label="Verify payment" />
              )}
              {(booking.status === 'completed' || booking.invoiceId) && (
                <ActionBtn onClick={doInvoice} busy={busy === 'invoice'} icon={FileText} label={booking.invoiceId ? 'Open invoice + WhatsApp' : 'Generate invoice'} />
              )}
              <a href={wa(booking.userPhone)} target="_blank" rel="noopener noreferrer" onClick={() => record('whatsapp', 'WhatsApp opened')}
                className="flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl transition-colors" style={{ background: 'var(--fog)', border: '1px solid var(--border-2)', color: 'var(--fg-dim)' }}>
                <MessageCircle size={15} /><span className="font-body" style={{ fontSize: 13 }}>WhatsApp customer</span>
              </a>
              <a href={`tel:+91${booking.userPhone}`} onClick={() => record('call', 'Called customer')}
                className="flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl transition-colors" style={{ background: 'var(--fog)', border: '1px solid var(--border-2)', color: 'var(--fg-dim)' }}>
                <Phone size={15} /><span className="font-body" style={{ fontSize: 13 }}>Call customer</span>
              </a>
              {!['completed', 'cancelled'].includes(booking.status) && (
                <RescheduleControl booking={booking} onDone={(d, t) => { setBooking({ ...booking, scheduledDate: d, scheduledTime: t }); record('rescheduled', `Rescheduled to ${formatDate(d)} ${formatTime(t)}`); }} />
              )}
              {booking.status !== 'cancelled' && booking.status !== 'completed' && (
                <button onClick={cancel} disabled={busy === 'cancel'}
                  className="w-full px-3.5 py-2.5 rounded-xl font-body transition-colors" style={{ fontSize: 12.5, color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 22%, transparent)' }}>
                  {busy === 'cancel' ? 'Cancelling…' : 'Cancel booking'}
                </button>
              )}
            </div>
          </Section>

          <NotesSection booking={booking} onSaved={n => setBooking({ ...booking, adminNotes: n })} />
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── operational sub-sections ───────────────────────── */

function OperationalStage({ job, busy, onAdvance }: { job: Job; busy: string | null; onAdvance: (s: JobStatus, m: BookingStatus) => void }) {
  const idx = JOB_STAGES.findIndex(s => s.status === job.status);
  return (
    <Section title="Job stage" delay={0.1}>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {JOB_STAGES.map((s, i) => {
          const done = i <= idx; const current = i === idx;
          const next = i === idx + 1;
          return (
            <button key={s.status} disabled={!next || !!busy} onClick={() => onAdvance(s.status, s.booking)}
              className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl transition-all disabled:cursor-default"
              style={{ background: current ? 'var(--accent-mist)' : next ? 'var(--fog)' : 'transparent', border: `1px solid ${done ? 'var(--border-strong)' : next ? 'var(--border-2)' : 'var(--border)'}`, opacity: !next && !done ? 0.5 : 1 }}>
              {busy === 'stage:' + s.status ? <Loader2 size={15} className="animate-spin" style={{ color: 'var(--fg)' }} />
                : done ? <CheckCircle2 size={15} style={{ color: 'var(--fg)' }} /> : <Clock size={15} style={{ color: next ? 'var(--muted)' : 'var(--faint)' }} />}
              <span className="font-mono text-center" style={{ fontSize: 8.5, letterSpacing: '0.05em', textTransform: 'uppercase', color: done ? 'var(--fg-dim)' : 'var(--faint)' }}>{s.label}</span>
            </button>
          );
        })}
      </div>
      {idx < JOB_STAGES.length - 1 && (
        <p className="font-body mt-3" style={{ fontSize: 12, color: 'var(--muted)' }}>Tap the next stage to advance the job. The customer’s booking updates automatically.</p>
      )}
    </Section>
  );
}

function AssigneesSection({ job, actor, record, onChange }: { job: Job; actor: { id: string; name: string }; record: (t: ActivityType, title: string, meta?: Record<string, unknown>) => void; onChange: () => void }) {
  const [picking, setPicking] = useState(false);
  const [emps, setEmps] = useState<Employee[]>([]);
  const [saving, setSaving] = useState(false);
  const active = (job.assignments ?? []).filter(a => !a.removedAt);

  const openPicker = async () => {
    setPicking(true);
    if (emps.length === 0) { try { setEmps(await listEmployees()); } catch {} }
  };
  const toggle = async (e: Employee) => {
    setSaving(true);
    const isOn = active.some(a => a.employeeId === e.id);
    const next = isOn
      ? active.filter(a => a.employeeId !== e.id).map(a => ({ id: a.employeeId, name: a.employeeName }))
      : [...active.map(a => ({ id: a.employeeId, name: a.employeeName })), { id: e.id, name: e.name }];
    try {
      await setJobAssignees(job, next, actor);
      record('assigned', `${isOn ? 'Unassigned' : 'Assigned'} ${e.name}`);
      onChange();
    } catch { toast.error('Could not update team'); }
    setSaving(false);
  };

  return (
    <Section title="Assigned team" delay={0.12}
      action={<button onClick={openPicker} className="inline-flex items-center gap-1 font-mono" style={{ fontSize: 10, letterSpacing: '0.06em', color: 'var(--muted)' }}><Plus size={12} /> ASSIGN</button>}>
      {active.length === 0 ? (
        <p className="font-body" style={{ fontSize: 13, color: 'var(--muted)' }}>No one assigned yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {active.map(a => (
            <span key={a.employeeId} className="inline-flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full" style={{ background: 'var(--fog)', border: '1px solid var(--border-2)' }}>
              <span className="grid place-items-center rounded-full font-display" style={{ width: 24, height: 24, fontSize: 11, fontWeight: 700, background: 'var(--accent-grad)', color: 'var(--on-accent)' }}>{a.employeeName[0]}</span>
              <span className="font-body" style={{ fontSize: 12.5, color: 'var(--fg-dim)' }}>{a.employeeName}</span>
              <span className="font-mono" style={{ fontSize: 8.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>{a.role}</span>
            </span>
          ))}
        </div>
      )}
      {picking && (
        <div className="mt-3 rounded-xl p-2" style={{ background: 'var(--fog)', border: '1px solid var(--border-2)' }}>
          <div className="flex items-center justify-between px-1 pb-1.5">
            <span className="font-mono" style={{ fontSize: 9.5, letterSpacing: '0.1em', color: 'var(--faint)' }}>TAP TO TOGGLE</span>
            <button onClick={() => setPicking(false)}><X size={13} style={{ color: 'var(--muted)' }} /></button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {emps.length === 0 ? <span className="font-body px-1" style={{ fontSize: 12, color: 'var(--muted)' }}>Loading team…</span>
              : emps.map(e => {
                const on = active.some(a => a.employeeId === e.id);
                return (
                  <button key={e.id} disabled={saving} onClick={() => toggle(e)}
                    className="px-3 py-1.5 rounded-full font-body transition-colors"
                    style={{ fontSize: 12.5, background: on ? 'var(--accent-grad)' : 'transparent', color: on ? 'var(--on-accent)' : 'var(--fg-dim)', border: `1px solid ${on ? 'transparent' : 'var(--border-2)'}` }}>
                    {e.name}
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </Section>
  );
}

function PhotosSection({ job, record, onChange }: { job: Job; record: (t: ActivityType, title: string, meta?: Record<string, unknown>) => void; onChange: () => void }) {
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);
  const [up, setUp] = useState<'before' | 'after' | null>(null);
  const photos = job.photos ?? [];
  const before = photos.filter(p => p.kind === 'before');
  const after = photos.filter(p => p.kind === 'after');

  const upload = async (file: File | undefined, kind: 'before' | 'after') => {
    if (!file) return;
    setUp(kind);
    try {
      await addJobPhoto(job, file, kind);
      record('photo', `${kind === 'before' ? 'Before' : 'After'} photo added`);
      onChange();
      toast.success(kind === 'before' ? 'Before photo added' : 'After photo added');
    }
    catch { toast.error('Upload failed'); } finally { setUp(null); }
  };

  const Grid = ({ list, kind, inputRef }: { list: typeof photos; kind: 'before' | 'after'; inputRef: React.RefObject<HTMLInputElement> }) => (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono" style={{ fontSize: 9.5, letterSpacing: '0.1em', color: 'var(--faint)', textTransform: 'uppercase' }}>{kind}</span>
        <button onClick={() => inputRef.current?.click()} disabled={up === kind} className="inline-flex items-center gap-1 font-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
          {up === kind ? <Loader2 size={11} className="animate-spin" /> : <Camera size={12} />} ADD
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => upload(e.target.files?.[0], kind)} />
      </div>
      {list.length === 0 ? (
        <button onClick={() => inputRef.current?.click()} className="w-full grid place-items-center rounded-xl" style={{ height: 76, border: '1px dashed var(--border-strong)', color: 'var(--faint)' }}>
          <Camera size={18} />
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {list.map(p => <img key={p.path} src={p.url} alt={kind} className="w-full rounded-lg object-cover" style={{ aspectRatio: '1', border: '1px solid var(--border)' }} />)}
        </div>
      )}
    </div>
  );

  return (
    <Section title="Photos" delay={0.14}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Grid list={before} kind="before" inputRef={beforeRef} />
        <Grid list={after} kind="after" inputRef={afterRef} />
      </div>
    </Section>
  );
}

const ACTIVITY_ICON: Record<ActivityType, React.ElementType> = {
  booking_created: CalendarClock, confirmed: CheckCircle2, rescheduled: CalendarClock,
  checked_in: LogIn, stage: Clock, assigned: Users, photo: Camera, payment: IndianRupee,
  invoice: FileText, whatsapp: MessageCircle, call: Phone, note: FileText,
  cancelled: X, delivered: CheckCircle2,
};

function ActivitySection({ booking, events }: { booking: Booking; events: ActivityEvent[] }) {
  // synthetic first event so every booking has a heartbeat from day one
  const created = {
    id: '__created', type: 'booking_created' as ActivityType, title: 'Booking placed',
    actorName: booking.userName,
    at: booking.createdAt,
  };
  const rows = [...events, created];
  const fmt = (t?: { toDate?: () => Date }) => t?.toDate ? t.toDate().toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';

  return (
    <Section title="Activity" delay={0.18}>
      <div className="space-y-0">
        {rows.map((e, i) => {
          const Icon = ACTIVITY_ICON[e.type] ?? Clock;
          return (
            <div key={e.id} className="flex gap-3 pb-4 last:pb-0">
              <div className="flex flex-col items-center">
                <span className="grid place-items-center rounded-full shrink-0" style={{ width: 28, height: 28, background: 'var(--smoke)', border: '1px solid var(--border-strong)', color: 'var(--fg)' }}><Icon size={13} /></span>
                {i < rows.length - 1 && <span className="flex-1 w-px my-1" style={{ background: 'var(--border-strong)', minHeight: 8 }} />}
              </div>
              <div className="pb-1 min-w-0 pt-0.5">
                <p className="font-body" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg)' }}>{e.title}</p>
                <p className="font-mono mt-0.5" style={{ fontSize: 10, color: 'var(--muted)' }}>
                  {e.actorName}{fmt(e.at) ? ` · ${fmt(e.at)}` : ''}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function NotesSection({ booking, onSaved }: { booking: Booking; onSaved: (n: string) => void }) {
  const [draft, setDraft] = useState(booking.adminNotes ?? '');
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(booking.adminNotes ?? ''), [booking.id]);
  const save = async () => {
    setSaving(true);
    try { await saveBookingAdminNotes(booking.id, draft.trim()); onSaved(draft.trim()); toast.success('Notes saved'); }
    catch { toast.error('Could not save'); } finally { setSaving(false); }
  };
  return (
    <Section title="Internal notes" delay={0.1}>
      <textarea value={draft} maxLength={500} rows={3} onChange={e => setDraft(e.target.value)}
        placeholder="Staff-only — special requests, damage on arrival…"
        className="w-full rounded-xl px-3 py-2.5 font-body resize-none outline-none"
        style={{ fontSize: 13, background: 'var(--fog)', border: '1px solid var(--border-2)', color: 'var(--fg)' }} />
      {draft !== (booking.adminNotes ?? '') && (
        <button onClick={save} disabled={saving} className="mt-2 w-full py-2 rounded-xl font-body" style={{ fontSize: 12.5, background: 'var(--fog)', border: '1px solid var(--border-2)', color: 'var(--fg-dim)' }}>
          {saving ? 'Saving…' : 'Save notes'}
        </button>
      )}
    </Section>
  );
}

function RescheduleControl({ booking, onDone }: { booking: Booking; onDone: (d: string, t: string) => void }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(booking.scheduledDate);
  const [t, setT] = useState(booking.scheduledTime);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await rescheduleBooking(booking.id, d, t); onDone(d, t); toast.success('Rescheduled'); setOpen(false); }
    catch { toast.error('Could not reschedule'); } finally { setSaving(false); }
  };
  if (!open) return (
    <button onClick={() => setOpen(true)} className="flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl" style={{ background: 'var(--fog)', border: '1px solid var(--border-2)', color: 'var(--fg-dim)' }}>
      <CalendarClock size={15} /><span className="font-body" style={{ fontSize: 13 }}>Reschedule</span>
    </button>
  );
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--fog)', border: '1px solid var(--border-2)' }}>
      <div className="flex gap-2 mb-2">
        <input type="date" value={d} min={new Date().toISOString().split('T')[0]} onChange={e => setD(e.target.value)} className="flex-1 rounded-lg px-2 py-1.5 font-body outline-none" style={{ fontSize: 12.5, background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--fg)' }} />
        <input type="time" value={t} onChange={e => setT(e.target.value)} className="w-28 rounded-lg px-2 py-1.5 font-body outline-none" style={{ fontSize: 12.5, background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--fg)' }} />
      </div>
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} className="flex-1 py-1.5 rounded-lg font-body" style={{ fontSize: 12, color: 'var(--muted)' }}>Cancel</button>
        <button onClick={save} disabled={saving || (d === booking.scheduledDate && t === booking.scheduledTime)} className="flex-1 py-1.5 rounded-lg font-display" style={{ fontSize: 12, fontWeight: 700, background: 'var(--accent-grad)', color: 'var(--on-accent)' }}>{saving ? 'Moving…' : 'Move'}</button>
      </div>
    </div>
  );
}

/* ───────────────────────── shared bits ───────────────────────── */

function Section({ title, children, action, delay = 0 }: { title: string; children: React.ReactNode; action?: React.ReactNode; delay?: number }) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE, delay }}
      className="rounded-2xl p-4 md:p-5" style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)' }}>
      <div className="flex items-center justify-between mb-3.5">
        <h2 className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--fg-dim)' }}>{title}</h2>
        {action}
      </div>
      {children}
    </motion.section>
  );
}

function Field({ icon: Icon, label, value, sub, tone }: { icon: React.ElementType; label: string; value: string; sub?: string; tone?: 'good' | 'warn' }) {
  const color = tone === 'good' ? 'var(--success)' : tone === 'warn' ? 'var(--warning)' : 'var(--muted)';
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={15} style={{ color, marginTop: 2, flexShrink: 0 }} />
      <div className="min-w-0">
        <p className="font-mono" style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--faint)' }}>{label}</p>
        <p className="font-body truncate" style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>{value}</p>
        {sub && <p className="font-body truncate" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{sub}</p>}
      </div>
    </div>
  );
}

// lets us pass the category icon into <Field icon=…>
function ServiceIconAsField(category: string) {
  return function Wrapped({ size, style }: { size?: number; style?: React.CSSProperties }) {
    return <ServiceIcon category={category} size={size} style={style} />;
  };
}

function ActionBtn({ onClick, busy, icon: Icon, label, primary }: { onClick: () => void; busy?: boolean; icon: React.ElementType; label: string; primary?: boolean }) {
  return (
    <button onClick={onClick} disabled={busy}
      className="flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl transition-transform active:scale-[0.98]"
      style={primary
        ? { background: 'var(--accent-grad)', color: 'var(--on-accent)', boxShadow: 'var(--ember-glow-sm)' }
        : { background: 'var(--fog)', border: '1px solid var(--border-2)', color: 'var(--fg-dim)' }}>
      {busy ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}
      <span className="font-display" style={{ fontSize: 13, fontWeight: primary ? 700 : 600 }}>{label}</span>
    </button>
  );
}

function StageBadge({ booking, hasJob }: { booking: Booking; hasJob: boolean }) {
  const cancelled = booking.status === 'cancelled';
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
      style={{ background: cancelled ? 'color-mix(in srgb, var(--danger) 12%, transparent)' : 'var(--accent-mist)', border: '1px solid var(--border-strong)' }}>
      <span className="rounded-full" style={{ width: 6, height: 6, background: cancelled ? 'var(--danger)' : hasJob ? 'var(--success)' : 'var(--warning)' }} />
      <span className="font-mono" style={{ fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-dim)' }}>{getStatusLabel(booking.status)}</span>
    </span>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="h-4 w-24 shimmer rounded mb-5" />
      <div className="flex items-center gap-3.5 mb-6">
        <div className="w-13 h-13 shimmer rounded-2xl" style={{ width: 52, height: 52 }} />
        <div className="flex-1"><div className="h-6 w-48 shimmer rounded mb-2" /><div className="h-3.5 w-64 shimmer rounded" /></div>
      </div>
      <div className="h-16 shimmer rounded-2xl mb-4" />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4"><div className="h-40 shimmer rounded-2xl" /><div className="h-32 shimmer rounded-2xl" /></div>
        <div className="space-y-4"><div className="h-56 shimmer rounded-2xl" /><div className="h-28 shimmer rounded-2xl" /></div>
      </div>
    </div>
  );
}
