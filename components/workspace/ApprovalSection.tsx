'use client';
/**
 * ASKING THE CUSTOMER — the studio side of design screen 12.
 *
 * A customer cannot approve extra work the studio has never asked for, so this
 * is the operation that makes screen 12 more than a page: the bay opens a
 * panel, finds something, and asks.
 *
 * ── WHAT THE COUNTER MAY SET, AND WHAT IT MAY NOT ────────────────────────
 * It sets the finding, the evidence, the proposed line and its price and time.
 * It does NOT set the customer's total: `/api/approval` prices the visit as it
 * stands and as it would be, through `priceVisit`, and stores both. So the
 * figure the customer sees is the engine's, and the studio cannot ask for one
 * number and charge another.
 *
 * ── AND IT CANNOT ANSWER ─────────────────────────────────────────────────
 * There is no control here that resolves a request. The transition table
 * refuses `approved` and `declined` to the studio, and this screen offers
 * neither — the studio may only WITHDRAW what it asked, which is a different
 * act with a different meaning.
 */
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, MessageSquareWarning } from 'lucide-react';
import { idToken } from '@/lib/clientSession';
import { formatCurrency } from '@/lib/utils';
import type { Job, JobPhoto } from '@/lib/types';
import { Section } from './parts';

/** The studio's word for each refusal, so the counter is never shown a code. */
const FAULT: Record<string, string> = {
  'job-has-no-customer': 'This car has no account attached — ask them at the counter.',
  'visit-already-closed': 'This visit is finished; there is nothing left to change.',
  'price-required': 'What does the extra work cost?',
  'label-required': 'Name the extra work.',
  'reason-required': 'Say what you found.',
  'staff-only': 'Only the studio can ask for an approval.',
};

export function ApprovalSection(
  { job, onAsked }: { job: Job; onAsked?: () => void },
) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [label, setLabel] = useState('');
  const [price, setPrice] = useState('');
  const [minutes, setMinutes] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  /* The evidence comes from the photographs the bay has ALREADY taken. A
     separate upload here would be a second media path for one car, and the
     customer is being asked to trust a photograph — it should be one that is
     already part of the visit's record. */
  const available: JobPhoto[] = (job.photos ?? []).filter(p => p.kind !== 'before');

  const ask = async () => {
    setBusy(true);
    try {
      const token = await idToken();
      if (!token) throw new Error('not-signed-in');
      const res = await fetch('/api/approval', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          reason, detail, label,
          price: Number(price),
          minutes: Number(minutes || 0),
          photos: chosen.map(url => ({
            url,
            caption: available.find(p => p.url === url)?.kind === 'after' ? 'After' : 'Under light',
          })),
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        toast.error(FAULT[(b as { error?: string }).error ?? ''] ?? 'Could not send that.');
        return;
      }
      toast.success('Asked — the customer has been told.');
      setOpen(false);
      setReason(''); setDetail(''); setLabel(''); setPrice(''); setMinutes(''); setChosen([]);
      onAsked?.();
    } catch {
      toast.error('Could not send that. Check the connection.');
    } finally {
      setBusy(false);
    }
  };

  const ready = reason.trim() && label.trim() && Number(price) > 0;

  return (
    <Section title="Extra work" delay={0.15}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full py-3 rounded-xl font-display flex items-center justify-center gap-2"
          style={{ fontSize: 12, fontWeight: 700, background: 'var(--fog)', color: 'var(--fg)' }}
        >
          <MessageSquareWarning size={14} /> Ask the customer to approve something
        </button>
      ) : (
        <div className="space-y-3">
          <p className="font-body" style={{ fontSize: 12, color: 'var(--muted)' }}>
            The customer sees what you write here, the photographs you pick, and
            a total priced by the system. They approve or decline; nobody here can
            answer for them.
          </p>

          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              What you found
            </span>
            <input
              value={reason} onChange={e => setReason(e.target.value)}
              placeholder="We found something under the film"
              className="input-dark text-sm py-2 px-2 w-full mt-1"
            />
          </label>

          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              Why it matters
            </span>
            <textarea
              value={detail} onChange={e => setDetail(e.target.value)}
              rows={3}
              placeholder="Left as it is, the film will lift at the edge within a season."
              className="input-dark text-sm py-2 px-2 w-full mt-1"
            />
          </label>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={label} onChange={e => setLabel(e.target.value)}
              placeholder="Extra stage"
              aria-label="What the extra work is called"
              className="input-dark text-sm py-2 px-2 flex-1 min-w-[8rem]"
            />
            <span style={{ color: 'var(--muted)' }}>₹</span>
            <input
              type="number" value={price} onChange={e => setPrice(e.target.value)}
              aria-label="What it costs"
              className="input-dark text-sm py-2 px-2 w-24 text-right"
            />
            <input
              type="number" value={minutes} onChange={e => setMinutes(e.target.value)}
              aria-label="Extra minutes"
              title="Extra minutes — the customer is told whether it still fits today"
              className="input-dark text-sm py-2 px-2 w-20 text-right"
            />
            <span className="font-body text-xs" style={{ color: 'var(--muted)' }}>min</span>
          </div>

          {available.length > 0 ? (
            <div>
              <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                Show them
              </span>
              <div className="flex gap-2 flex-wrap mt-2">
                {available.slice(0, 8).map(p => (
                  <button
                    key={p.url}
                    onClick={() => setChosen(c =>
                      c.includes(p.url) ? c.filter(x => x !== p.url) : [...c, p.url].slice(0, 2))}
                    aria-pressed={chosen.includes(p.url)}
                    className="w-16 h-16 rounded-lg overflow-hidden"
                    style={{
                      outline: chosen.includes(p.url) ? '2px solid var(--fg)' : 'none',
                      opacity: chosen.includes(p.url) ? 1 : 0.6,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="font-body" style={{ fontSize: 12, color: 'var(--muted)' }}>
              No photographs on this job yet. Take one first — a customer asked to
              spend more deserves to see why.
            </p>
          )}

          {Number(price) > 0 ? (
            <p className="font-body" style={{ fontSize: 12, color: 'var(--muted)' }}>
              They will be asked for {formatCurrency(Number(price))} on top of the
              work so far. The exact total is priced by the system, not here.
            </p>
          ) : null}

          <div className="flex gap-2">
            <button
              onClick={ask} disabled={!ready || busy}
              className="btn-primary text-xs py-2.5 px-4 font-display font-800 tracking-widest flex items-center gap-2 disabled:opacity-50"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : null}
              ASK THE CUSTOMER
            </button>
            <button onClick={() => setOpen(false)} className="font-body text-xs" style={{ color: 'var(--muted)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}
