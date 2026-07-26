'use client';
/**
 * THE GARAGE - `/app/garage`.
 * (docs/AUTOMODZ-OS-IA.md §4 · AUTOMODZ-OS-DESIGN-LANGUAGE.md)
 *
 * Home answers "how is my car?". The Garage answers "what do I own, and what
 * do we have of it?" - every car, each one's identity, and every photograph
 * ever taken of it.
 *
 *   1  the cars        one hero each, in the order the owner keeps them
 *   2  the car         its plate, its protection, its papers - one panel
 *   3  media           every frame, by month, opening into the viewer
 *
 * COMPOSITION ONLY. Every material here already existed before this file:
 * `HeroVehicle`, `Panel`, `Section`, `StateCard`, `MediaGrid`, `MediaViewer`,
 * `Action` and the text primitives. Nothing visual is invented here - the two
 * patterns this screen genuinely needed (a read-only grid of many frames, and
 * a full-screen viewer) were extracted into `components/os` FIRST and are
 * consumed here like everything else.
 *
 * Editing a car is not re-implemented either: it hands off to the existing
 * car form at `/app?sheet=car-form&car-id=…`.
 *
 * NOT YET REACHABLE FROM THE DOCK. The Dock is frozen this phase and its
 * "Garage" slot still opens the blank add-a-car form - the single worst
 * interaction the audit found. One line in `components/os/Dock.tsx`
 * (`/app?sheet=car-form` → `/app/garage`) finishes it, deliberately left for
 * approval rather than taken.
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { getJobsForCustomer, getServices, STATIC_SERVICES } from '@/lib/firebaseService';
import { isDevUser, DEV_JOBS } from '@/lib/cx/devseed';
import type { Job, Service, Vehicle } from '@/lib/types';
import { projectProtections, type LiveProtection } from '@/lib/os/protection';
import { projectMoments, groupByMonth, framesOf } from '@/lib/os/moment';
import { visitPhase } from '@/lib/os/visit';
import { useStudioRouter } from '@/lib/os/navigate';
import HeroVehicle from '@/components/os/HeroVehicle';
import Panel from '@/components/os/Panel';
import Section from '@/components/os/Section';
import StateCard from '@/components/os/StateCard';
import MediaViewer from '@/components/os/MediaViewer';
import { MediaMonth } from '@/components/os/MediaGrid';
import Action from '@/components/os/Action';
import { Emphasis, Body, Data, Whisper } from '@/components/os/text';

export default function GaragePage() {
  const router = useRouter();
  const nav = useStudioRouter();
  const { user, vehicles, bookings, session, patchSession } = useAppStore();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [services, setServices] = useState<Service[]>(STATIC_SERVICES);
  const [viewing, setViewing] = useState<number | null>(null);

  /* the car in view is the one the rest of the product is already on - a
     garage never reopens on someone else's car just because it is first */
  const [selected, setSelected] = useState<string | null>(session.selectedVehicleId ?? null);
  const vehicle: Vehicle | null =
    vehicles.find(v => v.id === selected) ?? vehicles[0] ?? null;

  useEffect(() => { getServices().then(setServices).catch(() => {}); }, []);
  useEffect(() => {
    if (!user) return;
    if (isDevUser(user.uid)) { setJobs(Object.values(DEV_JOBS)); return; }
    getJobsForCustomer(user.uid).then(setJobs).catch(() => setJobs([]));
  }, [user?.uid]);

  // remember the car, so Home and the Garage never disagree about which one
  useEffect(() => {
    if (vehicle && vehicle.id !== session.selectedVehicleId) {
      patchSession({ selectedVehicleId: vehicle.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle?.id]);

  /* this car's completed work - the source both projections read */
  const completed = useMemo(
    () => bookings
      .filter(b => b.vehicleId === vehicle?.id && visitPhase(b.status) === 'archived')
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate)),
    [bookings, vehicle?.id],
  );

  /* the promises shielding it (the same engine Home reads) */
  const protections = useMemo<LiveProtection[]>(() => {
    if (!vehicle) return [];
    return projectProtections({
      vehicleId: vehicle.id,
      completed: completed.map(b => ({
        id: b.id, serviceName: b.serviceName,
        serviceCategory: b.serviceCategory, scheduledDate: b.scheduledDate,
      })),
      catalogue: services,
    });
  }, [vehicle, completed, services]);

  /* every frame we have of this car, by month */
  const months = useMemo(() => {
    if (!vehicle) return [];
    const mine = new Set(completed.map(b => b.id));
    const carJobs = jobs.filter(j => (j.bookingId && mine.has(j.bookingId)) || j.vehicleRegNo === vehicle.registrationNumber);
    return groupByMonth(projectMoments({ vehicleId: vehicle.id, jobs: carJobs }));
  }, [vehicle, jobs, completed]);

  /* the viewer pages through the whole library, not one month at a time */
  const frames = useMemo(() => framesOf(months.flatMap(m => m.moments)), [months]);
  const frameIndex = useMemo(() => {
    const map = new Map<string, number>();
    frames.forEach((f, i) => { if (!map.has(f.url)) map.set(f.url, i); });
    return map;
  }, [frames]);

  if (!user) return null;

  /* an empty garage is an invitation, and it is the whole screen - never a
     card sitting on an otherwise-populated page (Design Language §11) */
  if (!vehicle) {
    return (
      <main style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', padding: 'var(--st-inset)' }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <h1 style={{
            margin: 0, fontFamily: 'var(--st-display)', fontWeight: 640,
            fontSize: 'clamp(28px, 8vw, 40px)', lineHeight: 1.05,
            letterSpacing: '-0.02em', color: 'var(--st-ink)',
          }}>
            Your garage is empty.
          </h1>
          <Body tone="ink-2" style={{ marginTop: 'var(--st-line)' }}>There is room for the first car.</Body>
          <div style={{ marginTop: 'var(--st-rest)' }}>
            <Action variant="primary" onClick={() => router.push('/app?sheet=car-form')}>Add a car</Action>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ paddingBottom: 'var(--st-content-floor)' }}>
      {/* ── 1 · THE CAR ────────────────────────────────────────────────── */}
      <HeroVehicle
        name={vehicle.name}
        registration={vehicle.registrationNumber}
        photo={vehicle.photo}
        priority
      >
        <h1 style={{
          margin: 0, fontFamily: 'var(--st-display)', fontWeight: 700,
          fontSize: 'clamp(34px, 10vw, 52px)', lineHeight: 0.96,
          letterSpacing: '-0.03em', color: 'var(--st-ink)',
        }}>
          {vehicle.name}
        </h1>
      </HeroVehicle>

      {/* every other car, when there is one - the garage is a collection */}
      {vehicles.length > 1 && (
        <Section rhythm="line">
          <div style={{ display: 'flex', gap: 'var(--st-breath)', flexWrap: 'wrap' }}>
            {vehicles.map(v => {
              const on = v.id === vehicle.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setSelected(v.id)}
                  aria-current={on ? 'true' : undefined}
                  className="st-tap"
                  style={{
                    minHeight: 44, padding: '0 var(--st-gap)',
                    borderRadius: 'var(--st-r-pill)', cursor: 'pointer',
                    background: on ? 'var(--st-linen)' : 'transparent',
                    border: `1px solid ${on ? 'transparent' : 'var(--st-hairline)'}`,
                    fontFamily: 'var(--st-text)', fontSize: 15,
                    color: on ? 'var(--st-ink)' : 'var(--st-ink-2)',
                  }}
                >
                  {v.name}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── 2 · WHAT IT IS ─────────────────────────────────────────────── */}
      <Section title="The car" rhythm="rest" actionLabel="Edit" onAction={() => router.push(`/app?sheet=car-form&car-id=${vehicle.id}`)}>
        <Panel>
          <div style={{ display: 'grid', gap: 'var(--st-line)' }}>
            {/* the heading above already names the car - this panel carries
                what the heading cannot */}
            <div>
              <Whisper as="span" tone="ink-2" style={{ display: 'block' }}>Registration</Whisper>
              <Data tone="ink" style={{ display: 'block', marginTop: 2, fontSize: 18 }}>
                {vehicle.registrationNumber}
              </Data>
            </div>
            <Whisper tone="ink-2">
              {completed.length
                ? `${completed.length} visit${completed.length === 1 ? '' : 's'} on record.`
                : 'No visits on record yet.'}
            </Whisper>
          </div>
        </Panel>
      </Section>

      {/* ── 3 · WHAT PROTECTS IT ───────────────────────────────────────── */}
      {protections.length > 0 && (
        <Section title="Protection" rhythm="rest">
          <div style={{ display: 'grid', gap: 'var(--st-line)' }}>
            {protections.map(p => (
              <StateCard
                key={p.id}
                protection={p}
                onOpenChapter={p.visitId ? () => nav.push(`/app/chapter/${p.visitId}`) : undefined}
              />
            ))}
          </div>
        </Section>
      )}

      {/* ── 4 · MEDIA - every frame we have, by month ──────────────────── */}
      {months.length > 0 ? (
        <Section title="Media" rhythm="rest">
          <div style={{ display: 'grid', gap: 'var(--st-rest)' }}>
            {months.map(m => (
              <MediaMonth
                key={m.month}
                label={m.label}
                frames={m.moments.flatMap(mo =>
                  mo.media.map((md, i) => ({
                    id: `${mo.id}_${i}`, url: md.url, caption: mo.caption,
                  })),
                )}
                onOpen={i => {
                  // the grid indexes within its month; the viewer spans the library
                  const url = m.moments.flatMap(mo => mo.media.map(md => md.url))[i];
                  setViewing(frameIndex.get(url) ?? 0);
                }}
              />
            ))}
          </div>
        </Section>
      ) : (
        /* silence, not an empty-state card: one quiet line, once */
        <Section title="Media" rhythm="rest">
          <Whisper tone="ink-2">
            Photographs of the {vehicle.name} will collect here after its first visit.
          </Whisper>
        </Section>
      )}

      <MediaViewer
        frames={frames}
        index={viewing}
        onIndex={setViewing}
        onClose={() => setViewing(null)}
      />
    </main>
  );
}
