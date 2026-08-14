/**
 * THE MOMENT ENGINE (Constitution Art. 10 · docs/AUTOMODZ-OS-IA.md §4).
 *
 * Media belongs to the car, not to the job. This module owns the one rule for
 * turning what the studio recorded into the vehicle's own timeline, and the
 * reading order the Media Library uses.
 *
 * Like `projectProtections`, `projectMoments` is a MIGRATION-WINDOW read path:
 * until the `moments` collection is populated, it derives the studio's half of
 * the timeline from the job photos a car already has, keyed deterministically
 * so the eventual write produces the same rows. The owner's half cannot be
 * projected from anything - it does not exist until they add it - so an empty
 * Media Library is honest, not broken.
 *
 * Pure - no Firebase, no React.
 */
import type { Job, Moment, MomentMedia } from '@/lib/types';

/** What each studio photograph was taken FOR - the evidence chain (Art. 13). */
export const SHOT_CAPTION: Record<'before' | 'during' | 'after', string> = {
  before: 'On arrival',
  during: 'In care',
  after: 'Finished',
};

/** Studio captures lead the day they were taken; the reveal reads last. */
const SHOT_ORDER: Record<'before' | 'during' | 'after', number> = {
  before: 0, during: 1, after: 2,
};

export interface MomentGroup {
  /** YYYY-MM - the Media Library groups by month, never by job */
  month: string;
  label: string;
  moments: Moment[];
}

/**
 * The studio's half of a car's timeline, derived from the work it has had.
 *
 * Deterministic ids (`${jobId}_${kind}_${i}`) so running this twice - or
 * writing it for real later - produces one row per photograph, never two.
 */
export function projectMoments(args: {
  vehicleId: string;
  /** every job on this car, any status */
  jobs: Job[];
  /** jobId → the visit it belongs to, when known */
  visitByJob?: Map<string, string>;
}): Moment[] {
  const out: Moment[] = [];

  for (const job of args.jobs) {
    const photos = job.photos ?? [];
    if (!photos.length) continue;

    /**
     * WHEN THE WORK HAPPENED - and `updatedAt` is not that.
     *
     * The comment below said "when the studio recorded it, not when we read
     * it", and then fell back to `updatedAt`, which is when the document was
     * last WRITTEN. Every later edit to a job dragged its photographs forward
     * in time, and the room groups them by month: a job opened on 23 July and
     * touched on 8 August filed its three photographs under August 2026, in a
     * car whose own room shows the months as headings. That is live in
     * production today.
     *
     * `completedAt` is a true event and every completed job in production
     * carries one. `createdAt` - when the job was opened, which is when the car
     * arrived - is the honest floor for one still in the bay. Neither can move
     * because somebody corrected a note.
     */
    const at = job.completedAt ?? job.createdAt;
    if (!at) continue;

    photos.forEach((p, i) => {
      const media: MomentMedia[] = [{ url: p.url, kind: 'photo' }];
      out.push({
        id: `${job.id}_${p.kind}_${i}`,
        vehicleId: args.vehicleId,
        visitId: args.visitByJob?.get(job.id) ?? job.bookingId,
        at,
        kind: 'photo',
        media,
        caption: SHOT_CAPTION[p.kind],
        authorKind: 'studio',
      });
    });
  }

  return sortMoments(out);
}

/** Newest first; within one capture, the evidence chain keeps its order. */
export function sortMoments(list: Moment[]): Moment[] {
  return [...list].sort((a, b) => {
    const t = (b.at?.toMillis?.() ?? 0) - (a.at?.toMillis?.() ?? 0);
    if (t !== 0) return t;
    const ao = SHOT_ORDER[(a.caption === 'On arrival' ? 'before' : a.caption === 'In care' ? 'during' : 'after')] ?? 0;
    const bo = SHOT_ORDER[(b.caption === 'On arrival' ? 'before' : b.caption === 'In care' ? 'during' : 'after')] ?? 0;
    return ao - bo;
  });
}

/**
 * The Media Library reads by month, because that is how someone looks for a
 * photograph of their own car - not by which invoice produced it.
 */
export function groupByMonth(list: Moment[]): MomentGroup[] {
  const groups = new Map<string, Moment[]>();

  for (const m of sortMoments(list)) {
    const d = m.at?.toDate?.();
    if (!d) continue;
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month)!.push(m);
  }

  return [...groups.entries()].map(([month, moments]) => {
    const [y, mo] = month.split('-').map(Number);
    return {
      month,
      label: new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      moments,
    };
  });
}

/** Every frame in a set of moments, flattened - what the viewer pages through. */
export const framesOf = (list: Moment[]): { url: string; caption?: string; at?: Date }[] =>
  sortMoments(list).flatMap(m =>
    m.media.map(md => ({ url: md.url, caption: m.caption, at: m.at?.toDate?.() })),
  );
