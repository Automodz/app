'use client';
/**
 * CxLiveActivity — the persistent "your car is inside the studio" strip.
 * Docks above the tab bar on every customer screen while any booking is in
 * an active state, so the visit follows the customer everywhere (Uber
 * philosophy, our language). Tapping it opens the full tracker.
 *
 * One live surface. Screens must not render their own in-progress banners.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import type { Booking } from '@/lib/types';
import { STATUS_CX, TONE_COLOR } from '@/lib/cx/status';
import { DUR, EASE } from '@/lib/cx/motion';
import { getStatusStep } from '@/lib/utils';

const ACTIVE = ['vehicle_received', 'in_progress', 'quality_check', 'ready_for_delivery'];

export function activeVisit(bookings: Booking[]): Booking | null {
  return bookings
    .filter(b => ACTIVE.includes(b.status))
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0] ?? null;
}

export default function CxLiveActivity({ visit }: { visit: Booking | null }) {
  const router = useRouter();
  const cx = visit ? STATUS_CX[visit.status] : null;

  return (
    <AnimatePresence initial={false}>
      {visit && cx && (
        <motion.button
          key={visit.id + visit.status}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8, transition: { duration: DUR.fast, ease: EASE } }}
          transition={{ duration: DUR.base, ease: EASE }}
          onClick={() => router.push('/dashboard/history')}
          className="w-full text-left px-4 pt-2.5 pb-2 block"
          aria-label={`Live: ${visit.vehicleName} — ${cx.label}`}
        >
          <div className="flex items-center gap-3 max-w-lg mx-auto">
            <span className="relative flex w-2 h-2 shrink-0">
              <span className="absolute inline-flex w-full h-full rounded-full animate-ping opacity-60"
                style={{ background: TONE_COLOR[cx.tone] }} />
              <span className="relative inline-flex w-2 h-2 rounded-full"
                style={{ background: TONE_COLOR[cx.tone] }} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="truncate" style={{
                fontFamily: 'var(--font-display)', fontWeight: 700,
                fontSize: '12.5px', color: 'var(--chrome)',
              }}>
                {visit.vehicleName} · {cx.label}
              </p>
              <div className="flex items-center gap-1 mt-1.5">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex-1 h-[3px] rounded-full transition-colors duration-700"
                    style={{
                      background: i <= getStatusStep(visit.status)
                        ? TONE_COLOR[cx.tone] : 'var(--border-2)',
                    }} />
                ))}
              </div>
            </div>
            <ChevronRight size={15} style={{ color: 'var(--steel)', flexShrink: 0 }} />
          </div>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
