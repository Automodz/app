'use client';
/**
 * Live bay occupancy + wash pulse — the physical floor, at a glance.
 * One shared component for the Admin Workspace and Schedule (staff data
 * access). Derives everything from the jobs/bookings already loaded by the
 * host page + the service catalogue; writes nothing.
 */
import { useEffect, useMemo, useState } from 'react';
import { Wrench, Droplets, Timer } from 'lucide-react';
import { getResourceConfig, getServices } from '@/lib/firebaseService';
import { washDayStats, fmtMin } from '@/lib/services/washMetrics';
import {
  categoryToResource, expandIntervals, DAY_OPEN_MIN,
  RESOURCE_DEFAULTS, type ResourceConfig, type ResourceKey,
} from '@/lib/availability';
import type { Booking, Job, Service } from '@/lib/types';

const ACTIVE_JOB = ['checked_in', 'in_progress', 'quality_check', 'ready_for_delivery'];

interface BayView {
  key: ResourceKey;
  label: string;
  occupants: { vehicle: string; until: string | null }[];
  capacity: number;
}

const untilLabel = (startDate: string, startMin: number, durationMin: number): string | null => {
  const ivs = expandIntervals({ date: startDate, startMin, durationMin });
  const last = ivs[ivs.length - 1];
  if (!last) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (last.date === today) return 'Today';
  const d = new Date(last.date + 'T12:00:00');
  return 'Until ' + d.toLocaleDateString('en-IN', { weekday: 'short' });
};

export default function BayStrip({ jobs, bookings = [] }: { jobs: Job[]; bookings?: Booking[] }) {
  const [cfg, setCfg] = useState<ResourceConfig>(RESOURCE_DEFAULTS);
  const [services, setServices] = useState<Service[]>([]);
  useEffect(() => {
    getResourceConfig().then(setCfg).catch(() => {});
    getServices().then(setServices).catch(() => {});
  }, []);

  const durationOf = useMemo(() => {
    const byName = new Map(services.map(s => [s.name, s.duration]));
    const byCat = new Map<string, number>();
    services.forEach(s => byCat.set(s.category, Math.max(byCat.get(s.category) ?? 0, s.duration)));
    return (cat: string, name?: string) => (name && byName.get(name)) || byCat.get(cat) || 60;
  }, [services]);

  const bays = useMemo<BayView[]>(() => {
    const active = jobs.filter(j => ACTIVE_JOB.includes(j.status));
    const bookedJobIds = new Set(active.map(j => j.bookingId).filter(Boolean));
    const views: Record<ResourceKey, BayView> = {
      ppf:     { key: 'ppf', label: 'PPF BAY', occupants: [], capacity: 1 },
      coating: { key: 'coating', label: 'COATING BAY', occupants: [], capacity: 1 },
      wash:    { key: 'wash', label: 'WASH', occupants: [], capacity: Math.max(1, cfg.washCapacity) },
    };
    for (const j of active) {
      const cat = j.serviceItems[0]?.category;
      if (!cat) continue;
      const r = categoryToResource(cat);
      const created = j.createdAt?.toDate?.();
      const startMin = created ? created.getHours() * 60 + created.getMinutes() : DAY_OPEN_MIN;
      const dur = j.serviceItems.reduce((s, it) => s + durationOf(it.category, it.serviceName), 0);
      views[r].occupants.push({
        vehicle: j.vehicleName || j.customerName,
        until: untilLabel(j.date, startMin, dur),
      });
    }
    // in-studio bookings that have not spawned a job yet still hold their bay
    for (const b of bookings) {
      if (!['vehicle_received', 'in_progress', 'quality_check'].includes(b.status) || (b.jobId && bookedJobIds.has(b.jobId))) continue;
      const r = categoryToResource(b.serviceCategory);
      const [h, m] = (b.scheduledTime || '09:00').split(':').map(Number);
      views[r].occupants.push({
        vehicle: b.vehicleName,
        until: untilLabel(b.scheduledDate, h * 60 + m, b.serviceDurationMinutes ?? durationOf(b.serviceCategory)),
      });
    }
    return [views.ppf, views.coating, views.wash];
  }, [jobs, bookings, cfg, durationOf]);

  const wash = useMemo(() => washDayStats(jobs), [jobs]);

  return (
    <div className="rounded-2xl px-4 py-3 mb-4" style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
      <div className="grid sm:grid-cols-3 gap-x-6 gap-y-2">
        {bays.map(bay => {
          const used = bay.occupants.length;
          const full = used >= bay.capacity;
          return (
            <div key={bay.key} className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono" style={{ fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--faint)' }}>{bay.label}</span>
                <span className="font-mono" style={{ fontSize: 10, color: full ? 'var(--warning)' : 'var(--success)' }}>
                  {used}/{bay.capacity}
                </span>
              </div>
              {/* occupancy bar */}
              <div className="flex gap-1 mt-1.5">
                {Array.from({ length: bay.capacity }).map((_, i) => (
                  <span key={i} className="h-1.5 flex-1 rounded-full"
                    style={{ background: i < used ? (full ? 'var(--warning)' : 'var(--info)') : 'var(--smoke)' }} />
                ))}
              </div>
              <p className="font-body truncate mt-1.5" style={{ fontSize: 12, color: used ? 'var(--chrome)' : 'var(--steel)' }}>
                {bay.key === 'wash'
                  ? (used ? `${used} washing now` : 'Free')
                  : bay.occupants[0]
                    ? <>{bay.occupants[0].vehicle}{bay.occupants[0].until ? <span style={{ color: 'var(--steel)' }}> · {bay.occupants[0].until}</span> : null}</>
                    : 'Free'}
              </p>
            </div>
          );
        })}
      </div>

      {/* wash pulse — derived from the automatic job timeline, no manual timers */}
      <div className="flex items-center gap-x-5 gap-y-1 flex-wrap mt-3 pt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
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

