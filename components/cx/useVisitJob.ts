'use client';
/**
 * useVisitJob — THE way a customer surface follows the job behind a visit.
 * One subscription per mounted consumer (the home hero and the Live
 * Activity strip never render together, so at most one listener is live).
 * Dev-guarded seed keeps it exercisable without Firestore.
 */
import { useEffect, useState } from 'react';
import type { Booking, Job } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { subscribeJobForBooking } from '@/lib/firebaseService';
import { isDevUser, DEV_JOBS } from '@/lib/cx/devseed';

export function useVisitJob(visit: Booking | null): Job | null {
  const { user } = useAppStore();
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    if (!visit || !user) { setJob(null); return; }
    if (isDevUser(user.uid)) { setJob(DEV_JOBS[visit.id] ?? null); return; }
    return subscribeJobForBooking(visit.id, user.uid, setJob);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visit?.id, user?.uid]);

  return job;
}
