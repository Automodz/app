'use client';
/**
 * HOME - `/app`, the Garage. THE CONTROLLER.
 *
 * The screen itself is a pure view (components/home/Home.tsx); everything here
 * is wiring: Firebase, the session, the ownership/club/protection engines, the
 * sheets and every callback. The view decides nothing and mints no materials.
 *
 * The Glance it replaces was one adaptive composition fronted by a Capsule and
 * a CoachMark. Both retire here: the live visit now surfaces as the Garage's
 * own current state (IA §2), which also removes the three-way collision the
 * audit measured at the bottom of the screen.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useAppStore } from '@/lib/store';
import { useStudioRouter } from '@/lib/os/navigate';
import {
  getServices, getJobsForCustomer, getUserSubscription, STATIC_SERVICES,
  getAvailability,
} from '@/lib/firebaseService';
import { cancelBooking, rescheduleBooking, requestBooking } from '@/lib/services/bookings';
import { getEligiblePromos } from '@/lib/services/promos';
import { computeBestDiscount, applyDiscount } from '@/lib/services/pricing';
import type { BookingDiscount } from '@/lib/types';
import { generateTimeSlots, getAvailableDates } from '@/lib/utils';
import type { Booking, Job, Service, Subscription, Vehicle } from '@/lib/types';
import { truthOf, type ProtectionFact } from '@/lib/os/truth';
import { visitPhase, careAct, ACT_TITLE } from '@/lib/os/visit';
import { daysLeft } from '@/lib/os/term';
import { proposalFor } from '@/lib/os/proposal';
import { clubModel } from '@/lib/os/club';
import { ownershipState } from '@/lib/os/ownership';
import { conciergeLog } from '@/lib/os/log';
import { deriveProtection, PROTECTION_WORD, type Protection } from '@/lib/cx/protection';
import { isDevUser, DEV_JOBS, DEV_MEMBERSHIP } from '@/lib/cx/devseed';
import Portrait from '@/components/os/Portrait';
import IdentityPlate from '@/components/os/IdentityPlate';
import JoinClub from '@/components/os/JoinClub';
import CarForm from '@/components/os/CarForm';
import { markWelcomed, hasBeenWelcomed } from '@/lib/os/welcome';
import { useOnline } from '@/components/os/useOnline';
import ProtectionRecord from '@/components/os/ProtectionRecord';
import Desk, { type ShelfRow, type ThreadVisit, type SearchItem } from '@/components/os/Desk';
import StudioSheet from '@/components/os/StudioSheet';
import Action from '@/components/os/Action';
import Chip, { type Tone } from '@/components/os/Chip';
import Home, { type HomeState, type HomeJourneyEntry, type HomeTransformation } from '@/components/home/Home';
import { projectProtections, type LiveProtection } from '@/lib/os/protection';

import { Title, Emphasis, Body, Data, Whisper } from '@/components/os/text';
import { COMPANY, telLink } from '@/lib/company';

const fmtLong = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtDayDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

/** The visit a protection came from - its photograph and its Chapter. No
 *  individual is named (Constitution Art. 8, the actor law). */
function protectionSource(
  model: { visits: Booking[]; jobByBooking: Map<string, Job> },
  p: Protection,
): { bookingId?: string; photo?: string } {
  const source = model.visits.find(
    v => v.serviceName === p.service && visitPhase(v.status) === 'archived',
  );
  if (!source) return {};
  const job = model.jobByBooking.get(source.id);
  return {
    bookingId: source.id,
    photo: job?.photos?.find(x => x.kind === 'after')?.url,
  };
}

export default function GlancePage() {
  return (
    <Suspense fallback={null}>
      <Glance />
    </Suspense>
  );
}

