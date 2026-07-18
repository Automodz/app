'use client';
/**
 * BayStrip — the physical floor, compact. Two resources (Wash Bay ×1,
 * Protection Bay ×1) with live occupancy, derived time tracking and
 * scheduling intelligence. Used by the Schedule page; the Studio Operations
 * Board renders the full-size version of the same state. All derivation
 * lives in useFloor — this component only draws.
 *
 * Colour law:  green = available · orange = ending soon (<60 min) · red = late
 */
import { useMemo } from 'react';
import { Droplets, Timer, Wrench, AlertTriangle } from 'lucide-react';
import { washDayStats, fmtMin } from '@/lib/services/washMetrics';
import {
  categoryToResource, WORK_DAY_MIN, resourceCapacity, type ResourceKey,
} from '@/lib/availability';
import { useFloor, type Occupant } from '@/components/studio/useFloor';
import type { Booking, Job } from '@/lib/types';

const timeLabel = (d: Date) =>
  d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

export default function BayStrip({
  jobs, bookings = [], tomorrowBookings,
}: {
  jobs: Job[];
  bookings?: Booking[];
  /** Pass tomorrow's bookings to light up the look-ahead intelligence row. */
  tomorrowBookings?: Booking[];
}) {
  const floor = useFloor(jobs, bookings);
  const { bays, waiting, lateCount, bookedMin, remainingDayMin, durationOf, cfg } = floor;

  const tomorrowMin = useMemo(() => {
    if (!tomorrowBookings) return null;
    const m: Record<ResourceKey, number> = { wash: 0, protection: 0 };
    tomorrowBookings
      .filter(b => !['cancelled', 'completed'].includes(b.status))
      .forEach(b => {
        m[categoryToResource(b.serviceCategory)] +=
          Math.min(WORK_DAY_MIN, b.serviceDurationMinutes ?? durationOf(b.serviceCategory));
      });
    return m;
  }, [tomorrowBookings, durationOf]);

  const pct = (m: number) => Math.min(100, Math.round((m / WORK_DAY_MIN) * 100));
  const bottleneck: ResourceKey | null =
    bookedMin.wash === 0 && bookedMin.protection === 0 ? null
      : bookedMin.protection >= bookedMin.wash ? 'protection' : 'wash';

  const bayColor = (occ: Occupant[], cap: number): string => {
    if (occ.length === 0) return 'var(--success)';
    const worst = Math.min(...occ.map(o => o.remainingMin ?? Infinity));
    if (worst < 0) return 'var(--danger)';
    if (worst <= 60) return 'var(--warning)';
    return occ.length >= cap ? 'var(--danger)' : 'var(--warning)';
  };

  const wash = useMemo(() => washDayStats(jobs), [jobs]);

  const bayRows: { key: ResourceKey; label: string; cap: number }[] = [
    { key: 'wash', label: 'WASH BAY', cap: resourceCapacity('wash', cfg) },
    { key: 'protection', label: 'PROTECTION BAY', cap: 1 },
  ];

  return (
    <div className="rounded-2xl px-4 py-3 mb-4" style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
      {/* ── the two resources, live ── */}
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
        {bayRows.map(bay => {
          const occ = bays[bay.key];
          const color = bayColor(occ, bay.cap);
          const first = occ[0];
          return (
            <div key={bay.key} className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono inline-flex items-center gap-1.5" style={{ fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--faint)' }}>
                  <span className="rounded-full" style={{ width: 7, height: 7, background: color }} />
                  {bay.label}
                </span>
                <span className="font-mono" style={{ fontSize: 10, color }}>
                  {occ.length}/{bay.cap}
                </span>
              </div>
              <div className="flex gap-1 mt-1.5">
                {Array.from({ length: bay.cap }).map((_, i) => (
                  <span key={i} className="h-1.5 flex-1 rounded-full"
                    style={{ background: i < occ.length ? color : 'var(--smoke)' }} />
                ))}
              </div>
              {first ? (
                <div className="mt-1.5">
                  <p className="font-body truncate" style={{ fontSize: 12.5, color: 'var(--chrome)' }}>
                    {first.vehicle}
                    {first.technician && <span style={{ color: 'var(--steel)' }}> · {first.technician}</span>}
                  </p>
                  <p className="font-mono mt-0.5" style={{ fontSize: 10, color: 'var(--pewter)' }}>
                    {first.startedAt && <>started {timeLabel(first.startedAt)} · </>}
                    {first.elapsedMin !== null && <>{fmtMin(first.elapsedMin)} elapsed</>}
                    {first.eta && <> · ETA {timeLabel(first.eta)}</>}
                    {first.remainingMin !== null && (first.remainingMin < 0
                      ? <span style={{ color: 'var(--danger)' }}> · late {fmtMin(-first.remainingMin)}</span>
                      : <> · {fmtMin(first.remainingMin)} left</>)}
                  </p>
                  {occ.length > 1 && (
                    <p className="font-mono mt-0.5" style={{ fontSize: 9.5, color: 'var(--faint)' }}>
                      +{occ.length - 1} more in queue
                    </p>
                  )}
                </div>
              ) : (
                <p className="font-body mt-1.5" style={{ fontSize: 12.5, color: 'var(--steel)' }}>Available now</p>
              )}
            </div>
          );
        })}
      </div>

      {/* ── scheduling intelligence: capacity, bottleneck, look-ahead ── */}
      <div className="flex items-center gap-x-5 gap-y-1 flex-wrap mt-3 pt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
        <span className="font-mono" style={{ fontSize: 10, color: 'var(--pewter)' }}>
          today <b style={{ color: 'var(--chrome)', fontWeight: 700 }}>{pct(bookedMin.protection)}%</b> protection
          · <b style={{ color: 'var(--chrome)', fontWeight: 700 }}>{pct(bookedMin.wash)}%</b> wash
        </span>
        <span className="font-mono" style={{ fontSize: 10, color: 'var(--pewter)' }}>
          <Timer size={10} className="inline mr-1 -mt-0.5" style={{ color: 'var(--steel)' }} />
          <b style={{ color: 'var(--chrome)', fontWeight: 700 }}>{fmtMin(remainingDayMin)}</b> left today
        </span>
        {bottleneck && (
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--warning)' }}>
            bottleneck: {bottleneck}
          </span>
        )}
        {tomorrowMin && (
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--pewter)' }}>
            tomorrow <b style={{ color: 'var(--chrome)', fontWeight: 700 }}>{pct(tomorrowMin.protection)}%</b> / <b style={{ color: 'var(--chrome)', fontWeight: 700 }}>{pct(tomorrowMin.wash)}%</b>
          </span>
        )}
        {waiting.length > 0 && (
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--info)' }}>
            <Wrench size={10} className="inline mr-1 -mt-0.5" />{waiting.length} waiting
          </span>
        )}
        {lateCount > 0 && (
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--danger)' }}>
            <AlertTriangle size={10} className="inline mr-1 -mt-0.5" />{lateCount} running late
          </span>
        )}
      </div>

      {/* ── wash pulse — derived from the automatic job timeline ── */}
      <div className="flex items-center gap-x-5 gap-y-1 flex-wrap mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
        {[
          { icon: Timer, label: 'avg wash', value: fmtMin(wash.avgWorkMin) },
          { icon: Timer, label: 'avg wait', value: fmtMin(wash.avgWaitMin) },
          { icon: Timer, label: 'longest', value: fmtMin(wash.longestWorkMin) },
          { icon: Droplets, label: 'washed today', value: String(wash.completedToday) },
          { icon: Wrench, label: 'washing now', value: String(wash.washingNow) },
        ].map(s => (
          <span key={s.label} className="inline-flex items-center gap-1.5 font-mono" style={{ fontSize: 10, color: 'var(--pewter)' }}>
            <s.icon size={11} style={{ color: 'var(--steel)' }} />
            <b style={{ color: 'var(--chrome)', fontWeight: 700 }}>{s.value}</b> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
