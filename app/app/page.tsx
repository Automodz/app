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
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useAppStore } from '@/lib/store';
import { useStudioRouter } from '@/lib/os/navigate';
import {
  getServices, getJobsForCustomer, getUserSubscription,
  updateUserProfile, logoutUser, STATIC_SERVICES,
  createBooking, getAvailability,
} from '@/lib/firebaseService';
import { cancelBooking, rescheduleBooking } from '@/lib/services/bookings';
import { enablePush, disablePush, pushEnabled, pushSupported } from '@/lib/services/push';
import { generateTimeSlots, getAvailableDates } from '@/lib/utils';
import type { Booking, Job, Service, Subscription, Vehicle } from '@/lib/types';
import { truthOf, type ProtectionFact } from '@/lib/os/truth';
import { visitPhase, careAct, ACT_TITLE, PHASE_LINE } from '@/lib/os/visit';
import { daysLeft } from '@/lib/os/term';
import { proposalFor } from '@/lib/os/proposal';
import { clubModel } from '@/lib/os/club';
import { ownershipState, type ModuleKey } from '@/lib/os/ownership';
import { conciergeLog } from '@/lib/os/log';
import { deriveProtection, PROTECTION_WORD, type Protection } from '@/lib/cx/protection';
import { isDevUser, DEV_JOBS, DEV_MEMBERSHIP } from '@/lib/cx/devseed';
import Portrait from '@/components/os/Portrait';
import IdentityPlate from '@/components/os/IdentityPlate';
import CoachMark, { markCoachSeen } from '@/components/os/CoachMark';
import JoinClub from '@/components/os/JoinClub';
import CarForm from '@/components/os/CarForm';
import { markWelcomed, hasBeenWelcomed } from '@/lib/os/welcome';
import { useOnline } from '@/components/os/useOnline';
import { getMyReferralCode, referralShareLink, referralWhatsAppLink } from '@/lib/services/referrals';
import { REFERRAL } from '@/lib/config/storeConfig';
import Capsule from '@/components/os/Capsule';
import Layer from '@/components/os/Layer';
import ProtectionRecord from '@/components/os/ProtectionRecord';
import MemberCard from '@/components/os/MemberCard';
import Desk, { type ShelfRow, type ThreadVisit, type SearchItem } from '@/components/os/Desk';
import StudioSheet from '@/components/os/StudioSheet';
import Field from '@/components/os/Field';
import Action from '@/components/os/Action';
import Chip, { type Tone } from '@/components/os/Chip';

