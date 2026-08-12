'use client';
/**
 * PAPERS — the certificates customers have sent, and the studio's decision.
 *
 * ── WHY THIS SCREEN EXISTS ───────────────────────────────────────────────
 * A customer may state a fact about their own paperwork. Only the studio may
 * make the product assert it. This is the second half of that separation: the
 * queue of declarations, the certificate itself where one was photographed,
 * and the two acts — verify, refuse.
 *
 * Verifying is what writes a Protection. Nothing else in the product can, and
 * neither can this screen: it POSTs to `/api/protection/puc/verify`, which
 * reads the caller's role from their own profile and does the write with the
 * Admin SDK. `firestore.rules` refuses every client write to `declarations`
 * and to `protections`, including from a signed-in admin console — so a
 * mis-click here cannot become a promise, and neither can a devtools session.
 *
 * A refusal is given a REASON, and the reason is shown to the customer
 * verbatim on their own screen. A refusal with no reason is a customer sending
 * the same certificate again.
 */
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { BadgeCheck, ShieldCheck, X, ExternalLink } from 'lucide-react';
import { listDeclarations } from '@/lib/services/declarations';
import { authedFetch } from '@/lib/clientSession';
import { PUC_STATUS_WORD } from '@/lib/os/puc';
import type { Declaration, DeclarationStatus } from '@/lib/types';
import ErrorState from '@/components/ui/ErrorState';

const STATUS_COLOR: Record<DeclarationStatus, string> = {
  submitted: 'var(--warning)',
  verified: 'var(--success)',
  rejected: 'var(--danger)',
  superseded: 'var(--steel)',
  withdrawn: 'var(--steel)',
};

const day = (t?: { toMillis?: () => number }): string => {
  const ms = t?.toMillis?.() ?? 0;
  return ms ? new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
};

export default function AdminPapersPage() {
  const [rows, setRows] = useState<Declaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  /** Which declaration is having its refusal written, and what it says. */
  const [refusing, setRefusing] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    listDeclarations()
      .then(setRows)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const decide = async (d: Declaration, decision: 'verify' | 'reject', why?: string) => {
    setBusy(d.id);
    try {
      const res = await authedFetch('/api/protection/puc/verify', {
        method: 'POST',
        body: JSON.stringify({ declarationId: d.id, decision, reason: why }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: '' })) as { error?: string };
        toast.error(body.error || 'Could not save that');
        return;
      }
      toast.success(decision === 'verify' ? 'Verified — it now stands on the car' : 'Refused');
      setRefusing(null);
      setReason('');
      load();
    } catch {
      toast.error('Could not reach the server');
    } finally {
      setBusy(null);
    }
  };

  const waiting = rows.filter(r => r.status === 'submitted');
  const settled = rows.filter(r => r.status !== 'submitted');

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display font-800 text-2xl" style={{ color: 'var(--chrome)' }}>Papers</h1>
        <p className="text-sm font-body" style={{ color: 'var(--steel)' }}>
          Pollution certificates customers have sent. Verifying one is what makes
          it stand on their car.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 shimmer rounded-2xl" />)}</div>
      ) : loadError ? (
        <ErrorState onRetry={load} />
      ) : rows.length === 0 ? (
        <div className="card text-center py-14">
          <ShieldCheck size={26} className="mx-auto mb-3" style={{ color: 'var(--steel)' }} />
          <p className="font-body" style={{ color: 'var(--steel)' }}>
            Nothing has been sent yet.
          </p>
        </div>
      ) : (
        <>
          <p className="data-label mb-2" style={{ color: 'var(--warning)' }}>
            WAITING · {waiting.length}
          </p>
          <div className="space-y-3 mb-8">
            {waiting.length === 0 ? (
              <div className="card p-4">
                <p className="font-body text-sm" style={{ color: 'var(--steel)' }}>
                  Nothing waiting.
                </p>
              </div>
            ) : waiting.map(d => (
              <Paper
                key={d.id}
                d={d}
                busy={busy === d.id}
                refusing={refusing === d.id}
                reason={reason}
                onReason={setReason}
                onVerify={() => decide(d, 'verify')}
                onOpenRefuse={() => { setRefusing(d.id); setReason(''); }}
                onCancelRefuse={() => setRefusing(null)}
                onRefuse={() => decide(d, 'reject', reason)}
              />
            ))}
          </div>

          <p className="data-label mb-2" style={{ color: 'var(--steel)' }}>
            DECIDED · {settled.length}
          </p>
          <div className="space-y-3">
            {settled.map(d => <Paper key={d.id} d={d} />)}
          </div>
        </>
      )}
    </div>
  );
}

