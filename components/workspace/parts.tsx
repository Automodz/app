'use client';
/**
 * Shared operational-workspace building blocks. Used by BOTH the booking
 * workspace (/admin/bookings/[id]) and the walk-in job workspace
 * (/admin/jobs/[id]) so there is exactly ONE implementation of the job stage
 * rail, team assignment, photos, activity timeline and layout primitives.
 */
import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Loader2, CheckCircle2, Clock, Plus, X, Camera, CalendarClock, LogIn,
  Users, IndianRupee, FileText, MessageCircle, Phone, Star,
} from 'lucide-react';
import { setJobAssignees, addJobPhoto, listEmployees, addJobPayment } from '@/lib/firebaseService';
import { getStatusLabel, formatCurrency } from '@/lib/utils';
import type { Job, JobStatus, BookingStatus, Employee, JobPhoto } from '@/lib/types';
import type { ActivityType, ActivityEvent } from '@/lib/services/activity';
import ServiceIcon from '@/components/ui/ServiceIcon';

export const EASE = [0.22, 1, 0.36, 1] as const;

// operational stage order + the commercial status each mirrors to
export const JOB_STAGES: { status: JobStatus; label: string; booking: BookingStatus }[] = [
  { status: 'checked_in',         label: 'Checked in',    booking: 'vehicle_received' },
  { status: 'in_progress',        label: 'In progress',   booking: 'in_progress' },
  { status: 'quality_check',      label: 'Quality check', booking: 'quality_check' },
  { status: 'ready_for_delivery', label: 'Ready',         booking: 'ready_for_delivery' },
  { status: 'completed',          label: 'Delivered',     booking: 'completed' },
];

export type RecordFn = (t: ActivityType, title: string, meta?: Record<string, unknown>) => void;

/* ── layout primitives ── */

