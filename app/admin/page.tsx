'use client';
/**
 * Studio Board — the operating system for the working day. Open from morning
 * to close; the whole day runs on this one screen:
 *
 *   header        → date/clock + pipeline counts + operational notifications
 *   live capacity → utilization bar + next-free time per physical bay
 *   waiting queue → auto-prioritized (appointments > wait time > walk-ins)
 *   bay cards     → the two physical resources with full occupant detail
 *   QC / ready    → the tail of the pipeline
 *   tech rail     → who is working / on break / idle, ETA, jobs done today
 *   studio feed   → realtime event stream of the day (arrivals → deliveries)
 *   timeline      → today's bookings + live work on two resource lanes
 *
 * All state derives from useFloor + the single subscribeTodaysJobs listener —
 * no duplicate listeners, no duplicate logic.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  PlusCircle, Wrench, ChevronRight, Timer, Droplets, Shield,
  AlertTriangle, BadgeCheck, Truck, Camera, UserRound, IndianRupee,
  Play, CalendarClock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, addDays } from 'date-fns';
import {
  subscribeTodaysJobs, getBookingsForDates, getTodayAttendance, shiftMath,
  updateJobStatus,
} from '@/lib/firebaseService';
import { fmtMin } from '@/lib/services/washMetrics';
import {
  RESOURCE_LABELS, categoryToResource, DAY_OPEN_MIN, DAY_CLOSE_MIN, WORK_DAY_MIN,
  BUFFER_MIN, type ResourceKey,
} from '@/lib/availability';
import { useAppStore } from '@/lib/store';
import { useFloor, type Occupant } from '@/components/studio/useFloor';
import StudioDrawer, { type DrawerTarget } from '@/components/studio/StudioDrawer';
import TechnicianDrawer from '@/components/studio/TechnicianDrawer';
import { formatCurrency, formatTime } from '@/lib/utils';
import type { AttendanceRecord, Booking, Job, JobStatus } from '@/lib/types';

const timeLabel = (d: Date) =>
  d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

/** late < 15 min → orange, 15+ → red */
const lateColor = (remainingMin: number | null): string | undefined =>
  remainingMin === null || remainingMin >= 0 ? undefined
    : remainingMin > -15 ? 'var(--warning)' : 'var(--danger)';

/** long spans read in working days: 1450min → "2d 2h" (10h working day) */
const fmtSpan = (m: number | null): string => {
  if (m === null) return '—';
  if (m <= WORK_DAY_MIN) return fmtMin(m);
  const d = Math.floor(m / WORK_DAY_MIN);
  const rest = m % WORK_DAY_MIN;
  return `${d}d${rest >= 60 ? ` ${Math.round(rest / 60)}h` : ''}`;
};

const FEED_LABEL: Record<JobStatus, string> = {
  checked_in: 'arrived', in_progress: 'work started', quality_check: 'in quality check',
  ready_for_delivery: 'ready for delivery', completed: 'delivered', cancelled: 'cancelled',
};
const FEED_COLOR: Record<JobStatus, string> = {
  checked_in: 'var(--info)', in_progress: 'var(--chrome)', quality_check: 'var(--info)',
  ready_for_delivery: 'var(--success)', completed: 'var(--success)', cancelled: 'var(--danger)',
};

