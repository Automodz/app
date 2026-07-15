'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Car, Phone, CheckCircle2, XCircle, IndianRupee,
  FileText, MessageCircle, ChevronRight, X, Camera, Users, Star,
} from 'lucide-react';
import {
  getJob, updateJobStatus, addJobPayment, addJobPhoto, saveJobNotes,
  getRecipePrefill, consumeActuals,
  createInvoiceForJob, getInvoice, buildInvoiceWhatsAppLink, invoicePublicUrl,
  buildReviewAskLink, setJobAssignees, listEmployees } from '@/lib/firebaseService';
import { formatCurrency, formatTime } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import type { Job, Invoice, JobStatus, Employee } from '@/lib/types';
import BeforeAfterSlider from '@/components/ui/BeforeAfterSlider';
import { format } from 'date-fns';

const FLOW: { from: JobStatus; to: JobStatus; label: string }[] = [
  { from: 'checked_in',         to: 'in_progress',        label: 'Start Work' },
  { from: 'in_progress',        to: 'quality_check',      label: 'Send to Quality Check' },
  { from: 'quality_check',      to: 'ready_for_delivery', label: 'Ready for Delivery' },
  { from: 'ready_for_delivery', to: 'completed',          label: 'Hand Over Vehicle' },
];

const STATUS_LABEL: Record<JobStatus, string> = {
  checked_in: 'Checked In', in_progress: 'In Progress',
  quality_check: 'Quality Check', ready_for_delivery: 'Ready for Delivery',
  completed: 'Delivered', cancelled: 'Cancelled',
};