function Glance() {
  const router = useRouter();
  const nav = useStudioRouter();
  const params = useSearchParams();
  const { user, vehicles, bookings } = useAppStore();

  const [services, setServices] = useState<Service[]>(STATIC_SERVICES);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [membership, setMembership] = useState<Subscription | null>(null);
  /* the car they were last looking at - a garage never reopens on someone
     else's car just because it happens to be first */
  const { session, patchSession } = useAppStore();
  const selectedVehicleId = session.selectedVehicleId;
  const [page, setPage] = useState(() => {
    const i = vehicles.findIndex(v => v.id === selectedVehicleId);
    return i >= 0 ? i : 0;
  });
  const pagerRef = useRef<HTMLDivElement>(null);

  /* You became an entrance (IA §2), so its old sheet address forwards to it.
     The Dock still points at `?sheet=you` and is frozen this phase - this
     keeps that slot working without touching it. */
  const youOpen = params.get('sheet') === 'you';
  const deskOpen = params.get('sheet') === 'desk';
  const arrangeOpen = params.get('sheet') === 'arrange';
  const manageOpen = params.get('sheet') === 'manage';
  const protectionOpen = params.get('focus') === 'protection';
  const joinClubOpen = params.get('sheet') === 'join-club';
  const prefillCat = params.get('cat');
  // every sheet is addressable (design D1), the car form included
  const carFormOpen = params.get('sheet') === 'car-form';
  const editingCarId = params.get('car-id');


  const openCarForm = (v?: Vehicle) =>
    router.replace(`/app?sheet=car-form${v ? `&car-id=${v.id}` : ''}`);

  useEffect(() => { if (youOpen) router.replace('/app/you'); }, [youOpen, router]);

  /* a first authenticated open with an empty garage belongs to the welcome;
     a customer who skipped the car keeps the garage invitation instead */
  useEffect(() => {
    if (!user || vehicles.length > 0) return;
    if (!hasBeenWelcomed()) router.replace('/app/welcome');
  }, [user, vehicles.length, router]);

  // a garage with a car in it has met the welcome
  useEffect(() => { if (vehicles.length > 0) markWelcomed(); }, [vehicles.length]);

  useEffect(() => { getServices().then(setServices).catch(() => {}); }, []);
  useEffect(() => {
    if (!user) return;
    if (isDevUser(user.uid)) { setJobs(Object.values(DEV_JOBS)); setMembership(DEV_MEMBERSHIP); return; }
    getJobsForCustomer(user.uid).then(setJobs).catch(() => setJobs([]));
    getUserSubscription(user.uid)
      .then(s => setMembership(s ?? null)).catch(() => setMembership(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  /* Where the pager opens: an explicit ?car= deep link wins, otherwise the car
     they were last looking at. Jumped to without animation - restoring a
     position should look like it was never lost, not like a scroll. */
  useEffect(() => {
    if (!vehicles.length) return;
    const carId = params.get('car') ?? selectedVehicleId;
    const i = carId ? vehicles.findIndex(v => v.id === carId) : -1;
    if (i >= 0) {
      setPage(i);
      pagerRef.current?.scrollTo({ left: i * (pagerRef.current?.clientWidth ?? 0), behavior: 'instant' as ScrollBehavior });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles.length]);

  // remember the car in view, so the next launch opens on it
  useEffect(() => {
    const v = vehicles[page];
    if (v && v.id !== selectedVehicleId) patchSession({ selectedVehicleId: v.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, vehicles.length]);

  const vehicle: Vehicle | null = vehicles[Math.min(page, vehicles.length - 1)] ?? null;

  /* ── derivations for the visible vehicle (objects own truth) ── */
  const model = useMemo(() => {
    if (!vehicle) return null;
    const visits = bookings
      .filter(b => b.vehicleId === vehicle.id && b.status !== 'cancelled')
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
    const completed = visits.filter(b => visitPhase(b.status) === 'archived');
    const protections = deriveProtection(visits, services);
    const facts: ProtectionFact[] = protections
      .filter(p => p.until)
      .map(p => ({ label: PROTECTION_WORD[p.kind], expiresOn: p.until!.toISOString().split('T')[0] }));
    const live = visits.find(v => visitPhase(v.status) === 'live') ?? null;
    const agreed = visits
      .filter(v => ['proposed', 'agreed'].includes(visitPhase(v.status)))
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0] ?? null;
    /* the declined fork: a request the studio couldn't take (rejected) or a
       missed slot (no-show). It only speaks when nothing is in flight for the
       car, and it retires on its own after two weeks so it never lingers. */
    const DECLINE_WINDOW = 14 * 86400000;
    const declinedRaw = bookings
      .filter(b => b.vehicleId === vehicle.id && b.status === 'cancelled'
        && (b.rejectionReason != null || b.noShow === true))
      .filter(b => Date.now() - (b.cancelledAt?.toMillis?.() ?? b.updatedAt?.toMillis?.() ?? 0) <= DECLINE_WINDOW)
      .sort((a, b) => (b.cancelledAt?.toMillis?.() ?? 0) - (a.cancelledAt?.toMillis?.() ?? 0))[0] ?? null;
    const declined = live || agreed ? null : declinedRaw;
    const jobByBooking = new Map(jobs.filter(j => j.bookingId).map(j => [j.bookingId!, j]));
    // one open proposal per vehicle - suppressed while a visit is already in flight
    const proposal = (live || agreed) ? null : proposalFor({
      vehicleId: vehicle.id, protections, lastCaredOn: completed[0]?.scheduledDate,
    });
    return {
      visits, completed, protections, live, agreed, declined, jobByBooking, proposal,
      truth: truthOf({
        visits,
        protections: facts,
        lastCaredOn: completed[0]?.scheduledDate,
      }),
    };
  }, [vehicle, bookings, services, jobs]);

  /* the relationship, derived once - the Club layer, the Desk and the join
     sheet all read the same model */
  const club = useMemo(
    () => clubModel({ membership, completed: bookings.filter(b => visitPhase(b.status) === 'archived') }),
    [membership, bookings],
  );

  /* where this owner actually stands - the one state that decides what the
     deck leads with. Derived, never stored; no two customers get the same
     Home (lib/os/ownership.ts). */
  const own = useMemo(
    () => ownershipState({
      vehicleCount: vehicles.length,
      live: model?.live ?? null,
      agreed: model?.agreed ?? null,
      declined: model?.declined ?? null,
      completed: model?.completed ?? [],
      protections: model?.protections ?? [],
      club,
    }),
    [vehicles.length, model, club],
  );

  /* this customer's own wash cadence - the join sheet's honest arithmetic */
  const washHistory = useMemo(
    () => bookings
      .filter(b => visitPhase(b.status) === 'archived' && b.serviceCategory === 'Washing')
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate)),
    [bookings],
  );


  /* what the studio has already told this customer - one timeline, no inbox */
  const log = useMemo(() => {
    if (!vehicle || !model) return [];
    return conciergeLog({
      visits: bookings.filter(b => b.vehicleId === vehicle.id),
      jobByBooking: model.jobByBooking,
      membership,
      protections: model.protections,
      vehicleName: vehicle.name,
    });
  }, [vehicle, model, bookings, membership]);

  /* ── the Desk shelf (design system §7.4 · IA D2) - adaptive: a row exists
     only when its object does. Thread & search land in P2. ── */
  const deskRows: ShelfRow[] = useMemo(() => {
    if (!vehicle) return [];
    const rows: ShelfRow[] = [];
    rows.push({ label: `The ${vehicle.name}’s care`, onTap: () => router.replace('/app?sheet=arrange') });
    if (model && model.protections.length)
      rows.push({ label: 'Protection', detail: String(model.protections.length), onTap: () => router.replace('/app?focus=protection') });
    if (model && model.completed.some(b => b.invoiceId))
      rows.push({ label: 'Papers & records', onTap: () => router.replace('/app') }); // the vault is a Glance layer
    if (club.state !== 'none' || club.invited)
      rows.push({
        label: 'The Club',
        detail: club.state === 'active' || club.state === 'grace'
          ? `${club.washesLeft} wash${club.washesLeft === 1 ? '' : 'es'} left` : undefined,
        onTap: () => router.replace(club.state === 'none' || club.state === 'lapsed'
          ? '/app?sheet=join-club' : '/app'),
      });
    rows.push({ label: 'The studio', onTap: () => window.open(`https://wa.me/${COMPANY.phoneIntl}`, '_blank') });
    rows.push({ label: 'You', onTap: () => router.replace('/app?sheet=you') });
    return rows;
  }, [vehicle, model, club, router]);

  /* ── the conversation feed: real visits + a global search index (IA D) ── */
  const messageStudio = () => window.open(`https://wa.me/${COMPANY.phoneIntl}`, '_blank');

  const deskFeed = useMemo(() => {
    if (!model || !vehicle) return { visits: [] as ThreadVisit[], search: [] as SearchItem[] };
    const line = (b: Booking): string => {
      const ph = visitPhase(b.status);
      if (ph === 'live') { const a = careAct(b.status); return a ? `${ACT_TITLE[a]} - the ${vehicle.name} is with us` : 'In the studio'; }
      if (ph === 'agreed') return `${fmtDayDate(b.scheduledDate)} · ${b.scheduledTime} · confirmed`;
      if (ph === 'proposed') return `${b.serviceName} · requested`;
      return `${b.serviceName} · ${fmtLong(b.scheduledDate)}`;
    };
    // a live visit opens the Stay; a finished one opens its record (P4: the Chapter)
    const openVisit = (b: Booking) => () =>
      nav.push(visitPhase(b.status) === "live" ? `/app/visit/${b.id}` : `/app/chapter/${b.id}`);
    const visitsFeed: ThreadVisit[] = model.visits.slice(0, 6).reverse().map(b => ({
      id: b.id,
      line: line(b),
      sub: visitPhase(b.status) === 'archived' ? `₹${b.totalAmount.toLocaleString('en-IN')}` : undefined,
      onTap: openVisit(b),
    }));
    const search: SearchItem[] = [
      ...model.visits.map(b => ({ label: line(b), group: 'Visits', onTap: openVisit(b) })),
      ...model.completed.filter(b => b.invoiceId).map(b => ({
        label: `Care record - ${fmtLong(b.scheduledDate)}`, group: 'Records',
        onTap: () => nav.push(`/app/chapter/${b.id}`),
      })),
      ...model.protections.map(p => ({ label: PROTECTION_WORD[p.kind], group: 'Protection', onTap: () => router.replace('/app?focus=protection') })),
      /* the Conversation answers membership from the same model - real
         sentences about a real cycle, never a scripted reply */
      ...(club.state !== 'none' ? [
        {
          label: `Club · ${club.plan}${club.state === 'pending' ? ' · confirming' : ''}`,
          group: 'Club', onTap: () => router.replace('/app'),
        },
        ...(club.context ? [{ label: club.context, group: 'Club', onTap: () => router.replace('/app') }] : []),
        ...(club.washesUsed > 0 ? [{
          label: `${club.washesUsed} of ${club.washesTotal} washes used this cycle`,
          group: 'Club', onTap: () => router.replace('/app'),
        }] : []),
        ...(club.state === 'lapsed' || club.state === 'grace' ? [{
          label: club.state === 'grace' ? 'Renew the Club' : 'Rejoin the Club',
          group: 'Club', onTap: () => router.replace('/app?sheet=join-club'),
        }] : []),
      ] : club.invited ? [
        { label: 'The Club - have a look', group: 'Club', onTap: () => router.replace('/app?sheet=join-club') },
      ] : []),
    ];
    return { visits: visitsFeed, search };
  }, [model, vehicle, club, router]);

  /* ── the Home view props. Presentation only - every value comes from an
     engine that already exists (ownership, protection, club, visit); no new
     truth is minted here. ── */

  /* THE LIVING STATES. Stored protections are the destination; until the
     migration has run for this car, `projectProtections` derives them from
     completed work with the SAME capture function the migration persists
     (lib/os/protection). Marked `reconstructed`, never merged with stored. */
  const protections = useMemo<LiveProtection[]>(() => {
    if (!vehicle || !model) return [];
    return projectProtections({
      vehicleId: vehicle.id,
      completed: model.completed.map(b => ({
        id: b.id, serviceName: b.serviceName,
        serviceCategory: b.serviceCategory, scheduledDate: b.scheduledDate,
      })),
      catalogue: services,
    });
  }, [vehicle, model, services]);

  /* CURRENT STATE - the one Display of the screen, from the ownership engine.
     The Capsule used to carry this; it is the Garage's own state now. */
  const homeState = useMemo<HomeState>(() => {
    const car = vehicle?.name ?? 'your car';
    switch (own.state) {
      case 'ready':
        return {
          word: 'Ready', tone: 'ok',
          line: `The ${car} is ready to collect.`,
          note: model?.live?.serviceName,
          actionLabel: 'See the visit',
          onAction: () => nav.push(`/app/visit/${model!.live!.id}`),
        };
      case 'in_studio':
        return {
          word: 'In care', tone: 'info',
          line: `The ${car} is with us.`,
          note: model?.live?.serviceName,
          actionLabel: 'Follow the visit',
          onAction: () => nav.push(`/app/visit/${model!.live!.id}`),
        };
      case 'booked': {
        const b = model!.agreed!;
        const confirmed = visitPhase(b.status) === 'agreed';
        return {
          word: confirmed ? 'Booked in' : 'Requested', tone: confirmed ? 'ok' : 'info',
          line: `${b.serviceName}, ${fmtDayDate(b.scheduledDate)} at ${b.scheduledTime}.`,
          actionLabel: 'Manage the visit',
          onAction: () => router.replace('/app?sheet=manage'),
        };
      }
      case 'declined': {
        const b = model!.declined!;
        return {
          word: b.noShow ? 'Missed' : 'Not taken', tone: 'urgent',
          line: b.noShow ? `The ${car} missed its slot.` : 'We couldn’t take that visit.',
          note: b.rejectionReason ?? undefined,
          actionLabel: 'Arrange again',
          onAction: () => router.replace('/app?sheet=arrange'),
        };
      }
      case 'membership_attention':
        return {
          word: 'The Club', tone: club.state === 'lapsed' ? 'urgent' : 'warn',
          line: club.state === 'lapsed'
            ? 'Your membership has lapsed.' : 'Your membership needs renewing.',
          note: club.context ?? undefined,
          actionLabel: club.state === 'lapsed' ? 'Rejoin the Club' : 'Renew the Club',
          onAction: () => router.replace('/app?sheet=join-club'),
        };
      case 'new':
      case 'unvisited':
        return {
          word: 'New', tone: 'neutral',
          line: `The ${car} hasn’t been in yet.`,
          actionLabel: 'Arrange a visit',
          onAction: () => router.replace('/app?sheet=arrange'),
        };
      default:
        // steady states speak only when the proposal engine has something true
        return model?.proposal
          ? {
              word: 'Care due', tone: 'warn',
              line: `${model.proposal.headline}.`,
              note: model.proposal.reason,
              actionLabel: model.proposal.serviceCategory === 'Washing' ? 'Arrange it' : 'Renew it',
              onAction: () => router.replace(`/app?sheet=arrange&cat=${model.proposal!.serviceCategory}`),
            }
          : {
              word: own.state === 'dormant' ? 'Resting' : 'Cared for',
              tone: 'ok',
              actionLabel: 'Arrange a visit',
              onAction: () => router.replace('/app?sheet=arrange'),
            };
    }
  }, [own.state, vehicle, model, club, router, nav]);

  /* THE LATEST TRANSFORMATION - the most recent finished work, as evidence. */
  const latest = useMemo<HomeTransformation | null>(() => {
    const b = model?.completed[0];
    if (!b) return null;
    const job = model!.jobByBooking.get(b.id);
    return {
      id: b.id,
      title: b.serviceName,
      date: fmtLong(b.scheduledDate),
      photo: job?.photos?.find(x => x.kind === 'after')?.url
        ?? job?.photos?.[job.photos.length - 1]?.url,
      onOpen: () => nav.push(`/app/chapter/${b.id}`),
    };
  }, [model, nav]);

  /* THE JOURNEY - what happened, newest first. */
  const journey = useMemo<HomeJourneyEntry[]>(() => {
    if (!model) return [];
    return model.completed.slice(0, 4).map(b => ({
      id: b.id,
      title: b.serviceName,
      detail: fmtLong(b.scheduledDate),
      onOpen: () => nav.push(`/app/chapter/${b.id}`),
    }));
  }, [model, nav]);

  const unreadCount = 0;

  if (!user) return null;

  /* an empty garage: the invitation is the whole Glance (a customer who met
     the welcome and chose to add the car later) */
  if (vehicles.length === 0) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <AddCarInvitation onAdd={() => openCarForm()} full />
        <CarFormSheet open={carFormOpen} editing={null} onClose={() => router.replace('/app')} />
      </div>
    );
  }

  return (
    <div>
      {/* ── HOME ─────────────────────────────────────────────────────────
          The screen is a pure view (components/home/Home.tsx). Everything
          below is only the wiring: the controller keeps the data, the engines,
          the sheets and every callback - the view decides nothing. */}
      <Home
        vehicles={vehicles.map(v => ({
          id: v.id, name: v.name, registration: v.registrationNumber, photo: v.photo,
        }))}
        page={page}
        onPage={(i: number) => { if (i !== page) setPage(i); }}
        onAddCar={() => openCarForm()}
        state={homeState}
        protections={protections}
        onOpenProtection={() => router.replace('/app?focus=protection')}
        latest={latest}
        journey={journey}
        onOpenJourney={() => router.replace('/app?sheet=desk')}
        studio={{
          name: COMPANY.name,
          area: COMPANY.city === 'Ahmedabad' ? 'Maninagar' : COMPANY.city,
          hours: `Open ${COMPANY.hours.open} – ${COMPANY.hours.close}`,
          onDirections: () => window.open(COMPANY.mapsUrl, '_blank', 'noopener,noreferrer'),
          onCall: () => window.open(telLink(), '_self'),
          onMessage: messageStudio,
        }}
      />

      {/* the protection panel - the Desk's focus reading of every layer (§C6) */}
      <StudioSheet open={protectionOpen} onOpenChange={o => { if (!o) router.replace('/app'); }} label="Protection">
        {vehicle && model && (
          <div style={{ display: 'grid', gap: 'var(--st-inset)', paddingBottom: 'var(--st-breath)' }}>
            <Title>Protection</Title>
            <IdentityPlate
              name={vehicle.name}
              registration={vehicle.registrationNumber}
              variant="row"
            />
            {model.protections.map(p => {
              const src = protectionSource(model, p);
              return (
                <ProtectionRecord
                  key={p.kind}
                  protection={p}
                  vehicleName={vehicle.name}
                  daysLeft={p.until ? daysLeft(p.until.toISOString().split('T')[0]) : null}
                  photo={src.photo}
                  onOpenChapter={src.bookingId ? () => nav.push(`/app/chapter/${src.bookingId}`) : undefined}
                  onRenew={model.proposal?.serviceCategory === p.kind
                    ? () => router.replace(`/app?sheet=arrange&cat=${p.kind}`)
                    : undefined}
                />
              );
            })}
          </div>
        )}
      </StudioSheet>

      <StudioSheet open={deskOpen} onOpenChange={o => { if (!o) router.replace('/app'); }} label="The studio">
        <Desk
          rows={deskRows}
          visits={deskFeed.visits}
          searchItems={deskFeed.search}
          log={log}
          onOpenLogEntry={entry => router.push(
            entry.target!.kind === 'chapter'
              ? `/app/chapter/${entry.target!.bookingId}`
              : `/app/visit/${entry.target!.bookingId}`,
          )}
          proposal={model?.proposal ? {
            reason: model.proposal.reason,
            onAccept: () => router.replace(`/app?sheet=arrange&cat=${model.proposal!.serviceCategory}`),
          } : undefined}
          onMessage={messageStudio}
        />
      </StudioSheet>

      {vehicle && (
        <ArrangeSheet
          open={arrangeOpen}
          vehicle={vehicle}
          services={services}
          membership={membership}
          prefillCat={prefillCat}
          onClose={() => router.replace('/app')}
        />
      )}

      <ManageVisitSheet
        open={manageOpen}
        booking={model?.agreed ?? null}
        onClose={() => router.replace('/app')}
      />

      <StudioSheet open={joinClubOpen} onOpenChange={o => { if (!o) router.replace('/app'); }} label="The Club">
        {vehicle && (
          <JoinClub
            vehicleName={vehicle.name}
            washes={washHistory}
            rejoining={club.state === 'lapsed' || club.state === 'grace'}
            onJoined={() => {
              // the membership is now pending; the Club layer says so itself
              if (user) getUserSubscription(user.uid).then(s => setMembership(s ?? null)).catch(() => {});
              router.replace('/app');
            }}
          />
        )}
      </StudioSheet>

      <CarFormSheet
        open={carFormOpen}
        editing={vehicles.find(v => v.id === editingCarId) ?? null}
        onClose={() => router.replace('/app')}
      />
    </div>
  );
}

const fmtDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long' });


/* ── the add-a-car page (B1 last page / first-run) ── */
/** A document mark - the glyph that makes a paper read as a file. */

/** A location pin - marks the studio as a destination, not a text block. */

/** GLANCE tile - one number the customer reads without a sentence. A row of
 *  these (Wallet/Health) answers where/protected/owned at a glance. */

function AddCarInvitation({ onAdd, full = false }: { onAdd: () => void; full?: boolean }) {
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      minWidth: '100%', minHeight: full ? '100svh' : '100svh',
      scrollSnapAlign: 'start',
      background: 'radial-gradient(130% 86% at 50% 34%, var(--st-paper) 0%, var(--st-gallery) 56%, var(--st-linen) 100%)',
      boxShadow: 'var(--st-edge)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 'var(--st-line)', padding: 'var(--st-inset)', textAlign: 'center',
    }}>
      {/* ambient bloom */}
      <div aria-hidden className="st-bloom" style={{
        position: 'absolute', top: '22%', left: '50%', width: 'min(120vw, 560px)', height: '46%',
        transform: 'translateX(-50%)', pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 62%)',
        mixBlendMode: 'soft-light',
      }} />
      {/* the empty bay - a ghosted monument awaiting a car */}
      <button
        onClick={onAdd} aria-label="Add a car" className="st-tap"
        style={{
          position: 'relative', width: 132, height: 132, borderRadius: '50%',
          border: '1.5px dashed var(--st-ink-3)', background: 'transparent', cursor: 'pointer',
          display: 'grid', placeItems: 'center', marginBottom: 'var(--st-gap)',
          boxShadow: 'var(--st-hold)',
        }}
      >
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
          <path d="M20 9v22M9 20h22" stroke="var(--st-ink-2)" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      <p style={{
        fontFamily: 'var(--st-display)', fontWeight: 640, letterSpacing: '-0.02em',
        fontSize: 'clamp(28px, 8vw, 40px)', lineHeight: 1.05, color: 'var(--st-ink)', margin: 0,
      }}>
        {full ? 'Welcome to AutoModz.' : 'Another car?'}
      </p>
      <Body tone="ink-2">The garage has room.</Body>
      <div style={{ marginTop: 'var(--st-inset)' }}>
        <Action variant="forward" onClick={onAdd}>Add a car</Action>
      </div>
    </div>
  );
}