export default function StudioBoard() {
  // the context workspace: everything opens here, over the board
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsReady, setJobsReady] = useState(false);
  const [streamKey, setStreamKey] = useState(0);
  useEffect(() => {
    const unsub = subscribeTodaysJobs(
      j => { setJobs(j); setJobsReady(true); },
      () => setJobsReady(true),
    );
    return unsub;
  }, [streamKey]);
  useEffect(() => {
    const retry = () => setStreamKey(k => k + 1);
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, []);

  const today = format(new Date(), 'yyyy-MM-dd');
  const [bookings, setBookings] = useState<Booking[]>([]);
  // next 7 days — feeds "next booking" per bay + tomorrow's capacity
  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  useEffect(() => {
    const week = [...Array(7)].map((_, i) => format(addDays(new Date(), i), 'yyyy-MM-dd'));
    getBookingsForDates(week)
      .then(bs => {
        setBookings(bs.filter(b => b.scheduledDate === today));
        setUpcoming(bs.filter(b => !['cancelled', 'completed'].includes(b.status)));
      })
      .catch(() => {});
    getTodayAttendance().then(setAttendance).catch(() => {});
  }, [today]);

  const floor = useFloor(jobs, bookings);
  const { bays, waiting, qc, ready, deliveredToday, freeInMin, bookedMin } = floor;

  const openJob = (j: Job) =>
    setDrawer(j.bookingId ? { kind: 'booking', id: j.bookingId } : { kind: 'job', id: j.id });

  // ── one-tap dispatch: waiting → bay, no drawer needed ──
  const { user, kioskEmployee } = useAppStore();
  const actor = kioskEmployee
    ? { id: kioskEmployee.id, name: kioskEmployee.name }
    : { id: user?.uid ?? 'admin', name: user?.name || 'Admin' };
  const [starting, setStarting] = useState<string | null>(null);
  const startNow = async (o: Occupant) => {
    if (starting) return;
    setStarting(o.job.id);
    try {
      await updateJobStatus(o.job.id, 'in_progress', actor);
      toast.success(`${o.vehicle} → ${RESOURCE_LABELS[categoryToResource(o.job.serviceItems[0]?.category ?? 'Washing')]}`);
    } catch { toast.error('Could not start the job'); }
    setStarting(null);
  };

  // ── technician rail: attendance ⨯ live assignments ──
  const technicians = useMemo(() => {
    const activeJobs = jobs.filter(j => j.status === 'in_progress');
    const occupants = [...bays.wash, ...bays.protection];
    return attendance
      .filter(r => !r.checkOutAt)
      .map(r => {
        const job = activeJobs.find(j => j.assignedIds?.includes(r.employeeId));
        const occ = job ? occupants.find(o => o.job.id === job.id) : undefined;
        const m = shiftMath(r);
        const jobsToday = jobs.filter(j =>
          j.status === 'completed' && j.assignedIds?.includes(r.employeeId)).length;
        return {
          id: r.employeeId, name: r.employeeName,
          state: m.onBreak ? 'break' as const : job ? 'working' as const : 'idle' as const,
          service: job?.serviceItems[0]?.serviceName,
          vehicle: occ?.vehicle,
          progress: occ && occ.elapsedMin !== null && occ.estMin > 0
            ? Math.round((occ.elapsedMin / occ.estMin) * 100) : null,
          bay: job ? RESOURCE_LABELS[categoryToResource(job.serviceItems[0]?.category ?? 'Washing')] : null,
          eta: occ?.eta ?? null,
          workMin: occ?.elapsedMin ?? null,
          breakMin: m.breakMin,
          jobsToday,
        };
      })
      .sort((a, b) => (a.state === 'working' ? 0 : a.state === 'break' ? 1 : 2)
        - (b.state === 'working' ? 0 : b.state === 'break' ? 1 : 2));
  }, [attendance, jobs, bays]);

  // ── studio feed: today's events, newest first — derived, never stored ──
  const feed = useMemo(() => {
    const events: { at: Date; text: string; color: string; job: Job }[] = [];
    for (const j of jobs) {
      for (const h of j.statusHistory ?? []) {
        const at = h.at?.toDate?.();
        if (!at || h.note) continue; // assignment notes stay in the workspace
        events.push({ at, text: `${j.vehicleName || j.customerName} · ${FEED_LABEL[h.status]}`, color: FEED_COLOR[h.status], job: j });
      }
      for (const p of j.payments ?? []) {
        const at = p.at?.toDate?.();
        if (!at) continue;
        events.push({ at, text: `${j.vehicleName || j.customerName} · ${formatCurrency(p.amount)} received (${p.method.toUpperCase()})`, color: 'var(--success)', job: j });
      }
    }
    return events.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 20);
  }, [jobs]);

  // ── predictive floor intelligence ──
  const resourceOf = (j: Job): ResourceKey => categoryToResource(j.serviceItems[0]?.category ?? 'Washing');
  const nowMin = floor.now.getHours() * 60 + floor.now.getMinutes();
  const capacityPlanned = floor.capacity.wash.planned + floor.capacity.protection.planned;

  /**
   * Auto-priority queue — nobody sorts by hand. Appointments outrank
   * walk-ins; inside each class the longest wait floats to the top.
   * (Premium-member boost joins when membership lands on the Job record.)
   */
  const queue = useMemo(() => {
    const score = (o: Occupant) =>
      (o.job.source === 'booking' ? 100000 : 0) + (o.elapsedMin ?? 0);
    return [...waiting].sort((a, b) => score(b) - score(a));
  }, [waiting]);

  /** minutes from now until the n-th waiting vehicle of a resource can start */
  const queuePlan = useMemo(() => {
    const cursor: Record<ResourceKey, number> = {
      wash: freeInMin.wash === null ? 0 : freeInMin.wash + BUFFER_MIN,
      protection: freeInMin.protection === null ? 0 : freeInMin.protection + BUFFER_MIN,
    };
    const plan = new Map<string, { inMin: number; bayFreeNow: boolean }>();
    for (const o of queue) {
      const r = resourceOf(o.job);
      plan.set(o.job.id, { inMin: cursor[r], bayFreeNow: cursor[r] === 0 });
      cursor[r] += o.estMin + BUFFER_MIN;
    }
    return plan;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, freeInMin]);

  /** next upcoming booking per bay (today's later slots + next 6 days) */
  const nextBooking = useMemo(() => {
    const out: Record<ResourceKey, Booking | null> = { wash: null, protection: null };
    const nowStamp = `${today} ${format(floor.now, 'HH:mm')}`;
    [...upcoming]
      .filter(b => !b.jobId && `${b.scheduledDate} ${b.scheduledTime}` >= nowStamp)
      .sort((a, b) => `${a.scheduledDate} ${a.scheduledTime}`.localeCompare(`${b.scheduledDate} ${b.scheduledTime}`))
      .forEach(b => {
        const r = categoryToResource(b.serviceCategory);
        if (!out[r]) out[r] = b;
      });
    return out;
  }, [upcoming, today, floor.now]);
  const bookingDayLabel = (b: Booking) =>
    (b.scheduledDate === today ? 'Today' : format(new Date(b.scheduledDate + 'T12:00:00'), 'EEE')) +
    ' ' + formatTime(b.scheduledTime);

  /** tomorrow's load per bay: booked minutes + spill-over from live multi-day work */
  const tomorrowLoad = useMemo(() => {
    const tmr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    const load: Record<ResourceKey, number> = { wash: 0, protection: 0 };
    for (const b of upcoming) {
      if (b.scheduledDate !== tmr) continue;
      load[categoryToResource(b.serviceCategory)] +=
        Math.min(WORK_DAY_MIN, b.serviceDurationMinutes ?? floor.durationOf(b.serviceCategory));
    }
    const leftToday = Math.max(0, DAY_CLOSE_MIN - nowMin);
    (['wash', 'protection'] as ResourceKey[]).forEach(r => {
      for (const o of bays[r]) {
        if (o.remainingMin !== null && o.remainingMin > leftToday)
          load[r] += Math.min(WORK_DAY_MIN, o.remainingMin - leftToday);
      }
    });
    return load;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcoming, bays, nowMin]);

  /** the board tells reception what to do next — one prioritized list */
  const upNext = useMemo(() => {
    const out: { icon: typeof Timer; text: string; sub?: string; color: string; onClick?: () => void }[] = [];
    // 1 — a bay is open and a vehicle is waiting for it: move it (with reasons)
    const freeTech = technicians.find(t => t.state === 'idle');
    queue.forEach(o => {
      const p = queuePlan.get(o.job.id);
      if (p?.bayFreeNow) out.push({
        icon: Play, color: 'var(--success)',
        text: `Move ${o.vehicle} into the ${RESOURCE_LABELS[resourceOf(o.job)]}`,
        sub: [
          'Bay free now',
          freeTech ? `${freeTech.name.split(' ')[0]} free` : null,
          o.job.paymentStatus === 'collected' ? 'Paid' : 'Payment pending',
          o.job.source === 'booking' ? 'Appointment' : null,
        ].filter(Boolean).join(' · '),
        onClick: () => openJob(o.job),
      });
    });
    // 2 — work in a bay with nobody on it
    [...bays.wash, ...bays.protection].forEach(o => {
      if (!(o.job.assignedIds?.length)) out.push({
        icon: UserRound, color: 'var(--warning)',
        text: `Assign a technician — ${o.vehicle}`, onClick: () => openJob(o.job),
      });
    });
    // 3 — QC gate
    qc.forEach(j => out.push({
      icon: BadgeCheck, color: 'var(--info)',
      text: `Quality-check ${j.vehicleName}`, onClick: () => openJob(j),
    }));
    // 4 — money before handover
    ready.filter(j => j.paymentStatus === 'pending').forEach(j => out.push({
      icon: IndianRupee, color: 'var(--warning)',
      text: `Collect ${formatCurrency(j.totalAmount - (j.amountPaid ?? 0))} — ${j.vehicleName}`,
      onClick: () => openJob(j),
    }));
    // 5 — paid and ready: hand it over
    ready.filter(j => j.paymentStatus === 'collected').forEach(j => out.push({
      icon: Truck, color: 'var(--success)',
      text: `Deliver ${j.vehicleName} — call ${j.customerName}`, onClick: () => openJob(j),
    }));
    // warnings ride below the actions
    [...bays.wash, ...bays.protection].forEach(o => {
      if (o.remainingMin !== null && o.remainingMin < 0) out.push({
        icon: AlertTriangle, color: lateColor(o.remainingMin)!,
        text: `${o.vehicle} running late ${fmtMin(-o.remainingMin)}`, onClick: () => openJob(o.job),
      });
    });
    queue.forEach(o => {
      if (o.elapsedMin !== null && o.elapsedMin >= 15 && !queuePlan.get(o.job.id)?.bayFreeNow) out.push({
        icon: UserRound, color: 'var(--warning)',
        text: `${o.customer} waiting ${fmtMin(o.elapsedMin)}`, onClick: () => openJob(o.job),
      });
    });
    (['protection', 'wash'] as ResourceKey[]).forEach(r => {
      const f = freeInMin[r];
      if (f !== null && f > 0 && f <= 30)
        out.push({ icon: Timer, text: `${RESOURCE_LABELS[r]} free in ${fmtMin(f)}`, color: 'var(--info)' });
    });
    return out.slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, bays, qc, ready, freeInMin, queuePlan, technicians]);

  const bayMeta: Record<ResourceKey, { icon: typeof Droplets }> = {
    wash: { icon: Droplets }, protection: { icon: Shield },
  };

  // ── bay tone engine: the bay's colour IS its status ──
  //   green running · amber over ETA · red badly late · blue vehicle waiting
  //   to enter a free bay · grey idle
  const bayState = (r: ResourceKey): { word: string; color: string } => {
    const occ = bays[r][0];
    if (occ) {
      if (occ.remainingMin !== null && occ.remainingMin <= -15)
        return { word: `LATE ${fmtMin(-occ.remainingMin)}`, color: 'var(--danger)' };
      if (occ.remainingMin !== null && occ.remainingMin < 0)
        return { word: `OVER ETA ${fmtMin(-occ.remainingMin)}`, color: 'var(--warning)' };
      return { word: 'RUNNING', color: 'var(--success)' };
    }
    if (waiting.some(o => resourceOf(o.job) === r))
      return { word: 'VEHICLE WAITING', color: 'var(--info)' };
    return { word: 'IDLE', color: 'var(--steel)' };
  };

  // ── timeline geometry: % of the working day (09:00 → close) ──
  const dayPct = (d: Date) => {
    const min = d.getHours() * 60 + d.getMinutes() - DAY_OPEN_MIN;
    return Math.max(0, Math.min(100, (min / WORK_DAY_MIN) * 100));
  };
  const hmPct = (hm: string) => {
    const [h, m] = hm.split(':').map(Number);
    return Math.max(0, Math.min(100, ((h * 60 + m - DAY_OPEN_MIN) / WORK_DAY_MIN) * 100));
  };
  const timelineBlocks = useMemo(() => {
    const lanes: Record<ResourceKey, { left: number; width: number; label: string; live: boolean; onClick: () => void }[]> = {
      wash: [], protection: [],
    };
    for (const b of bookings) {
      if (['cancelled', 'completed'].includes(b.status) || b.jobId) continue;
      const left = hmPct(b.scheduledTime);
      const dur = Math.min(WORK_DAY_MIN, b.serviceDurationMinutes ?? floor.durationOf(b.serviceCategory));
      lanes[categoryToResource(b.serviceCategory)].push({
        left, width: Math.max(3, Math.min(100 - left, (dur / WORK_DAY_MIN) * 100)),
        label: b.vehicleName, live: false,
        onClick: () => setDrawer({ kind: 'booking', id: b.id }),
      });
    }
    (['wash', 'protection'] as ResourceKey[]).forEach(r => {
      for (const o of bays[r]) {
        if (!o.startedAt) continue;
        const left = dayPct(o.startedAt);
        const end = o.eta ? dayPct(o.eta) : left + 4;
        lanes[r].push({
          left, width: Math.max(3, end - left), label: o.vehicle, live: true,
          onClick: () => openJob(o.job),
        });
      }
    });
    return lanes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, bays, floor.durationOf]);
  const hourTicks = useMemo(() => {
    const ticks: { pct: number; label: string }[] = [];
    for (let m = DAY_OPEN_MIN; m <= DAY_OPEN_MIN + WORK_DAY_MIN; m += 120) {
      const h = Math.floor(m / 60);
      ticks.push({ pct: ((m - DAY_OPEN_MIN) / WORK_DAY_MIN) * 100, label: formatTime(`${String(h).padStart(2, '0')}:00`) });
    }
    return ticks;
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      {/* ── Header: the studio at a glance ── */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="font-display font-800 text-2xl" style={{ color: 'var(--chrome)' }}>Studio</h1>
          <p className="text-sm font-body flex items-center gap-2" style={{ color: 'var(--steel)' }}>
            <span className="w-1.5 h-1.5 rounded-full pulse-dot"
              style={{ background: nowMin >= DAY_OPEN_MIN && nowMin < DAY_CLOSE_MIN ? 'var(--success)' : 'var(--steel)' }} />
            {format(floor.now, 'EEEE, dd MMMM')} · {timeLabel(floor.now)}
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--faint)' }}>
              {nowMin < DAY_OPEN_MIN ? `OPENS ${formatTime('09:00')}`
                : nowMin >= DAY_CLOSE_MIN ? 'CLOSED'
                : `OPEN · CLOSES ${formatTime('19:00')} · ${fmtSpan(DAY_CLOSE_MIN - nowMin)} left`}
            </span>
          </p>
        </div>
        <div className="flex items-stretch gap-2 overflow-x-auto">
          {[
            { n: `${deliveredToday}/${capacityPlanned}`, l: 'Completed', c: 'var(--success)', on: deliveredToday > 0 },
            { n: String(waiting.length), l: 'Waiting', c: 'var(--info)', on: waiting.length > 0 },
            { n: String(qc.length), l: 'QC', c: 'var(--info)', on: qc.length > 0 },
            { n: String(ready.length), l: 'Ready', c: 'var(--success)', on: ready.length > 0 },
            { n: String(floor.lateCount), l: 'Delayed', c: 'var(--danger)', on: floor.lateCount > 0 },
          ].map(s => (
            <div key={s.l} className="flex flex-col justify-center gap-0.5 px-3.5 py-1.5 rounded-xl shrink-0"
              style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
              <span className="font-mono font-700 text-base leading-none" style={{ color: s.on ? s.c : 'var(--steel)' }}>{s.n}</span>
              <span className="text-[10px] font-body" style={{ color: 'var(--pewter)' }}>{s.l}</span>
            </div>
          ))}
          <button onClick={() => setDrawer({ kind: 'walkin' })}
            className="btn-ember flex items-center gap-2 px-4 py-2.5 text-sm shrink-0 cursor-pointer">
            <PlusCircle size={15} /> Walk-in
          </button>
        </div>
      </div>

      {/* ── Up next: the board tells reception what to do ── */}
      {upNext.length > 0 && (
        <div className="rounded-2xl px-2 py-1.5 mb-4"
          style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
          <p className="font-mono px-2 pt-1" style={{ fontSize: 9, letterSpacing: '0.16em', color: 'var(--faint)' }}>UP NEXT</p>
          {upNext.map((a, i) => (
            <button key={i} onClick={a.onClick} disabled={!a.onClick}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors hover:bg-white/[.03] cursor-pointer disabled:cursor-default">
              <a.icon size={12} className="shrink-0" style={{ color: a.color }} />
              <span className="font-body" style={{ fontSize: 12.5, color: 'var(--chrome)' }}>{a.text}</span>
              {a.sub && <span className="font-mono text-[10px]" style={{ color: a.color }}>{a.sub}</span>}
              {a.onClick && <ChevronRight size={13} className="ml-auto shrink-0" style={{ color: 'var(--steel)' }} />}
            </button>
          ))}
        </div>
      )}

      {/* ── Live capacity: always-visible bay utilization ── */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {(['wash', 'protection'] as ResourceKey[]).map(r => {
          const pct = Math.min(100, Math.round((bookedMin[r] / WORK_DAY_MIN) * 100));
          const f = freeInMin[r];
          return (
            <div key={r} className="rounded-2xl px-4 py-3" style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono" style={{ fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--faint)' }}>
                  {RESOURCE_LABELS[r].toUpperCase()}
                </span>
                <span className="font-mono font-700" style={{ fontSize: 11, color: pct >= 90 ? 'var(--warning)' : 'var(--chrome)' }}>{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: 'var(--dark)' }}>
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: pct >= 90 ? 'var(--warning)' : 'var(--accent-grad)' }} />
              </div>
              <p className="font-mono text-[10px] flex items-center gap-x-3 flex-wrap" style={{ color: 'var(--pewter)' }}>
                <span>Next free{' '}
                  <b style={{ color: 'var(--chrome)', fontWeight: 700 }}>
                    {f === null || f === 0 ? 'now' : f > DAY_CLOSE_MIN - nowMin ? fmtSpan(f) : timeLabel(new Date(floor.now.getTime() + f * 60000))}
                  </b>
                </span>
                <span>Tomorrow{' '}
                  <b style={{ color: tomorrowLoad[r] >= WORK_DAY_MIN ? 'var(--warning)' : 'var(--chrome)', fontWeight: 700 }}>
                    {tomorrowLoad[r] === 0 ? 'free' : tomorrowLoad[r] >= WORK_DAY_MIN ? 'full' : `${fmtSpan(tomorrowLoad[r])} booked`}
                  </b>
                </span>
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Waiting queue ── */}
      <section className="mb-5">
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="rounded-full" style={{ width: 6, height: 6, background: 'var(--info)' }} />
          <h2 className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fg-dim)' }}>
            Waiting
          </h2>
          <span className="font-mono" style={{ fontSize: 10.5, color: 'var(--faint)' }}>{waiting.length}</span>
        </div>
        {waiting.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-5 text-center" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs font-body" style={{ color: 'var(--steel)' }}>No vehicles waiting.</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--fog)' }}>
            {queue.map((o, i) => {
              const p = queuePlan.get(o.job.id);
              const r = resourceOf(o.job);
              return (
                <div key={o.job.id} className="group w-full flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[.03]"
                  style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                  <button onClick={() => openJob(o.job)} className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer">
                    <span className="font-mono text-xs w-5 shrink-0" style={{ color: 'var(--faint)' }}>{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-body font-600 truncate" style={{ fontSize: 13.5, color: 'var(--chrome)' }}>
                        {o.vehicle}
                        <span className="font-400" style={{ color: 'var(--steel)' }}> · {o.service}</span>
                      </p>
                      <p className="text-xs font-body mt-0.5 truncate" style={{ color: 'var(--steel)' }}>
                        {o.job.source === 'walk_in' ? 'Walk-in' : 'Appointment'} · {o.customer}
                        {o.elapsedMin !== null && (
                          <span style={{ color: (o.elapsedMin ?? 0) >= 15 ? 'var(--warning)' : 'var(--steel)' }}>
                            {' '}· waiting {fmtMin(o.elapsedMin)}
                          </span>
                        )}
                      </p>
                    </div>
                  </button>
                  {p?.bayFreeNow ? (
                    <button onClick={() => startNow(o)} disabled={starting === o.job.id}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg shrink-0 cursor-pointer transition-transform active:scale-95"
                      style={{ background: 'var(--accent-grad)', color: 'var(--on-accent)' }}>
                      <Play size={11} />
                      <span className="font-display" style={{ fontSize: 11, fontWeight: 700 }}>
                        {starting === o.job.id ? 'Starting…' : `Start · ${RESOURCE_LABELS[r].split(' ')[0]}`}
                      </span>
                    </button>
                  ) : (
                    <span className="font-mono text-[10px] shrink-0 text-right" style={{ color: 'var(--pewter)' }}>
                      {RESOURCE_LABELS[r].split(' ')[0]} ~{p ? (p.inMin > DAY_CLOSE_MIN - nowMin
                        ? fmtSpan(p.inMin) : timeLabel(new Date(floor.now.getTime() + p.inMin * 60000))) : '—'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Bay cards: the two physical resources ── */}
      <div className="grid sm:grid-cols-2 gap-4 mb-5">
        {(['wash', 'protection'] as ResourceKey[]).map(r => {
          const occ: Occupant | undefined = bays[r][0];
          const queuedBehind = bays[r].length - 1;
          const Icon = bayMeta[r].icon;
          const st = bayState(r);
          const progress = occ && occ.elapsedMin !== null && occ.estMin > 0
            ? Math.min(100, Math.round((occ.elapsedMin / occ.estMin) * 100)) : null;
          return (
            <div key={r} className="rounded-2xl p-4 transition-colors"
              style={{
                background: `color-mix(in srgb, ${st.color} 3%, var(--fog))`,
                border: `1px solid color-mix(in srgb, ${st.color} ${occ ? 32 : 18}%, var(--border))`,
              }}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono inline-flex items-center gap-2" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--faint)' }}>
                  <Icon size={13} style={{ color: st.color }} />
                  {RESOURCE_LABELS[r].toUpperCase()}
                </span>
                <span className="font-mono font-700 inline-flex items-center gap-1.5" style={{ fontSize: 11, color: st.color }}>
                  <span className={occ ? 'rounded-full pulse-dot' : 'rounded-full'}
                    style={{ width: 6, height: 6, background: st.color }} />
                  {st.word}
                </span>
              </div>
              {occ ? (
                <button onClick={() => openJob(occ.job)} className="w-full text-left cursor-pointer">
                  <p className="font-display font-700 text-lg leading-tight truncate" style={{ color: 'var(--chrome)' }}>
                    {occ.vehicle}
                  </p>
                  <p className="text-sm font-body truncate mt-0.5" style={{ color: 'var(--steel)' }}>
                    {occ.service} · {occ.customer}
                  </p>
                  {progress !== null && (
                    <div className="h-1 rounded-full overflow-hidden mt-2.5" style={{ background: 'var(--dark)' }}>
                      <div className="h-full rounded-full" style={{ width: `${progress}%`, background: st.color }} />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3">
                    {[
                      ['Started', occ.startedAt ? timeLabel(occ.startedAt) : '—'],
                      ['Ends', occ.eta ? timeLabel(occ.eta) : '—'],
                      ['Elapsed', occ.elapsedMin !== null ? fmtMin(occ.elapsedMin) : '—'],
                      ['Remaining', occ.remainingMin !== null
                        ? (occ.remainingMin < 0 ? `late ${fmtMin(-occ.remainingMin)}` : fmtSpan(occ.remainingMin)) : '—'],
                    ].map(([l, v]) => (
                      <div key={l}>
                        <p className="font-mono" style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--faint)' }}>{l.toUpperCase()}</p>
                        <p className="font-mono font-700 text-sm"
                          style={{ color: l === 'Remaining' ? (lateColor(occ.remainingMin) ?? 'var(--chrome)') : 'var(--chrome)' }}>{v}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-3 pt-2.5 flex-wrap" style={{ borderTop: '1px solid var(--border)' }}>
                    {occ.technician && (
                      <span className="inline-flex items-center gap-1.5 font-body text-xs" style={{ color: 'var(--pewter)' }}>
                        <UserRound size={11} /> {occ.technician}
                      </span>
                    )}
                    {occ.photoCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 font-body text-xs" style={{ color: 'var(--pewter)' }}>
                        <Camera size={11} /> {occ.photoCount} photos
                      </span>
                    )}
                    <span className="font-mono text-[10px]" style={{ color: occ.job.paymentStatus === 'collected' ? 'var(--success)' : 'var(--warning)' }}>
                      {occ.job.paymentStatus === 'collected' ? 'PAID' : 'PAYMENT PENDING'}
                    </span>
                    {queuedBehind > 0 && (
                      <span className="font-mono text-[10px]" style={{ color: 'var(--faint)' }}>+{queuedBehind} queued</span>
                    )}
                  </div>
                  <BayNextLine r={r} waiting={queue} nextBooking={nextBooking[r]}
                    bookingDayLabel={bookingDayLabel} resourceOf={resourceOf} />
                </button>
              ) : (
                <div className="py-2">
                  <p className="font-body text-sm mb-1" style={{ color: 'var(--steel)' }}>
                    Available now{waiting.length > 0 ? ' — assign from the waiting queue.' : '.'}
                  </p>
                  <BayNextLine r={r} waiting={queue} nextBooking={nextBooking[r]}
                    bookingDayLabel={bookingDayLabel} resourceOf={resourceOf} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── QC + Ready ── */}
      {(qc.length > 0 || ready.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4 mb-5">
          {[
            { label: 'QUALITY CHECK', list: qc, icon: BadgeCheck, color: 'var(--info)' },
            { label: 'READY', list: ready, icon: Truck, color: 'var(--success)' },
          ].map(sec => (
            <div key={sec.label}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <sec.icon size={12} style={{ color: sec.color }} />
                <h2 className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--fg-dim)' }}>{sec.label}</h2>
                <span className="font-mono" style={{ fontSize: 10.5, color: 'var(--faint)' }}>{sec.list.length}</span>
              </div>
              {sec.list.length === 0 ? (
                <div className="rounded-2xl border border-dashed py-4 text-center" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-xs font-body" style={{ color: 'var(--steel)' }}>Empty</p>
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--fog)' }}>
                  {sec.list.map((j, i) => (
                    <button key={j.id} onClick={() => openJob(j)}
                      className="w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[.03] cursor-pointer"
                      style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                      <div className="flex-1 min-w-0">
                        <p className="font-body font-600 truncate" style={{ fontSize: 13.5, color: 'var(--chrome)' }}>{j.vehicleName}</p>
                        <p className="text-xs font-body truncate mt-0.5" style={{ color: 'var(--steel)' }}>{j.customerName}</p>
                      </div>
                      {sec.label === 'READY' && (
                        <span className="font-mono text-[10px] uppercase tracking-wider shrink-0"
                          style={{ color: j.paymentStatus === 'collected' ? 'var(--success)' : 'var(--warning)' }}>
                          {j.paymentStatus === 'collected' ? 'Paid' : 'Payment pending'}
                        </span>
                      )}
                      <ChevronRight size={14} className="shrink-0" style={{ color: 'var(--steel)' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Technician rail ── */}
      {technicians.length > 0 && (
        <div className="rounded-2xl px-4 py-3 mb-4 flex items-stretch gap-5 overflow-x-auto"
          style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
          {technicians.map(t => (
            <button key={t.id} onClick={() => setDrawer({ kind: 'tech', id: t.id })}
              className="flex flex-col gap-0.5 shrink-0 min-w-28 text-left cursor-pointer">
              <span className="font-body font-600 text-sm truncate" style={{ color: 'var(--chrome)' }}>{t.name}</span>
              <span className="font-mono inline-flex items-center gap-1.5" style={{
                fontSize: 10,
                color: t.state === 'working' ? 'var(--success)' : t.state === 'break' ? 'var(--warning)' : 'var(--steel)',
              }}>
                <span className="rounded-full" style={{
                  width: 6, height: 6,
                  background: t.state === 'working' ? 'var(--success)' : t.state === 'break' ? 'var(--warning)' : 'var(--steel)',
                }} />
                {t.state === 'working' ? (t.vehicle ? `${t.vehicle} · ${t.service ?? 'Working'}` : (t.service ?? 'Working'))
                  : t.state === 'break' ? 'Break' : 'Idle'}
              </span>
              {t.state === 'working' && (
                <>
                  <span className="font-mono text-[10px]" style={{ color: 'var(--pewter)' }}>
                    {t.bay}{t.workMin !== null ? ` · ${fmtMin(t.workMin)}` : ''}{t.eta ? ` · ETA ${timeLabel(t.eta)}` : ''}
                  </span>
                  {t.progress !== null && (
                    <span className="flex items-center gap-1.5">
                      <span className="h-1 flex-1 rounded-full overflow-hidden" style={{ background: 'var(--dark)' }}>
                        <span className="block h-full rounded-full"
                          style={{ width: `${t.progress}%`, background: t.progress > 100 ? 'var(--warning)' : 'var(--success)' }} />
                      </span>
                      <span className="font-mono text-[9px]" style={{ color: 'var(--faint)' }}>{Math.min(999, t.progress)}%</span>
                    </span>
                  )}
                </>
              )}
              <span className="font-mono text-[10px]" style={{ color: 'var(--faint)' }}>
                {t.jobsToday} job{t.jobsToday === 1 ? '' : 's'} today{t.breakMin > 0 ? ` · ${fmtMin(t.breakMin)} break` : ''}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Studio feed + today's timeline ── */}
      <div className="grid lg:grid-cols-2 gap-4 mb-5">
        <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
          <p className="font-mono mb-2" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--faint)' }}>STUDIO FEED</p>
          {feed.length === 0 ? (
            <p className="text-xs font-body py-3" style={{ color: 'var(--steel)' }}>Nothing yet — events appear as the day unfolds.</p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {feed.map((e, i) => (
                <button key={i} onClick={() => openJob(e.job)}
                  className="w-full flex items-center gap-2.5 text-left cursor-pointer group">
                  <span className="font-mono text-[10px] w-14 shrink-0" style={{ color: 'var(--faint)' }}>{timeLabel(e.at)}</span>
                  <span className="rounded-full shrink-0" style={{ width: 5, height: 5, background: e.color }} />
                  <span className="font-body text-xs truncate group-hover:underline" style={{ color: 'var(--pewter)' }}>{e.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--faint)' }}>TODAY&apos;S TIMELINE</p>
            <Link href="/admin/schedule" className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--steel)' }}>
              Full schedule →
            </Link>
          </div>
          {(['wash', 'protection'] as ResourceKey[]).map(r => (
            <div key={r} className="mb-2.5">
              <p className="font-mono text-[9px] mb-1" style={{ letterSpacing: '0.12em', color: 'var(--faint)' }}>
                {RESOURCE_LABELS[r].toUpperCase()}
              </p>
              <div className="relative h-7 rounded-lg overflow-hidden" style={{ background: 'var(--dark)' }}>
                {hourTicks.map(t => (
                  <span key={t.pct} className="absolute top-0 bottom-0" style={{ left: `${t.pct}%`, width: 1, background: 'var(--border)' }} />
                ))}
                {timelineBlocks[r].map((b, i) => (
                  <button key={i} onClick={b.onClick} title={b.label}
                    className="absolute top-1 bottom-1 rounded-md px-1.5 overflow-hidden cursor-pointer"
                    style={{
                      left: `${b.left}%`, width: `${b.width}%`,
                      background: b.live ? 'var(--accent-mist)' : 'var(--smoke)',
                      border: `1px solid ${b.live ? 'var(--accent-haze)' : 'var(--border-strong)'}`,
                    }}>
                    <span className="font-mono block truncate" style={{ fontSize: 8.5, color: b.live ? 'var(--ember)' : 'var(--pewter)', lineHeight: '18px' }}>
                      {b.label}
                    </span>
                  </button>
                ))}
                <span className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${dayPct(floor.now)}%`, width: 1.5, background: 'var(--danger)' }} />
              </div>
            </div>
          ))}
          <div className="relative h-3">
            {hourTicks.map(t => (
              <span key={t.pct} className="absolute font-mono whitespace-nowrap" style={{
                left: `${t.pct}%`,
                transform: t.pct === 0 ? 'none' : t.pct === 100 ? 'translateX(-100%)' : 'translateX(-50%)',
                fontSize: 8, color: 'var(--faint)',
              }}>
                {t.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {!jobsReady ? (
        <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-10 shimmer rounded-xl" />)}</div>
      ) : jobs.length === 0 && (
        <div className="card text-center py-12">
          <Wrench size={24} className="mx-auto mb-3" style={{ color: 'var(--steel)' }} />
          <p className="font-body text-sm" style={{ color: 'var(--steel)' }}>Quiet floor — start a walk-in to get moving.</p>
        </div>
      )}

      {/* the context workspace — walk-ins, jobs, bookings, technicians open over the board */}
      <StudioDrawer target={drawer} onClose={() => setDrawer(null)} onTarget={setDrawer}
        renderTech={id => (
          <TechnicianDrawer employeeId={id} jobs={jobs} attendance={attendance} actor={actor}
            onChanged={() => getTodayAttendance().then(setAttendance).catch(() => {})}
            onOpenJob={openJob} />
        )} />
    </div>
  );
}

/** "Next: …" footer on a bay card — who takes this bay after the current job. */
function BayNextLine({ r, waiting, nextBooking, bookingDayLabel, resourceOf }: {
  r: ResourceKey;
  waiting: Occupant[];
  nextBooking: Booking | null;
  bookingDayLabel: (b: Booking) => string;
  resourceOf: (j: Job) => ResourceKey;
}) {
  const inQueue = waiting.find(o => resourceOf(o.job) === r);
  if (inQueue) return (
    <p className="font-mono text-[10px] mt-2 flex items-center gap-1.5" style={{ color: 'var(--pewter)' }}>
      <CalendarClock size={10} className="shrink-0" style={{ color: 'var(--info)' }} />
      Next: <b style={{ color: 'var(--chrome)', fontWeight: 700 }}>{inQueue.vehicle}</b> — waiting on site
    </p>
  );
  if (nextBooking) return (
    <p className="font-mono text-[10px] mt-2 flex items-center gap-1.5" style={{ color: 'var(--pewter)' }}>
      <CalendarClock size={10} className="shrink-0" />
      Next booking: <b style={{ color: 'var(--chrome)', fontWeight: 700 }}>{bookingDayLabel(nextBooking)}</b> · {nextBooking.vehicleName}
    </p>
  );
  return (
    <p className="font-mono text-[10px] mt-2" style={{ color: 'var(--faint)' }}>No upcoming work booked.</p>
  );
}