export function Section({ title, children, action, delay = 0 }: { title: string; children: React.ReactNode; action?: React.ReactNode; delay?: number }) {
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

export function Field({ icon: Icon, label, value, sub, tone }: { icon: React.ElementType; label: string; value: string; sub?: string; tone?: 'good' | 'warn' }) {
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

/** Adapter so the service-category glyph can be passed into <Field icon=…>. */
export function serviceIconField(category: string) {
  return function Wrapped({ size, style }: { size?: number; style?: React.CSSProperties }) {
    return <ServiceIcon category={category} size={size} style={style} />;
  };
}

export function ActionBtn({ onClick, busy, icon: Icon, label, primary }: { onClick: () => void; busy?: boolean; icon: React.ElementType; label: string; primary?: boolean }) {
  return (
    <button onClick={onClick} disabled={busy}
      className="flex items-center gap-2.5 w-full px-3.5 py-3 rounded-xl transition-transform active:scale-[0.98]"
      style={primary
        ? { background: 'var(--accent-grad)', color: 'var(--on-accent)', boxShadow: 'var(--ember-glow-sm)' }
        : { background: 'var(--fog)', border: '1px solid var(--border-2)', color: 'var(--fg-dim)' }}>
      {busy ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}
      <span className="font-display" style={{ fontSize: 13, fontWeight: primary ? 700 : 600 }}>{label}</span>
    </button>
  );
}

export function WorkspaceSkeleton() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="h-4 w-24 shimmer rounded mb-5" />
      <div className="flex items-center gap-3.5 mb-6">
        <div className="shimmer rounded-2xl" style={{ width: 52, height: 52 }} />
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

/* ── operational sections (job-driven) ── */

export function OperationalStage({ job, busy, onAdvance }: { job: Job; busy: string | null; onAdvance: (s: JobStatus, m: BookingStatus) => void }) {
  const idx = JOB_STAGES.findIndex(s => s.status === job.status);
  // 'collected' covers booking-verified payments that never hit the job ledger
  const balance = job.paymentStatus === 'collected' ? 0 : Math.max(0, job.totalAmount - (job.amountPaid ?? 0));
  const [deliverAsk, setDeliverAsk] = useState(false);

  // Delivery is guarded: never one-tap-finish a job with money outstanding.
  const request = (s: JobStatus, m: BookingStatus) => {
    if (s === 'completed' && balance > 0) { setDeliverAsk(true); return; }
    onAdvance(s, m);
  };

  return (
    <Section title="Job stage" delay={0.1}>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {JOB_STAGES.map((s, i) => {
          const done = i <= idx; const current = i === idx; const next = i === idx + 1;
          return (
            <button key={s.status} disabled={!next || !!busy} onClick={() => request(s.status, s.booking)}
              className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl transition-all disabled:cursor-default"
              style={{ background: current ? 'var(--accent-mist)' : next ? 'var(--fog)' : 'transparent', border: `1px solid ${done ? 'var(--border-strong)' : next ? 'var(--border-2)' : 'var(--border)'}`, opacity: !next && !done ? 0.5 : 1 }}>
              {busy === 'stage:' + s.status ? <Loader2 size={15} className="animate-spin" style={{ color: 'var(--fg)' }} />
                : done ? <CheckCircle2 size={15} style={{ color: 'var(--fg)' }} /> : <Clock size={15} style={{ color: next ? 'var(--muted)' : 'var(--faint)' }} />}
              <span className="font-mono text-center" style={{ fontSize: 8.5, letterSpacing: '0.05em', textTransform: 'uppercase', color: done ? 'var(--fg-dim)' : 'var(--faint)' }}>{s.label}</span>
            </button>
          );
        })}
      </div>
      {deliverAsk && (
        <div className="mt-3 rounded-xl p-3.5" style={{ background: 'color-mix(in srgb, var(--warning) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--warning) 25%, transparent)' }}>
          <p className="font-body inline-flex items-center gap-2" style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>
            <IndianRupee size={14} style={{ color: 'var(--warning)' }} /> {formatCurrency(balance)} still outstanding - has payment been received?
          </p>
          <p className="font-body mt-1" style={{ fontSize: 12, color: 'var(--muted)' }}>Record it in Payments below, or deliver with the balance pending - it will stay flagged until collected.</p>
          <div className="flex gap-2 mt-3">
            <button onClick={() => setDeliverAsk(false)}
              className="flex-1 py-2.5 rounded-lg font-display" style={{ fontSize: 12, fontWeight: 700, background: 'var(--accent-grad)', color: 'var(--on-accent)' }}>
              Collect payment first
            </button>
            <button onClick={() => { setDeliverAsk(false); onAdvance('completed', 'completed'); }}
              className="flex-1 py-2.5 rounded-lg font-body" style={{ fontSize: 12, color: 'var(--warning)', border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)' }}>
              Deliver - payment pending
            </button>
          </div>
        </div>
      )}
      {idx < JOB_STAGES.length - 1 && !deliverAsk && (
        <p className="font-body mt-3" style={{ fontSize: 12, color: 'var(--muted)' }}>Tap the next stage to advance. The customer’s booking stays in sync automatically.</p>
      )}
    </Section>
  );
}

export function AssigneesSection({ job, actor, record, onChange }: { job: Job; actor: { id: string; name: string }; record: RecordFn; onChange: () => void }) {
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
                    className="px-3 py-2 rounded-full font-body transition-colors"
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

type PhotoKind = JobPhoto['kind'];

export function PhotosSection({ job, record, onChange }: { job: Job; record: RecordFn; onChange: () => void }) {
  const beforeRef = useRef<HTMLInputElement>(null);
  const duringRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);
  const [up, setUp] = useState<PhotoKind | null>(null);
  const photos = job.photos ?? [];
  const before = photos.filter(p => p.kind === 'before');
  const during = photos.filter(p => p.kind === 'during');
  const after = photos.filter(p => p.kind === 'after');

  const upload = async (file: File | undefined, kind: PhotoKind) => {
    if (!file) return;
    setUp(kind);
    try {
      await addJobPhoto(job, file, kind);
      const label = kind.charAt(0).toUpperCase() + kind.slice(1);
      record('photo', `${label} photo added`);
      onChange();
      toast.success(`${label} photo added`);
    } catch { toast.error('Upload failed'); } finally { setUp(null); }
  };

  const Grid = ({ list, kind, inputRef }: { list: typeof photos; kind: PhotoKind; inputRef: React.RefObject<HTMLInputElement> }) => (
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
      <div className="grid sm:grid-cols-3 gap-4">
        <Grid list={before} kind="before" inputRef={beforeRef} />
        <Grid list={during} kind="during" inputRef={duringRef} />
        <Grid list={after} kind="after" inputRef={afterRef} />
      </div>
    </Section>
  );
}

/* ── payments (job ledger) ── */

export function PaymentsSection({ job, actor, record, onChange }: { job: Job; actor: { id: string; name: string }; record: RecordFn; onChange: () => void }) {
  const paid = job.amountPaid ?? 0;
  const balance = job.paymentStatus === 'collected' ? 0 : Math.max(0, job.totalAmount - paid);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'upi'>('cash');
  const [txn, setTxn] = useState('');
  const [saving, setSaving] = useState(false);
  const ledger = job.payments ?? [];

  const openForm = () => { setAmount(String(balance || job.totalAmount)); setMethod('cash'); setTxn(''); setOpen(true); };
  const submit = async () => {
    const amt = Math.round(Number(amount));
    if (!amt || amt <= 0) { toast.error('Enter an amount'); return; }
    setSaving(true);
    try {
      await addJobPayment(job, { amount: amt, method, transactionId: txn.trim() || undefined, by: actor });
      record('payment', `${formatCurrency(amt)} received · ${method.toUpperCase()}`, { amount: amt, method });
      setOpen(false);
      onChange();
      toast.success('Payment recorded');
    } catch { toast.error('Could not record payment'); } finally { setSaving(false); }
  };

  return (
    <Section title="Payments" delay={0.15}
      action={balance > 0
        ? <button onClick={openForm} className="inline-flex items-center gap-1 font-mono" style={{ fontSize: 10, letterSpacing: '0.06em', color: 'var(--muted)' }}><Plus size={12} /> RECORD</button>
        : <span className="inline-flex items-center gap-1 font-mono" style={{ fontSize: 10, letterSpacing: '0.06em', color: 'var(--success)' }}><CheckCircle2 size={12} /> SETTLED</span>}>
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="font-mono" style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--faint)' }}>Collected</p>
          <p className="font-display" style={{ fontSize: 20, fontWeight: 800, color: 'var(--fg)' }}>{formatCurrency(paid)} <span className="font-body" style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>of {formatCurrency(job.totalAmount)}</span></p>
        </div>
        {balance > 0 && <p className="font-mono" style={{ fontSize: 11, color: 'var(--warning)' }}>{formatCurrency(balance)} due</p>}
      </div>

      {ledger.length > 0 && (
        <div className="space-y-1.5 mb-1">
          {ledger.map(p => (
            <div key={p.id} className="flex items-center justify-between rounded-lg px-2.5 py-1.5" style={{ background: 'var(--fog)' }}>
              <span className="font-body inline-flex items-center gap-1.5" style={{ fontSize: 12.5, color: 'var(--fg-dim)' }}><IndianRupee size={11} />{formatCurrency(p.amount)} · {p.method.toUpperCase()}</span>
              <span className="font-mono" style={{ fontSize: 9.5, color: 'var(--muted)' }}>{p.receivedByName}</span>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-3 rounded-xl p-3 space-y-2" style={{ background: 'var(--fog)', border: '1px solid var(--border-2)' }}>
          <div className="flex gap-2">
            <input inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="Amount"
              className="flex-1 rounded-lg px-2.5 py-2 font-body outline-none" style={{ fontSize: 13, background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--fg)' }} />
            {(['cash', 'upi'] as const).map(m => (
              <button key={m} onClick={() => setMethod(m)} className="px-3 rounded-lg font-mono" style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', background: method === m ? 'var(--accent-grad)' : 'transparent', color: method === m ? 'var(--on-accent)' : 'var(--fg-dim)', border: `1px solid ${method === m ? 'transparent' : 'var(--border-2)'}` }}>{m}</button>
            ))}
          </div>
          {method === 'upi' && (
            <input value={txn} onChange={e => setTxn(e.target.value)} placeholder="UPI transaction id (optional)"
              className="w-full rounded-lg px-2.5 py-2 font-body outline-none" style={{ fontSize: 12.5, background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--fg)' }} />
          )}
          <div className="flex gap-2">
            <button onClick={() => setOpen(false)} className="flex-1 py-2 rounded-lg font-body" style={{ fontSize: 12.5, color: 'var(--muted)' }}>Cancel</button>
            <button onClick={submit} disabled={saving} className="flex-1 py-2 rounded-lg font-display inline-flex items-center justify-center gap-1.5" style={{ fontSize: 12.5, fontWeight: 700, background: 'var(--accent-grad)', color: 'var(--on-accent)' }}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : null}{saving ? 'Saving…' : 'Record'}
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ── activity timeline (the heartbeat) ── */

export const ACTIVITY_ICON: Record<ActivityType, React.ElementType> = {
  booking_created: CalendarClock, confirmed: CheckCircle2, rescheduled: CalendarClock,
  checked_in: LogIn, stage: Clock, assigned: Users, photo: Camera, payment: IndianRupee,
  invoice: FileText, whatsapp: MessageCircle, call: Phone, note: FileText,
  cancelled: X, delivered: CheckCircle2, review: Star,
};

type Seed = { type: ActivityType; title: string; actorName: string; at?: { toDate?: () => Date } };

export function ActivityTimeline({ events, seed }: { events: ActivityEvent[]; seed?: Seed }) {
  const rows: { id: string; type: ActivityType; title: string; actorName: string; at?: { toDate?: () => Date } }[] =
    [...events, ...(seed ? [{ id: '__seed', ...seed }] : [])];
  const fmt = (t?: { toDate?: () => Date }) => t?.toDate ? t.toDate().toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
  return (
    <Section title="Activity" delay={0.18}>
      {rows.length === 0 ? (
        <p className="font-body" style={{ fontSize: 13, color: 'var(--muted)' }}>No activity yet.</p>
      ) : (
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
                  <p className="font-mono mt-0.5" style={{ fontSize: 10, color: 'var(--muted)' }}>{e.actorName}{fmt(e.at) ? ` · ${fmt(e.at)}` : ''}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

export { getStatusLabel };
