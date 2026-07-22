/**
 * Wash performance metrics - PURE derivations over the job timeline the app
 * already records. `statusHistory` is written automatically on every stage
 * change (updateJobStatus / check-in), so there are no manual timers and no
 * duplicate timestamps: this module only reads.
 *
 * Stage → operational meaning:
 *   checked_in          vehicle arrived / check-in
 *   in_progress         work started
 *   ready_for_delivery  work completed (car is done, awaiting handover)
 *   completed           delivered to the customer
 */
import type { Job } from '../types';

export interface JobTimeline {
  arrivedAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;   // work complete (ready_for_delivery)
  deliveredAt: Date | null;  // handed over (completed)
  /** minutes between arrival and work start */
  waitMin: number | null;
  /** minutes of actual work */
  workMin: number | null;
  /** minutes arrival → delivery */
  turnaroundMin: number | null;
}

const firstAt = (job: Job, status: string): Date | null => {
  const e = (job.statusHistory ?? []).find(h => h.status === status);
  return e?.at?.toDate?.() ?? null;
};
const mins = (a: Date | null, b: Date | null): number | null =>
  a && b && b >= a ? Math.round((b.getTime() - a.getTime()) / 60000) : null;

export const jobTimeline = (job: Job): JobTimeline => {
  const arrivedAt = firstAt(job, 'checked_in') ?? job.createdAt?.toDate?.() ?? null;
  const startedAt = firstAt(job, 'in_progress');
  const finishedAt = firstAt(job, 'ready_for_delivery') ?? firstAt(job, 'quality_check');
  const deliveredAt = firstAt(job, 'completed');
  return {
    arrivedAt, startedAt, finishedAt, deliveredAt,
    waitMin: mins(arrivedAt, startedAt),
    workMin: mins(startedAt, finishedAt ?? deliveredAt),
    turnaroundMin: mins(arrivedAt, deliveredAt),
  };
};

export const isWashJob = (job: Job): boolean =>
  job.serviceItems.some(i => i.category === 'Washing');

export interface WashDayStats {
  avgWorkMin: number | null;
  avgWaitMin: number | null;
  longestWorkMin: number | null;
  completedToday: number;
  washingNow: number;
}

/** Today's wash pulse for the Workspace (feed it today's jobs). */
export const washDayStats = (jobs: Job[]): WashDayStats => {
  const washes = jobs.filter(isWashJob);
  const done = washes.filter(j => ['ready_for_delivery', 'completed'].includes(j.status));
  const works = done.map(j => jobTimeline(j).workMin).filter((n): n is number => n !== null);
  const waits = washes.map(j => jobTimeline(j).waitMin).filter((n): n is number => n !== null);
  return {
    avgWorkMin: works.length ? Math.round(works.reduce((s, n) => s + n, 0) / works.length) : null,
    avgWaitMin: waits.length ? Math.round(waits.reduce((s, n) => s + n, 0) / waits.length) : null,
    longestWorkMin: works.length ? Math.max(...works) : null,
    completedToday: washes.filter(j => j.status === 'completed').length,
    washingNow: washes.filter(j => j.status === 'in_progress').length,
  };
};

export interface EmployeeWashStats {
  washesDone: number;
  avgWorkMin: number | null;
  activeWorkMin: number;
  completionRate: number | null; // delivered / assigned washes
}

/** Wash performance for one employee (feed jobs where they are assigned). */
export const employeeWashStats = (jobs: Job[], employeeId: string): EmployeeWashStats => {
  const mine = jobs.filter(j =>
    isWashJob(j) && (j.assignedIds?.includes(employeeId) || j.createdByEmployeeId === employeeId));
  const finished = mine.filter(j => ['ready_for_delivery', 'completed'].includes(j.status));
  const works = finished.map(j => jobTimeline(j).workMin).filter((n): n is number => n !== null);
  return {
    washesDone: finished.length,
    avgWorkMin: works.length ? Math.round(works.reduce((s, n) => s + n, 0) / works.length) : null,
    activeWorkMin: works.reduce((s, n) => s + n, 0),
    completionRate: mine.length ? Math.round((finished.length / mine.length) * 100) : null,
  };
};

/** Average turnaround + peak start hours + per-resource busy share, for reports. */
export const studioThroughput = (jobs: Job[]) => {
  const delivered = jobs.filter(j => j.status === 'completed');
  const turns = delivered.map(j => jobTimeline(j).turnaroundMin).filter((n): n is number => n !== null);
  const hourHist = new Map<number, number>();
  jobs.forEach(j => {
    const s = jobTimeline(j).startedAt;
    if (s) hourHist.set(s.getHours(), (hourHist.get(s.getHours()) ?? 0) + 1);
  });
  const peakHour = [...hourHist.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const busyMin = { wash: 0, protection: 0 };
  jobs.forEach(j => {
    const t = jobTimeline(j);
    const w = t.workMin;
    if (w === null) return;
    if (j.serviceItems[0]?.category === 'Washing') busyMin.wash += w;
    else busyMin.protection += w;
  });

  return {
    avgTurnaroundMin: turns.length ? Math.round(turns.reduce((s, n) => s + n, 0) / turns.length) : null,
    deliveredCount: delivered.length,
    peakHour,
    busyMin,
  };
};

export const fmtMin = (m: number | null): string => {
  if (m === null) return '-';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

/** Per-category average work time for one employee (wash / ceramic / PPF …). */
export const employeeCategoryStats = (jobs: Job[], employeeId: string) => {
  const mine = jobs.filter(j =>
    j.assignedIds?.includes(employeeId) || j.createdByEmployeeId === employeeId);
  const byCat = new Map<string, number[]>();
  mine.forEach(j => {
    const w = jobTimeline(j).workMin;
    const cat = j.serviceItems[0]?.category;
    if (w === null || !cat) return;
    byCat.set(cat, [...(byCat.get(cat) ?? []), w]);
  });
  const avg = (arr: number[]) => Math.round(arr.reduce((s, n) => s + n, 0) / arr.length);
  return {
    perCategory: [...byCat.entries()].map(([category, works]) => ({
      category, count: works.length, avgWorkMin: avg(works),
    })),
    jobsWorked: mine.length,
    revenue: mine.filter(j => j.status === 'completed').reduce((s, j) => s + j.totalAmount, 0),
  };
};
