'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { MessageCircle, Plus, Trash2, X, FileSpreadsheet, Wrench } from 'lucide-react';
import {
  listQuotes, createQuote, updateQuote, setQuoteStatus,
  buildQuoteWhatsAppLink, addTask, todayDateStr, createWalkInJob,
} from '@/lib/firebaseService';
import { formatCurrency } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import type { Quote, QuoteStatus, QuoteLineItem } from '@/lib/types';
import ErrorState from '@/components/ui/ErrorState';

const STATUS_META: Record<QuoteStatus, { label: string; color: string }> = {
  requested: { label: 'Requested', color: 'var(--warning)' },
  draft:     { label: 'Draft',     color: 'var(--steel)' },
  sent:      { label: 'Sent',      color: 'var(--info)' },
  accepted:  { label: 'Accepted',  color: 'var(--success)' },
  declined:  { label: 'Declined',  color: 'var(--danger)' },
  expired:   { label: 'Expired',   color: 'var(--steel)' },
};
const PIPELINE: QuoteStatus[] = ['requested', 'draft', 'sent', 'accepted'];

const emptyDraft = {
  customerName: '', customerPhone: '', vehicleName: '',
  serviceCategory: 'PPF', validUntil: '', notes: '',
  items: [{ name: '', detail: '', amount: '' }],
};