/** Add or edit a car - the one form, in the Studio's own language. */
function CarFormSheet({ open, editing, onClose }: {
  open: boolean; editing?: Vehicle | null; onClose: () => void;
}) {
  return (
    <StudioSheet open={open} onOpenChange={o => { if (!o) onClose(); }} label="The car">
      <CarForm editing={editing} onSaved={onClose} />
    </StudioSheet>
  );
}

/* ── the manage-visit sheet - reschedule or cancel an agreed/requested visit.
   Reuses the availability engine and the booking service (rescheduleBooking /
   cancelBooking); a customer may change a pending or confirmed visit, and the
   Firestore rules permit exactly this. ── */
function ManageVisitSheet({
  open, booking, onClose,
}: {
  open: boolean; booking: Booking | null; onClose: () => void;
}) {
  const { user, bookings, setBookings, cancelBookingInStore } = useAppStore();
  const online = useOnline();
  const [mode, setMode] = useState<'idle' | 'reschedule' | 'confirmCancel'>('idle');
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [full, setFull] = useState<{ fullDates: string[]; fullSlots: Record<string, string[]> }>({ fullDates: [], fullSlots: {} });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dates = useMemo(() => getAvailableDates(), []);

  // reset each time the sheet opens (or the target visit changes)
  useEffect(() => {
    if (!open) return;
    setMode('idle'); setDate(null); setTime(null); setBusy(false); setError(null);
  }, [open, booking?.id]);

  const duration = booking?.serviceDurationMinutes ?? 60;

  // availability for the visit's own service, only while rescheduling
  useEffect(() => {
    if (!open || mode !== 'reschedule' || !booking) return;
    getAvailability(dates, booking.serviceCategory, duration)
      .then(setFull).catch(() => setFull({ fullDates: [], fullSlots: {} }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, booking?.id]);

  const times = booking && date
    ? generateTimeSlots(duration).filter(t => !(full.fullSlots[date] ?? []).includes(t))
    : [];

  const doReschedule = async () => {
    if (!booking || !date || !time) return;
    if (!online) { setError('You’re offline — reconnect to change this visit.'); return; }
    setBusy(true); setError(null);
    try {
      await rescheduleBooking(booking.id, date, time);
    } catch {
      if (!isDevUser(user?.uid)) { setError('That didn’t reach us - try again.'); setBusy(false); return; }
    }
    // optimistic - the live subscription confirms it for real users, dev seeds locally
    setBookings(bookings.map(b => b.id === booking.id ? { ...b, scheduledDate: date, scheduledTime: time } : b));
    onClose();
  };

  const doCancel = async () => {
    if (!booking) return;
    if (!online) { setError('You’re offline — reconnect to cancel this visit.'); return; }
    setBusy(true); setError(null);
    try {
      await cancelBooking(booking.id);
    } catch {
      if (!isDevUser(user?.uid)) { setError('That didn’t reach us - try again.'); setBusy(false); return; }
    }
    cancelBookingInStore(booking.id);
    onClose();
  };

  return (
    <StudioSheet open={open} onOpenChange={o => { if (!o) onClose(); }} label="Your visit">
      {booking ? (
        <div style={{ display: 'grid', gap: 24, paddingBottom: 8 }}>
          <Title>Your visit</Title>
          <IdentityPlate name={booking.vehicleName} registration={booking.vehicleRegNo} variant="row" />

          <div>
            <Body>{booking.serviceName}</Body>
            <Whisper as="p" style={{ marginTop: 'var(--st-hair)' }}>
              {fmtDayDate(booking.scheduledDate)} · {booking.scheduledTime}
            </Whisper>
          </div>

          {mode === 'idle' && (
            <div style={{ display: 'grid', gap: 'var(--st-line)', justifyItems: 'start' }}>
              <Action variant="forward" onClick={() => setMode('reschedule')}>Reschedule</Action>
              <Action variant="destructive" onClick={() => setMode('confirmCancel')}>Cancel this visit</Action>
            </div>
          )}

          {mode === 'reschedule' && (
            <>
              {/* the day */}
              <div>
                <Body tone="ink-2" style={{ marginBottom: 12 }}>A new day?</Body>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
                  {dates.map(d => {
                    const isFull = full.fullDates.includes(d);
                    const sel = d === date;
                    return (
                      <button key={d} disabled={isFull} onClick={() => { setDate(d); setTime(null); }}
                        style={{
                          flex: '0 0 auto', padding: '10px 14px', borderRadius: 12, border: 'none', cursor: isFull ? 'default' : 'pointer',
                          background: sel ? 'var(--st-linen)' : 'transparent', opacity: isFull ? 0.35 : 1,
                          fontFamily: 'var(--st-text)', fontSize: 14, color: 'var(--st-ink)', whiteSpace: 'nowrap',
                        }}>
                        {new Date(`${d}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* the time */}
              {date && (
                <div>
                  <Body tone="ink-2" style={{ marginBottom: 12 }}>At?</Body>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {times.length ? times.map(t => (
                      <button key={t} onClick={() => setTime(t)}
                        style={{
                          padding: '10px 14px', borderRadius: 12, border: 'none', cursor: 'pointer',
                          background: t === time ? 'var(--st-linen)' : 'transparent',
                          fontFamily: 'var(--st-text)', fontSize: 14, color: 'var(--st-ink)',
                        }}>{t}</button>
                    )) : <Whisper>No room that day - try another.</Whisper>}
                  </div>
                </div>
              )}

              {error && <Body tone="caution">{error}</Body>}

              {date && time && (
                <Action variant="primary" onClick={doReschedule} loading={busy}>
                  Move to {new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long' })} {time}
                </Action>
              )}
              <Action variant="quiet" onClick={() => { setMode('idle'); setDate(null); setTime(null); }}>
                Keep the current time
              </Action>
            </>
          )}

          {mode === 'confirmCancel' && (
            <>
              <Body tone="ink-2">
                Cancelling the {booking.vehicleName}’s visit frees the slot for someone else. This can’t be undone.
              </Body>
              {error && <Body tone="caution">{error}</Body>}
              <Action variant="destructive" onClick={doCancel} loading={busy}>Yes, cancel the visit</Action>
              <Action variant="quiet" onClick={() => setMode('idle')}>Keep it</Action>
            </>
          )}
        </div>
      ) : (
        <div style={{ paddingBottom: 8 }}>
          <Body tone="ink-2">There’s no visit to change right now.</Body>
        </div>
      )}
    </StudioSheet>
  );
}

/* The studio's answer, in the studio's voice. The Booking Service refuses in
   codes; a customer is owed a sentence. Anything unmapped falls back to the
   honest generic rather than leaking an identifier. */
const bookingError = (e: unknown): string => {
  const code = e instanceof Error ? e.message : '';
  switch (code) {
    case 'slot-taken':      return 'That time just went — pick another and we’ll hold it.';
    case 'slot-in-the-past':
    case 'not-a-slot':
    case 'bad-slot':        return 'That time isn’t one we can work. Pick another.';
    case 'service-not-offered':
    case 'unknown-service': return 'We’ve stopped offering that one. Choose another service.';
    case 'service-not-priced': return 'That service isn’t priced yet — call the studio and we’ll sort it.';
    case 'vehicle-not-yours': return 'We couldn’t find that car in your garage.';
    case 'not-signed-in':   return 'Sign in again and we’ll pick this up where you left it.';
    default:                return 'That didn’t reach us - try again.';
  }
};

/* ── the arrange sheet (design E1) - care is agreed, not filed. Three
   pre-answered questions. The sheet QUOTES a price; the Booking Service
   decides it and returns the record. A visit is born `pending`
   (= proposed); the studio confirms. ── */
function ArrangeSheet({
  open, vehicle, services, membership, prefillCat, onClose,
}: {
  open: boolean; vehicle: Vehicle; services: Service[];
  membership: Subscription | null; prefillCat: string | null; onClose: () => void;
}) {
  const { user, addBookingToStore } = useAppStore();
  const online = useOnline();
  const active = useMemo(() => services.filter(s => s.active !== false), [services]);
  // group the menu by category so it reads as a few objects, never a flat list
  const grouped = useMemo(() => {
    const m = new Map<string, Service[]>();
    active.forEach(s => { if (!m.has(s.category)) m.set(s.category, []); m.get(s.category)!.push(s); });
    return [...m.entries()];
  }, [active]);

  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [full, setFull] = useState<{ fullDates: string[]; fullSlots: Record<string, string[]> }>({ fullDates: [], fullSlots: {} });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* the discount this customer is actually owed - membership % or the best
     auto-applying promo, never stacked (lib/services/pricing) */
  const [discount, setDiscount] = useState<BookingDiscount | undefined>();

  const dates = useMemo(() => getAvailableDates(), []);

  // reset + prefill each time the sheet opens
  useEffect(() => {
    if (!open) return;
    setError(null); setDate(null); setTime(null); setBusy(false);
    const pick = prefillCat ? active.find(s => s.category === prefillCat) ?? null : null;
    setService(pick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefillCat]);

  // availability for the chosen service (degrades to all-open when unauthorised)
  useEffect(() => {
    if (!open || !service) return;
    getAvailability(dates, service.category, service.duration)
      .then(setFull).catch(() => setFull({ fullDates: [], fullSlots: {} }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, service?.id]);

  const washCovered = !!service && service.category === 'Washing' && !!membership
    && membership.status === 'active' && (membership.washesTotal - membership.washesUsed) > 0;

  /* WHAT THIS WILL COST - a QUOTE, not a decision.
     Same pure engine the counter and the server use, so the number shown here
     is the number the Booking Service will reach. But it is only shown: the
     server prices the visit from the catalogue when it creates it, and if the
     owner has changed a price in the meantime the server's figure is the real
     one. Nothing computed in this browser is ever written. */
  useEffect(() => {
    if (!open || !service || !user || washCovered) { setDiscount(undefined); return; }
    let live = true;
    (async () => {
      const today = new Date().toISOString().split('T')[0];
      const activeMember = membership?.status === 'active' && membership.endDate >= today
        ? membership : null;

      /* The promo lookup is a network read and may fail; the MEMBERSHIP
         discount is already in hand and must never depend on it. Wrapping
         both in one try meant a Firestore hiccup silently quoted a member
         full price - the exact overcharge this item exists to remove. */
      let eligible: Awaited<ReturnType<typeof getEligiblePromos>> = [];
      try {
        eligible = await getEligiblePromos(
          { serviceId: service.id, category: service.category, userId: user.uid, date: today },
          { autoApplyOnly: true },
        );
      } catch { /* no promos reachable - the membership still stands */ }

      const best = computeBestDiscount({
        price: service.price,
        membershipPlan: activeMember?.plan ?? null,
        eligiblePromos: eligible,
      });
      if (live) setDiscount(best);
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, service?.id, user?.uid, washCovered, membership?.id]);

  const total = washCovered ? 0 : applyDiscount(service?.price ?? 0, discount);

  const times = service && date
    ? generateTimeSlots(service.duration).filter(t => !(full.fullSlots[date] ?? []).includes(t))
    : [];

  /* One key per selection. A retry of the same car+service+slot returns the
     booking that already exists instead of making a second one; changing the
     selection is a new intent and gets a new key. */
  const idemRef = useRef<{ sig: string; key: string } | null>(null);
  const idempotencyKey = () => {
    const sig = `${vehicle.id}|${service?.id}|${date}|${time}`;
    if (idemRef.current?.sig !== sig) {
      idemRef.current = {
        sig,
        key: (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)
          .replace(/[^A-Za-z0-9_-]/g, ''),
      };
    }
    return idemRef.current.key;
  };

  const confirm = async () => {
    if (!user || !service || !date || !time) return;
    if (!online) { setError('You’re offline — reconnect to arrange this visit.'); return; }
    setBusy(true); setError(null);
    try {
      // intent only - the studio decides the price and returns the record
      const booking = await requestBooking({
        vehicleId: vehicle.id,
        serviceId: service.id,
        scheduledDate: date,
        scheduledTime: time,
        useMembershipWash: washCovered,
        idempotencyKey: idempotencyKey(),
      });
      addBookingToStore(booking);
    } catch (e) {
      if (isDevUser(user.uid)) {
        // the dev shim has no studio behind it; keep the flow walkable
        const now = Timestamp.now();
        addBookingToStore({
          id: `dev-${Date.now()}`, userId: user.uid, userName: user.name,
          userPhone: user.phone || '', userEmail: user.email,
          vehicleId: vehicle.id, vehicleName: vehicle.name, vehicleRegNo: vehicle.registrationNumber,
          serviceId: service.id, serviceName: service.name, serviceCategory: service.category,
          serviceBasePrice: service.price, serviceDurationMinutes: service.duration,
          pickupDropRequired: false, pickupRequired: false, dropRequired: false,
          pickupDropFee: 0, pickupAddress: '', totalAmount: total,
          scheduledDate: date, scheduledTime: time, status: 'pending',
          paymentMethod: 'cash', paymentStatus: 'pending', transactionId: '',
          usedMembershipWash: washCovered, discount,
          createdAt: now, updatedAt: now,
        } as Booking);
      } else {
        setError(bookingError(e));
        setBusy(false);
        return;
      }
    }
    onClose();
  };

  return (
    <StudioSheet open={open} onOpenChange={o => { if (!o) onClose(); }} label="Arrange a visit">
      <div style={{ display: 'grid', gap: 24, paddingBottom: 8 }}>
        {/* the car this visit belongs to - a large object, not a white plate */}
        <div>
          <span style={{
            fontFamily: 'var(--st-data)', fontSize: 11, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--st-ink-3)',
          }}>Arrange · {vehicle.registrationNumber}</span>
          <p style={{
            margin: '6px 0 0', fontFamily: 'var(--st-display)', fontWeight: 660, letterSpacing: '-0.03em',
            fontSize: 'clamp(34px, 11vw, 52px)', lineHeight: 0.95, color: 'var(--st-ink)',
          }}>
            {vehicle.name}
          </p>
        </div>

        {/* 1 · the care - grouped under large category objects, not a flat list */}
        {!service ? (
          <div style={{ display: 'grid', gap: 'var(--st-rest)' }}>
            {grouped.map(([cat, items]) => (
              <div key={cat}>
                <span style={{
                  display: 'block', marginBottom: 'var(--st-gap)',
                  fontFamily: 'var(--st-display)', fontWeight: 600, letterSpacing: '-0.01em',
                  fontSize: 'clamp(22px, 6vw, 28px)', color: 'var(--st-ink)',
                }}>{cat}</span>
                <div style={{ display: 'grid', gap: 'var(--st-gap)' }}>
                  {items.map(s => (
                    <button key={s.id} onClick={() => setService(s)} className="st-tap"
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--st-gap)', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                      <Body style={{ fontSize: 19, color: 'var(--st-ink-2)' }}>{s.name}</Body>
                      <Data tone="ink-3">from ₹{s.price.toLocaleString('en-IN')}</Data>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <button onClick={() => { setService(null); setDate(null); setTime(null); }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', background: 'var(--st-gallery)', borderRadius: 16, padding: 16, width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <Body>{service.name}</Body>
              <Data tone="ink-3">change</Data>
            </button>

            {/* 2 · the day */}
            <div>
              <Body tone="ink-2" style={{ marginBottom: 12 }}>When suits you?</Body>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
                {dates.map(d => {
                  const isFull = full.fullDates.includes(d);
                  const sel = d === date;
                  return (
                    <button key={d} disabled={isFull} onClick={() => { setDate(d); setTime(null); }}
                      style={{
                        flex: '0 0 auto', padding: '10px 14px', borderRadius: 12, border: 'none', cursor: isFull ? 'default' : 'pointer',
                        background: sel ? 'var(--st-linen)' : 'transparent', opacity: isFull ? 0.35 : 1,
                        fontFamily: 'var(--st-text)', fontSize: 14, color: 'var(--st-ink)', whiteSpace: 'nowrap',
                      }}>
                      {new Date(`${d}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3 · the time */}
            {date && (
              <div>
                <Body tone="ink-2" style={{ marginBottom: 12 }}>At?</Body>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {times.length ? times.map(t => (
                    <button key={t} onClick={() => setTime(t)}
                      style={{
                        padding: '10px 14px', borderRadius: 12, border: 'none', cursor: 'pointer',
                        background: t === time ? 'var(--st-linen)' : 'transparent',
                        fontFamily: 'var(--st-text)', fontSize: 14, color: 'var(--st-ink)',
                      }}>{t}</button>
                  )) : <Whisper>No room that day - try another.</Whisper>}
                </div>
              </div>
            )}

            {/* the price, and WHY it is that price. A number that quietly
                drops is as untrustworthy as one that quietly rises. */}
            {!washCovered && service && (
              <div style={{ display: 'grid', gap: 'var(--st-hair)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--st-gap)' }}>
                  <Body tone="ink-2">{discount ? discount.label : 'Total'}</Body>
                  <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
                    {discount && (
                      <Data tone="ink-3" style={{ textDecoration: 'line-through' }}>
                        ₹{service.price.toLocaleString('en-IN')}
                      </Data>
                    )}
                    <Data tone="ink" style={{ fontSize: 18 }}>₹{total.toLocaleString('en-IN')}</Data>
                  </span>
                </div>
              </div>
            )}

            {error && <Body tone="caution">{error}</Body>}

            {date && time && (
              <Action variant="primary" onClick={confirm} loading={busy}>
                {washCovered
                  ? `Confirm ${new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long' })} ${time} · covered by the Club`
                  : `Confirm ${new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long' })} ${time}`}
              </Action>
            )}
          </>
        )}
      </div>
    </StudioSheet>
  );
}
