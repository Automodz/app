'use client';
/**
 * useFloor - the single live derivation of "what is happening inside the
 * workshop right now". One brain shared by the Studio Operations Board and
 * the compact BayStrip so the two never disagree.
 *
 * Everything is derived from the automatic job timeline (statusHistory) +
 * the service catalogue; nothing here writes or stores.
 */
import { useEffect, useMemo, useState } from 'react';
import { getResourceConfig, getServices } from '@/lib/firebaseService';
import { jobTimeline } from '@/lib/services/washMetrics';
import {
  categoryToResource, RESOURCE_DEFAULTS, WORK_DAY_MIN, DAY_OPEN_MIN,
  type ResourceConfig, type ResourceKey,
} from '@/lib/availability';
import type { Booking, Job, Service } from '@/lib/types';

export const ACTIVE_JOB = ['checked_in', 'in_progress', 'quality_check', 'ready_for_delivery'];
/** Jobs physically inside a bay right now. */
const IN_BAY = ['in_progress'];

export interface Occupant {
  job: Job;
  vehicle: string;
  customer: string;
  service: string;
  technician?: string;
  startedAt: Date | null;
  elapsedMin: number | null;
  estMin: number;
  eta: Date | null;
  /** negative = late */
  remainingMin: number | null;
  photoCount: number;
}

export interface FloorState {
  now: Date;
  cfg: ResourceConfig;
  services: Service[];
  durationOf: (cat: string, name?: string) => number;
  /** vehicles physically occupying each bay (in_progress) */
  bays: Record<ResourceKey, Occupant[]>;
  /** checked-in, not yet in a bay - the waiting queue, oldest first */
  waiting: Occupant[];
  qc: Job[];
  ready: Job[];
  deliveredToday: number;
  lateCount: number;
  /** minutes until each bay frees up; null = free now */
  freeInMin: Record<ResourceKey, number | null>;
  /** done / planned per resource today */
  capacity: Record<ResourceKey, { done: number; planned: number }>;
  avgDelayMin: number | null;
  /** booked minutes today per resource (bookings + walk-ins) */
  bookedMin: Record<ResourceKey, number>;
  remainingDayMin: number;
}