export default function AdminQuotesPage() {
  const router = useRouter();
  const { user } = useAppStore();
  const [startingJob, setStartingJob] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null); // existing quote being priced
  const [draftOpen, setDraftOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true); setLoadError(false);
    listQuotes().then(setQuotes).catch(() => setLoadError(true)).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const openNew = () => { setEditing(null); setDraft(emptyDraft); setDraftOpen(true); };
  const openEdit = (q: Quote) => {
    setEditing(q);
    setDraft({
      customerName: q.customerName, customerPhone: q.customerPhone,
      vehicleName: q.vehicleName, serviceCategory: q.serviceCategory,
      validUntil: q.validUntil ?? '', notes: q.notes ?? '',
      items: q.items.length
        ? q.items.map(i => ({ name: i.name, detail: i.detail ?? '', amount: String(i.amount) }))
        : [{ name: '', detail: '', amount: '' }],
    });
    setDraftOpen(true);
  };

  const draftTotal = draft.items.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  const save = async (send: boolean) => {
    if (!user) return;
    if (!draft.customerName.trim() || draft.customerPhone.replace(/\D/g, '').length < 10) {
      toast.error('Customer name and 10-digit phone required'); return;
    }
    const items: QuoteLineItem[] = draft.items
      .filter(i => i.name.trim() && Number(i.amount) > 0)
      .map(i => ({ name: i.name.trim(), ...(i.detail.trim() ? { detail: i.detail.trim() } : {}), amount: Number(i.amount) }));
    if (send && items.length === 0) { toast.error('Add at least one line item'); return; }
    setSaving(true);
    try {
      const payload = {
        customerName: draft.customerName.trim(),
        customerPhone: draft.customerPhone.replace(/\D/g, '').slice(-10),
        vehicleName: draft.vehicleName.trim(),
        serviceCategory: draft.serviceCategory,
        items, total: items.reduce((s, i) => s + i.amount, 0),
        ...(draft.validUntil ? { validUntil: draft.validUntil } : {}),
        ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
        status: (send ? 'sent' : 'draft') as QuoteStatus,
      };
      let q: Quote;
      if (editing) {
        await updateQuote(editing.id, payload);
        q = { ...editing, ...payload } as Quote;
      } else {
        const id = await createQuote({
          ...payload,
          createdById: user.uid, createdByName: user.name,
        } as Omit<Quote, 'id' | 'createdAt' | 'updatedAt'>);
        q = { id, ...payload } as Quote;
      }
      if (send) {
        window.open(buildQuoteWhatsAppLink(q), '_blank');
        // Follow-up lands in the queue 2 days out - quotes don't rot
        const due = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
        addTask({
          note: `Follow up on ${q.serviceCategory} quote · ${formatCurrency(q.total)}`,
          dueDate: due, customerName: q.customerName, customerPhone: q.customerPhone,
          refType: 'quote', refId: q.id, byName: user.name,
        }).catch(() => {});
      }
      toast.success(send ? 'Quote sent on WhatsApp' : 'Draft saved');
      setDraftOpen(false);
      load();
    } catch { toast.error('Could not save quote'); }
    setSaving(false);
  };

  const changeStatus = async (q: Quote, status: QuoteStatus) => {
    try {
      await setQuoteStatus(q.id, status);
      setQuotes(prev => prev.map(x => x.id === q.id ? { ...x, status } : x));
      toast.success(STATUS_META[status].label);
    } catch { toast.error('Could not update'); }
  };

  // Accepted quote → operational job, zero re-typing. The quote keeps a jobId
  // link so the card becomes a doorway into the job workspace.
  const startJob = async (q: Quote) => {
    if (!user || startingJob) return;
    setStartingJob(q.id);
    try {
      const jobId = await createWalkInJob({
        customerId: q.customerId,
        customerName: q.customerName, customerPhone: q.customerPhone,
        vehicleName: q.vehicleName, vehicleRegNo: '',
        serviceItems: q.items.map((it, i) => ({
          serviceId: `quote:${q.id}:${i}`, serviceName: it.name,
          category: q.serviceCategory, price: it.amount,
        })),
        byEmployee: { id: user.uid, name: user.name || 'Admin' },
      });
      await updateQuote(q.id, { jobId });
      toast.success('Job started from quote');
      router.push(`/admin/jobs/${jobId}`);
    } catch { toast.error('Could not start the job'); setStartingJob(null); }
  };

  const pipelineValue = quotes.filter(q => ['draft', 'sent', 'requested'].includes(q.status))
    .reduce((s, q) => s + q.total, 0);

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display font-800 text-2xl" style={{ color: 'var(--chrome)' }}>QUOTES</h1>
          <p className="text-sm font-body" style={{ color: 'var(--steel)' }}>
            {formatCurrency(pipelineValue)} open pipeline · {quotes.filter(q => q.status === 'requested').length} awaiting pricing
          </p>
        </div>
        <button onClick={openNew} className="btn-ember flex items-center gap-2 px-5 py-3">
          <Plus size={16} /> New Quote
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-40 shimmer rounded-2xl" />)}
        </div>
      ) : loadError ? (
        <ErrorState onRetry={load} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
          {PIPELINE.map(col => {
            const colQuotes = quotes.filter(q => q.status === col);
            return (
              <div key={col}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="data-label" style={{ color: STATUS_META[col].color }}>{STATUS_META[col].label.toUpperCase()}</span>
                  <span className="data-label px-2 py-0.5 rounded-lg" style={{ background: 'var(--dark)', color: 'var(--chrome)' }}>
                    {colQuotes.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {colQuotes.map(q => (
                    <div key={q.id} className="card-dark cursor-pointer" onClick={() => openEdit(q)}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-body font-600 text-sm truncate" style={{ color: 'var(--chrome)' }}>{q.customerName}</p>
                        {q.total > 0 && (
                          <span className="font-mono font-700 text-sm shrink-0" style={{ color: 'var(--ember)' }}>
                            {formatCurrency(q.total)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-body truncate" style={{ color: 'var(--steel)' }}>
                        {q.vehicleName} · {q.serviceCategory}
                      </p>
                      {q.customerMessage && (
                        <p className="text-xs font-body mt-1 line-clamp-2" style={{ color: 'var(--steel)' }}>“{q.customerMessage}”</p>
                      )}
                      <div className="flex gap-1.5 mt-3" onClick={e => e.stopPropagation()}>
                        {q.status === 'sent' && (
                          <>
                            <button onClick={() => changeStatus(q, 'accepted')} className="btn-ember flex-1 py-1.5 text-xs">Won</button>
                            <button onClick={() => changeStatus(q, 'declined')} className="btn-ghost flex-1 py-1.5 text-xs">Lost</button>
                          </>
                        )}
                        {q.status === 'accepted' && !q.jobId && (
                          <button onClick={() => startJob(q)} disabled={startingJob === q.id}
                            className="btn-ember flex-1 py-1.5 text-xs flex items-center justify-center gap-1.5">
                            <Wrench size={12} /> {startingJob === q.id ? 'Starting…' : 'Start job'}
                          </button>
                        )}
                        {q.jobId && (
                          <button onClick={() => router.push(`/admin/jobs/${q.jobId}`)}
                            className="btn-ghost flex-1 py-1.5 text-xs flex items-center justify-center gap-1.5"
                            style={{ color: 'var(--success)' }}>
                            <Wrench size={12} /> In studio →
                          </button>
                        )}
                        {q.status !== 'requested' && q.items.length > 0 && (
                          <a href={buildQuoteWhatsAppLink(q)} target="_blank" rel="noreferrer"
                            className="btn-ghost px-3 py-1.5 flex items-center justify-center">
                            <MessageCircle size={13} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                  {colQuotes.length === 0 && (
                    <div className="rounded-2xl border border-dashed py-8 text-center" style={{ borderColor: 'var(--border)' }}>
                      <p className="data-label" style={{ color: 'var(--steel)' }}>Empty</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quote editor sheet */}
      {draftOpen && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
            onClick={() => setDraftOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-5 max-w-2xl mx-auto max-h-[85vh] overflow-y-auto"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-700 text-lg" style={{ color: 'var(--chrome)' }}>
                {editing ? `QUOTE · ${editing.customerName}` : 'NEW QUOTE'}
              </h2>
              <button onClick={() => setDraftOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg"
                style={{ background: 'var(--dark)', color: 'var(--steel)' }}><X size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input className="input" placeholder="Customer name" value={draft.customerName}
                onChange={e => setDraft({ ...draft, customerName: e.target.value })} />
              <input className="input" placeholder="Phone" inputMode="numeric" value={draft.customerPhone}
                onChange={e => setDraft({ ...draft, customerPhone: e.target.value })} />
              <input className="input" placeholder="Vehicle" value={draft.vehicleName}
                onChange={e => setDraft({ ...draft, vehicleName: e.target.value })} />
              <div className="flex gap-1.5">
                {['PPF', 'Ceramic', 'Coating', 'Detailing'].map(c => (
                  <button key={c} onClick={() => setDraft({ ...draft, serviceCategory: c })}
                    className="flex-1 rounded-xl data-label py-2"
                    style={{
                      background: draft.serviceCategory === c ? 'var(--accent-mist)' : 'var(--dark)',
                      border: draft.serviceCategory === c ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
                      color: draft.serviceCategory === c ? 'var(--ember)' : 'var(--steel)',
                    }}>{c}</button>
                ))}
              </div>
            </div>
            <p className="data-label mb-2" style={{ color: 'var(--steel)' }}>LINE ITEMS</p>
            <div className="space-y-2 mb-2">
              {draft.items.map((it, i) => (
                <div key={i} className="flex gap-2">
                  <input className="input flex-[2]" placeholder="Item" value={it.name}
                    onChange={e => setDraft(d => ({ ...d, items: d.items.map((x, j) => j === i ? { ...x, name: e.target.value } : x) }))} />
                  <input className="input flex-[2]" placeholder="Detail (film, coverage…)" value={it.detail}
                    onChange={e => setDraft(d => ({ ...d, items: d.items.map((x, j) => j === i ? { ...x, detail: e.target.value } : x) }))} />
                  <input className="input flex-1 font-mono" placeholder="₹" inputMode="numeric" value={it.amount}
                    onChange={e => setDraft(d => ({ ...d, items: d.items.map((x, j) => j === i ? { ...x, amount: e.target.value.replace(/\D/g, '') } : x) }))} />
                  <button onClick={() => setDraft(d => ({ ...d, items: d.items.filter((_, j) => j !== i) }))}
                    className="w-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'var(--dark)', color: 'var(--steel)' }}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
            <button onClick={() => setDraft(d => ({ ...d, items: [...d.items, { name: '', detail: '', amount: '' }] }))}
              className="btn-ghost px-4 py-2 text-xs mb-3">+ Add line</button>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="data-label block mb-1">Valid until</label>
                <input className="input" type="date" value={draft.validUntil}
                  onChange={e => setDraft({ ...draft, validUntil: e.target.value })} />
              </div>
              <div>
                <label className="data-label block mb-1">Internal notes</label>
                <input className="input" value={draft.notes}
                  onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Condition, negotiation…" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono font-700 text-lg" style={{ color: 'var(--ember)' }}>{formatCurrency(draftTotal)}</span>
              <button onClick={() => save(false)} disabled={saving} className="btn-ghost flex-1 py-3">Save Draft</button>
              <button onClick={() => save(true)} disabled={saving} className="btn-ember flex-1 py-3 flex items-center justify-center gap-2">
                <MessageCircle size={15} /> Send on WhatsApp
              </button>
            </div>
            {editing?.status === 'accepted' && !editing.jobId && (
              <p className="text-xs font-body mt-3 flex items-center gap-1.5" style={{ color: 'var(--success)' }}>
                <FileSpreadsheet size={12} /> Accepted - use “Start job” on the card when the car arrives; everything carries over.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