/** the colour language, as ink for status text and dots (see Chip) */
const TONE_INK: Record<Tone, string> = {
  ok: 'var(--st-ok)', warn: 'var(--st-warn)', info: 'var(--st-info)',
  urgent: 'var(--st-urgent)', neutral: 'var(--st-ink-3)',
};
import EmptyState from '@/components/os/EmptyState';
import { Title, Emphasis, Body, Data, Whisper } from '@/components/os/text';
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
  const [refCopied, setRefCopied] = useState(false);

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
        return { line: `The ${modelWord} is ready.`, ready: true, tap: () => nav.push(`/app/visit/${model.live!.id}`) };
      }
      return {
        line: act ? `${ACT_TITLE[act]} - the ${modelWord} is with us.` : 'In the studio.',
        tap: () => nav.push(`/app/visit/${model.live!.id}`),
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

  /* the referral - carries the customer's real code so the friend is credited
     and both sides earn the reward. Without the code the link is worthless, so
     minting it is the whole point. Falls back to WhatsApp / clipboard by
     platform; a cancelled share or an offline mint is safe to retry. */
  const shareReferral = async () => {
    if (!user) return;
    try {
      const code = await getMyReferralCode(user);
      const link = referralShareLink(code);
      const text = `My car lives at AutoModz — here’s ${REFERRAL.label} on your first detail. ${link}`;
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ text });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(link);
        setRefCopied(true);
        setTimeout(() => setRefCopied(false), 2500);
      } else {
        window.open(referralWhatsAppLink(code, user.name), '_blank', 'noopener,noreferrer');
      }
    } catch { /* cancelled share or offline mint - the button can be tapped again */ }
  };

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
              minHeight="100svh"
              continuous={v.id === vehicle?.id}
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

      {/* ── the DECK: a physical surface that lifts over the vehicle stage,
          carrying the car's live world. Not sections under a hero - a raised
          deck floating over the car, Wallet/car-OS depth. ── */}
      {!onAddPage && vehicle && model && (
        <div style={{
          position: 'relative', zIndex: 1,
          marginTop: 'calc(-1 * var(--st-rest))',
          borderTopLeftRadius: 30, borderTopRightRadius: 30,
          background: 'var(--st-paper)',
          boxShadow: '0 -28px 64px -28px rgba(12,13,14,0.22), var(--st-edge)',
          paddingTop: 'var(--st-hair)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + var(--st-movement))',
        }}>
          {/* grab handle - the deck reads as a liftable surface */}
          <div aria-hidden style={{
            width: 38, height: 4, borderRadius: 999, background: 'var(--st-hairline)',
            margin: '12px auto 0',
          }} />

          {/* STATUS - one enormous asymmetric statement, read from ten feet.
              Not a row of tiles: the car's state IS the object; protection and
              the Club recede to hairline controls beneath it. */}
          {(() => {
            const p0 = model.protections[0];
            const stateWord = model.live ? 'In care'
              : model.agreed ? (visitPhase(model.agreed.status) === 'agreed' ? 'Booked in' : 'Requested')
              : model.proposal ? 'Care due'
              : model.completed.length ? 'Cared for' : 'New';
            const onState = model.live ? () => nav.push(`/app/visit/${model.live!.id}`)
              : model.agreed ? () => router.replace('/app?sheet=manage')
              : () => router.replace('/app?sheet=arrange');
            const controls: { text: string; tone: Tone; onTap?: () => void }[] = [];
            if (p0 || model.completed.length > 0) {
              const waning = p0?.active && (p0.term === 'waning' || p0.term === 'expiring');
              controls.push({
                // green protected · amber running out · red expired · amber none
                tone: !p0 ? 'warn' : !p0.active ? 'urgent' : waning ? 'warn' : 'ok',
                text: p0
                  ? `${p0.active ? 'Protected' : 'Expired'}${p0.until ? ` · ${p0.until.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}` : ''}`
                  : 'Unprotected',
                onTap: p0
                  ? (model.protections.length > 1 ? () => router.replace('/app?focus=protection') : undefined)
                  : () => router.replace('/app?sheet=arrange'),
              });
            }
            if (club.state !== 'none') {
              controls.push({
                // blue membership · amber confirming or in grace · red lapsed
                tone: club.state === 'lapsed' ? 'urgent'
                  : club.state === 'pending' || club.state === 'grace' ? 'warn' : 'info',
                text: club.state === 'active' || club.state === 'grace'
                  ? `Club · ${club.washesLeft} wash${club.washesLeft === 1 ? '' : 'es'}`
                  : club.state === 'pending' ? 'Club · confirming' : 'Club · lapsed',
                onTap: (club.state === 'lapsed' || club.state === 'grace') ? () => router.replace('/app?sheet=join-club') : undefined,
              });
            } else if (club.invited) {
              controls.push({ tone: 'info', text: 'The Club', onTap: () => router.replace('/app?sheet=join-club') });
            }
            return (
              <section style={{ marginTop: 'var(--st-rest)', padding: '0 var(--st-inset)' }}>
                <button onClick={onState} className="st-tap" style={{
                  display: 'block', width: '100%', textAlign: 'left', background: 'transparent',
                  border: 'none', padding: 0, cursor: 'pointer',
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 14 }}>
                    {model.live && <span aria-hidden className="st-live-dot" style={{ width: 12, height: 12 }} />}
                    <span style={{
                      fontFamily: 'var(--st-display)', fontWeight: 700, letterSpacing: '-0.045em',
                      fontSize: 'clamp(56px, 19vw, 116px)', lineHeight: 0.86,
                      color: model.live ? 'var(--st-ok)' : 'var(--st-ink)',
                    }}>
                      {stateWord}
                    </span>
                  </span>
                </button>
                {controls.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--st-inset)', marginTop: 'var(--st-gap)' }}>
                    {controls.map((c, i) => (
                      <button key={i} onClick={c.onTap} disabled={!c.onTap} className="st-tap"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 7,
                          background: 'transparent', border: 'none', padding: 0,
                          cursor: c.onTap ? 'pointer' : 'default',
                          fontFamily: 'var(--st-data)', fontSize: 12, letterSpacing: '0.04em',
                          color: TONE_INK[c.tone], textTransform: 'uppercase',
                        }}>
                        <span aria-hidden style={{
                          width: 6, height: 6, borderRadius: 999, flex: '0 0 auto',
                          background: TONE_INK[c.tone],
                        }} />
                        {c.text}{c.onTap ? '  ↗' : ''}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })()}

          {/* B3 · Now - the next thing for this car. An agreed visit takes the
              floor; otherwise the studio's one standing suggestion (live lives
              in the capsule until P3). The two are mutually exclusive. */}
          {model.agreed ? (
            <Layer>
              {/* THE PASS - the next visit as a single graphite object, the one
                  dark surface on the deck. The day is the hero; the pass reads
                  like a boarding card, not another white section. */}
              {(() => {
                const confirmed = visitPhase(model.agreed.status) === 'agreed';
                return (
                  <div className="st-card" style={{
                    position: 'relative', overflow: 'hidden',
                    background: 'linear-gradient(155deg, #23262B 0%, #16181B 56%, #0D0E10 100%)',
                    borderRadius: 'var(--st-r-sheet)', boxShadow: 'var(--st-lift)',
                    padding: 'var(--st-inset)', color: 'var(--st-over)',
                  }}>
                    {/* top specular edge + a faint corner bloom - machined metal */}
                    <div aria-hidden style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: 1,
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)',
                    }} />
                    <div aria-hidden style={{
                      position: 'absolute', top: '-30%', right: '-20%', width: '70%', height: '80%',
                      background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.10) 0%, transparent 65%)',
                      pointerEvents: 'none',
                    }} />
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--st-gap)' }}>
                      <span style={{
                        fontFamily: 'var(--st-data)', fontSize: 11, letterSpacing: '0.1em',
                        textTransform: 'uppercase', color: 'var(--st-over-2)',
                      }}>{confirmed ? 'Next visit' : 'Requested'}</span>
                      {/* the colour language, on graphite: a confirmed visit is
                          blue (booked), one the studio hasn't taken yet is amber
                          (waiting). The dark-surface values are used directly
                          because this card is a dark object inside a light page. */}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '4px 10px', borderRadius: 999,
                        background: confirmed ? 'rgba(111,168,201,0.16)' : 'rgba(217,169,74,0.16)',
                        border: `1px solid ${confirmed ? 'rgba(111,168,201,0.34)' : 'rgba(217,169,74,0.34)'}`,
                        fontFamily: 'var(--st-text)', fontSize: 12,
                        color: confirmed ? '#9FCBE2' : '#E8C57E',
                      }}>
                        {confirmed && <span aria-hidden className="st-live-dot" style={{ ['--st-ok' as string]: '#6FA8C9' }} />}
                        {confirmed ? 'Confirmed' : 'Awaiting the studio'}
                      </span>
                    </div>
                    <p style={{
                      position: 'relative', marginTop: 'var(--st-gap)',
                      fontFamily: 'var(--st-display)', fontWeight: 640, letterSpacing: '-0.02em',
                      fontSize: 'clamp(34px, 10vw, 52px)', lineHeight: 1.02, color: 'var(--st-over)',
                    }}>
                      {fmtDayDate(model.agreed.scheduledDate)}
                    </p>
                    <span style={{
                      display: 'block', marginTop: 6, fontFamily: 'var(--st-data)', fontSize: 15,
                      color: 'var(--st-over-2)',
                    }}>
                      {model.agreed.scheduledTime}
                    </span>
                    <div style={{ position: 'relative', marginTop: 'var(--st-inset)', paddingTop: 'var(--st-gap)', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--st-gap)' }}>
                        <span style={{ fontFamily: 'var(--st-text)', fontSize: 16, color: 'var(--st-over-2)' }}>
                          {model.agreed.serviceName}
                          {model.agreed.paymentMethod === 'cash' ? ' · pay at the studio' : ''}
                        </span>
                        <span style={{ fontFamily: 'var(--st-data)', fontSize: 14, color: 'var(--st-over)' }}>
                          ₹{model.agreed.totalAmount.toLocaleString('en-IN')}
                        </span>
                      </div>
                      {!confirmed && (
                        <p style={{ marginTop: 'var(--st-breath)', fontFamily: 'var(--st-text)', fontSize: 12, color: 'var(--st-over-2)' }}>
                          {PHASE_LINE.proposed}
                        </p>
                      )}
                    </div>
                    <div style={{ position: 'relative', marginTop: 'var(--st-gap)' }}>
                      <Action variant="on-photo" onClick={() => router.replace('/app?sheet=manage')}>Change or cancel</Action>
                    </div>
                  </div>
                );
              })()}
            </Layer>
          ) : model.declined ? (
            <Layer>
              {/* the declined fork - the studio couldn't take a request, or a
                  slot was missed. The reason the studio gave is finally shown,
                  and the way forward is one tap to another time. */}
              {(() => {
                const d = model.declined!;
                const missed = d.noShow === true;
                return (
                  <div style={{
                    background: 'var(--st-card-fill)', border: '1px solid var(--st-hairline)',
                    borderRadius: 'var(--st-r-sheet)', boxShadow: 'var(--st-raise), var(--st-edge)',
                    padding: 'var(--st-inset)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--st-gap)' }}>
                      <Whisper as="p">A note from the studio</Whisper>
                      <Chip tone="urgent">{missed ? 'Missed' : 'Not accepted'}</Chip>
                    </div>
                    <Emphasis style={{ display: 'block', marginTop: 'var(--st-line)' }}>
                      {missed
                        ? `The ${fmtDayDate(d.scheduledDate)} visit was missed.`
                        : `${fmtDayDate(d.scheduledDate)} couldn’t be taken.`}
                    </Emphasis>
                    <Data tone="ink-2" style={{ display: 'block', marginTop: 'var(--st-hair)', fontSize: 15 }}>
                      {d.serviceName} · {d.scheduledTime}
                    </Data>
                    <Body tone="ink-2" style={{ marginTop: 'var(--st-gap)' }}>
                      {missed
                        ? `The ${vehicle.name}’s slot went unused. Arrange another whenever suits you.`
                        : d.rejectionReason}
                    </Body>
                    <div style={{ marginTop: 'var(--st-inset)' }}>
                      <Action variant="forward"
                        onClick={() => router.replace(`/app?sheet=arrange&cat=${d.serviceCategory}`)}>
                        {missed ? 'Arrange another' : 'Find another time'}
                      </Action>
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

          {/* QUICK ACTIONS - the two things a customer does to this vehicle, as
              a row of actions (not cards). Messaging is the Capsule's job, so it
              is not duplicated here. */}
          <div style={{
            marginTop: 'var(--st-rest)', padding: '0 var(--st-inset)',
            display: 'flex', gap: 'var(--st-inset)', flexWrap: 'wrap', alignItems: 'baseline',
          }}>
            <Action variant="forward" onClick={() => router.replace('/app?sheet=arrange')}>Arrange a visit</Action>
            <Action variant="quiet" onClick={() => openCarForm(vehicle)}>Edit details</Action>
          </div>

          {/* Protection and papers are no longer cards on the deck: protection
              rides the hairline control under the status; every paper lives
              inside its Chapter's receipt. The deck stays large objects only. */}

          {/* THE DECK, ORDERED BY OWNERSHIP STATE (lib/os/ownership.ts).
              The objects below are the same objects; which one the owner meets
              first is decided by where they actually stand - a lapsed Club
              leads for a lapsed member, the story leads for a dormant car.
              Status and its actions stay pinned above: every state leads with
              them. No two customers get the same deck. */}
          {(() => {
            const deck: Partial<Record<ModuleKey, ReactNode>> = {
              activity: model.completed.length === 0 ? (
                <div style={{ marginTop: 'var(--st-rest)', padding: '0 var(--st-inset)' }}>
                  <EmptyState
                    line={`The ${vehicle.name}’s story starts with its first visit.`}
                    actionLabel="Arrange one"
                    onAction={() => router.replace('/app?sheet=arrange')}
                  />
                </div>
              ) : (
                <StoryFilm
                  completed={showAllStory ? model.completed : model.completed.slice(0, STORY_PREVIEW)}
                  jobByBooking={model.jobByBooking}
                  vehicleName={vehicle.name}
                  moreCount={!showAllStory ? Math.max(0, model.completed.length - STORY_PREVIEW) : 0}
                  onMore={() => setShowAllStory(true)}
                  onOpen={id => nav.push(`/app/chapter/${id}`)}
                />
              ),

              ...(club.state !== 'none' || club.invited ? {
                ownership: (
                  <Layer>
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

                    <div style={{
                      marginTop: 'var(--st-inset)', paddingTop: 'var(--st-gap)',
                      borderTop: '1px solid var(--st-hairline)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--st-gap)',
                    }}>
                      <Body tone="ink-2" style={{ flex: 1 }}>Give a friend {REFERRAL.label}, get {REFERRAL.label}.</Body>
                      <Action variant="forward" onClick={shareReferral}>{refCopied ? 'Copied' : 'Share'}</Action>
                    </div>
                  </Layer>
                ),
              } : {}),

              studio: <StudioCard />,
            };

            return own.order
              .filter(k => deck[k])
              .map(k => <Fragment key={k}>{deck[k]}</Fragment>);
          })()}
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
                  installer={src.installer}
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
/** A document mark - the glyph that makes a paper read as a file. */

/** A location pin - marks the studio as a destination, not a text block. */

/** GLANCE tile - one number the customer reads without a sentence. A row of
 *  these (Wallet/Health) answers where/protected/owned at a glance. */

/** THE STORY - the car's history as a filmstrip of tall cinematic frames.
 *  Each visit is named over its own photograph; no heading, the images lead. */
function StoryFilm({
  completed, jobByBooking, vehicleName, moreCount, onMore, onOpen,
}: {
  completed: Booking[];
  jobByBooking: Map<string, Job>;
  vehicleName: string;
  moreCount: number;
  onMore: () => void;
  onOpen: (id: string) => void;
}) {
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  return (
    <div className="st-rail-fade" style={{
      marginTop: 'var(--st-rest)', display: 'flex', gap: 'var(--st-line)',
      overflowX: 'auto', scrollbarWidth: 'none', padding: '2px var(--st-inset)',
      scrollSnapType: 'x proximity',
    }}>
      {completed.map(b => {
        const job = jobByBooking.get(b.id);
        const photos = job?.photos ?? [];
        const best = photos.find(x => x.kind === 'after') ?? photos[0];
        const tech = job?.assignments?.filter(a => !a.removedAt && a.role === 'lead')[0]?.employeeName;
        return (
          <button
            key={b.id}
            onClick={() => onOpen(b.id)}
            className="st-tap st-card"
            style={{
              position: 'relative', flex: '0 0 auto', width: 'min(64vw, 244px)',
              aspectRatio: '3 / 4', borderRadius: 'var(--st-r-card)', overflow: 'hidden',
              border: 'none', cursor: 'pointer', textAlign: 'left', scrollSnapAlign: 'start',
              background: best ? 'var(--st-stage)' : 'var(--st-gallery-fill)',
              boxShadow: 'var(--st-raise), var(--st-edge)', padding: 0,
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
            }}
          >
            {best ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={best.url} alt=""
                  onLoad={() => setLoaded(m => ({ ...m, [b.id]: true }))}
                  className={`st-img${loaded[b.id] ? ' is-loaded' : ''}`}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div aria-hidden style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(to top, var(--st-scrim-strong) 0%, transparent 46%)',
                }} />
              </>
            ) : (
              <span aria-hidden style={{
                position: 'absolute', top: 'var(--st-gap)', left: 'var(--st-gap)',
                fontFamily: 'var(--st-data)', fontSize: 11, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--st-ink-3)',
              }}>{vehicleName}</span>
            )}
            <span style={{ position: 'relative', zIndex: 1, padding: 'var(--st-gap)' }}>
              <Emphasis as="span" tone={best ? 'over' : 'ink'} style={{ display: 'block' }}>
                {b.serviceName}
              </Emphasis>
              <Whisper as="span" tone={best ? 'over-2' : 'ink-3'} style={{ display: 'block', marginTop: 2 }}>
                {fmtLong(b.scheduledDate)}{tech ? ` · ${tech}` : ''}
              </Whisper>
            </span>
          </button>
        );
      })}
      {moreCount > 0 && (
        <button
          onClick={onMore}
          className="st-tap st-card"
          style={{
            flex: '0 0 auto', width: 132, aspectRatio: '3 / 4', borderRadius: 'var(--st-r-card)',
            border: '1px solid var(--st-hairline)', cursor: 'pointer',
            background: 'var(--st-card-fill)', boxShadow: 'var(--st-hold), var(--st-edge)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}
        >
          <span style={{
            fontFamily: 'var(--st-display)', fontWeight: 600, fontSize: 26, color: 'var(--st-ink)',
          }}>+{moreCount}</span>
          <Whisper as="span">earlier</Whisper>
        </button>
      )}
    </div>
  );
}

/** STUDIO - the sign-off: a large place-name and two hairline controls, no card. */
function StudioCard() {
  return (
    <div style={{ padding: '0 var(--st-inset)', marginTop: 'var(--st-movement)' }}>
      <div style={{ height: 1, background: 'var(--st-hairline)', marginBottom: 'var(--st-inset)' }} />
      <p style={{
        fontFamily: 'var(--st-display)', fontWeight: 620, letterSpacing: '-0.02em',
        fontSize: 'clamp(30px, 9vw, 48px)', lineHeight: 0.98, color: 'var(--st-ink)', margin: 0,
      }}>
        {COMPANY.name}
        <span style={{ color: 'var(--st-ink-3)' }}> · Maninagar</span>
      </p>
      <Whisper as="p" style={{ marginTop: 'var(--st-line)' }}>
        {COMPANY.address} · Open {COMPANY.hours.open}–{COMPANY.hours.close}
      </Whisper>
      <div style={{ display: 'flex', gap: 'var(--st-inset)', marginTop: 'var(--st-gap)' }}>
        <Action variant="external" onClick={() => window.open(COMPANY.mapsUrl, '_blank', 'noopener,noreferrer')}>Directions</Action>
        <Action variant="external" onClick={() => window.open(COMPANY.googleReviewUrl, '_blank', 'noopener,noreferrer')}>Reviews</Action>
      </div>
    </div>
  );
}

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

/** A notification preference as a tactile toggle pill - on: filled ink with a
 *  check; off: a quiet hairline outline. A cluster of these replaces the list. */
function NotifPill({ on, label, onTap, busy }: {
  on: boolean; label: string; onTap: () => void; busy?: boolean;
}) {
  return (
    <button onClick={onTap} disabled={busy} aria-pressed={on} className="st-tap"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, cursor: busy ? 'default' : 'pointer',
        padding: '10px 16px', borderRadius: 999,
        background: on ? 'var(--st-ink)' : 'transparent',
        border: `1px solid ${on ? 'var(--st-ink)' : 'var(--st-border-2, var(--st-hairline))'}`,
        color: on ? 'var(--st-paper)' : 'var(--st-ink-3)',
        fontFamily: 'var(--st-text)', fontWeight: 500, fontSize: 15,
        transition: 'background var(--st-move) var(--st-ease), color var(--st-move) var(--st-ease), border-color var(--st-move) var(--st-ease)',
      }}>
      <span aria-hidden style={{
        width: 15, height: 15, display: 'grid', placeItems: 'center', flex: '0 0 auto',
      }}>
        {on ? (
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
            <path d="M1.5 6.5 L4.5 9.5 L10.5 2.5" stroke="var(--st-paper)" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <span style={{ width: 11, height: 11, borderRadius: 999, border: '1.5px solid var(--st-ink-3)' }} />
        )}
      </span>
      {label}
    </button>
  );
}

/* ── the You sheet (design E1) ── */
function YouSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { user, setUser } = useAppStore();
  const online = useOnline();
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [installEvent, setInstallEvent] = useState<Event | null>(null);

  /* device push - the delivery channel for every visit update the studio sends
     (confirmed, in care, ready, and so on). Without registering this device
     the notifications reach nothing, so this is where the customer turns it on. */
  const [pushState, setPushState] = useState<'on' | 'off' | 'unsupported'>('off');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushErr, setPushErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPushErr(null);
    setPushState(!pushSupported() ? 'unsupported' : pushEnabled() ? 'on' : 'off');
  }, [open]);

  const turnOnPush = async () => {
    if (!user) return;
    if (!online) { setPushErr('You’re offline — reconnect to turn these on.'); return; }
    setPushBusy(true); setPushErr(null);
    const ok = await enablePush(user.uid);
    setPushBusy(false);
    if (ok) { setPushState('on'); return; }
    setPushErr(
      typeof Notification !== 'undefined' && Notification.permission === 'denied'
        ? 'Notifications are blocked — allow them for AutoModz in your browser settings.'
        : 'That didn’t go through — try again.',
    );
  };

  const turnOffPush = async () => {
    if (!user) return;
    setPushBusy(true);
    await disablePush(user.uid);
    setPushBusy(false);
    setPushState('off');
  };

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


  return (
    <StudioSheet open={open} onOpenChange={o => { if (!o) save(); }} label="You">
      <div style={{ display: 'grid', gap: 24, paddingBottom: 8 }}>
        {/* the identity moment - a machined monogram, not a settings title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--st-gap)' }}>
          <div aria-hidden style={{
            position: 'relative', width: 68, height: 68, borderRadius: 999, flex: '0 0 auto',
            display: 'grid', placeItems: 'center', overflow: 'hidden',
            background: 'radial-gradient(circle at 34% 28%, #ffffff 0%, #eef0f2 14%, #d3d7db 42%, #a3a8af 72%, #74797f 100%)',
            boxShadow: 'var(--st-raise), inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -6px 14px rgba(20,22,25,0.28)',
          }}>
            <span style={{
              fontFamily: 'var(--st-display)', fontWeight: 700, fontSize: 30, color: '#1a1c1f',
              textShadow: '0 1px 0 rgba(255,255,255,0.5)',
            }}>
              {(user?.name?.charAt(0) || 'Y').toUpperCase()}
            </span>
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{
              fontFamily: 'var(--st-display)', fontWeight: 620, fontSize: 26, letterSpacing: '-0.02em',
              lineHeight: 1.05, color: 'var(--st-ink)', margin: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {user?.name || 'Your account'}
            </p>
            {user?.email && (
              <Data tone="ink-3" style={{ display: 'block', marginTop: 4 }}>{user.email}</Data>
            )}
          </div>
        </div>

        <Field label="Name" value={name} onChange={setName} />
        <Field label="Phone" value={phone} onChange={setPhone} kind="phone" />

        {/* how we reach you - a cluster of toggle pills, never a settings list */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {pushState !== 'unsupported' && (
            <NotifPill on={pushState === 'on'} busy={pushBusy} label="This device"
              onTap={pushState === 'on' ? turnOffPush : turnOnPush} />
          )}
          <NotifPill on={prefs.whatsapp} label="WhatsApp" onTap={() => togglePref('whatsapp')} />
          <NotifPill on={prefs.serviceReminders} label="Care due" onTap={() => togglePref('serviceReminders')} />
          <NotifPill on={prefs.membershipReminders} label="Membership" onTap={() => togglePref('membershipReminders')} />
          <NotifPill on={prefs.promotions} label="Offers" onTap={() => togglePref('promotions')} />
        </div>
        {pushErr && (
          <div role="status" aria-live="polite"><Whisper tone="ink-2">{pushErr}</Whisper></div>
        )}
        <Whisper>While the car’s in care we always message — it’s your car.</Whisper>

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