function Paper({
  d, busy = false, refusing = false, reason = '',
  onReason, onVerify, onOpenRefuse, onCancelRefuse, onRefuse,
}: {
  d: Declaration;
  busy?: boolean;
  refusing?: boolean;
  reason?: string;
  onReason?: (v: string) => void;
  onVerify?: () => void;
  onOpenRefuse?: () => void;
  onCancelRefuse?: () => void;
  onRefuse?: () => void;
}) {
  const open = d.status === 'submitted';
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="font-mono font-700" style={{ color: 'var(--chrome)', fontSize: 13 }}>
            {d.reference}
          </p>
          <p className="font-body text-sm mt-0.5" style={{ color: 'var(--steel)' }}>
            {d.vehicleName ?? 'Unnamed car'}
            {d.registrationNumber ? ` · ${d.registrationNumber}` : ''}
          </p>
          <p className="font-body text-sm mt-1" style={{ color: 'var(--steel)' }}>
            Issued {d.issuedOn} · valid to {d.expiresOn} · sent {day(d.submittedAt)}
          </p>
          {d.note ? (
            <p className="font-body text-sm mt-1" style={{ color: 'var(--steel)' }}>
              “{d.note}”
            </p>
          ) : null}
          {d.decisionReason ? (
            <p className="font-body text-sm mt-1" style={{ color: 'var(--danger)' }}>
              Refused: {d.decisionReason}
            </p>
          ) : null}
        </div>

        <span
          className="data-label"
          style={{ color: STATUS_COLOR[d.status] }}
        >
          {PUC_STATUS_WORD[d.status].toUpperCase()}
        </span>
      </div>

      {/* The certificate itself, when one was photographed. Opened in its own
          tab rather than shown inline: the studio compares it against a piece
          of paper, and that wants the full image. */}
      {d.evidence ? (
        <a
          href={d.evidence.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 mt-3 font-body text-sm"
          style={{ color: 'var(--info)' }}
        >
          <ExternalLink size={13} /> The certificate they sent
        </a>
      ) : (
        <p className="font-body text-sm mt-3" style={{ color: 'var(--steel)' }}>
          No photograph attached.
        </p>
      )}

      {open ? (
        <div className="mt-4">
          {refusing ? (
            <div className="space-y-2">
              <textarea
                className="input text-sm"
                rows={2}
                value={reason}
                onChange={e => onReason?.(e.target.value)}
                placeholder="Why can this not be accepted? The customer reads this."
              />
              <div className="flex gap-2 flex-wrap">
                <button
                  className="btn btn-danger text-sm"
                  disabled={busy || reason.trim().length < 4}
                  onClick={onRefuse}
                >
                  Refuse it
                </button>
                <button className="btn btn-ghost text-sm" onClick={onCancelRefuse}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <button
                className="btn btn-primary text-sm inline-flex items-center gap-1.5"
                disabled={busy}
                onClick={onVerify}
              >
                <BadgeCheck size={14} /> Verify
              </button>
              <button
                className="btn btn-ghost text-sm inline-flex items-center gap-1.5"
                disabled={busy}
                onClick={onOpenRefuse}
              >
                <X size={14} /> Refuse
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