export function useFloor(jobs: Job[], bookings: Booking[] = []): FloorState {
  const [cfg, setCfg] = useState<ResourceConfig>(RESOURCE_DEFAULTS);
  const [services, setServices] = useState<Service[]>([]);
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    getResourceConfig().then(setCfg).catch(() => {});
    getServices().then(setServices).catch(() => {});
    const t = setInterval(() => setNowTs(Date.now()), 30000); // live half-minutes
    return () => clearInterval(t);
  }, []);
  const now = useMemo(() => new Date(nowTs), [nowTs]);

  const durationOf = useMemo(() => {
    const byName = new Map(services.map(s => [s.name, s.duration]));
    const byCat = new Map<string, number>();
    services.forEach(s => byCat.set(s.category, Math.max(byCat.get(s.category) ?? 0, s.duration)));
    return (cat: string, name?: string) => (name && byName.get(name)) || byCat.get(cat) || 60;
  }, [services]);

  return useMemo(() => {
    const toOccupant = (j: Job): Occupant => {
      const t = jobTimeline(j);
      const start = t.startedAt ?? t.arrivedAt;
      const estMin = j.serviceItems.reduce((s, it) => s + durationOf(it.category, it.serviceName), 0);
      const elapsedMin = start ? Math.max(0, Math.round((now.getTime() - start.getTime()) / 60000)) : null;
      const eta = t.startedAt ? new Date(t.startedAt.getTime() + estMin * 60000) : null;
      const remainingMin = eta ? Math.round((eta.getTime() - now.getTime()) / 60000) : null;
      return {
        job: j,
        vehicle: j.vehicleName || j.customerName,
        customer: j.customerName,
        service: j.serviceItems.map(s => s.serviceName).join(' + '),
        technician: j.assignments?.filter(a => !a.removedAt).map(a => a.employeeName).join(', ') || undefined,
        startedAt: start, elapsedMin, estMin, eta, remainingMin,
        photoCount: j.photos?.length ?? 0,
      };
    };

    const bays: Record<ResourceKey, Occupant[]> = { wash: [], protection: [] };
    let late = 0;
    const delays: number[] = [];
    for (const j of jobs) {
      if (!IN_BAY.includes(j.status)) continue;
      const cat = j.serviceItems[0]?.category;
      if (!cat) continue;
      const o = toOccupant(j);
      if (o.remainingMin !== null && o.remainingMin < 0) { late += 1; delays.push(-o.remainingMin); }
      bays[categoryToResource(cat)].push(o);
    }

    const waiting = jobs
      .filter(j => j.status === 'checked_in')
      .map(toOccupant)
      .sort((a, b) => (a.startedAt?.getTime() ?? 0) - (b.startedAt?.getTime() ?? 0));
    const qc = jobs.filter(j => j.status === 'quality_check');
    const ready = jobs.filter(j => j.status === 'ready_for_delivery');
    const deliveredToday = jobs.filter(j => j.status === 'completed').length;

    const freeIn = (r: ResourceKey): number | null => {
      const occ = bays[r];
      if (occ.length === 0) return null;
      const worst = Math.max(...occ.map(o => o.remainingMin ?? 0));
      return Math.max(0, worst);
    };

    // done / planned per resource today (jobs on the floor + bookings not yet arrived)
    const capacity: Record<ResourceKey, { done: number; planned: number }> = {
      wash: { done: 0, planned: 0 }, protection: { done: 0, planned: 0 },
    };
    const bookedMin: Record<ResourceKey, number> = { wash: 0, protection: 0 };
    for (const j of jobs) {
      if (j.status === 'cancelled') continue;
      const cat = j.serviceItems[0]?.category;
      if (!cat) continue;
      const r = categoryToResource(cat);
      capacity[r].planned += 1;
      if (['completed', 'ready_for_delivery'].includes(j.status)) capacity[r].done += 1;
      if (ACTIVE_JOB.includes(j.status) && j.source === 'walk_in') {
        bookedMin[r] += j.serviceItems.reduce((s, it) => s + durationOf(it.category, it.serviceName), 0);
      }
    }
    for (const b of bookings) {
      if (['cancelled', 'completed'].includes(b.status)) continue;
      const r = categoryToResource(b.serviceCategory);
      if (!b.jobId) capacity[r].planned += 1; // job-linked bookings already counted
      bookedMin[r] += Math.min(WORK_DAY_MIN, b.serviceDurationMinutes ?? durationOf(b.serviceCategory));
    }

    // average delay across today's finished + active work
    for (const j of jobs) {
      if (!['completed', 'ready_for_delivery', 'quality_check'].includes(j.status)) continue;
      const t = jobTimeline(j);
      const est = j.serviceItems.reduce((s, it) => s + durationOf(it.category, it.serviceName), 0);
      if (t.workMin !== null && t.workMin > est) delays.push(t.workMin - est);
    }
    const avgDelayMin = delays.length
      ? Math.round(delays.reduce((s, n) => s + n, 0) / delays.length) : null;

    const nowMin = now.getHours() * 60 + now.getMinutes();
    const remainingDayMin = Math.max(0, Math.min(WORK_DAY_MIN, (DAY_OPEN_MIN + WORK_DAY_MIN) - nowMin));

    return {
      now, cfg, services, durationOf, bays, waiting, qc, ready, deliveredToday,
      lateCount: late,
      freeInMin: { wash: freeIn('wash'), protection: freeIn('protection') },
      capacity, avgDelayMin, bookedMin, remainingDayMin,
    };
  }, [jobs, bookings, durationOf, now, cfg, services]);
}
