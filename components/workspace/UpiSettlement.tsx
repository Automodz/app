'use client';
/**
 * CONFIRMING A UPI PAYMENT — the studio side of design screen 13.
 *
 * A customer can open their bank application and pay. Nothing in this product
 * can see that money: there is no gateway, so the application never learns
 * whether a credit landed. What it can do is carry the customer's claim to the
 * counter with a reference attached, and give the studio one control that says
 * "I have seen this".
 *
 * ── THAT CONTROL IS THE ONE THAT RELEASES A CAR ──────────────────────────
 * So it is deliberately not a tick beside a row. It states the amount the
 * SERVER is expecting, and settling sends that figure back to be checked
 * against the payment's own — a mismatch is refused rather than reconciled,
 * because a settlement for the wrong amount leaves the books and the
 * customer's record disagreeing and only one of them gets looked at again.
 *
 * ── AND IT DOES NOT DUPLICATE THE COUNTER'S LEDGER ───────────────────────
 * `PaymentsSection` records money taken AT the counter — cash, a card machine,
 * a UPI transfer the counter watched arrive. This is for the payments a
 * customer started in the app, which the counter did not watch. Settling one
 * writes into that same ledger, keyed by the payment id, so the two can never
 * count the same rupee twice.
 */
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { CheckCircle2, Loader2, Smartphone } from 'lucide-react';
import { db } from '@/lib/firebase';
import { authedFetch } from '@/lib/clientSession';
import { formatCurrency } from '@/lib/utils';
import type { Job, Payment } from '@/lib/types';
import { Section } from './parts';

const WORD: Record<string, string> = {
  initiated: 'Link opened — no reference yet',
  submitted: 'Customer says they have paid',
  failed: 'Their bank refused it',
  expired: 'The link ran out',
};

const FAULT: Record<string, string> = {
  'amount-mismatch': 'That is not the figure the customer was asked for. Check before settling.',
  'already-paid': 'Already settled.',
  'staff-only': 'Only the studio can settle a payment.',
};

export function UpiSettlement({ job, onChange }: { job: Job; onChange?: () => void }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    /* A LISTENER, because the customer pays while the counter is looking at
       this screen. A fetch would mean the studio reloads to find out. */
    const q = query(collection(db, 'payments'), where('jobId', '==', job.id));
    return onSnapshot(
      q,
      snap => setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Payment)),
      () => setPayments([]),
    );
  }, [job.id]);

  const settle = useCallback(async (payment: Payment) => {
    setBusy(payment.id);
    try {
            const res = await authedFetch('/api/payment', {
        method: 'PUT',
        body: JSON.stringify({
          paymentId: payment.id,
          /* WHAT WE BELIEVE WE RECEIVED, sent back to be checked against the
             payment's own figure. Refused on a mismatch. */
          expectedAmount: payment.amount,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        toast.error(FAULT[(b as { error?: string }).error ?? ''] ?? 'Could not settle that.');
        return;
      }
      toast.success('Settled — the customer has been told.');
      onChange?.();
    } catch {
      toast.error('Could not settle that. Check the connection.');
    } finally {
      setBusy(null);
    }
  }, [onChange]);

  const open = payments.filter(p => p.status !== 'paid');
  /* §18.1 — nothing started in the app, nothing here. The counter's own ledger
     is where a cash payment is recorded, and a second empty card would be the
     same silence twice. */
  if (open.length === 0) return null;

  return (
    <Section title="Paid in the app" delay={0.16}>
      <div className="space-y-2">
        {open.map(p => (
          <div
            key={p.id}
            className="rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap"
            style={{ background: 'var(--fog)', border: '1px solid var(--border-2)' }}
          >
            <div className="min-w-0">
              <p className="font-body inline-flex items-center gap-1.5" style={{ fontSize: 13, color: 'var(--fg)' }}>
                <Smartphone size={12} /> {formatCurrency(p.amount)} · UPI
              </p>
              <p className="font-body mt-0.5" style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                {WORD[p.status] ?? p.status}
                {p.reference ? ` · ${p.reference}` : ''}
              </p>
            </div>
            <button
              onClick={() => settle(p)}
              disabled={busy === p.id}
              className="py-2 px-3 rounded-lg font-display inline-flex items-center gap-1.5 shrink-0"
              style={{ fontSize: 12, fontWeight: 700, background: 'var(--accent-grad)', color: 'var(--on-accent)' }}
            >
              {busy === p.id
                ? <Loader2 size={13} className="animate-spin" />
                : <CheckCircle2 size={13} />}
              I have seen it
            </button>
          </div>
        ))}
      </div>
      <p className="font-body mt-2" style={{ fontSize: 11.5, color: 'var(--muted)' }}>
        Check the credit in the studio&rsquo;s account first. Nothing here can
        see it for you &mdash; settling is you saying you have.
      </p>
    </Section>
  );
}
