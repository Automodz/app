import { projectMoments, sortMoments, groupByMonth, framesOf, SHOT_CAPTION } from '@/lib/os/moment';
import type { Job, Moment } from '@/lib/types';

const ts = (iso: string) => {
  const d = new Date(iso);
  return { toDate: () => d, toMillis: () => d.getTime() } as unknown as import('firebase/firestore').Timestamp;
};

const job = (over: Partial<Job> = {}): Job => ({
  id: 'j1', bookingId: 'b1', vehicleRegNo: 'GJ01AB1234',
  completedAt: ts('2026-04-20T17:30:00'),
  photos: [
    { url: 'before.jpg', path: 'p1', kind: 'before' },
    { url: 'after.jpg', path: 'p2', kind: 'after' },
  ],
  ...over,
} as unknown as Job);

describe('the Moment engine', () => {
  it('turns the studio’s photographs into the vehicle’s own timeline', () => {
    const m = projectMoments({ vehicleId: 'car1', jobs: [job()] });
    expect(m).toHaveLength(2);
    expect(m.every(x => x.vehicleId === 'car1')).toBe(true);
    expect(m.every(x => x.authorKind === 'studio')).toBe(true);
    expect(m.map(x => x.caption)).toEqual([SHOT_CAPTION.before, SHOT_CAPTION.after]);
  });

  /* Media belongs to the CAR, not the job (Constitution Art. 10). A moment
     that came from work carries its visit so "what did you actually do?" is
     answerable from any photograph. */
  it('carries the visit it came from', () => {
    const m = projectMoments({ vehicleId: 'car1', jobs: [job()] });
    expect(m.every(x => x.visitId === 'b1')).toBe(true);
  });

  it('is idempotent - deterministic ids, so a re-run writes one row per frame', () => {
    const a = projectMoments({ vehicleId: 'car1', jobs: [job()] });
    const b = projectMoments({ vehicleId: 'car1', jobs: [job()] });
    expect(a.map(x => x.id)).toEqual(b.map(x => x.id));
    expect(new Set(a.map(x => x.id)).size).toBe(a.length);
  });

  it('says nothing when the studio recorded nothing', () => {
    expect(projectMoments({ vehicleId: 'car1', jobs: [job({ photos: [] })] })).toEqual([]);
    expect(projectMoments({ vehicleId: 'car1', jobs: [] })).toEqual([]);
  });

  /**
   * A PHOTOGRAPH IS DATED BY THE WORK, NEVER BY THE LAST EDIT.
   *
   * `at` fell back to `job.updatedAt` - when the document was last written -
   * and the Vehicle room groups photographs by MONTH under month headings. A
   * job opened on 23 July and touched on 8 August filed its three photographs
   * under "August 2026", which was live in production.
   */
  it('dates photographs from the work, not from when the record was touched', () => {
    const inTheBay = job({
      completedAt: undefined,
      createdAt: ts('2026-07-23T09:00:00'),
      updatedAt: ts('2026-08-08T16:00:00'),
    });
    const m = projectMoments({ vehicleId: 'car1', jobs: [inTheBay] });
    expect(groupByMonth(sortMoments(m)).map(g => g.label)).toEqual(['July 2026']);
    expect(m.every(x => x.at.toDate().getMonth() === 6)).toBe(true);
  });

  it('skips work with no recorded time rather than inventing one', () => {
    const undated = job({ completedAt: undefined, updatedAt: undefined, createdAt: undefined });
    expect(projectMoments({ vehicleId: 'car1', jobs: [undated] })).toEqual([]);
  });

  it('reads newest first', () => {
    const older = job({ id: 'j0', bookingId: 'b0', completedAt: ts('2025-01-10T10:00:00') });
    const m = sortMoments(projectMoments({ vehicleId: 'car1', jobs: [older, job()] }));
    expect(m[0].at.toDate().getFullYear()).toBe(2026);
    expect(m[m.length - 1].at.toDate().getFullYear()).toBe(2025);
  });

  /* Someone looking for a photograph of their own car thinks in months, not
     in invoices. */
  it('groups by month, not by job', () => {
    const a = job({ id: 'jA', bookingId: 'bA', completedAt: ts('2026-04-02T10:00:00') });
    const b = job({ id: 'jB', bookingId: 'bB', completedAt: ts('2026-04-28T10:00:00') });
    const c = job({ id: 'jC', bookingId: 'bC', completedAt: ts('2026-07-12T10:00:00') });
    const groups = groupByMonth(projectMoments({ vehicleId: 'car1', jobs: [a, b, c] }));
    expect(groups.map(g => g.month)).toEqual(['2026-07', '2026-04']);
    expect(groups[0].moments).toHaveLength(2);   // one job  × 2 photos
    expect(groups[1].moments).toHaveLength(4);   // two jobs × 2 photos
    expect(groups[0].label).toBe('July 2026');
  });

  it('flattens to the frames the viewer pages through', () => {
    const f = framesOf(projectMoments({ vehicleId: 'car1', jobs: [job()] }));
    expect(f.map(x => x.url)).toEqual(['before.jpg', 'after.jpg']);
    expect(f[0].caption).toBe('On arrival');
    expect(f[0].at).toBeInstanceOf(Date);
  });

  /* THE ACTOR LAW (Constitution Art. 8) - the timeline credits the studio,
     never a person, however the floor recorded it. */
  it('never carries an individual’s name', () => {
    const withNames = job({
      // the floor's own record, names and all
      statusHistory: [{ status: 'completed', at: ts('2026-04-20T17:30:00'), byEmployeeId: 'e1', byEmployeeName: 'Ravi Sharma' }],
      assignments: [{ employeeId: 'e1', employeeName: 'Ravi Sharma', role: 'lead', assignedAt: ts('2026-04-20T09:00:00') }],
    } as unknown as Partial<Job>);
    const m = projectMoments({ vehicleId: 'car1', jobs: [withNames] });
    expect(JSON.stringify(m)).not.toContain('Ravi Sharma');
  });
});
