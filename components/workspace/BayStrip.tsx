'use client';
/**
 * The physical floor, live — two resources (Wash Bay ×1, Protection Bay ×N=1)
 * with real occupancy, derived time tracking and scheduling intelligence.
 * Shared by the Admin Workspace and Schedule. Reads the jobs/bookings the
 * host already loads + the service catalogue; writes nothing, stores nothing:
 * elapsed / ETA / late are all derived from the automatic job timeline.
 *
 * Colour law:  green = available · orange = ending soon (<60 min) · red = busy
 */
import { useEffect, useMemo, useState } from 'react';
import { Droplets, Timer, Wrench, AlertTriangle } from 'lucide-react';
import { getResourceConfig, getServices } from '@/lib/firebaseService';
import { washDayStats, fmtMin, jobTimeline } from '@/lib/services/washMetrics';
import {
  categoryToResource, RESOURCE_DEFAULTS, WORK_DAY_MIN, DAY_OPEN_MIN,
  type ResourceConfig, type ResourceKey,
} from '@/lib/availability';
import type { Booking, Job, Service } from '@/lib/types';

const ACTIVE_JOB = ['checked_in', 'in_progress', 'quality_check', 'ready_for_delivery'];

interface LiveOccupant {
  vehicle: string;
  technician?: string;
  startedAt: Date | null;
  elapsedMin: number | null;
  etaLabel: string | null;
  remainingMin: number | null; // negative = late
}

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
  const [cfg, setCfg] = useState<ResourceConfig>(RESOURCE_DEFAULTS);
  const [services, setServices] = useState<Service[]>([]);
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    getResourceConfig().then(setCfg).catch(() => {});
    getServices().then(setServices).catch(() => {});
    const t = setInterval(() => setNowTs(Date.now()), 60000); // live minutes
    return () => clearInterval(t);
  }, []);

  const durationOf = useMemo(() => {
    const byName = new Map(services.map(s => [s.name, s.duration]));
    const byCat = new Map<string, number>();
    services.forEach(s => byCat.set(s.category, Math.max(byCat.get(s.category) ?? 0, s.duration)));
    return (cat: string, name?: string) => (name && byName.get(name)) || byCat.get(cat) || 60;
  }, [services]);

  const now = useMemo(() => new Date(nowTs), [nowTs]);

  // ── live occupants per resource, with derived time tracking ──
  const { bays, lateCount, waitingCount } = useMemo(() => {
    const active = jobs.filter(j => ACTIVE_JOB.includes(j.status));
    const map: Record<ResourceKey, LiveOccupant[]> = { wash: [], protection: [] };
    let late = 0;
    for (const j of active) {
      const cat = j.serviceItems[0]?.category;
      if (!cat) continue;
      const t = jobTimeline(j);
      const start = t.startedAt ?? t.arrivedAt;
      const estMin = j.serviceItems.reduce((s, it) => s + durationOf(it.category, it.serviceName), 0);
      const elapsedMin = start ? Math.max(0, Math.round((now.getTime() - start.getTime()) / 60000)) : null;
      const eta = start ? new Date(start.getTime() + estMin * 60000) : null;
      const remainingMin = eta ? Math.round((eta.getTime() - now.getTime()) / 60000) : null;
      if (remainingMin !== null && remainingMin < 0) late += 1;
      map[categoryToResource(cat)].push({
        vehicle: j.vehicleName || j.customerName,
        technician: j.assignments?.filter(a => !a.removedAt).map(a => a.employeeName).join(', ') || undefined,
        startedAt: start,
        elapsedMin,
        etaLabel: eta ? timeLabel(eta) : null,
        remainingMin,
      });
    }
    const waiting = jobs.filter(j => j.status === 'checked_in').length;
    return { bays: map, lateCount: late, waitingCount: waiting };
  }, [jobs, durationOf, now]);

  // ── capacity intelligence: booked minutes today/tomorrow per resource ──
  const capacity = useMemo(() => {
    const booked = (bs: Booking[]): Record<ResourceKey, number> => {
      const m: Record<ResourceKey, number> = { wash: 0, protection: 0 };
      bs.filter(b => !['cancelled', 'completed'].includes(b.status)).forEach(b => {
        m[categoryToResource(b.serviceCategory)] +=
          Math.min(WORK_DAY_MIN, b.serviceDurationMinutes ?? durationOf(b.serviceCategory));
      });
      return m;
    };
    const today = booked(bookings);
    // live jobs count toward today's load too (walk-ins have no booking)
    jobs.filter(j => ACTIVE_JOB.includes(j.status) && j.source === 'walk_in').forEach(j => {
      const cat = j.serviceItems[0]?.category;
      if (cat) today[categoryToResource(cat)] +=
        j.serviceItems.reduce((s, it) => s + durationOf(it.category, it.serviceName), 0);
    });
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const remainingDayMin = Math.max(0, Math.min(WORK_DAY_MIN, (DAY_OPEN_MIN + WORK_DAY_MIN) - nowMin));
    const pct = (m: number) => Math.min(100, Math.round((m / WORK_DAY_MIN) * 100));
    const bottleneck: ResourceKey | null =
      today.wash === 0 && today.protection === 0 ? null
        : today.protection >= today.wash ? 'protection' : 'wash';
    return {
      today, pct, remainingDayMin, bottleneck,
      tomorrow: tomorrowBookings ? booked(tomorrowBookings) : null,
    };
  }, [bookings, tomorrowBookings, jobs, durationOf, now]);

  const bayColor = (occ: LiveOccupant[], cap: number): string => {
    if (occ.length === 0) return 'var(--success)';
    const worst = Math.min(...occ.map(o => o.remainingMin ?? Infinity));
    if (worst < 0) return 'var(--danger)';
    if (worst <= 60) return 'var(--warning)';
    return occ.length >= cap ? 'var(--danger)' : 'var(--warning)';
  };

  const wash = useMemo(() => washDayStats(jobs), [jobs]);
  const washCap = Math.max(1, cfg.washCapacity);

  const bayRows: { key: ResourceKey; label: string; cap: number }[] = [
    { key: 'wash', label: 'WASH BAY', cap: washCap },
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
                    {first.etaLabel && <> · ETA {first.etaLabel}</>}
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
          today <b style={{ color: 'var(--chrome)', fontWeight: 700 }}>{capacity.pct(capacity.today.protection)}%</b> protection
          · <b style={{ color: 'var(--chrome)', fontWeight: 700 }}>{capacity.pct(capacity.today.wash)}%</b> wash
        </span>
        <span className="font-mono" style={{ fontSize: 10, color: 'var(--pewter)' }}>
          <Timer size={10} className="inline mr-1 -mt-0.5" style={{ color: 'var(--steel)' }} />
          <b style={{ color: 'var(--chrome)', fontWeight: 700 }}>{fmtMin(capacity.remainingDayMin)}</b> left today
        </span>
        {capacity.bottleneck && (
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--warning)' }}>
            bottleneck: {capacity.bottleneck}
          </span>
        )}
        {capacity.tomorrow && (
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--pewter)' }}>
            tomorrow <b style={{ color: 'var(--chrome)', fontWeight: 700 }}>{capacity.pct(capacity.tomorrow.protection)}%</b> / <b style={{ color: 'var(--chrome)', fontWeight: 700 }}>{capacity.pct(capacity.tomorrow.wash)}%</b>
          </span>
        )}
        {waitingCount > 0 && (
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--info)' }}>
            <Wrench size={10} className="inline mr-1 -mt-0.5" />{waitingCount} waiting
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
