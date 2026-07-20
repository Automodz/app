/**
 * Vehicle Passport model — everything the passport shows, derived from the
 * vehicle's own bookings, its jobs (statusHistory, assignments, photos) and
 * the service catalog. No stored duplicates, no fake metrics: every number
 * traces back to a real record, and every recommendation explains why.
 */
import type { Booking, Job, JobPhoto, Service, Vehicle } from '@/lib/types';
import { deriveProtection, type Protection } from '@/lib/cx/protection';

const DAY = 86400000;
const daysSince = (iso: string, now: Date) =>
  Math.floor((now.getTime() - new Date(iso + 'T12:00:00').getTime()) / DAY);
const daysUntil = (d: Date, now: Date) =>
  Math.ceil((d.getTime() - now.getTime()) / DAY);

/* ── life timeline: the story, not the invoices ─────────────────────────── */

const LIFE_PHRASE: Record<string, string> = {
  PPF: 'Paint protection film applied',
  Ceramic: 'Ceramic protection installed',
  Coating: 'Glass & Teflon care applied',
  Washing: 'Maintenance wash',
};

export type LifeEvent = { key: string; date: string; title: string; bookingId?: string };

/* ── care score: a 100-point identity, fully explainable ────────────────── */

export type ScoreReason = { label: string; delta: number };
export type CareScore = {
  value: number;
  grade: 'Excellent' | 'Good' | 'Needs attention' | 'Poor';
  reasons: ScoreReason[];
};

/* ── smart recommendations: history-driven, each with a why ─────────────── */

export type Recommendation = {
  id: string;
  title: string;
  why: string;
  /** category the CTA books into */
  category: Service['category'];
  urgent: boolean;
};

export type Memory = {
  booking: Booking;
  job: Job | null;
  photos: JobPhoto[];
  technician: string | null;
};

export type Passport = {
  history: Booking[];          // non-cancelled, newest first
  completed: Booking[];
  protection: Protection[];
  life: LifeEvent[];
  score: CareScore;
  recommendations: Recommendation[];
  memories: Memory[];
  stats: {
    visits: number;
    invested: number;
    daysProtected: number | null;
    topService: string | null;
    favoriteTechnician: string | null;
    avgTurnaroundMin: number | null;
    lastVisit: string | null;
  };
  documents: {
    invoices: { id: string; name: string; date: string }[];
    warranties: Protection[];
    photoCount: number;
  };
  photosByKind: Record<JobPhoto['kind'], JobPhoto[]>;
};

