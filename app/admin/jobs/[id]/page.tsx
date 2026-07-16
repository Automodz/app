'use client';
/**
 * Job Operational Workspace (walk-ins). Same workspace, same components as the
 * booking workspace — a walk-in simply has no commercial booking in front of it,
 * so it opens straight into operational mode. Booking-linked jobs redirect to
 * the unified booking workspace so there is ever only ONE place to manage a car.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Phone, MessageCircle, Car, User as UserIcon, Clock,
} from 'lucide-react';
import {
  getJob, updateJobStatus, saveJobNotes,
  logActivity, listJobActivity, type ActivityEvent, type ActivityType,
} from '@/lib/firebaseService';
import { formatCurrency, getStatusLabel } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import type { Job, JobStatus } from '@/lib/types';
import ServiceIcon from '@/components/ui/ServiceIcon';
import ErrorState from '@/components/ui/ErrorState';
import {
  Section, Field, serviceIconField, WorkspaceSkeleton,
  OperationalStage, AssigneesSection, PhotosSection, PaymentsSection, ActivityTimeline, EASE,
} from '@/components/workspace/parts';

const wa = (phone: string) => `https://wa.me/${phone.startsWith('91') ? phone : '91' + phone}`;

export default function JobWorkspace() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAppStore();
  const actor = { id: user?.uid ?? 'admin', name: user?.name || 'Admin' };

  const [job, setJob] = useState<Job | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);

  const load = useCallback(async () => {
    setError(false); setLoading(true);
    try {
      const j = await getJob(id);
      if (!j) { setError(true); return; }
      // booking-linked jobs live in the unified booking workspace — one place only
      if (j.bookingId) { router.replace(`/admin/bookings/${j.bookingId}`); return; }
      setJob(j);
      setNotes(j.notes ?? '');
      setActivity(await listJobActivity(id).catch(() => []));
    } catch (e) { console.error('job workspace load failed', e); setError(true); }
    finally { setLoading(false); }
  }, [id, router]);
  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(async () => { try { setJob(await getJob(id)); } catch {} }, [id]);
  const record = useCallback(async (type: ActivityType, title: string, meta?: Record<string, unknown>) => {
    await logActivity({ type, title, jobId: id, customerId: job?.customerId, actor, meta });
    try { setActivity(await listJobActivity(id)); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, job?.customerId]);

  const advance = async (status: JobStatus) => {
    if (!job) return;
    setBusy('stage:' + status);
    try {
      await updateJobStatus(job.id, status, actor);
      record(status === 'completed' ? 'delivered' : 'stage', 'Stage · ' + getStatusLabel(status));
      await refresh();
      toast.success('Stage updated');
    } catch { toast.error('Could not update stage'); } finally { setBusy(null); }
  };

  const saveNotes = async () => {
    if (!job) return;
    setNotesSaving(true);
    try { await saveJobNotes(job.id, notes.trim()); toast.success('Notes saved'); }
    catch { toast.error('Could not save'); } finally { setNotesSaving(false); }
  };

  if (loading) return <WorkspaceSkeleton />;
  if (error || !job) return <div className="p-6 max-w-3xl"><ErrorState onRetry={load} message="Couldn't load this job." /></div>;

  const category = job.serviceItems[0]?.category;
  const services = job.serviceItems.map(s => s.serviceName).join(', ');
  const cancelled = job.status === 'cancelled';

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 mb-4 font-mono" style={{ fontSize: 11, letterSpacing: '0.06em', color: 'var(--muted)' }}>
        <ArrowLeft size={13} /> ACTIVE JOBS
      </button>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
        className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-3.5 min-w-0">
          <span className="grid place-items-center rounded-2xl shrink-0" style={{ width: 52, height: 52, background: 'var(--smoke)', border: '1px solid var(--border-strong)', color: 'var(--chrome)' }}>
            <ServiceIcon category={category} size={24} />
          </span>
          <div className="min-w-0">
            <h1 className="font-display truncate" style={{ fontSize: 'clamp(22px,4vw,30px)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--fg)', lineHeight: 1.05 }}>{job.customerName}</h1>
            <p className="font-body mt-0.5 truncate" style={{ fontSize: 14, color: 'var(--muted)' }}>{services} · {job.vehicleName} · {job.vehicleRegNo}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: cancelled ? 'color-mix(in srgb, var(--danger) 12%, transparent)' : 'var(--accent-mist)', border: '1px solid var(--border-strong)' }}>
            <span className="rounded-full" style={{ width: 6, height: 6, background: cancelled ? 'var(--danger)' : 'var(--success)' }} />
            <span className="font-mono" style={{ fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-dim)' }}>{getStatusLabel(job.status)}</span>
          </span>
          <span className="font-mono px-2 py-1 rounded-full" style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--muted)', background: 'var(--fog)', border: '1px solid var(--border-2)' }}>WALK-IN</span>
          <span className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg)' }}>{formatCurrency(job.totalAmount)}</span>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Section title="Overview" delay={0.06}>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
              <Field icon={UserIcon} label="Customer" value={job.customerName} sub={job.customerPhone} />
              <Field icon={Car} label="Vehicle" value={job.vehicleName} sub={job.vehicleRegNo} />
              <Field icon={serviceIconField(category ?? '')} label="Services" value={services} sub={`${job.serviceItems.length} item${job.serviceItems.length === 1 ? '' : 's'}`} />
              <Field icon={job.bay ? Car : Clock} label="Bay" value={job.bay ? `Bay ${job.bay}` : 'Unassigned'} sub={`By ${job.createdByEmployeeName}`} />
            </div>
          </Section>

          <OperationalStage job={job} busy={busy} onAdvance={(s) => advance(s)} />
          <AssigneesSection job={job} actor={actor} record={record} onChange={refresh} />
          <PhotosSection job={job} record={record} onChange={refresh} />
          <PaymentsSection job={job} actor={actor} record={record} onChange={refresh} />
          <ActivityTimeline events={activity} seed={{ type: 'checked_in', title: 'Walk-in checked in', actorName: job.createdByEmployeeName, at: job.createdAt }} />
        </div>

        <div className="space-y-4">
          <Section title="Actions" delay={0.08}>
            <div className="space-y-2">
              <a href={wa(job.customerPhone)} target="_blank" rel="noopener noreferrer" onClick={() => record('whatsapp', 'WhatsApp opened')}
                className="flex items-center gap-2.5 w-full px-3.5 py-3 rounded-xl" style={{ background: 'var(--fog)', border: '1px solid var(--border-2)', color: 'var(--fg-dim)' }}>
                <MessageCircle size={15} /><span className="font-body" style={{ fontSize: 13 }}>WhatsApp customer</span>
              </a>
              <a href={`tel:+91${job.customerPhone}`} onClick={() => record('call', 'Called customer')}
                className="flex items-center gap-2.5 w-full px-3.5 py-3 rounded-xl" style={{ background: 'var(--fog)', border: '1px solid var(--border-2)', color: 'var(--fg-dim)' }}>
                <Phone size={15} /><span className="font-body" style={{ fontSize: 13 }}>Call customer</span>
              </a>
            </div>
          </Section>

          <Section title="Internal notes" delay={0.1}>
            <textarea value={notes} maxLength={500} rows={3} onChange={e => setNotes(e.target.value)}
              placeholder="Staff-only — condition on arrival, special requests…"
              className="w-full rounded-xl px-3 py-2.5 font-body resize-none outline-none"
              style={{ fontSize: 13, background: 'var(--fog)', border: '1px solid var(--border-2)', color: 'var(--fg)' }} />
            {notes !== (job.notes ?? '') && (
              <button onClick={saveNotes} disabled={notesSaving} className="mt-2 w-full py-2 rounded-xl font-body" style={{ fontSize: 12.5, background: 'var(--fog)', border: '1px solid var(--border-2)', color: 'var(--fg-dim)' }}>
                {notesSaving ? 'Saving…' : 'Save notes'}
              </button>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
