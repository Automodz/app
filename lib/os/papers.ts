/**
 * The vault (P2D1 §C1 · Papers).
 *
 * Papers holds what the car actually owns: the warranty each living
 * protection carries, and the receipt of every visit that produced one.
 * Each paper points at the Chapter that contains it - the record is never
 * duplicated, only indexed. When the car owns no papers yet, the vault says
 * nothing at all (audit #17: Papers is documents, not a second Story).
 */
import type { Booking } from '@/lib/types';
import { PROTECTION_WORD, type Protection } from '@/lib/cx/protection';

export interface Paper {
  id: string;
  kind: 'warranty' | 'receipt';
  title: string;
  detail: string;
  /** the visit whose Chapter holds this paper */
  bookingId: string;
}

const fmtMonthYear = (d: Date) =>
  d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const fmtLong = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

export function papersFor(args: {
  /** this vehicle's completed visits, newest first */
  completed: Booking[];
  protections: Protection[];
}): Paper[] {
  const { completed, protections } = args;
  const papers: Paper[] = [];

  /* a warranty is a paper only while it protects something, and only when
     the visit that created it is still on the record */
  protections.forEach(p => {
    if (!p.active || !p.warranty) return;
    const source = completed.find(b => b.serviceName === p.service);
    if (!source) return;
    papers.push({
      id: `warranty-${p.kind}`,
      kind: 'warranty',
      title: `${PROTECTION_WORD[p.kind]} warranty`,
      detail: p.until ? `Until ${fmtMonthYear(p.until)}` : p.warranty,
      bookingId: source.id,
    });
  });

  completed.forEach(b => {
    if (!b.invoiceId) return;
    papers.push({
      id: `receipt-${b.id}`,
      kind: 'receipt',
      title: b.paymentStatus === 'verified' ? 'Receipt' : 'Invoice',
      detail: fmtLong(b.scheduledDate),
      bookingId: b.id,
    });
  });

  return papers;
}
