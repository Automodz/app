'use client';
/**
 * Operations Timeline — yesterday | today | tomorrow across the two bays.
 * Occupancy visualization only (execution lives on the bay cards): every job
 * or booking is ONE block on a compressed working-day axis (09:00–19:00,
 * nights removed), so a multi-day PPF renders as a single block flowing
 * across day boundaries — no fake duplication.
 *
 * Status palette matches the bay tone engine:
 *   grey scheduled · blue waiting · green running · red delayed · amber QC ·
 *   accent ready · dark-grey completed
 * (the identity is monochrome — "ready" wears the graphite accent, not purple)
 *
 * Blocks open the job/booking drawer. Never navigates.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { format, addDays } from 'date-fns';
import { DAY_OPEN_MIN, DAY_CLOSE_MIN, WORK_DAY_MIN, RESOURCE_LABELS, categoryToResource, type ResourceKey } from '@/lib/availability';
import { jobTimeline, fmtMin } from '@/lib/services/washMetrics';
import { formatTime } from '@/lib/utils';
import type { Booking, Job } from '@/lib/types';

const DAYS = 3;              // yesterday, today, tomorrow
const AXIS_MIN = DAYS * WORK_DAY_MIN;
const ZOOMS = [
  { label: '1h', pxPerHour: 96 },
  { label: '2h', pxPerHour: 48 },
  { label: '4h', pxPerHour: 24 },
];

type Block = {
  startMin: number;          // position on the compressed 3-day axis
  durMin: number;
  label: string;
  title: string;             // hover detail: customer/service/tech/times/payment
  color: string;
  dim: boolean;              // completed / past
  live: boolean;             // running now — gets the subtle pulse
  progress: number | null;
  paid: boolean | null;
  onOpen: () => void;
};

export default function OpsTimeline({ jobs, yesterdayJobs, bookings, durationOf, now, onOpenJob, onOpenBooking, flowLine }: {
  /** today's live jobs (the board's single stream) */
  jobs: Job[];
  /** yesterday's jobs — one plain fetch, not a listener */
  yesterdayJobs: Job[];
  /** bookings for yesterday..tomorrow that never became jobs */
  bookings: Booking[];
  durationOf: (cat: string, name?: string) => number;
  now: Date;
  onOpenJob: (j: Job) => void;
  onOpenBooking: (b: Booking) => void;
  /** derived one-line studio flow summary rendered above the strip */
  flowLine: string;
}) {
  const dayISO = (offset: number) => format(addDays(new Date(), offset - 1), 'yyyy-MM-dd');
  const days = [dayISO(0), dayISO(1), dayISO(2)]; // yesterday, today, tomorrow

  // real timestamp → compressed axis minutes (clamped into each working day)
  const toAxis = (d: Date): number => {
    const iso = format(d, 'yyyy-MM-dd');
    let idx = days.indexOf(iso);
    let min = d.getHours() * 60 + d.getMinutes();
    if (idx === -1) {
      if (iso < days[0]) { idx = 0; min = DAY_OPEN_MIN; }
      else { idx = DAYS - 1; min = DAY_CLOSE_MIN; }
    }
    return idx * WORK_DAY_MIN + Math.max(0, Math.min(WORK_DAY_MIN, min - DAY_OPEN_MIN));
  };
  const hmToAxis = (iso: string, hm: string): number => {
    const idx = Math.max(0, days.indexOf(iso));
    const [h, m] = hm.split(':').map(Number);
    return idx * WORK_DAY_MIN + Math.max(0, Math.min(WORK_DAY_MIN, h * 60 + m - DAY_OPEN_MIN));
  };
  const nowAxis = toAxis(now);

  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    try {
      const z = Number(localStorage.getItem('studio-tl-zoom'));
      if (z >= 0 && z < ZOOMS.length) setZoom(z);
    } catch {}
  }, []);
  const pickZoom = (z: number) => {
    setZoom(z);
    try { localStorage.setItem('studio-tl-zoom', String(z)); } catch {}
  };
  const pxPerMin = ZOOMS[zoom].pxPerHour / 60;
  const width = AXIS_MIN * pxPerMin;

  // opening Studio centers NOW, not 9 AM
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = Math.max(0, nowAxis * pxPerMin - el.clientWidth / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  const lanes = useMemo(() => {
    const out: Record<ResourceKey, Block[]> = { wash: [], protection: [] };
    const jobBlock = (j: Job) => {
      const cat = j.serviceItems[0]?.category;
      if (!cat || j.status === 'cancelled') return;
      const r = categoryToResource(cat);
      const t = jobTimeline(j);
      const est = j.serviceItems.reduce((s, it) => s + durationOf(it.category, it.serviceName), 0);
      const startAt = t.startedAt ?? t.arrivedAt;
      if (!startAt) return;
      const start = toAxis(startAt);
      const end = j.status === 'completed' && t.deliveredAt ? toAxis(t.deliveredAt) : start + est;
      const elapsed = Math.max(0, Math.round((now.getTime() - startAt.getTime()) / 60000));
      const running = j.status === 'in_progress';
      const late = running && start + est < nowAxis;
      const color =
        j.status === 'completed' ? 'var(--steel)'
        : j.status === 'ready_for_delivery' ? 'var(--ember)'
        : j.status === 'quality_check' ? 'var(--warning)'
        : late ? 'var(--danger)'
        : running ? 'var(--success)'
        : 'var(--info)'; // checked_in / waiting
      const tech = j.assignments?.filter(a => !a.removedAt).map(a => a.employeeName).join(', ');
      out[r].push({
        startMin: start, durMin: Math.max(15, end - start),
        label: j.vehicleName || j.customerName,
        title: [
          `${j.vehicleName} · ${j.customerName}`,
          j.serviceItems.map(s => s.serviceName).join(' + '),
          tech ? `Tech: ${tech}` : null,
          `Start ${format(startAt, 'EEE h:mm a')} · ${running ? `est ${fmtMin(est)}` : j.status}`,
          j.paymentStatus === 'collected' ? 'Paid' : 'Payment pending',
        ].filter(Boolean).join('\n'),
        color, dim: j.status === 'completed',
        live: running,
        progress: running && est > 0 ? Math.min(100, Math.round((elapsed / est) * 100)) : null,
        paid: j.paymentStatus === 'collected',
        onOpen: () => onOpenJob(j),
      });
    };
    [...yesterdayJobs, ...jobs].forEach(jobBlock);
    for (const b of bookings) {
      if (b.jobId || ['cancelled', 'completed'].includes(b.status)) continue;
      if (!days.includes(b.scheduledDate)) continue;
      const start = hmToAxis(b.scheduledDate, b.scheduledTime);
      const dur = b.serviceDurationMinutes ?? durationOf(b.serviceCategory);
      out[categoryToResource(b.serviceCategory)].push({
        startMin: start, durMin: Math.max(15, dur),
        label: b.vehicleName,
        title: `${b.vehicleName} · ${b.userName}\n${b.serviceName}\nScheduled ${b.scheduledDate} ${formatTime(b.scheduledTime)}`,
        color: 'var(--steel)', dim: false, live: false, progress: null, paid: null,
        onOpen: () => onOpenBooking(b),
      });
    }
    (Object.keys(out) as ResourceKey[]).forEach(r => out[r].sort((a, b) => a.startMin - b.startMin));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, yesterdayJobs, bookings, durationOf, now]);

  const dayNames = ['Yesterday', 'Today', 'Tomorrow'];
  const hourTicks = useMemo(() => {
    const step = zoom === 0 ? 60 : zoom === 1 ? 120 : 240;
    const ticks: { axis: number; label: string; isDay: boolean }[] = [];
    for (let d = 0; d < DAYS; d++) {
      for (let m = 0; m < WORK_DAY_MIN; m += step) {
        const h = Math.floor((DAY_OPEN_MIN + m) / 60);
        ticks.push({ axis: d * WORK_DAY_MIN + m, label: m === 0 ? dayNames[d] : String(h), isDay: m === 0 });
      }
    }
    return ticks;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  return (
    <div className="rounded-2xl px-4 py-3 mb-5" style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-3 mb-1 flex-wrap">
        <p className="font-mono" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--faint)' }}>OPERATIONS TIMELINE</p>
        <div className="ml-auto flex items-center gap-1 p-0.5 rounded-lg" style={{ background: 'var(--dark)', border: '1px solid var(--border)' }}>
          {ZOOMS.map((z, i) => (
            <button key={z.label} onClick={() => pickZoom(i)}
              className="px-2.5 py-1 rounded-md font-mono cursor-pointer"
              style={{
                fontSize: 9.5,
                background: zoom === i ? 'var(--accent-mist)' : 'transparent',
                border: zoom === i ? '1px solid var(--accent-haze)' : '1px solid transparent',
                color: zoom === i ? 'var(--ember)' : 'var(--steel)',
              }}>
              {z.label}
            </button>
          ))}
        </div>
      </div>
      {/* current studio flow — one derived sentence, no manual input */}
      <p className="font-mono mb-3" style={{ fontSize: 10.5, color: 'var(--pewter)' }}>{flowLine}</p>

      <div ref={scroller} className="overflow-x-auto pb-1">
        <div style={{ width, minWidth: '100%' }}>
          {/* hour scale */}
          <div className="relative h-5">
            {hourTicks.map(t => (
              <span key={t.axis} className="absolute font-mono whitespace-nowrap"
                style={{
                  left: t.axis * pxPerMin, fontSize: t.isDay ? 9 : 8,
                  letterSpacing: t.isDay ? '0.12em' : 0,
                  color: t.isDay ? 'var(--pewter)' : 'var(--faint)',
                  textTransform: 'uppercase', fontWeight: t.isDay ? 700 : 400,
                }}>
                {t.label}
              </span>
            ))}
          </div>

          {(['protection', 'wash'] as ResourceKey[]).map(r => (
            <div key={r} className="mb-2">
              <p className="mb-1">
                <span className="font-mono text-[9px] sticky left-0 inline-block" style={{ letterSpacing: '0.12em', color: 'var(--faint)' }}>
                  {RESOURCE_LABELS[r].toUpperCase()}
                </span>
              </p>
              <div className="relative h-9 rounded-lg" style={{ background: 'var(--dark)' }}>
                {/* day separators */}
                {[1, 2].map(d => (
                  <span key={d} className="absolute top-0 bottom-0" style={{ left: d * WORK_DAY_MIN * pxPerMin, width: 1.5, background: 'var(--border-strong)' }} />
                ))}
                {lanes[r].map((b, i) => (
                  <button key={i} onClick={b.onOpen} title={b.title}
                    className="absolute top-1 bottom-1 rounded-md px-1.5 overflow-hidden cursor-pointer text-left"
                    style={{
                      left: b.startMin * pxPerMin,
                      width: Math.max(14, b.durMin * pxPerMin),
                      background: `color-mix(in srgb, ${b.color} ${b.dim ? 7 : 14}%, var(--fog))`,
                      border: `1px solid color-mix(in srgb, ${b.color} ${b.dim ? 25 : 55}%, transparent)`,
                      opacity: b.dim ? 0.65 : 1,
                    }}>
                    <span className="flex items-center gap-1">
                      <span className={b.live ? 'rounded-full pulse-dot shrink-0' : 'rounded-full shrink-0'}
                        style={{ width: 5, height: 5, background: b.color }} />
                      <span className="font-mono truncate" style={{ fontSize: 8.5, color: 'var(--chrome)', lineHeight: '14px' }}>
                        {b.label}
                      </span>
                      {b.paid === false && (
                        <span className="font-mono shrink-0" style={{ fontSize: 8, color: 'var(--warning)' }}>₹</span>
                      )}
                    </span>
                    {b.progress !== null && (
                      <span className="absolute left-0 right-0 bottom-0 h-0.5" style={{ background: 'var(--dark)' }}>
                        <span className="block h-full" style={{ width: `${b.progress}%`, background: b.color }} />
                      </span>
                    )}
                  </button>
                ))}
                {/* glowing now line — today only by construction */}
                <span className="absolute top-0 bottom-0 pointer-events-none"
                  style={{ left: nowAxis * pxPerMin, width: 2, background: 'var(--danger)', boxShadow: '0 0 8px var(--danger)' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
