'use client';
/**
 * Studio Operations Board — the heart of the business. The whole screen
 * answers one question: "what is happening inside my workshop right now?"
 *
 * No graphs. No revenue. Operations only:
 *   ops header    → clock + live bay states + waiting/QC/ready counts
 *   alerts        → bay freeing, running late, customer waiting, ready to call
 *   waiting queue → every arriving vehicle, oldest first
 *   resource cards→ the two physical bays with full occupant detail
 *   QC / ready    → the tail of the pipeline
 *   technicians   → who is working, on break, idle
 *   capacity      → done/planned per bay, average delay, next free bay
 *
 * All state derives from useFloor (shared with BayStrip) — no duplicate logic.
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PlusCircle, Wrench, ChevronRight, Timer, Droplets, Shield,
  AlertTriangle, Phone, BadgeCheck, Truck, Camera, UserRound,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  subscribeTodaysJobs, getBookingsForDates, getTodayAttendance, shiftMath,
} from '@/lib/firebaseService';
import { fmtMin } from '@/lib/services/washMetrics';
import { RESOURCE_LABELS, type ResourceKey } from '@/lib/availability';
import { useFloor, type Occupant } from '@/components/studio/useFloor';
import type { AttendanceRecord, Booking, Job } from '@/lib/types';

const timeLabel = (d: Date) =>
  d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

/** late < 15 min → orange, 15+ → red */
const lateColor = (remainingMin: number | null): string | undefined =>
  remainingMin === null || remainingMin >= 0 ? undefined
    : remainingMin > -15 ? 'var(--warning)' : 'var(--danger)';

