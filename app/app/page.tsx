'use client';
/**
 * The Glance - `/app` (Product Design Part B). One vertical composition:
 * portrait region → Now → Protection → The story → Papers → The Club →
 * signature. Layers render only when true (silence law). The Capsule is
 * the only fixed element. Vehicle switching is a horizontal pager; the
 * last page is the add-a-car invitation.
 *
 * Interim targets (tracked; each dies with its phase):
 *   TODO(P6): "Have a look" → join-club sheet (interim: legacy club page)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useAppStore } from '@/lib/store';
import {
  getServices, getJobsForCustomer, getUserSubscription,
  updateUserProfile, logoutUser, STATIC_SERVICES,
  createBooking, getAvailability,
} from '@/lib/firebaseService';
import { cancelBooking, rescheduleBooking } from '@/lib/services/bookings';
import { generateTimeSlots, getAvailableDates } from '@/lib/utils';
import type { Booking, Job, Service, Subscription, Vehicle } from '@/lib/types';
import { truthOf, type ProtectionFact } from '@/lib/os/truth';
import { visitPhase, careAct, ACT_TITLE, PHASE_LINE } from '@/lib/os/visit';
import { daysLeft } from '@/lib/os/term';
import { proposalFor } from '@/lib/os/proposal';
import { papersFor } from '@/lib/os/papers';
import { clubModel } from '@/lib/os/club';
import { conciergeLog } from '@/lib/os/log';
import { deriveProtection, PROTECTION_WORD, type Protection } from '@/lib/cx/protection';
import { isDevUser, DEV_JOBS, DEV_MEMBERSHIP } from '@/lib/cx/devseed';
import Portrait from '@/components/os/Portrait';
import IdentityPlate, { plateSurface } from '@/components/os/IdentityPlate';
import StudioIntro from '@/components/os/StudioIntro';
import CoachMark, { markCoachSeen } from '@/components/os/CoachMark';
import JoinClub from '@/components/os/JoinClub';
import CarForm from '@/components/os/CarForm';
import { markWelcomed, hasBeenWelcomed } from '@/lib/os/welcome';
import { useOnline } from '@/components/os/useOnline';
import Capsule from '@/components/os/Capsule';
import Layer from '@/components/os/Layer';
import ProtectionRecord from '@/components/os/ProtectionRecord';
import DocumentCard, { DocumentGrid } from '@/components/os/DocumentCard';
import MomentEntry from '@/components/os/MomentEntry';
import MemberCard from '@/components/os/MemberCard';
import Desk, { type ShelfRow, type ThreadVisit, type SearchItem } from '@/components/os/Desk';
import StudioSheet from '@/components/os/StudioSheet';
import Field from '@/components/os/Field';
import Action from '@/components/os/Action';
import Chip from '@/components/os/Chip';
import EmptyState from '@/components/os/EmptyState';
import { Display, DisplayLarge, Title, Emphasis, Body, Data, Whisper } from '@/components/os/text';
import { COMPANY } from '@/lib/company';

const fmtLong = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtMonthYear = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const fmtDayDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

/** The visit a protection came from - its photograph, its craftsman, its Chapter. */
function protectionSource(
  model: { visits: Booking[]; jobByBooking: Map<string, Job> },
  p: Protection,
): { bookingId?: string; photo?: string; installer?: string | null } {
  const source = model.visits.find(
    v => v.serviceName === p.service && visitPhase(v.status) === 'archived',
  );
  if (!source) return {};
  const job = model.jobByBooking.get(source.id);
  return {
    bookingId: source.id,
    photo: job?.photos?.find(x => x.kind === 'after')?.url,
    installer: job?.assignments?.filter(a => !a.removedAt).find(a => a.role === 'lead')?.employeeName ?? null,
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
  const params = useSearchParams();
  const { user, vehicles, bookings } = useAppStore();

  const [services, setServices] = useState<Service[]>(STATIC_SERVICES);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [membership, setMembership] = useState<Subscription | null>(null);
  const [page, setPage] = useState(0);
  const pagerRef = useRef<HTMLDivElement>(null);

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
  const [showAllStory, setShowAllStory] = useState(false);

  // the story summarises to its most recent chapters; the rest reveal on demand
  const STORY_PREVIEW = 3;

  const openCarForm = (v?: Vehicle) =>
    router.replace(`/app?sheet=car-form${v ? `&car-id=${v.id}` : ''}`);

  /* a first authenticated open with an empty garage belongs to the welcome;
     a customer who skipped the car keeps the garage invitation instead */
  useEffect(() => {
    if (!user || vehicles.length > 0) return;
    if (!hasBeenWelcomed()) router.replace('/app/welcome');
  }, [user, vehicles.length, router]);

  // a garage with a car in it has met the welcome
  useEffect(() => { if (vehicles.length > 0) markWelcomed(); }, [vehicles.length]);

  // reaching the Desk *is* the lesson - the nudge retires the moment it opens
  useEffect(() => { if (deskOpen) markCoachSeen(); }, [deskOpen]);

  useEffect(() => { getServices().then(setServices).catch(() => {}); }, []);
  useEffect(() => {
    if (!user) return;
    if (isDevUser(user.uid)) { setJobs(Object.values(DEV_JOBS)); setMembership(DEV_MEMBERSHIP); return; }
    getJobsForCustomer(user.uid).then(setJobs).catch(() => setJobs([]));
    getUserSubscription(user.uid)
      .then(s => setMembership(s ?? null)).catch(() => setMembership(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // ?car= deep link → pager position
  useEffect(() => {
    const carId = params.get('car');
    if (!carId) return;
    const i = vehicles.findIndex(v => v.id === carId);
    if (i >= 0) {
      setPage(i);
      pagerRef.current?.scrollTo({ left: i * (pagerRef.current?.clientWidth ?? 0) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles.length]);

  const vehicle: Vehicle | null = vehicles[Math.min(page, vehicles.length - 1)] ?? null;
  const onAddPage = vehicles.length > 0 && page >= vehicles.length;

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
    const jobByBooking = new Map(jobs.filter(j => j.bookingId).map(j => [j.bookingId!, j]));
    // one open proposal per vehicle - suppressed while a visit is already in flight
    const proposal = (live || agreed) ? null : proposalFor({
      vehicleId: vehicle.id, protections, lastCaredOn: completed[0]?.scheduledDate,
    });
    return {
      visits, completed, protections, live, agreed, jobByBooking, proposal,
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

  /* this customer's own wash cadence - the join sheet's honest arithmetic */
  const washHistory = useMemo(
    () => bookings
      .filter(b => visitPhase(b.status) === 'archived' && b.serviceCategory === 'Washing')
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate)),
    [bookings],
  );

  /* the car's own papers - warranties that still protect, receipts that exist */
  const papers = useMemo(
    () => (model ? papersFor({ completed: model.completed, protections: model.protections }) : []),
    [model],
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

  /* ── capsule state (design B2) ── */
  const capsule = useMemo<{ line: string; tap: () => void; actionWord?: string; onAction?: () => void; ready?: boolean }>(() => {
    // quiet state (line: '') opens the Desk - the concierge's index
    if (!model || !vehicle) return { line: '', tap: () => router.replace('/app?sheet=desk') };
    const modelWord = vehicle.name;
    if (model.live) {
      const act = careAct(model.live.status);
      // the capsule is the Stay's glass live header: it carries the act and
      // taps straight back into it
      if (act === 'ready') {
        return { line: `The ${modelWord} is ready.`, ready: true, tap: () => router.push(`/app/visit/${model.live!.id}`) };
      }
      return {
        line: act ? `${ACT_TITLE[act]} - the ${modelWord} is with us.` : 'In the studio.',
        tap: () => router.push(`/app/visit/${model.live!.id}`),
      };
    }
    if (model.agreed) {
      // a just-arranged visit is `proposed` (pending) until the studio confirms
      const stateWord = visitPhase(model.agreed.status) === 'agreed' ? 'confirmed' : 'requested';
      return {
        line: `${fmtDay(model.agreed.scheduledDate)} ${model.agreed.scheduledTime} · ${stateWord}`,
        tap: () => router.replace('/app?sheet=desk'),
      };
    }
    if (model.proposal) {
      return {
        line: model.proposal.headline,
        actionWord: 'Yes',
        onAction: () => router.replace(`/app?sheet=arrange&cat=${model.proposal!.serviceCategory}`),
        tap: () => router.replace('/app?sheet=desk'),
      };
    }
    return { line: '', tap: () => router.replace('/app?sheet=desk') }; // quiet → Desk
  }, [model, vehicle, router]);

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
      router.push(visitPhase(b.status) === 'live' ? `/app/visit/${b.id}` : `/app/chapter/${b.id}`);
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
        onTap: () => router.push(`/app/chapter/${b.id}`),
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

  if (!user) return null;

  /* an empty garage: the invitation is the whole Glance (a customer who met
     the welcome and chose to add the car later) */
  if (vehicles.length === 0) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <AddCarInvitation onAdd={() => openCarForm()} full />
        <YouSheet open={youOpen} onClose={() => router.replace('/app')} />
        <CarFormSheet open={carFormOpen} editing={null} onClose={() => router.replace('/app')} />
      </div>
    );
  }

  return (
    <div>
      {/* ── portrait pager ── */}
      <div
        ref={pagerRef}
        onScroll={e => {
          const el = e.currentTarget;
          const next = Math.round(el.scrollLeft / el.clientWidth);
          if (next !== page) { setPage(next); setShowAllStory(false); }
        }}
        style={{
          display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
        }}
      >
        {vehicles.map(v => (
          <div key={v.id} style={{ minWidth: '100%', scrollSnapAlign: 'start' }}>
            <Portrait
              name={v.name}
              plate={v.registrationNumber}
              photo={v.photo}
              truth={v.id === vehicle?.id && model ? model.truth : ''}
              minHeight="92vh"
            >
              {/* avatar → you sheet */}
              <button
                onClick={() => router.replace('/app?sheet=you')}
                aria-label="You"
                className="st-tap"
                style={{
                  position: 'absolute', top: 'calc(env(safe-area-inset-top) + 16px)', right: 24,
                  width: 36, height: 36, borderRadius: 999, border: 'none', cursor: 'pointer',
                  background: 'var(--st-linen)', color: 'var(--st-ink)',
                  fontFamily: 'var(--st-text)', fontWeight: 520, fontSize: 14, zIndex: 2,
                }}
              >
                {user.name?.charAt(0).toUpperCase() || 'Y'}
              </button>

              {/* page dots - only when vehicles ≥ 2 (◆R4) */}
              {vehicles.length >= 2 && (
                <div aria-hidden style={{
                  position: 'absolute', bottom: 96, left: 0, right: 0,
                  display: 'flex', justifyContent: 'center', gap: 8, zIndex: 2,
                }}>
                  {[...vehicles, null].map((_, i) => (
                    <span key={i} style={{
                      width: 4, height: 4, borderRadius: 999,
                      background: i === page ? 'var(--st-portrait-fg)' : 'var(--st-portrait-fg-2)',
                    }} />
                  ))}
                </div>
              )}
            </Portrait>
          </div>
        ))}
        {/* last page: add-a-car (◆R14) */}
        <div style={{ minWidth: '100%', scrollSnapAlign: 'start' }}>
          <AddCarInvitation onAdd={() => openCarForm()} />
        </div>
      </div>

      {/* ── layers for the visible vehicle ── */}
      {!onAddPage && vehicle && model && (
        <div style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + var(--st-movement))' }}>

          {/* B3 · Now - the next thing for this car. An agreed visit takes the
              floor; otherwise the studio's one standing suggestion (live lives
              in the capsule until P3). The two are mutually exclusive. */}
          {model.agreed ? (
            <Layer>
              {/* the focus card - the single most important thing after the
                  hero: the visit as an object, its status read at a glance
                  (UX-1). Object-first: the day is the hero, not a sentence. */}
              {(() => {
                const confirmed = visitPhase(model.agreed.status) === 'agreed';
                return (
                  <div style={{
                    background: 'var(--st-card-fill)', border: '1px solid var(--st-hairline)',
                    borderRadius: 'var(--st-r-sheet)', boxShadow: 'var(--st-raise), var(--st-edge)',
                    padding: 'var(--st-inset)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--st-gap)' }}>
                      <Whisper as="p">{confirmed ? 'Your next visit' : 'Requested'}</Whisper>
                      <Chip tone={confirmed ? 'ok' : 'neutral'}>{confirmed ? 'Confirmed' : 'Requested'}</Chip>
                    </div>
                    <DisplayLarge style={{ marginTop: 'var(--st-line)', fontSize: 'clamp(28px, 8vw, 40px)' }}>
                      {fmtDayDate(model.agreed.scheduledDate)}
                    </DisplayLarge>
                    <Data tone="ink-2" style={{ display: 'block', marginTop: 'var(--st-hair)', fontSize: 15 }}>
                      {model.agreed.scheduledTime}
                    </Data>
                    <div style={{ marginTop: 'var(--st-inset)', paddingTop: 'var(--st-gap)', borderTop: '1px solid var(--st-hairline)' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--st-gap)' }}>
                        <Body tone="ink-2">
                          {model.agreed.serviceName}
                          {model.agreed.paymentMethod === 'cash' ? ' · pay at the studio' : ''}
                        </Body>
                        <Data>₹{model.agreed.totalAmount.toLocaleString('en-IN')}</Data>
                      </div>
                      {!confirmed && (
                        <Whisper as="p" style={{ marginTop: 'var(--st-breath)' }}>{PHASE_LINE.proposed}</Whisper>
                      )}
                    </div>
                    <div style={{ marginTop: 'var(--st-line)' }}>
                      <Action variant="quiet" onClick={() => router.replace('/app?sheet=manage')}>Change or cancel</Action>
                    </div>
                  </div>
                );
              })()}
            </Layer>
          ) : model.proposal ? (
            <Layer>
              <div style={{
                background: 'var(--st-card-fill)', border: '1px solid var(--st-hairline)',
                borderRadius: 'var(--st-r-sheet)', boxShadow: 'var(--st-raise), var(--st-edge)',
                padding: 'var(--st-inset)',
              }}>
                <Whisper as="p" style={{ marginBottom: 'var(--st-line)' }}>A suggestion from the studio</Whisper>
                <Emphasis>{model.proposal.reason}</Emphasis>
                <div style={{ marginTop: 'var(--st-inset)' }}>
                  <Action variant="forward"
                    onClick={() => router.replace(`/app?sheet=arrange&cat=${model.proposal!.serviceCategory}`)}>
                    Arrange it
                  </Action>
                </div>
              </div>
            </Layer>
          ) : null}

          {/* B3.5 · The studio - trust before there is a story of their own.
              Leaves for good once the first visit is completed (◆audit #2). */}
          {model.completed.length === 0 && (
            <Layer title="The studio">
              <StudioIntro />
            </Layer>
          )}

          {/* B4 · Protection - one record per layer, told by the protection
              engine; renewal appears only when the studio's proposal cites it */}
          {model.protections.length > 0 ? (
            <Layer
              title="Protection"
              action={model.protections.length > 1
                ? { label: 'All protection', onClick: () => router.replace('/app?focus=protection') }
                : undefined}
            >
              <div style={{ display: 'grid', gap: 'var(--st-rest)' }}>
                {model.protections.map(p => {
                  const src = protectionSource(model, p);
                  return (
                    <ProtectionRecord
                      key={p.kind}
                      protection={p}
                      vehicleName={vehicle.name}
                      daysLeft={p.until ? daysLeft(p.until.toISOString().split('T')[0]) : null}
                      photo={src.photo}
                      installer={src.installer}
                      onOpenChapter={src.bookingId ? () => router.push(`/app/chapter/${src.bookingId}`) : undefined}
                      onRenew={model.proposal?.serviceCategory === p.kind
                        ? () => router.replace(`/app?sheet=arrange&cat=${p.kind}`)
                        : undefined}
                    />
                  );
                })}
              </div>
            </Layer>
          ) : model.completed.length > 0 ? (
            /* the car has a story but nothing shields it - say so plainly */
            <Layer title="Protection">
              <EmptyState
                line={`Nothing protects the ${vehicle.name} yet.`}
                actionLabel={model.proposal ? 'Arrange it' : undefined}
                onAction={model.proposal
                  ? () => router.replace(`/app?sheet=arrange&cat=${model.proposal!.serviceCategory}`)
                  : undefined}
              />
            </Layer>
          ) : null}

          {/* B5 · The story */}
          <Layer title="The story">
            {model.completed.length === 0 ? (
              <EmptyState
                line={`The ${vehicle.name}’s story starts with its first visit.`}
                actionLabel="Arrange one"
                onAction={() => router.replace('/app?sheet=arrange')}
              />
            ) : (
              <div style={{ display: 'grid', gap: 'var(--st-rest)' }}>
                {(showAllStory ? model.completed : model.completed.slice(0, STORY_PREVIEW)).map(b => {
                  const job = model.jobByBooking.get(b.id);
                  const photos = job?.photos ?? [];
                  const best = photos.find(x => x.kind === 'after') ?? photos[0];
                  const tech = job?.assignments?.filter(a => !a.removedAt && a.role === 'lead')[0]?.employeeName;
                  return (
                    <MomentEntry
                      key={b.id}
                      photo={best?.url}
                      caption={`${b.serviceName} · ${fmtLong(b.scheduledDate)}`}
                      whisper={best
                        ? `${photos.length} photo${photos.length === 1 ? '' : 's'}${tech ? ` · ${tech}` : ''}`
                        : `₹${b.totalAmount.toLocaleString('en-IN')}`}
                      onTap={() => router.push(`/app/chapter/${b.id}`)}
                    />
                  );
                })}
                {!showAllStory && model.completed.length > STORY_PREVIEW && (
                  <Action variant="quiet" onClick={() => setShowAllStory(true)}>
                    Show earlier visits ({model.completed.length - STORY_PREVIEW})
                  </Action>
                )}
              </div>
            )}
          </Layer>

          {/* B6 · Papers - the vault. The plate is the permanent header; each
              paper opens the Chapter that holds it (no second record). */}
          <Layer title="Papers">
            <IdentityPlate
              name={vehicle.name}
              registration={vehicle.registrationNumber}
              variant="row"
            />
            {papers.length > 0 && (
              <div style={{ marginTop: 'var(--st-inset)' }}>
                <DocumentGrid>
                  {papers.map(paper => (
                    <DocumentCard
                      key={paper.id}
                      title={paper.title}
                      detail={paper.detail}
                      onOpen={() => router.push(`/app/chapter/${paper.bookingId}`)}
                    />
                  ))}
                </DocumentGrid>
              </div>
            )}
            <div style={{ marginTop: 'var(--st-inset)' }}>
              <Action variant="quiet" onClick={() => openCarForm(vehicle)}>Edit details</Action>
            </div>
          </Layer>

          {/* B7 · The Club - the relationship, told by the club model. The
              card is the object; one true line sits under it. */}
          {(club.state !== 'none' || club.invited) && (
            <Layer title="The Club">
              {club.state !== 'none' ? (
                <div>
                  <MemberCard
                    name={user.name}
                    tier={`Club · since ${fmtMonthYear(club.since!)}`}
                    since={club.plan!}
                    state={club.state === 'pending' ? 'pending'
                      : club.state === 'lapsed' ? 'lapsed' : 'active'}
                  />
                  {club.context && (
                    <Body tone="ink-2" style={{ marginTop: 'var(--st-gap)' }}>{club.context}</Body>
                  )}
                  {(club.state === 'lapsed' || club.state === 'grace') && (
                    <div style={{ marginTop: 'var(--st-breath)' }}>
                      <Action variant="forward" onClick={() => router.replace('/app?sheet=join-club')}>
                        {club.state === 'grace' ? 'Renew' : 'Rejoin'}
                      </Action>
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState
                  line={`You wash often. The Club would suit the ${vehicle.name}.`}
                  actionLabel="Have a look"
                  onAction={() => router.replace('/app?sheet=join-club')}
                />
              )}

              <div style={{ marginTop: 'var(--st-rest)' }}>
                <Body>A friend’s first detail is on us.</Body>
                <div style={{ marginTop: 'var(--st-breath)' }}>
                  <Action variant="quiet" onClick={() => {
                    const url = typeof window !== 'undefined' ? window.location.origin : '';
                    if (navigator.share) navigator.share({ text: `My car lives at AutoModz - first detail's on me. ${url}` }).catch(() => {});
                  }}>Share</Action>
                </div>
              </div>
            </Layer>
          )}

          {/* the signature - the dossier closes on a hairline, then the mark */}
          <div style={{ marginTop: 'var(--st-movement)', padding: '0 var(--st-inset)' }}>
            <div aria-hidden style={{ height: 1, background: 'var(--st-hairline)', marginBottom: 'var(--st-rest)' }} />
            <Whisper style={{ fontFamily: 'var(--st-display)', letterSpacing: '0.08em', display: 'block' }}>AUTOMODZ</Whisper>
            <Data tone="ink-3" style={{ fontSize: 14, display: 'block', marginTop: 'var(--st-breath)' }}>{COMPANY.address}</Data>
            <div style={{ marginTop: 'var(--st-line)' }}>
              <Action variant="forward" onClick={() => router.replace('/app?sheet=desk')}>
                Message the studio
              </Action>
            </div>
          </div>
        </div>
      )}

      {/* the one-time nudge at the capsule - never over a sheet (◆audit #5) */}
      <CoachMark show={!deskOpen && !arrangeOpen && !youOpen && !carFormOpen && !protectionOpen && !joinClubOpen} />

      <Capsule
        line={capsule.line}
        actionWord={capsule.actionWord}
        onActionTap={capsule.onAction}
        onTap={capsule.tap}
        onPhoto={false}
        ready={capsule.ready}
      />

      {/* the protection panel - the Desk's focus reading of every layer (§C6) */}
      <StudioSheet open={protectionOpen} onOpenChange={o => { if (!o) router.replace('/app'); }} label="Protection">
        {vehicle && model && (
          <div style={{ display: 'grid', gap: 'var(--st-rest)', paddingBottom: 'var(--st-breath)' }}>
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
                  installer={src.installer}
                  onOpenChapter={src.bookingId ? () => router.push(`/app/chapter/${src.bookingId}`) : undefined}
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

      <YouSheet open={youOpen} onClose={() => router.replace('/app')} />
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
function AddCarInvitation({ onAdd, full = false }: { onAdd: () => void; full?: boolean }) {
  return (
    <div style={{
      ...plateSurface,
      minWidth: '100%', minHeight: full ? '100vh' : '92vh',
      scrollSnapAlign: 'start',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 12, padding: 24, textAlign: 'center',
    }}>
      <Display>{full ? 'Welcome to AutoModz.' : 'Another car?'}</Display>
      <Body tone="ink-2">The garage has room.</Body>
      <div style={{ marginTop: 24 }}>
        <Action onClick={onAdd}>Add a car</Action>
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

/* ── the You sheet (design E1) ── */
function YouSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { user, setUser } = useAppStore();
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [installEvent, setInstallEvent] = useState<Event | null>(null);

  useEffect(() => { setName(user?.name ?? ''); setPhone(user?.phone ?? ''); }, [user?.uid, open]);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvent(e); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const prefs = {
    whatsapp: true, serviceReminders: true, membershipReminders: true, promotions: true,
    ...(user?.notificationPrefs ?? {}),
  };

  const save = async () => {
    if (!user) return;
    const dirty = name !== user.name || phone !== (user.phone ?? '');
    if (dirty && name.trim()) {
      setUser({ ...user, name: name.trim(), phone: phone.trim() });
      try { await updateUserProfile(user.uid, { name: name.trim(), phone: phone.trim() }); } catch {}
    }
    onClose();
  };

  const togglePref = async (key: keyof typeof prefs) => {
    if (!user) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setUser({ ...user, notificationPrefs: next });
    try { await updateUserProfile(user.uid, { notificationPrefs: next }); } catch {}
  };

  const rows: { key: keyof typeof prefs; line: string }[] = [
    { key: 'whatsapp',            line: 'Message me on WhatsApp about my visits.' },
    { key: 'serviceReminders',    line: 'Tell me when the car’s care is due.' },
    { key: 'membershipReminders', line: 'Tell me about my membership.' },
    { key: 'promotions',          line: 'Occasionally, a word about offers.' },
  ];

  return (
    <StudioSheet open={open} onOpenChange={o => { if (!o) save(); }} label="You">
      <div style={{ display: 'grid', gap: 24, paddingBottom: 8 }}>
        <Title>You</Title>

        <Field label="Name" value={name} onChange={setName} />
        <Field label="Phone" value={phone} onChange={setPhone} kind="phone" />

        <div>
          <Body tone="ink-2" style={{ marginBottom: 12 }}>Notifications</Body>
          <div style={{ display: 'grid', gap: 16 }}>
            {rows.map(r => (
              <label key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}>
                <span style={{ flex: 1 }}><Body>{r.line}</Body></span>
                <input
                  type="checkbox"
                  checked={prefs[r.key]}
                  onChange={() => togglePref(r.key)}
                  style={{ width: 44, height: 24, accentColor: 'var(--st-ink)' }}
                />
              </label>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ flex: 1 }}><Body>Message me while the car’s in care.</Body></span>
              <Whisper>Always - it’s your car.</Whisper>
            </div>
          </div>
        </div>

        {installEvent && (
          <Action variant="quiet" onClick={() => (installEvent as { prompt?: () => void }).prompt?.()}>
            Install AutoModz
          </Action>
        )}

        <Action variant="quiet" onClick={async () => { await logoutUser(); router.replace('/auth/login'); }}>
          Sign out
        </Action>
      </div>
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

/* ── the arrange sheet (design E1) - care is agreed, not filed. Three
   pre-answered questions; reuses the booking engine (createBooking +
   availability + membership-wash) untouched. A visit is born `pending`
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

  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [full, setFull] = useState<{ fullDates: string[]; fullSlots: Record<string, string[]> }>({ fullDates: [], fullSlots: {} });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const total = washCovered ? 0 : (service?.price ?? 0);

  const times = service && date
    ? generateTimeSlots(service.duration).filter(t => !(full.fullSlots[date] ?? []).includes(t))
    : [];

  const confirm = async () => {
    if (!user || !service || !date || !time) return;
    if (!online) { setError('You’re offline — reconnect to arrange this visit.'); return; }
    setBusy(true); setError(null);
    const now = Timestamp.now();
    const payload: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'> = {
      userId: user.uid, userName: user.name, userPhone: user.phone || '', userEmail: user.email,
      vehicleId: vehicle.id, vehicleName: vehicle.name, vehicleRegNo: vehicle.registrationNumber,
      serviceId: service.id, serviceName: service.name, serviceCategory: service.category,
      serviceBasePrice: service.price, serviceDurationMinutes: service.duration,
      pickupDropRequired: false, pickupRequired: false, dropRequired: false, pickupDropFee: 0, pickupAddress: '',
      totalAmount: total, scheduledDate: date, scheduledTime: time,
      status: 'pending', paymentMethod: 'cash', paymentStatus: 'pending', transactionId: '',
      usedMembershipWash: washCovered, membershipId: washCovered ? membership!.id : undefined,
    };
    try {
      const id = await createBooking(payload);
      addBookingToStore({ ...payload, id, createdAt: now, updatedAt: now });
    } catch {
      if (isDevUser(user.uid)) addBookingToStore({ ...payload, id: `dev-${Date.now()}`, createdAt: now, updatedAt: now });
      else { setError('That didn’t reach us - try again.'); setBusy(false); return; }
    }
    onClose();
  };

  return (
    <StudioSheet open={open} onOpenChange={o => { if (!o) onClose(); }} label="Arrange a visit">
      <div style={{ display: 'grid', gap: 24, paddingBottom: 8 }}>
        <Title>Arrange a visit</Title>
        {/* the car this visit belongs to, in the plate's own language - it
            stays in view for every step, so the answer is never a guess */}
        <IdentityPlate
          name={vehicle.name}
          registration={vehicle.registrationNumber}
          variant="row"
        />

        {/* 1 · the care */}
        {!service ? (
          <div style={{ display: 'grid', gap: 16 }}>
            {active.map(s => (
              <button key={s.id} onClick={() => setService(s)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                <Body style={{ fontSize: 19 }}>{s.name}</Body>
                <Data>from ₹{s.price.toLocaleString('en-IN')}</Data>
              </button>
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