export default function StoreJobPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { kioskEmployee, user } = useAppStore();
  const isAdmin = user?.role === 'admin';
  const [job, setJob] = useState<Job | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [txnId, setTxnId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState<'before' | 'after' | null>(null);
  const beforeInput = useRef<HTMLInputElement>(null);
  const afterInput = useRef<HTMLInputElement>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [staff, setStaff] = useState<Employee[]>([]);
  const [assignDraft, setAssignDraft] = useState<Map<string, string>>(new Map());
  const [assignSaving, setAssignSaving] = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [materials, setMaterials] = useState<{ itemId: string; itemName: string; qty: string; unit: string }[]>([]);

  useEffect(() => { setNotesDraft(job?.notes ?? ''); }, [job?.id]);

  const handleSaveNotes = async () => {
    if (!job) return;
    setNotesSaving(true);
    try {
      await saveJobNotes(job.id, notesDraft.trim());
      setJob(prev => prev ? { ...prev, notes: notesDraft.trim() } : null);
      toast.success('Notes saved');
    } catch { toast.error('Could not save notes'); }
    setNotesSaving(false);
  };

  const capturePhoto = async (kind: 'before' | 'after', files: FileList | null) => {
    if (!files?.length || !job) return;
    setUploadingPhoto(kind);
    try {
      for (const file of Array.from(files).slice(0, 4)) {
        await addJobPhoto(job, file, kind);
      }
      toast.success(`${kind === 'before' ? 'Before' : 'After'} photo added`);
      await load();
    } catch (e) { console.error(e); toast.error('Photo upload failed'); }
    setUploadingPhoto(null);
  };

  const load = useCallback(async () => {
    const j = await getJob(id);
    setJob(j);
    if (j?.invoiceId) setInvoice(await getInvoice(j.invoiceId));
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const emp = kioskEmployee ? { id: kioskEmployee.id, name: kioskEmployee.name } : null;

  const openAssign = async () => {
    setAssignOpen(true);
    if (staff.length === 0) {
      try { setStaff(await listEmployees()); } catch { toast.error('Could not load staff'); }
    }
    const active = (job?.assignments ?? []).filter(a => !a.removedAt);
    setAssignDraft(new Map(active.map(a => [a.employeeId, a.employeeName])));
  };

  const saveAssign = async () => {
    if (!job || !user) return;
    if (assignDraft.size === 0) { toast.error('Assign at least one employee'); return; }
    setAssignSaving(true);
    try {
      const next = [...assignDraft].map(([id, name]) => ({ id, name }));
      await setJobAssignees(job, next, { id: user.uid, name: user.name });
      setJob(await getJob(job.id));
      setAssignOpen(false);
      toast.success('Assignees updated');
    } catch { toast.error('Could not update assignees'); }
    finally { setAssignSaving(false); }
  };

  const advance = async (to: JobStatus) => {
    if (!emp || !job) return;
    // Delivery gate: the car doesn't leave until the money is in (or the
    // owner explicitly overrides - logged in statusHistory like any change).
    if (to === 'completed' && job.paymentStatus !== 'collected' && !isAdmin) {
      toast.error(`Collect ${formatCurrency(job.totalAmount - (job.amountPaid ?? 0))} before handover (owner can override)`);
      setPayAmount(String(job.totalAmount - (job.amountPaid ?? 0)));
      setPayModal(true);
      return;
    }
    // Materials actuals: recipes are per-service estimates - vehicle size
    // varies, so staff confirm what was actually used at handover.
    if (to === 'completed' && !materialsOpen) {
      try {
        const prefill = await getRecipePrefill(job.serviceItems.map(i => i.serviceId));
        if (prefill.length > 0) {
          setMaterials(prefill.map(x => ({ ...x, qty: String(x.qty) })));
          setMaterialsOpen(true);
          return;
        }
      } catch { /* no recipes - plain completion */ }
    }
    setBusy(true);
    try {
      await updateJobStatus(job.id, to, emp);
      toast.success(STATUS_LABEL[to]);
      await load();
    } catch { toast.error('Update failed'); }
    setBusy(false);
  };

  const balance = job ? job.totalAmount - (job.amountPaid ?? 0) : 0;

  const collect = async (method: 'upi' | 'cash') => {
    if (!job || !emp) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) { toast.error('Enter the amount received'); return; }
    if (amount > balance) { toast.error(`Balance is only ${formatCurrency(balance)}`); return; }
    setBusy(true);
    try {
      await addJobPayment(job, {
        amount, method,
        transactionId: method === 'upi' && txnId ? txnId : undefined,
        by: { id: emp.id, name: emp.name },
      });
      toast.success(amount >= balance
        ? `Payment complete · ${method.toUpperCase()}`
        : `${formatCurrency(amount)} received · ${formatCurrency(balance - amount)} due`);
      setPayModal(false); setTxnId(''); setPayAmount('');
      await load();
    } catch { toast.error('Could not record payment'); }
    setBusy(false);
  };

  const generateInvoice = async () => {
    if (!job || !emp) return;
    setBusy(true);
    try {
      const inv = await createInvoiceForJob(job, emp);
      setInvoice(inv);
      toast.success(`Invoice ${inv.invoiceNumber} created`);
      await load();
    } catch (e) { console.error(e); toast.error('Invoice failed'); }
    setBusy(false);
  };

  if (loading) return <div className="p-8 flex justify-center"><div className="w-10 h-10 loader-ring" /></div>;
  if (!job) return <div className="p-8 text-center font-body" style={{ color: 'var(--steel)' }}>Job not found.</div>;

  const nextStep = FLOW.find(f => f.from === job.status);

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto">
      <button onClick={() => router.push('/store/board')}
        className="flex items-center gap-2 data-label mb-5" style={{ color: 'var(--steel)' }}>
        <ArrowLeft size={13} /> Job Board
      </button>

      <div className="card mb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="font-display font-700 text-xl" style={{ color: 'var(--chrome)' }}>{job.customerName}</h1>
            <p className="flex items-center gap-1.5 text-sm font-body mt-1" style={{ color: 'var(--steel)' }}>
              <Phone size={12} /> {job.customerPhone}
            </p>
            <p className="flex items-center gap-1.5 text-sm font-body" style={{ color: 'var(--steel)' }}>
              <Car size={12} /> {job.vehicleName} · {job.vehicleRegNo}{job.bay ? ` · Bay ${job.bay}` : ''}
            </p>
            <p className="flex items-center gap-1.5 text-sm font-body" style={{ color: 'var(--steel)' }}>
              <Users size={12} />
              {(job.assignments ?? []).filter(a => !a.removedAt).map(a => a.employeeName).join(', ') || job.createdByEmployeeName}
              {isAdmin && (
                <button onClick={openAssign} className="data-label px-2 py-0.5 rounded-lg"
                  style={{ background: 'var(--dark)', border: '1px solid var(--border)', color: 'var(--ember)' }}>
                  Edit
                </button>
              )}
            </p>
          </div>
          <span className="status-badge" style={{
            color: job.status === 'completed' ? 'var(--success)' : job.status === 'cancelled' ? 'var(--danger)' : 'var(--ember)',
            background: job.status === 'completed' ? 'color-mix(in srgb, var(--success) 12%, transparent)' : job.status === 'cancelled' ? 'color-mix(in srgb, var(--danger) 12%, transparent)' : 'var(--accent-mist)',
          }}>
            {STATUS_LABEL[job.status]}
          </span>
        </div>

        <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
          {job.serviceItems.map((s, i) => (
            <div key={i} className="flex justify-between py-1 text-sm font-body">
              <span style={{ color: 'var(--chrome)' }}>{s.serviceName}</span>
              <span className="font-mono" style={{ color: 'var(--steel)' }}>{formatCurrency(s.price)}</span>
            </div>
          ))}
          {job.discount && (
            <div className="flex justify-between py-1 text-sm font-body">
              <span style={{ color: 'var(--success)' }}>{job.discount.label}</span>
              <span className="font-mono" style={{ color: 'var(--success)' }}>−{formatCurrency(job.discount.amount)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 mt-1 border-t" style={{ borderColor: 'var(--border)' }}>
            <span className="font-body font-600" style={{ color: 'var(--chrome)' }}>Total</span>
            <span className="font-mono font-700 text-lg" style={{ color: 'var(--ember)' }}>{formatCurrency(job.totalAmount)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3 mb-6">
        {nextStep && (
          <button onClick={() => advance(nextStep.to)} disabled={busy}
            className="btn-ember w-full flex items-center justify-center gap-2 py-4 text-base">
            <CheckCircle2 size={18} /> {nextStep.label}
            {nextStep.to === 'completed' && job.paymentStatus !== 'collected' && isAdmin ? ' (unpaid - override)' : ''}
          </button>
        )}
        {job.paymentStatus === 'pending' && job.status !== 'cancelled' && (
          <button onClick={() => { setPayAmount(String(balance)); setPayModal(true); }} disabled={busy}
            className="btn-ghost w-full flex items-center justify-center gap-2 py-4 text-base">
            <IndianRupee size={17} /> Collect Payment · {formatCurrency(balance)} due
          </button>
        )}
        {(job.payments?.length ?? 0) > 0 && (
          <div className="card-dark">
            <p className="data-label mb-2" style={{ color: 'var(--steel)' }}>
              Payments · {formatCurrency(job.amountPaid ?? 0)} of {formatCurrency(job.totalAmount)}
            </p>
            <div className="space-y-1.5">
              {(job.payments ?? []).map(pm => (
                <div key={pm.id} className="flex items-center gap-2 text-sm font-body">
                  <span className="font-mono" style={{ color: 'var(--success)' }}>{formatCurrency(pm.amount)}</span>
                  <span className="data-label" style={{ color: 'var(--steel)' }}>{pm.method.toUpperCase()}</span>
                  <span className="ml-auto" style={{ color: 'var(--steel)' }}>{pm.receivedByName} · {pm.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {job.status === 'completed' && !invoice && (
          <button onClick={generateInvoice} disabled={busy}
            className="btn-ghost w-full flex items-center justify-center gap-2 py-4 text-base">
            <FileText size={17} /> Generate Invoice
          </button>
        )}
        {invoice && (
          <div className="card-dark">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="data-label" style={{ color: 'var(--steel)' }}>Invoice</p>
                <p className="font-mono font-700" style={{ color: 'var(--chrome)' }}>{invoice.invoiceNumber}</p>
              </div>
              <a href={invoicePublicUrl(invoice)} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 data-label" style={{ color: 'var(--ember)' }}>
                View <ChevronRight size={12} />
              </a>
            </div>
            <a href={buildInvoiceWhatsAppLink(invoice)} target="_blank" rel="noreferrer"
              className="btn-ember w-full flex items-center justify-center gap-2 py-3">
              <MessageCircle size={16} /> Send on WhatsApp
            </a>
          </div>
        )}
        {job.status === 'completed' && (
          <a href={buildReviewAskLink(job.customerName, job.customerPhone)} target="_blank" rel="noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl data-label"
            style={{ color: 'var(--warning)', background: 'color-mix(in srgb, var(--warning) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--warning) 20%, transparent)' }}>
            <Star size={14} /> Ask for a Google Review
          </a>
        )}
        {job.status !== 'completed' && job.status !== 'cancelled' && (
          <button onClick={() => advance('cancelled')} disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl data-label"
            style={{ color: 'var(--danger)', background: 'color-mix(in srgb, var(--danger) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)' }}>
            <XCircle size={14} /> Cancel Job
          </button>
        )}
      </div>

      {/* Before / after photos */}
      <div className="card-dark mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="data-label" style={{ color: 'var(--steel)' }}>Work photos - shown on the invoice</p>
        </div>
        <div className="flex gap-2 mb-3">
          <button onClick={() => beforeInput.current?.click()} disabled={!!uploadingPhoto}
            className="btn-ghost flex-1 flex items-center justify-center gap-2 py-3 text-sm">
            <Camera size={15} /> {uploadingPhoto === 'before' ? 'Uploading…' : '+ Before'}
          </button>
          <button onClick={() => afterInput.current?.click()} disabled={!!uploadingPhoto}
            className="btn-ghost flex-1 flex items-center justify-center gap-2 py-3 text-sm">
            <Camera size={15} /> {uploadingPhoto === 'after' ? 'Uploading…' : '+ After'}
          </button>
        </div>
        <input ref={beforeInput} type="file" accept="image/*" capture="environment" multiple hidden
          onChange={e => capturePhoto('before', e.target.files)} />
        <input ref={afterInput} type="file" accept="image/*" capture="environment" multiple hidden
          onChange={e => capturePhoto('after', e.target.files)} />
        {(() => {
          const before = (job.photos ?? []).find(p => p.kind === 'before');
          const after = (job.photos ?? []).find(p => p.kind === 'after');
          return before && after
            ? <div className="mb-3"><BeforeAfterSlider before={before.url} after={after.url} alt={job.vehicleName} /></div>
            : null;
        })()}
        {(job.photos?.length ?? 0) > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {(job.photos ?? []).map(p => (
              <a key={p.path} href={p.url} target="_blank" rel="noreferrer"
                className="relative aspect-square rounded-xl overflow-hidden" style={{ background: 'var(--dark)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.kind} className="w-full h-full object-cover" />
                <span className="absolute bottom-1 left-1 data-label px-1.5 py-0.5 rounded"
                  style={{
                    background: 'rgba(5,5,7,0.8)',
                    color: p.kind === 'after' ? 'var(--success)' : 'var(--warning)',
                  }}>
                  {p.kind}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Job notes */}
      <div className="card-dark mb-5">
        <p className="data-label mb-2" style={{ color: 'var(--steel)' }}>Job notes - staff only</p>
        <textarea className="input text-sm" rows={2} value={notesDraft} maxLength={500}
          onChange={e => setNotesDraft(e.target.value)}
          placeholder="Pre-existing damage, customer requests, bay remarks…" />
        {notesDraft !== (job.notes ?? '') && (
          <button onClick={handleSaveNotes} disabled={notesSaving}
            className="btn-ghost w-full py-2.5 mt-2 text-xs">
            {notesSaving ? 'Saving…' : 'Save Notes'}
          </button>
        )}
      </div>

      {/* Audit trail */}
      <div className="card-dark">
        <p className="data-label mb-3" style={{ color: 'var(--steel)' }}>Activity</p>
        <div className="space-y-2">
          {[...(job.statusHistory ?? [])].reverse().map((h, i) => (
            <div key={i} className="flex items-center gap-3 text-xs font-body">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--ember)' }} />
              <span style={{ color: 'var(--chrome)' }}>{STATUS_LABEL[h.status]}</span>
              <span style={{ color: 'var(--steel)' }}>by {h.byEmployeeName}</span>
              <span className="ml-auto font-mono" style={{ color: 'var(--steel)' }}>
                {h.at?.toDate ? formatTime(format(h.at.toDate(), 'HH:mm')) : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Payment modal */}
      <AnimatePresence>
        {payModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
              onClick={() => setPayModal(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-5 max-w-lg mx-auto"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-700 text-lg" style={{ color: 'var(--chrome)' }}>
                  COLLECT · {formatCurrency(balance)} DUE
                </h2>
                <button onClick={() => setPayModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg"
                  style={{ background: 'var(--dark)', color: 'var(--steel)' }}><X size={14} /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="data-label block mb-1">Amount received (advance / partial OK)</label>
                  <input className="input font-mono text-lg" inputMode="numeric" value={payAmount}
                    onChange={e => setPayAmount(e.target.value.replace(/\D/g, ''))} placeholder="0" />
                </div>
                <input className="input" value={txnId} onChange={e => setTxnId(e.target.value)}
                  placeholder="UPI transaction ID (optional)" />
                <div className="flex gap-3">
                  <button onClick={() => collect('upi')} disabled={busy} className="btn-ember flex-1 py-3.5">UPI Received</button>
                  <button onClick={() => collect('cash')} disabled={busy} className="btn-ghost flex-1 py-3.5">Cash Received</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Materials actuals at handover */}
      <AnimatePresence>
        {materialsOpen && job && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
              onClick={() => setMaterialsOpen(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-5 max-w-lg mx-auto"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-display font-700 text-lg" style={{ color: 'var(--chrome)' }}>MATERIALS USED</h2>
                <button onClick={() => setMaterialsOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg"
                  style={{ background: 'var(--dark)', color: 'var(--steel)' }}><X size={14} /></button>
              </div>
              <p className="text-xs font-body mb-4" style={{ color: 'var(--steel)' }}>
                Prefilled from the service recipe - adjust to what this car actually took.
              </p>
              <div className="space-y-2 mb-5">
                {materials.map((m, i) => (
                  <div key={m.itemId} className="flex items-center gap-3">
                    <span className="flex-1 font-body text-sm" style={{ color: 'var(--chrome)' }}>{m.itemName}</span>
                    <input className="input w-24 font-mono text-right" inputMode="decimal" value={m.qty}
                      onChange={e => setMaterials(prev => prev.map((x, j) => j === i ? { ...x, qty: e.target.value.replace(/[^0-9.]/g, '') } : x))} />
                    <span className="data-label w-8" style={{ color: 'var(--steel)' }}>{m.unit}</span>
                  </div>
                ))}
              </div>
              <button disabled={busy} className="btn-ember w-full py-3.5"
                onClick={async () => {
                  if (!emp || !job) return;
                  setBusy(true);
                  try {
                    await updateJobStatus(job.id, 'completed', emp, { skipAutoConsumption: true });
                    await consumeActuals(
                      materials.map(m => ({ itemId: m.itemId, qty: Number(m.qty) || 0 })),
                      'job', job.id, emp.id,
                    );
                    setMaterialsOpen(false);
                    toast.success('Delivered');
                    await load();
                  } catch { toast.error('Update failed'); }
                  setBusy(false);
                }}>
                {busy ? 'Saving…' : 'Confirm & Hand Over'}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Assignee editor - admin only */}
      <AnimatePresence>
        {assignOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
              onClick={() => setAssignOpen(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-5 max-w-lg mx-auto"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-700 text-lg" style={{ color: 'var(--chrome)' }}>WHO WORKS THIS JOB</h2>
                <button onClick={() => setAssignOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg"
                  style={{ background: 'var(--dark)', color: 'var(--steel)' }}><X size={14} /></button>
              </div>
              <div className="flex gap-2 flex-wrap mb-5">
                {staff.map(e => {
                  const on = assignDraft.has(e.id);
                  return (
                    <button key={e.id}
                      onClick={() => setAssignDraft(prev => {
                        const n = new Map(prev);
                        if (on) n.delete(e.id); else n.set(e.id, e.name);
                        return n;
                      })}
                      className="px-4 rounded-xl data-label transition-all"
                      style={{
                        minHeight: 44,
                        background: on ? 'var(--accent-mist)' : 'var(--dark)',
                        border: on ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
                        color: on ? 'var(--ember)' : 'var(--steel)',
                      }}>{e.name}</button>
                  );
                })}
                {staff.length === 0 && <p className="font-body text-sm" style={{ color: 'var(--steel)' }}>Loading staff…</p>}
              </div>
              <button onClick={saveAssign} disabled={assignSaving} className="btn-ember w-full py-3.5">
                {assignSaving ? 'Saving…' : 'Save Assignees'}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