export function derivePassport(
  vehicle: Vehicle,
  allBookings: Booking[],
  allJobs: Job[],
  services: Service[],
  now = new Date(),
): Passport {
  const history = allBookings
    .filter(b => b.vehicleId === vehicle.id && b.status !== 'cancelled')
    .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
  const completed = history.filter(b => b.status === 'completed');

  const jobs = allJobs.filter(j =>
    history.some(b => b.id === j.bookingId) || j.vehicleRegNo === vehicle.registrationNumber);
  const jobByBooking = new Map(jobs.filter(j => j.bookingId).map(j => [j.bookingId!, j]));

  const protection = deriveProtection(history, services);

  /* life timeline (oldest first — a story reads forward) */
  const life: LifeEvent[] = [];
  if (vehicle.createdAt?.toDate) {
    life.push({
      key: 'joined',
      date: vehicle.createdAt.toDate().toISOString().split('T')[0],
      title: 'Joined your AutoModz garage',
    });
  }
  [...completed].reverse().forEach((b, i) => {
    life.push({
      key: b.id,
      date: b.scheduledDate,
      title: i === 0 && b.serviceCategory === 'Washing'
        ? 'First wash with us'
        : LIFE_PHRASE[b.serviceCategory] ?? b.serviceName,
      bookingId: b.id,
    });
  });

  /* stats */
  const invested = completed.reduce((s, b) => s + b.totalAmount, 0);

  const activeLayers = protection.filter(p => p.active);
  const earliestActive = activeLayers
    .map(p => p.applied).sort()[0];
  const daysProtected = earliestActive ? daysSince(earliestActive, now) : null;

  const svcCount = new Map<string, number>();
  completed.forEach(b => svcCount.set(b.serviceName, (svcCount.get(b.serviceName) ?? 0) + 1));
  const topService = [...svcCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const techCount = new Map<string, number>();
  jobs.forEach(j => j.assignments?.filter(a => !a.removedAt && a.role === 'lead')
    .forEach(a => techCount.set(a.employeeName, (techCount.get(a.employeeName) ?? 0) + 1)));
  const favoriteTechnician = [...techCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const turnarounds = jobs
    .filter(j => j.completedAt && j.createdAt)
    .map(j => (j.completedAt!.toMillis() - j.createdAt.toMillis()) / 60000);
  const avgTurnaroundMin = turnarounds.length
    ? Math.round(turnarounds.reduce((s, t) => s + t, 0) / turnarounds.length)
    : null;

  const lastVisit = completed[0]?.scheduledDate ?? null;
  const lastWash = completed.find(b => b.serviceCategory === 'Washing')?.scheduledDate ?? null;

  /* recommendations — every one traces to a record */
  const recommendations: Recommendation[] = [];
  activeLayers.forEach(p => {
    if (!p.until) return;
    const left = daysUntil(p.until, now);
    if (left > 0 && left <= 60) {
      recommendations.push({
        id: `${p.kind}-expiring`,
        title: `Your ${p.kind === 'Coating' ? 'coating' : p.kind} protection ends in ${left} days`,
        why: `${p.service} was applied ${new Date(p.applied + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} with ${p.warranty ?? 'limited'} cover.`,
        category: p.kind, urgent: left <= 21,
      });
    }
  });
  protection.filter(p => !p.active).forEach(p => {
    recommendations.push({
      id: `${p.kind}-expired`,
      title: `${p.kind === 'Coating' ? 'Coating' : p.kind} protection has lapsed`,
      why: `${p.service} expired ${p.until ? p.until.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'a while back'} — the paint is bare again.`,
      category: p.kind, urgent: true,
    });
  });
  const ppf = activeLayers.find(p => p.kind === 'PPF');
  if (ppf && daysSince(ppf.applied, now) >= 330 && (!lastVisit || daysSince(lastVisit, now) > 30)) {
    recommendations.push({
      id: 'ppf-inspection',
      title: 'PPF annual inspection due',
      why: `The film went on ${new Date(ppf.applied + 'T12:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} — edges and high-impact zones deserve a yearly look.`,
      category: 'PPF', urgent: false,
    });
  }
  const washGap = lastWash ? daysSince(lastWash, now) : null;
  if (washGap !== null && washGap > 30) {
    recommendations.push({
      id: 'wash-overdue',
      title: 'A wash is overdue',
      why: `Last washed ${washGap} days ago${activeLayers.length ? ' — regular washes keep the protection working' : ''}.`,
      category: 'Washing', urgent: washGap > 60,
    });
  } else if (washGap === null && completed.length > 0) {
    recommendations.push({
      id: 'first-wash',
      title: 'Time for its first wash with us',
      why: 'We’ve done the big work — maintenance washes make it last.',
      category: 'Washing', urgent: false,
    });
  }

  /* care score — explainable, derived, no magic */
  const reasons: ScoreReason[] = [];
  let value = 0;
  if (activeLayers.length > 0) {
    const pts = Math.min(35, 25 + (activeLayers.length - 1) * 10);
    value += pts;
    reasons.push({ label: `${activeLayers.length} protection layer${activeLayers.length > 1 ? 's' : ''} active`, delta: pts });
  } else {
    reasons.push({ label: 'No active protection', delta: 0 });
  }
  if (washGap !== null) {
    const pts = washGap <= 30 ? 25 : Math.max(0, Math.round(25 * (1 - (washGap - 30) / 60)));
    value += pts;
    reasons.push({ label: washGap <= 30 ? 'Washed recently' : `Last wash ${washGap} days ago`, delta: pts });
  } else {
    reasons.push({ label: 'No wash on record', delta: 0 });
  }
  const overdue = recommendations.filter(r => r.urgent).length;
  const overduePts = Math.max(0, 20 - overdue * 10);
  value += overduePts;
  reasons.push({ label: overdue === 0 ? 'Nothing overdue' : `${overdue} urgent item${overdue > 1 ? 's' : ''}`, delta: overduePts });
  if (lastVisit && daysSince(lastVisit, now) <= 60) {
    value += 10;
    reasons.push({ label: 'Serviced in the last 60 days', delta: 10 });
  }
  if (completed.length >= 3) {
    value += 10;
    reasons.push({ label: `${completed.length} visits of consistent care`, delta: 10 });
  }
  value = Math.min(100, value);
  const score: CareScore = {
    value,
    grade: value >= 85 ? 'Excellent' : value >= 65 ? 'Good' : value >= 45 ? 'Needs attention' : 'Poor',
    reasons,
  };

  /* memories — completed visits as moments, photos attached */
  const memories: Memory[] = completed.map(b => {
    const job = jobByBooking.get(b.id) ?? null;
    return {
      booking: b, job,
      photos: job?.photos ?? [],
      technician: job?.assignments?.filter(a => !a.removedAt && a.role === 'lead')[0]?.employeeName ?? null,
    };
  });

  const allPhotos = jobs.flatMap(j => j.photos ?? []);
  const photosByKind: Passport['photosByKind'] = { before: [], during: [], after: [] };
  allPhotos.forEach(p => photosByKind[p.kind]?.push(p));

  const invoices = completed
    .map(b => ({ b, invoiceId: b.invoiceId ?? jobByBooking.get(b.id)?.invoiceId }))
    .filter((x): x is { b: Booking; invoiceId: string } => !!x.invoiceId)
    .map(({ b, invoiceId }) => ({ id: invoiceId, name: b.serviceName, date: b.scheduledDate }));

  return {
    history, completed, protection, life, score, recommendations, memories,
    stats: { visits: completed.length, invested, daysProtected, topService, favoriteTechnician, avgTurnaroundMin, lastVisit },
    documents: { invoices, warranties: protection.filter(p => p.warranty), photoCount: allPhotos.length },
    photosByKind,
  };
}
