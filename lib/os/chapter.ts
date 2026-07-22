/**
 * The Chapter's model (P2D1 §C5 · P2D3 C-13).
 *
 * One completed visit, read as a document: what was done, the evidence in the
 * order it happened, who did it and for how long, what now protects the car,
 * and - for the owner only - what it cost and which papers exist. Every field
 * is read off the real booking, job and invoice; when a fact wasn't recorded
 * the Chapter simply doesn't carry it (silence, never a placeholder).
 */
import type { Booking, Invoice, Job, JobPhoto } from '@/lib/types';
import { actFromJobStatus, ACT_TITLE, type CareAct } from './visit';

export interface EvidenceShot {
  url: string;
  /** the act this photograph belongs to */
  act: 'arrival' | 'work' | 'finished';
  label: string;
}

export interface ChapterDocument {
  kind: 'invoice' | 'receipt';
  title: string;
  detail: string;
  href: string;
}

export interface ChapterModel {
  title: string;
  dateISO: string;
  vehicleName: string;
  registration: string;
  /** hero = the finished car when it exists, else the best photograph there is */
  hero?: string;
  /** the work, in the studio's own words where it left them */
  work: string[];
  evidence: EvidenceShot[];
  lead: string | null;
  helpers: string[];
  /** minutes between arrival and completion, when both were recorded */
  minutesInCare: number | null;
  amount: number;
  paid: boolean;
  paymentMethod: 'upi' | 'cash' | null;
  coveredByClub: boolean;
  documents: ChapterDocument[];
}

const SHOT_LABEL: Record<EvidenceShot['act'], string> = {
  arrival: 'On arrival', work: 'In care', finished: 'Finished',
};

const KIND_ACT: Record<JobPhoto['kind'], EvidenceShot['act']> = {
  before: 'arrival', during: 'work', after: 'finished',
};

/** Chronological: arrival, then the work, then the finished car. */
const ORDER: EvidenceShot['act'][] = ['arrival', 'work', 'finished'];

export function deriveChapter(args: {
  booking: Booking;
  job: Job | null;
  invoice: Invoice | null;
  /** the invoice's own share token - the owner has it, the public link carries it */
  invoiceToken?: string;
}): ChapterModel {
  const { booking, job, invoice, invoiceToken } = args;

  const photos = job?.photos ?? invoice?.photos ?? [];
  const evidence: EvidenceShot[] = photos
    .map(p => ({ url: p.url, act: KIND_ACT[p.kind], label: SHOT_LABEL[KIND_ACT[p.kind]] }))
    .sort((a, b) => ORDER.indexOf(a.act) - ORDER.indexOf(b.act));

  const hero = evidence.find(e => e.act === 'finished')?.url ?? evidence[0]?.url;

  /* the work: the services actually performed, then any note the studio left
     along the way - its own sentences, never a generated summary */
  const services = job?.serviceItems?.length
    ? job.serviceItems.map(i => i.serviceName)
    : [booking.serviceName];
  const notes = (job?.statusHistory ?? [])
    .filter(h => h.note?.trim())
    .map(h => {
      const act: CareAct | null = actFromJobStatus(h.status);
      return act ? `${ACT_TITLE[act]} - ${h.note!.trim()}` : h.note!.trim();
    });
  const work = [...services, ...notes];

  const assignments = (job?.assignments ?? []).filter(a => !a.removedAt);
  const lead = assignments.find(a => a.role === 'lead')?.employeeName ?? null;
  const helpers = assignments.filter(a => a.role !== 'lead').map(a => a.employeeName);

  const history = job?.statusHistory ?? [];
  const arrived = history.find(h => h.status === 'checked_in')?.at?.toDate() ?? null;
  const finishedAt = job?.completedAt?.toDate()
    ?? history.find(h => h.status === 'completed')?.at?.toDate()
    ?? null;
  const minutesInCare = arrived && finishedAt
    ? Math.max(0, Math.round((finishedAt.getTime() - arrived.getTime()) / 60000))
    : null;

  const paid = invoice
    ? invoice.paymentStatus === 'paid'
    : job?.paymentStatus === 'collected' || booking.paymentStatus === 'verified';

  const documents: ChapterDocument[] = [];
  if (invoice && invoiceToken) {
    documents.push({
      kind: paid ? 'receipt' : 'invoice',
      title: paid ? 'Receipt' : 'Invoice',
      detail: invoice.invoiceNumber,
      href: `/invoice/${invoice.id}?t=${invoiceToken}`,
    });
  }

  return {
    title: booking.serviceName,
    dateISO: booking.scheduledDate,
    vehicleName: booking.vehicleName,
    registration: booking.vehicleRegNo,
    hero,
    work,
    evidence,
    lead,
    helpers,
    minutesInCare,
    amount: invoice?.total ?? booking.totalAmount ?? 0,
    paid,
    paymentMethod: invoice?.paymentMethod ?? booking.paymentMethod ?? null,
    coveredByClub: !!booking.usedMembershipWash,
    documents,
  };
}

/** "6h 20m in the studio" / "45 minutes in the studio" - never a bare number. */
export const timeInCare = (minutes: number): string => {
  if (minutes < 60) return `${minutes} minutes in the studio`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m in the studio` : `${h}h in the studio`;
};
