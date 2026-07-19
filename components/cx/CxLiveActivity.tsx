'use client';
/**
 * CxLiveActivity — the persistent "your car is inside the studio" strip.
 * Docks above the tab bar on every customer screen while any booking is in
 * an active state. Intelligent: it subscribes to the job behind the visit,
 * so stage, ETA, technician and the unread-update dot are live. One tap
 * enters the Care tracker.
 *
 * One live surface. Screens must not render their own in-progress banners.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import type { Booking, Job } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { subscribeJobForBooking } from '@/lib/firebaseService';
import { deriveCare, etaLine, hasUnseenUpdates } from '@/lib/cx/care';
import { DUR, EASE } from '@/lib/cx/motion';
import { isDevUser, DEV_JOBS } from '@/lib/cx/devseed';

const ACTIVE = ['vehicle_received', 'in_progress', 'quality_check', 'ready_for_delivery'];

export function activeVisit(bookings: Booking[]): Booking | null {
  return bookings
    .filter(b => ACTIVE.includes(b.status))
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0] ?? null;
}

export default function CxLiveActivity({ visit }: { visit: Booking | null }) {
  const router = useRouter();
  const { user } = useAppStore();
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    if (!visit || !user) { setJob(null); return; }
    if (isDevUser(user.uid)) { setJob(DEV_JOBS[visit.id] ?? null); return; }
    return subscribeJobForBooking(visit.id, user.uid, setJob);
  }, [visit?.id, user?.uid]);

  if (!visit) return null;
  const care = deriveCare(visit, job);
  const eta = etaLine(care);
  const unread = hasUnseenUpdates(visit.id, job);

  return (
    <AnimatePresence initial={false}>
      <motion.button
        key={visit.id + care.stage.label}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8, transition: { duration: DUR.fast, ease: EASE } }}
        transition={{ duration: DUR.base, ease: EASE }}
        onClick={() => router.push(`/dashboard/care/${visit.id}`)}
        className="w-full text-left px-4 pt-2.5 pb-2 block"
        aria-label={`Live: ${visit.vehicleName} — ${care.stage.label}`}
      >
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <span className="relative flex w-2 h-2 shrink-0">
            <span className="absolute inline-flex w-full h-full rounded-full animate-ping opacity-60"
              style={{ background: 'var(--success)' }} />
            <span className="relative inline-flex w-2 h-2 rounded-full"
              style={{ background: 'var(--success)' }} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 min-w-0">
              <p className="truncate" style={{
                fontFamily: 'var(--font-display)', fontWeight: 700,
                fontSize: '12.5px', color: 'var(--chrome)',
              }}>
                {visit.vehicleName} · {care.stage.label}
              </p>
              {unread && (
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--ember)' }}
                  aria-label="New updates" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--border-2)' }}>
                <motion.div className="h-full rounded-full"
                  initial={false}
                  animate={{ width: `${Math.round(care.progress * 100)}%` }}
                  transition={{ duration: DUR.slow, ease: EASE }}
                  style={{ background: 'var(--success)' }} />
              </div>
              {(eta || care.technician) && (
                <p className="shrink-0 truncate max-w-[46%]" style={{
                  fontFamily: 'var(--font-mono)', fontSize: '9px',
                  letterSpacing: '0.06em', color: 'var(--steel)',
                }}>
                  {eta ?? `WITH ${care.technician?.split(' ')[0].toUpperCase()}`}
                </p>
              )}
            </div>
          </div>
          <ChevronRight size={15} style={{ color: 'var(--steel)', flexShrink: 0 }} />
        </div>
      </motion.button>
    </AnimatePresence>
  );
}
