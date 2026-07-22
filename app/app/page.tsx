'use client';
/**
 * The Glance — `/app` (Product Design Part B). One vertical composition:
 * portrait region → Now → Protection → The story → Papers → The Club →
 * signature. Layers render only when true (silence law). The Capsule is
 * the only fixed element. Vehicle switching is a horizontal pager; the
 * last page is the add-a-car invitation.
 *
 * Interim targets (tracked; each dies with its phase):
 *   TODO(P3): capsule/visit-card live-tap → the Stay (interim: legacy tracker route)
 *   TODO(P4): story/record taps → Chapter; records → Record view (interim: legacy)
 *   TODO(P6): "Have a look" → join-club sheet (interim: legacy club page)
 *   TODO(P7): CxVehicleForm → the car-form + portrait-capture sheet (onboarding)
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
import { generateTimeSlots, getAvailableDates } from '@/lib/utils';
import type { Booking, Job, Service, Subscription, Vehicle } from '@/lib/types';
import { truthOf, type ProtectionFact } from '@/lib/os/truth';
import { visitPhase, careAct, ACT_TITLE, PHASE_LINE } from '@/lib/os/visit';
import { termState, daysLeft } from '@/lib/os/term';
import { proposalFor } from '@/lib/os/proposal';
import { deriveProtection, PROTECTION_WORD } from '@/lib/cx/protection';
import { isDevUser, DEV_JOBS } from '@/lib/cx/devseed';
import Portrait from '@/components/os/Portrait';
import Capsule from '@/components/os/Capsule';
import Layer from '@/components/os/Layer';
import PhotoBand from '@/components/os/PhotoBand';
import MomentEntry from '@/components/os/MomentEntry';
import MemberCard from '@/components/os/MemberCard';
import Desk, { type ShelfRow, type ThreadVisit, type SearchItem } from '@/components/os/Desk';
import StudioSheet from '@/components/os/StudioSheet';
import Field from '@/components/os/Field';
import Action from '@/components/os/Action';
import EmptyState from '@/components/os/EmptyState';
import { Display, Title, Emphasis, Body, Data, Whisper } from '@/components/os/text';
import CxVehicleForm from '@/components/cx/CxVehicleForm'; // TODO(P7): replaced by the car-form sheet
import { COMPANY } from '@/lib/company';

const fmtLong = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtMonthYear = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const fmtDayDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

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
  const prefillCat = params.get('cat');
  const [carFormOpen, setCarFormOpen] = useState(false);
  const [showAllStory, setShowAllStory] = useState(false);

  // the story summarises to its most recent chapters; the rest reveal on demand
  const STORY_PREVIEW = 3;

  useEffect(() => { getServices().then(setServices).catch(() => {}); }, []);
  useEffect(() => {
    if (!user) return;
    if (isDevUser(user.uid)) { setJobs(Object.values(DEV_JOBS)); return; }
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
    // one open proposal per vehicle — suppressed while a visit is already in flight
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

  /* ── capsule state (design B2) ── */
  const capsule = useMemo<{ line: string; tap: () => void; actionWord?: string; onAction?: () => void }>(() => {
    // quiet state (line: '') opens the Desk — the concierge's index
    if (!model || !vehicle) return { line: '', tap: () => router.replace('/app?sheet=desk') };
    const modelWord = vehicle.name;
    if (model.live) {
      const act = careAct(model.live.status);
      if (act === 'ready') {
        return { line: `The ${modelWord} is ready.`, tap: () => router.push(`/dashboard/care/${model.live!.id}`) };
      }
      return {
        line: act ? `${ACT_TITLE[act]} — the ${modelWord} is with us.` : 'In the studio.',
        tap: () => router.push(`/dashboard/care/${model.live!.id}`), // TODO(P3): the Stay
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

  /* ── the Desk shelf (design system §7.4 · IA D2) — adaptive: a row exists
     only when its object does. Thread & search land in P2. ── */
  const deskRows: ShelfRow[] = useMemo(() => {
    if (!vehicle) return [];
    const rows: ShelfRow[] = [];
    rows.push({ label: `The ${vehicle.name}’s care`, onTap: () => router.replace('/app?sheet=arrange') });
    if (model && model.protections.length)
      rows.push({ label: 'Protection', detail: String(model.protections.length), onTap: () => router.replace('/app') }); // on the Glance
    if (model && model.completed.some(b => b.invoiceId))
      rows.push({ label: 'Papers & records', onTap: () => router.replace('/app') }); // on the Glance
    if (membership || (model && model.completed.length >= 2))
      rows.push({ label: 'The Club', onTap: () => router.push('/dashboard/subscriptions') }); // TODO(P6): join-club sheet
    rows.push({ label: 'The studio', onTap: () => window.open(`https://wa.me/${COMPANY.phoneIntl}`, '_blank') });
    rows.push({ label: 'You', onTap: () => router.replace('/app?sheet=you') });
    return rows;
  }, [vehicle, model, membership, router]);

  /* ── the conversation feed: real visits + a global search index (IA D) ── */
  const messageStudio = () => window.open(`https://wa.me/${COMPANY.phoneIntl}`, '_blank');

  const deskFeed = useMemo(() => {
    if (!model || !vehicle) return { visits: [] as ThreadVisit[], search: [] as SearchItem[] };
    const line = (b: Booking): string => {
      const ph = visitPhase(b.status);
      if (ph === 'live') { const a = careAct(b.status); return a ? `${ACT_TITLE[a]} — the ${vehicle.name} is with us` : 'In the studio'; }
      if (ph === 'agreed') return `${fmtDayDate(b.scheduledDate)} · ${b.scheduledTime} · confirmed`;
      if (ph === 'proposed') return `${b.serviceName} · requested`;
      return `${b.serviceName} · ${fmtLong(b.scheduledDate)}`;
    };
    const visitsFeed: ThreadVisit[] = model.visits.slice(0, 6).reverse().map(b => ({
      id: b.id,
      line: line(b),
      sub: visitPhase(b.status) === 'archived' ? `₹${b.totalAmount.toLocaleString('en-IN')}` : undefined,
      onTap: () => router.push(`/dashboard/care/${b.id}`), // TODO(P3/P4): the Stay / Chapter
    }));
    const search: SearchItem[] = [
      ...model.visits.map(b => ({ label: line(b), group: 'Visits', onTap: () => router.push(`/dashboard/care/${b.id}`) })),
      ...model.completed.filter(b => b.invoiceId).map(b => ({
        label: `Care record — ${fmtLong(b.scheduledDate)}`, group: 'Records',
        onTap: () => router.push(`/invoice/${b.invoiceId}`), // TODO(P4): Chapter
      })),
      ...model.protections.map(p => ({ label: PROTECTION_WORD[p.kind], group: 'Protection', onTap: () => router.replace('/app') })),
      ...(membership ? [{ label: `Club · ${membership.plan}`, group: 'Club', onTap: () => router.replace('/app') }] : []),
    ];
    return { visits: visitsFeed, search };
  }, [model, vehicle, membership, router]);

  if (!user) return null;

  /* first-run without a vehicle: the invitation is the whole glance */
  if (vehicles.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex' }}>
        <AddCarInvitation onAdd={() => setCarFormOpen(true)} full />
        <YouSheet open={youOpen} onClose={() => router.replace('/app')} />
        <AddCarSheet open={carFormOpen} onClose={() => setCarFormOpen(false)} />
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

              {/* page dots — only when vehicles ≥ 2 (◆R4) */}
              {vehicles.length >= 2 && (
                <div aria-hidden style={{
                  position: 'absolute', bottom: 96, left: 0, right: 0,
                  display: 'flex', justifyContent: 'center', gap: 8, zIndex: 2,
                }}>
                  {[...vehicles, null].map((_, i) => (
                    <span key={i} style={{
                      width: 4, height: 4, borderRadius: 999,
                      background: i === page ? 'var(--st-over)' : 'var(--st-over-2)',
                    }} />
                  ))}
                </div>
              )}
            </Portrait>
          </div>
        ))}
        {/* last page: add-a-car (◆R14) */}
        <div style={{ minWidth: '100%', scrollSnapAlign: 'start' }}>
          <AddCarInvitation onAdd={() => setCarFormOpen(true)} />
        </div>
      </div>

      {/* ── layers for the visible vehicle ── */}
      {!onAddPage && vehicle && model && (
        <div style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + var(--st-movement))' }}>

          {/* B3 · Now — the next thing for this car. An agreed visit takes the
              floor; otherwise the studio's one standing suggestion (live lives
              in the capsule until P3). The two are mutually exclusive. */}
          {model.agreed ? (
            <Layer>
              <Whisper as="p" style={{ marginBottom: 'var(--st-breath)' }}>
                {visitPhase(model.agreed.status) === 'agreed' ? 'Your next visit' : 'Requested'}
              </Whisper>
              <Title>{fmtDayDate(model.agreed.scheduledDate)} · {model.agreed.scheduledTime}</Title>
              <Body tone="ink-2" style={{ marginTop: 'var(--st-line)' }}>
                {model.agreed.serviceName} · ₹{model.agreed.totalAmount.toLocaleString('en-IN')}
                {model.agreed.paymentMethod === 'cash' ? ' · pay at the studio' : ''}
              </Body>
              {visitPhase(model.agreed.status) === 'proposed' && (
                <Whisper as="p" style={{ marginTop: 'var(--st-breath)' }}>{PHASE_LINE.proposed}</Whisper>
              )}
              <div style={{ marginTop: 'var(--st-gap)' }}>
                {/* changes to a visit go through the conversation */}
                <Action variant="quiet" onClick={() => router.replace('/app?sheet=desk')}>Change or cancel</Action>
              </div>
            </Layer>
          ) : model.proposal ? (
            <Layer>
              <Whisper as="p" style={{ marginBottom: 'var(--st-breath)' }}>A suggestion from the studio</Whisper>
              <Emphasis>{model.proposal.reason}</Emphasis>
              <div style={{ marginTop: 'var(--st-gap)' }}>
                <Action variant="quiet"
                  onClick={() => router.replace(`/app?sheet=arrange&cat=${model.proposal!.serviceCategory}`)}>
                  Arrange it
                </Action>
              </div>
            </Layer>
          ) : null}

          {/* B4 · Protection */}
          {model.protections.length > 0 && (
            <Layer title="Protection">
              <div style={{ display: 'grid', gap: 24 }}>
                {model.protections.map(p => {
                  const untilISO = p.until ? p.until.toISOString().split('T')[0] : null;
                  const state = untilISO ? termState(untilISO) : 'active';
                  const left = untilISO ? daysLeft(untilISO) : null;
                  const srcJob = model.visits.find(v => v.serviceName === p.service && visitPhase(v.status) === 'archived');
                  const photo = srcJob ? model.jobByBooking.get(srcJob.id)?.photos?.find(x => x.kind === 'after')?.url : undefined;

                  if (!p.active) {
                    /* ◆R13 — expired converts to typographic gallery band */
                    return (
                      <div key={p.kind} style={{ background: 'var(--st-gallery)', borderRadius: 'var(--st-r-sheet)', padding: 'var(--st-inset)' }}>
                        <Body>
                          {PROTECTION_WORD[p.kind]} · {new Date(p.applied + 'T12:00:00').getFullYear()}
                          {p.until ? `–${p.until.getFullYear()}` : ''} · ran its course.
                        </Body>
                        <div style={{ marginTop: 'var(--st-line)' }}>
                          <Action variant="quiet" onClick={() => router.replace(`/app?sheet=arrange&cat=${p.kind}`)}>Renew</Action>
                        </div>
                      </div>
                    );
                  }
                  const capLine = state === 'waning' || state === 'expiring'
                    ? `Renewal window open — ${left} day${left === 1 ? '' : 's'} left`
                    : untilISO
                    ? `Protected until ${fmtMonthYear(untilISO)}`
                    : `Applied ${fmtMonthYear(p.applied)}`;
                  return (
                    <PhotoBand
                      key={p.kind}
                      src={photo}
                      alt={`${PROTECTION_WORD[p.kind]} — detail of the ${vehicle.name}`}
                      ratio="band"
                      overTitle={photo ? PROTECTION_WORD[p.kind] : undefined}
                      overCaption={photo ? capLine : undefined}
                      caption={photo ? undefined : PROTECTION_WORD[p.kind]}
                      whisper={photo ? undefined : capLine}
                    />
                  );
                })}
              </div>
            </Layer>
          )}

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
                      onTap={() => router.push(`/dashboard/care/${b.id}`)} // TODO(P4): chapter
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

          {/* B6 · Papers */}
          <Layer title="Papers">
            <Data tone="ink-2" style={{ display: 'block' }}>{vehicle.registrationNumber}</Data>
            {model.completed.filter(b => b.invoiceId).length > 0 && (
              <div style={{ marginTop: 'var(--st-inset)', display: 'grid', gap: 'var(--st-line)' }}>
                {model.completed.filter(b => b.invoiceId).map(b => (
                  <button key={b.id} onClick={() => router.push(`/invoice/${b.invoiceId}`)} /* TODO(P4): record view */
                    className="st-tap"
                    style={{ background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}>
                    <Body>Care record — {fmtLong(b.scheduledDate)}</Body>
                  </button>
                ))}
              </div>
            )}
            <div style={{ marginTop: 'var(--st-inset)' }}>
              <Action variant="quiet" onClick={() => setCarFormOpen(true)}>Edit details</Action>
            </div>
          </Layer>

          {/* B7 · The Club */}
          {(membership || model.completed.length >= 2) && (
            <Layer title="The Club">
              {membership && membership.status !== 'cancelled' ? (
                <div>
                  <MemberCard
                    name={user.name}
                    tier={`Club · since ${fmtMonthYear(membership.startDate)}`}
                    since={membership.plan}
                    state={membership.status === 'active' && daysLeft(membership.endDate) > 0
                      ? 'active' : membership.status === 'pending' ? 'pending' : 'lapsed'}
                  />
                  {membership.status === 'active' && daysLeft(membership.endDate) > 0 ? (
                    <Body tone="ink-2" style={{ marginTop: 16 }}>
                      {membership.washesTotal - membership.washesUsed} washes left this cycle · renews {fmtLong(membership.endDate)}
                    </Body>
                  ) : membership.status === 'pending' ? (
                    /* the pending line lives inside MemberCard — no repeat here */
                    null
                  ) : (
                    <div style={{ marginTop: 16 }}>
                      <Body tone="ink-2">Rejoin any time — your history holds.</Body>
                      {/* TODO(P6): join-club sheet */}
                      <div style={{ marginTop: 8 }}>
                        <Action variant="quiet" onClick={() => router.push('/dashboard/subscriptions')}>Rejoin</Action>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* TODO(P6): "Have a look" → join-club sheet */
                <EmptyState
                  line={`You wash often. The Club would suit the ${vehicle.name}.`}
                  actionLabel="Have a look"
                  onAction={() => router.push('/dashboard/subscriptions')}
                />
              )}

              <div style={{ marginTop: 'var(--st-rest)' }}>
                <Body>A friend’s first detail is on us.</Body>
                <div style={{ marginTop: 'var(--st-breath)' }}>
                  <Action variant="quiet" onClick={() => {
                    const url = typeof window !== 'undefined' ? window.location.origin : '';
                    if (navigator.share) navigator.share({ text: `My car lives at AutoModz — first detail's on me. ${url}` }).catch(() => {});
                  }}>Share</Action>
                </div>
              </div>
            </Layer>
          )}

          {/* the signature */}
          <div style={{ marginTop: 'var(--st-movement)', padding: '0 var(--st-inset)' }}>
            <Whisper style={{ fontFamily: 'var(--st-display)', letterSpacing: '0.08em', display: 'block' }}>AUTOMODZ</Whisper>
            <Data tone="ink-3" style={{ fontSize: 14, display: 'block', marginTop: 'var(--st-breath)' }}>{COMPANY.address}</Data>
            <div style={{ marginTop: 'var(--st-line)' }}>
              <Action variant="quiet" onClick={() => router.replace('/app?sheet=desk')}>
                Message the studio
              </Action>
            </div>
          </div>
        </div>
      )}

      <Capsule
        line={capsule.line}
        actionWord={capsule.actionWord}
        onActionTap={capsule.onAction}
        onTap={capsule.tap}
        onPhoto={false}
      />

      <StudioSheet open={deskOpen} onOpenChange={o => { if (!o) router.replace('/app'); }} label="The studio">
        <Desk
          rows={deskRows}
          visits={deskFeed.visits}
          searchItems={deskFeed.search}
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

      <YouSheet open={youOpen} onClose={() => router.replace('/app')} />
      <AddCarSheet open={carFormOpen} onClose={() => setCarFormOpen(false)} />
    </div>
  );
}

const fmtDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long' });

/* ── the add-a-car page (B1 last page / first-run) ── */
function AddCarInvitation({ onAdd, full = false }: { onAdd: () => void; full?: boolean }) {
  return (
    <div style={{
      minWidth: '100%', minHeight: full ? '100vh' : '92vh',
      background: 'var(--st-stage)', scrollSnapAlign: 'start',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 12, padding: 24, textAlign: 'center',
    }}>
      <Display tone="over">Another car?</Display>
      <Body tone="over-2">The garage has room.</Body>
      <div style={{ marginTop: 24 }}>
        <Action variant="on-photo" onClick={onAdd}>Add a car</Action>
      </div>
    </div>
  );
}

/* TODO(P7): replaced by the car-form sheet (make/model/year/plate + portrait) */
function AddCarSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <StudioSheet open={open} onOpenChange={o => { if (!o) onClose(); }} label="The car">
      <CxVehicleForm onSaved={onClose} onClose={onClose} />
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
              <Whisper>Always — it’s your car.</Whisper>
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

/* ── the arrange sheet (design E1) — care is agreed, not filed. Three
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
      else { setError('That didn’t reach us — try again.'); setBusy(false); return; }
    }
    onClose();
  };

  return (
    <StudioSheet open={open} onOpenChange={o => { if (!o) onClose(); }} label="Arrange a visit">
      <div style={{ display: 'grid', gap: 24, paddingBottom: 8 }}>
        <Title>Arrange a visit</Title>
        <Body tone="ink-2">For the {vehicle.name}.</Body>

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
                  )) : <Whisper>No room that day — try another.</Whisper>}
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