export default function StudioBoard() {
  const router = useRouter();

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
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  useEffect(() => {
    getBookingsForDates([today])
      .then(bs => setBookings(bs.filter(b => b.scheduledDate === today)))
      .catch(() => {});
    getTodayAttendance().then(setAttendance).catch(() => {});
  }, [today]);

  const floor = useFloor(jobs, bookings);
  const { bays, waiting, qc, ready, deliveredToday, freeInMin, capacity } = floor;

  const openJob = (j: Job) =>
    router.push(j.bookingId ? `/admin/bookings/${j.bookingId}` : `/admin/jobs/${j.id}`);

  // ── technicians: attendance ⨯ live assignments ──
  const technicians = useMemo(() => {
    const activeJobs = jobs.filter(j => j.status === 'in_progress');
    return attendance
      .filter(r => !r.checkOutAt)
      .map(r => {
        const job = activeJobs.find(j => j.assignedIds?.includes(r.employeeId));
        const onBreak = shiftMath(r).onBreak;
        const bay = job ? RESOURCE_LABELS[
          job.serviceItems[0]?.category === 'Washing' ? 'wash' as const : 'protection' as const
        ] : null;
        const started = job ? (job.statusHistory ?? []).find(h => h.status === 'in_progress')?.at?.toDate?.() : null;
        const workMin = started
          ? Math.max(0, Math.round((floor.now.getTime() - started.getTime()) / 60000)) : null;
        return {
          id: r.employeeId, name: r.employeeName,
          state: onBreak ? 'break' as const : job ? 'working' as const : 'idle' as const,
          service: job?.serviceItems[0]?.serviceName, bay, workMin,
        };
      })
      .sort((a, b) => (a.state === 'working' ? 0 : a.state === 'break' ? 1 : 2)
        - (b.state === 'working' ? 0 : b.state === 'break' ? 1 : 2));
  }, [attendance, jobs, floor.now]);

  // ── alerts the board constantly generates ──
  const alerts = useMemo(() => {
    const out: { icon: typeof Timer; text: string; color: string; href?: string }[] = [];
    (['protection', 'wash'] as ResourceKey[]).forEach(r => {
      const f = freeInMin[r];
      if (f !== null && f > 0 && f <= 30)
        out.push({ icon: Timer, text: `${RESOURCE_LABELS[r]} free in ${fmtMin(f)}`, color: 'var(--info)' });
    });
    [...bays.wash, ...bays.protection].forEach(o => {
      if (o.remainingMin !== null && o.remainingMin < 0)
        out.push({ icon: AlertTriangle, text: `${o.vehicle} running late ${fmtMin(-o.remainingMin)}`, color: lateColor(o.remainingMin)! });
    });
    waiting.forEach(o => {
      if (o.elapsedMin !== null && o.elapsedMin >= 15)
        out.push({ icon: UserRound, text: `${o.customer} waiting ${fmtMin(o.elapsedMin)}`, color: 'var(--warning)' });
    });
    ready.forEach(j => {
      if (j.paymentStatus === 'pending')
        out.push({ icon: AlertTriangle, text: `${j.vehicleName} · payment pending`, color: 'var(--warning)' });
      else
        out.push({ icon: Phone, text: `${j.vehicleName} ready — call ${j.customerName}`, color: 'var(--success)' });
    });
    return out.slice(0, 6);
  }, [bays, waiting, ready, freeInMin]);

  const bayMeta: Record<ResourceKey, { icon: typeof Droplets }> = {
    wash: { icon: Droplets }, protection: { icon: Shield },
  };

  const bayHeaderState = (r: ResourceKey): { text: string; color: string } => {
    const occ = bays[r][0];
    if (!occ) return { text: 'FREE', color: 'var(--success)' };
    const lc = lateColor(occ.remainingMin);
    if (lc) return { text: `LATE ${fmtMin(-(occ.remainingMin!))}`, color: lc };
    if (occ.remainingMin !== null)
      return { text: `${fmtMin(occ.remainingMin)} left`, color: occ.remainingMin <= 60 ? 'var(--warning)' : 'var(--chrome)' };
    return { text: 'BUSY', color: 'var(--warning)' };
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      {/* ── Ops header: the studio at a glance ── */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="font-display font-800 text-2xl" style={{ color: 'var(--chrome)' }}>Studio</h1>
          <p className="text-sm font-body flex items-center gap-2" style={{ color: 'var(--steel)' }}>
            <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: 'var(--success)' }} />
            {format(floor.now, 'EEEE, dd MMMM')} · {timeLabel(floor.now)}
          </p>
        </div>
        <Link href="/admin/walkin" className="btn-ember flex md:hidden items-center gap-2 px-4 py-2.5 text-sm">
          <PlusCircle size={15} /> New walk-in
        </Link>
      </div>

      <div className="flex items-stretch gap-2 mb-4 overflow-x-auto pb-1">
        {(['wash', 'protection'] as ResourceKey[]).map(r => {
          const st = bayHeaderState(r);
          const occ = bays[r][0];
          return (
            <div key={r} className="flex flex-col gap-0.5 px-3.5 py-2 rounded-xl shrink-0"
              style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
              <span className="font-mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--faint)' }}>
                {RESOURCE_LABELS[r].toUpperCase()}
              </span>
              <span className="font-mono font-700 text-sm" style={{ color: st.color }}>
                {occ ? occ.service.split(' + ')[0] : st.text}
              </span>
              {occ && <span className="font-mono" style={{ fontSize: 10, color: st.color }}>{st.text}</span>}
            </div>
          );
        })}
        {[
          { n: waiting.length, l: 'Waiting', c: 'var(--info)' },
          { n: qc.length, l: 'QC', c: 'var(--info)' },
          { n: ready.length, l: 'Ready', c: 'var(--success)' },
          { n: deliveredToday, l: 'Delivered', c: 'var(--success)' },
        ].map(s => (
          <div key={s.l} className="flex flex-col justify-center gap-0.5 px-3.5 py-2 rounded-xl shrink-0"
            style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
            <span className="font-mono font-700 text-base leading-none" style={{ color: s.n > 0 ? s.c : 'var(--steel)' }}>{s.n}</span>
            <span className="text-[10px] font-body" style={{ color: 'var(--pewter)' }}>{s.l}</span>
          </div>
        ))}
      </div>

      {/* ── Alerts ── */}
      {alerts.length > 0 && (
        <div className="rounded-2xl px-4 py-2.5 mb-4 space-y-1.5"
          style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
          {alerts.map((a, i) => (
            <p key={i} className="flex items-center gap-2 font-mono" style={{ fontSize: 11, color: a.color }}>
              <a.icon size={11} className="shrink-0" /> {a.text}
            </p>
          ))}
        </div>
      )}

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
            {waiting.map((o, i) => (
              <button key={o.job.id} onClick={() => openJob(o.job)}
                className="group w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[.03] cursor-pointer"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                <span className="font-mono text-xs w-5 shrink-0" style={{ color: 'var(--faint)' }}>{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="font-body font-600 truncate" style={{ fontSize: 13.5, color: 'var(--chrome)' }}>
                    {o.vehicle}
                    <span className="font-400" style={{ color: 'var(--steel)' }}> · {o.service}</span>
                  </p>
                  <p className="text-xs font-body mt-0.5" style={{ color: 'var(--steel)' }}>
                    {o.job.source === 'walk_in' ? 'Walk-in' : 'Appointment'} · {o.customer}
                  </p>
                </div>
                <span className="font-mono text-xs shrink-0"
                  style={{ color: (o.elapsedMin ?? 0) >= 15 ? 'var(--warning)' : 'var(--pewter)' }}>
                  {o.elapsedMin !== null ? `waiting ${fmtMin(o.elapsedMin)}` : ''}
                </span>
                <ChevronRight size={15} className="shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--steel)' }} />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Resource cards: the two physical bays ── */}
      <div className="grid sm:grid-cols-2 gap-4 mb-5">
        {(['wash', 'protection'] as ResourceKey[]).map(r => {
          const occ: Occupant | undefined = bays[r][0];
          const queue = bays[r].length - 1;
          const Icon = bayMeta[r].icon;
          const st = bayHeaderState(r);
          return (
            <div key={r} className="rounded-2xl p-4"
              style={{ background: 'var(--fog)', border: `1px solid ${occ ? 'var(--border-strong)' : 'var(--border)'}` }}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono inline-flex items-center gap-2" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--faint)' }}>
                  <Icon size={13} style={{ color: occ ? st.color : 'var(--success)' }} />
                  {RESOURCE_LABELS[r].toUpperCase()}
                </span>
                <span className="font-mono font-700" style={{ fontSize: 11, color: st.color }}>
                  {occ ? 'OCCUPIED' : 'FREE'}
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
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3">
                    {[
                      ['Started', occ.startedAt ? timeLabel(occ.startedAt) : '—'],
                      ['Ends', occ.eta ? timeLabel(occ.eta) : '—'],
                      ['Elapsed', occ.elapsedMin !== null ? fmtMin(occ.elapsedMin) : '—'],
                      ['Remaining', occ.remainingMin !== null
                        ? (occ.remainingMin < 0 ? `late ${fmtMin(-occ.remainingMin)}` : fmtMin(occ.remainingMin)) : '—'],
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
                    {queue > 0 && (
                      <span className="font-mono text-[10px]" style={{ color: 'var(--faint)' }}>+{queue} queued</span>
                    )}
                  </div>
                </button>
              ) : (
                <p className="font-body text-sm py-4" style={{ color: 'var(--steel)' }}>
                  Available now{waiting.length > 0 ? ' — assign from the waiting queue.' : '.'}
                </p>
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

      {/* ── Capacity strip ── */}
      <div className="rounded-2xl px-4 py-3 mb-5 flex items-center gap-x-5 gap-y-1.5 flex-wrap"
        style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
        <span className="font-mono" style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--faint)' }}>TODAY</span>
        {(['wash', 'protection'] as ResourceKey[]).map(r => (
          <span key={r} className="font-mono" style={{ fontSize: 11, color: 'var(--pewter)' }}>
            {r === 'wash' ? 'Wash' : 'Protection'}{' '}
            <b style={{ color: 'var(--chrome)', fontWeight: 700 }}>{capacity[r].done}/{capacity[r].planned}</b>
          </span>
        ))}
        {floor.avgDelayMin !== null && (
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--pewter)' }}>
            Avg delay <b style={{ color: floor.avgDelayMin > 15 ? 'var(--warning)' : 'var(--chrome)', fontWeight: 700 }}>{fmtMin(floor.avgDelayMin)}</b>
          </span>
        )}
        {(['wash', 'protection'] as ResourceKey[]).map(r => {
          const f = freeInMin[r];
          if (f === null || f === 0) return null;
          return (
            <span key={r + 'free'} className="font-mono" style={{ fontSize: 11, color: 'var(--pewter)' }}>
              {RESOURCE_LABELS[r]} free at{' '}
              <b style={{ color: 'var(--chrome)', fontWeight: 700 }}>
                {timeLabel(new Date(floor.now.getTime() + f * 60000))}
              </b>
            </span>
          );
        })}
        <Link href="/admin/schedule" className="ml-auto font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--steel)' }}>
          Timeline →
        </Link>
      </div>

      {/* ── Technician strip ── */}
      {technicians.length > 0 && (
        <div className="rounded-2xl px-4 py-3 mb-5 flex items-stretch gap-4 overflow-x-auto"
          style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
          {technicians.map(t => (
            <Link key={t.id} href={`/admin/employees/${t.id}`} className="flex flex-col gap-0.5 shrink-0 min-w-24">
              <span className="font-body font-600 text-sm truncate" style={{ color: 'var(--chrome)' }}>{t.name}</span>
              <span className="font-mono inline-flex items-center gap-1.5" style={{
                fontSize: 10,
                color: t.state === 'working' ? 'var(--success)' : t.state === 'break' ? 'var(--warning)' : 'var(--steel)',
              }}>
                <span className="rounded-full" style={{
                  width: 6, height: 6,
                  background: t.state === 'working' ? 'var(--success)' : t.state === 'break' ? 'var(--warning)' : 'var(--steel)',
                }} />
                {t.state === 'working' ? (t.service ?? 'Working') : t.state === 'break' ? 'Break' : 'Idle'}
              </span>
              {t.state === 'working' && (
                <span className="font-mono text-[10px]" style={{ color: 'var(--pewter)' }}>
                  {t.bay}{t.workMin !== null ? ` · ${fmtMin(t.workMin)}` : ''}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      {!jobsReady ? (
        <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-10 shimmer rounded-xl" />)}</div>
      ) : jobs.length === 0 && (
        <div className="card text-center py-12">
          <Wrench size={24} className="mx-auto mb-3" style={{ color: 'var(--steel)' }} />
          <p className="font-body text-sm" style={{ color: 'var(--steel)' }}>Quiet floor — start a walk-in to get moving.</p>
        </div>
      )}
    </div>
  );
}
