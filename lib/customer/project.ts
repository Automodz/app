/**
 * FIRESTORE → THE SCREENS.
 *
 * Pure functions. Every customer room's model is built here, from one
 * `CustomerPicture`, so no screen ever touches a Firestore document and no two
 * rooms can compute a different answer for the same car (§22.5).
 *
 * Everything derived — health, term wording, the visit's act, the protection
 * fallback — comes from the existing engines in `lib/os`. Nothing is
 * re-implemented here; this file only chooses words and shapes.
 */
import type { Booking, Invoice, Protection, ProtectionKind, Service, Subscription, Vehicle, Visit } from '@/lib/types';
import { PROTECTION_TITLE, MEMBERSHIP_PLANS } from '@/lib/types';
import { COMPANY, waLink } from '@/lib/company';
import { healthOf, termDaysLeft, type Health, type Term } from '@/lib/os/term';
import { liveProtection, projectProtections, sortByUrgency } from '@/lib/os/protection';
import { visitPhase, careAct, ACT_TITLE, ACT_LINE, PHASE_TITLE, PHASE_LINE } from '@/lib/os/visit';
import type { CarPicture, CustomerPicture } from './source';
import { readOwnership, clubOf } from './ownership';
import { cycleDaysLeft, washesLeftOf } from '@/lib/os/club';
import { homeStateCopy } from './homeState';
import { projectTimeline } from '@/lib/os/timeline';
import { projectMoments, sortMoments, groupByMonth, SHOT_CAPTION } from '@/lib/os/moment';
import type { LiveVisitModel } from '@/components/screens/LiveVisitScreen';
import { telLink } from '@/lib/company';

import type { HomeModel, HomeProtection, HomeTimelineEvent } from '@/components/screens/HomeScreen';
import { resolveAction, hrefForRef, hrefForDestination } from '@/navigation/resolve';
import { plainValue } from '@/lib/server/plain';
import type { GarageModel } from '@/components/screens/GarageScreen';
import type { VehicleModel, VehicleProtection } from '@/components/screens/VehicleScreen';
import type { PhotographSource } from '@/components/vehicle';
import type { RegionId } from '@/components/vehicle';
import type { HistoryModel, HistoryVisit } from '@/components/screens/HistoryScreen';
import type { StudioModel } from '@/components/screens/StudioScreen';
import type { YouModel } from '@/components/screens/YouScreen';
import type { MembershipModel } from '@/components/screens/MembershipScreen';

/* ── shared vocabulary ───────────────────────────────────────────────────── */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "12 July 2026". §16.4-adjacent: a date a customer would say out loud. */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "March 2029" — §14.4, beyond a season the date alone speaks. */
function monthYear(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return y && m ? `${MONTHS[m - 1]} ${y}` : iso;
}

const millis = (t?: { toMillis?: () => number }) => t?.toMillis?.() ?? 0;
const isoOf = (t?: { toDate?: () => Date }) =>
  t?.toDate?.().toISOString().slice(0, 10) ?? '';

/** §9.2's four states, from the engine's four healths. */
const TONE: Record<Health, HomeProtection['tone']> = {
  healthy: 'assent', attention: 'caution', urgent: 'urgent', lapsed: 'lapsed',
};

/**
 * §14.3 and §14.4 in one place: the unit that suits the term, at the precision
 * that is honest. A balance is never spoken in time.
 */
export function termWords(term: Term, now = new Date()): string {
  if (term.kind === 'perpetual') return 'For as long as you own it';
  if (term.kind === 'balance') {
    if (term.value <= 0) return 'Empty';
    return term.value <= term.low ? 'Running low' : 'Topped up';
  }
  const days = termDaysLeft(term, now);
  if (days === null) return `Through ${monthYear(term.expiresOn)}`;
  if (days < 0) return `Lapsed ${longDate(term.expiresOn)}`;
  if (days === 0) return 'Expires today';
  if (days === 1) return '1 day left';
  /* §14.4 — "a countdown is honest only when the number is small enough to act
     on. Beyond a season, the date alone speaks." */
  if (days <= 90) return `${days} days left`;
  return `Through ${monthYear(term.expiresOn)}`;
}

/** How much of a term is left, 0–1. Undefined for perpetual: it does not deplete. */
function remainingOf(p: Protection, now = new Date()): number | undefined {
  if (p.term.kind === 'perpetual') return undefined;
  if (p.term.kind === 'balance') {
    const ceiling = Math.max(p.term.low * 5, p.term.value, 1);
    return Math.max(0, Math.min(1, p.term.value / ceiling));
  }
  const end = new Date(p.term.expiresOn + 'T12:00:00').getTime();
  const start = p.since ? new Date(p.since + 'T12:00:00').getTime() : NaN;
  if (!Number.isFinite(start) || end <= start) {
    /* No start recorded, so the fraction cannot be honest. Fall back to health,
       which is derived rather than invented. */
    const h = healthOf(p.term, now);
    return h === 'lapsed' ? 0 : h === 'urgent' ? 0.05 : h === 'attention' ? 0.2 : 0.8;
  }
  return Math.max(0, Math.min(1, (end - now.getTime()) / (end - start)));
}

/**
 * MEMOISED PER CAR.
 *
 * `protectionsOf` and `stateOf` are each called several times per render — Home
 * asks for protections and Garage asks again for every car, and both walk the
 * booking list. A `WeakMap` keyed on the `CarPicture` gives one computation per
 * car per request and releases with it, so nothing is cached across customers or
 * across requests.
 */
const protectionCache = new WeakMap<CarPicture, ReturnType<typeof computeProtections>>();
const stateCache = new WeakMap<CarPicture, { word: string; line?: string }>();

export function protectionsOf(car: CarPicture, catalogue: Service[], now = new Date()) {
  const hit = protectionCache.get(car);
  if (hit) return hit;
  const out = computeProtections(car, catalogue, now);
  protectionCache.set(car, out);
  return out;
}

/**
 * The car's protections, stored if they exist and projected from completed work
 * if they do not. Never merged — `projectProtections` documents why.
 */
function computeProtections(car: CarPicture, catalogue: Service[], now = new Date()) {
  if (car.protections.length > 0) {
    return sortByUrgency(car.protections.map(p => liveProtection(p, now)));
  }
  const completed = car.bookings
    .filter(b => b.status === 'completed')
    .map(b => ({
      id: b.id,
      serviceName: b.serviceName,
      serviceCategory: b.serviceCategory,
      scheduledDate: b.scheduledDate,
    }));
  if (completed.length === 0) return [];
  return projectProtections({ vehicleId: car.vehicle.id, completed, catalogue, now });
}

/** The visit a customer would call "happening now", if there is one. */
function liveBooking(car: CarPicture): Booking | undefined {
  return car.bookings.find(b => visitPhase(b.status) === 'live')
    ?? car.bookings.find(b => visitPhase(b.status) === 'agreed')
    ?? car.bookings.find(b => visitPhase(b.status) === 'proposed');
}

/** What is happening to the car, in the present tense (§5.3 #2). Memoised. */
/**
 * THE ONE STATE WORD, for every surface that shows one.
 *
 * Home reads the full ownership engine (11 states, docs/HOME-STATE-MAP.md).
 * Garage and Vehicle show only the word — but it must be the SAME word, or the
 * same car reads "Cared for" on one screen and "Protected" on the next. That
 * divergence is what `lib/os/*` was written to prevent, and a test caught it
 * the moment Home was reconnected.
 *
 * Their own surfaces are rebuilt in their own milestones; this only makes the
 * vocabulary agree in the meantime.
 */
export function stateWordFor(
  picture: CustomerPicture,
  car: CarPicture,
  now = new Date(),
): string {
  const protections = protectionsOf(car, picture.catalogue, now);
  return homeStateCopy(readOwnership(picture, car, protections, now), car.vehicle.name).word;
}

export function stateOf(car: CarPicture): { word: string; line?: string } {
  const hit = stateCache.get(car);
  if (hit) return hit;
  const out = computeState(car);
  stateCache.set(car, out);
  return out;
}

function computeState(car: CarPicture): { word: string; line?: string } {
  const b = liveBooking(car);
  if (!b) {
    const finished = car.bookings.some(b2 => b2.status === 'completed');
    return finished
      ? { word: 'Protected', line: undefined }
      : { word: 'Awaiting its first visit', line: undefined };
  }
  const phase = visitPhase(b.status);
  if (phase === 'live') {
    const act = careAct(b.status);
    return act
      ? { word: ACT_TITLE[act], line: ACT_LINE[act] }
      : { word: 'In the studio' };
  }
  return { word: PHASE_TITLE[phase], line: PHASE_LINE[phase] };
}

/** "with AutoModz since 2023", from the earliest thing we have on the car. */
export function sinceWords(car: CarPicture, prefix = 'with AutoModz since'): string {
  const first = [
    millis(car.vehicle.createdAt),
    ...car.bookings.map(b => millis(b.createdAt)),
  ].filter(Boolean).sort((a, b) => a - b)[0];
  if (!first) return 'newly arrived';
  const year = new Date(first).getFullYear();
  const days = (Date.now() - first) / 86_400_000;
  return days < 30 ? 'joined this month' : `${prefix} ${year}`;
}

/* ── the visits a car has had ────────────────────────────────────────────── */

/**
 * The car's completed visits, newest first.
 *
 * §16.1 — "every COMPLETED visit". Sealed only, and STORED only.
 *
 * There used to be a fallback here that projected a visit from its Booking+Job
 * pair whenever `visits` was empty, because nothing wrote visits. It is gone:
 * `lib/server/sealVisit.ts` now writes one on completion and the backfill seals
 * every historical job. The fallback had to go for a reason beyond tidiness —
 * §22.5, truth is not recomputed. A projected visit read its warranty from the
 * live catalogue, so editing a price list rewrote what a past customer had been
 * promised. A sealed visit cannot be rewritten by anything.
 *
 * DEPLOY ORDER MATTERS: run `POST /api/visit/backfill` before or immediately
 * after shipping this. Until it has run, a car whose jobs predate the seal shows
 * no history — correctly, since nothing has been sealed for it yet, but visibly.
 */
/**
 * A car's HISTORY — sealed visits only.
 *
 * §16 — history never recalculates. A sealed visit carries its own services,
 * its own amounts and its own captured terms, so nothing here consults the
 * catalogue, the price list or the current warranties. It took a `catalogue`
 * argument that was never read (`_catalogue`), threaded through four call
 * sites; a parameter that exists but does nothing is an invitation to start
 * using it, which is exactly how a past visit starts changing.
 */
export function visitsOf(car: CarPicture): Visit[] {
  return car.visits.filter(v => v.status === 'sealed');
}

/** The photographs a visit produced, in the order they were taken. */
function framesOfVisit(visit: Visit, car: CarPicture) {
  const fromStages = visit.stages.flatMap(s =>
    s.media.filter(m => m.kind === 'photo').map(m => ({ url: m.url, caption: undefined as string | undefined })));
  if (fromStages.length > 0) return fromStages;

  const job = car.jobs.find(j => j.bookingId === visit.bookingId || j.id === visit.jobId);
  return (job?.photos ?? []).map(p => ({
    url: p.url,
    caption: p.kind === 'before' ? 'Before' : p.kind === 'after' ? 'After' : 'During',
  }));
}

/** One sentence about the visit, in the studio's own words where it left any. */
function visitLine(visit: Visit): string {
  const note = visit.stages.map(s => s.note).filter(Boolean).pop();
  if (note) return note;
  const names = visit.services.map(s => s.name);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}.` : `${names[0] ?? 'A visit'}.`;
}

function visitTitle(visit: Visit): string {
  const names = visit.services.map(s => s.name);
  return names[0] ?? 'A visit';
}

/* ── HOME ────────────────────────────────────────────────────────────────── */

export function toHome(picture: CustomerPicture, now = new Date()): HomeModel | null {
  const car = leadCar(picture);
  if (!car) return null;

  const protections = protectionsOf(car, picture.catalogue, now);
  const read = readOwnership(picture, car, protections, now);
  const visits = visitsOf(car);
  const latest = visits[0];
  const latestFrames = latest ? framesOfVisit(latest, car) : [];

  return {
    vehicle: {
      name: car.vehicle.name,
      plate: car.vehicle.registrationNumber,
      photo: car.vehicle.photo ?? car.vehicle.photos?.[0],
    },
    /* THE STATE, FROM THE ENGINE — not from a hand-rolled condition here.
       `lib/os/ownership` resolves 11 states in a documented precedence; this
       used to be five branches over booking status alone, which meant a lapsed
       membership, a refused visit, a dormant car and an expiring warranty were
       all literally unsayable. See docs/HOME-STATE-MAP.md. */
    state: homeStateCopy(read, car.vehicle.name),
    /* §15.2 — "a membership is a protection. It appears alongside everything
       else protecting the car." It lives in `subscriptions` rather than
       `protections`, so it is projected in here rather than being absent from
       the one surface that shows the car whole. */
    protections: [
      ...protections.map(p => ({
        id: p.id,
        label: PROTECTION_TITLE[p.kind],
        term: termWords(p.term, now),
        remaining: remainingOf(p, now),
        tone: TONE[p.health],
      })),
      ...membershipAsProtection(picture.subscription, now),
    ],
    nextAction: resolveAction(read.nextAction),

    liveActivity: latest ? {
      title: visitTitle(latest),
      when: longDate(isoOf(latest.createdAt)),
      note: visitLine(latest),
      photo: latestFrames[0]?.url,
      href: hrefForDestination({ to: 'visit', visitId: latest.id }),
    } : undefined,

    /* THE TIMELINE — one living record, reusable on Vehicle and History.
       Future events sort above the present, so a booked visit and an expiring
       warranty both read as things coming toward the owner. */
    timeline: projectTimeline({ car, protections, club: read.club, now })
      .map<HomeTimelineEvent>(e => ({
        id: e.id,
        title: e.title,
        line: e.line,
        when: longDate(e.at.toISOString().slice(0, 10)),
        href: hrefForRef(e.ref),
        ahead: e.ahead,
      })),

    studio: {
      name: COMPANY.name,
      address: COMPANY.address,
      directions: COMPANY.mapsUrl,
      call: telLink(),
      message: waLink(`Hi ${COMPANY.name}! A question about my ${car.vehicle.name}.`),
    },
  };
}

/**
 * §15.2 — the membership, in the shape every other protection takes. Its term
 * is dated with grace, which is the shape `Term` already gives a membership.
 */
function membershipAsProtection(sub: Subscription | null, now: Date): HomeProtection[] {
  if (!sub || sub.status === 'cancelled') return [];
  const term: Term = { kind: 'dated', expiresOn: sub.endDate, grace: true };
  const left = washesLeftOf(sub);
  return [{
    id: `membership_${sub.id}`,
    label: PROTECTION_TITLE.membership,
    /* What remains is washes, not days — §14.3's balance shape in words. */
    term: left === 0 ? termWords(term, now) : `${left} washes left`,
    remaining: sub.washesTotal > 0 ? left / sub.washesTotal : 0,
    tone: TONE[healthOf(term, now)],
  }];
}

/**
 * §12.3 forbids a primary car, so this is not one. It is the car the STUDIO has
 * touched most recently — the first position in the strip, which any car can
 * occupy and none holds.
 */
export function leadCar(picture: CustomerPicture): CarPicture | undefined {
  return [...picture.cars].sort((a, b) => attention(b) - attention(a))[0];
}

const attention = (car: CarPicture): number => {
  const live = liveBooking(car);
  if (live && visitPhase(live.status) === 'live') return Number.MAX_SAFE_INTEGER;
  return Math.max(millis(car.vehicle.createdAt), ...car.bookings.map(b => millis(b.createdAt)), 0);
};

/* ── GARAGE ──────────────────────────────────────────────────────────────── */

export function toGarage(picture: CustomerPicture, now = new Date()): GarageModel {
  const ordered = [...picture.cars].sort((a, b) => attention(b) - attention(a));

  return {
    vehicles: ordered.map(car => {
      const protections = protectionsOf(car, picture.catalogue, now);
      const worst = protections[0];
      return {
        id: car.vehicle.id,
        name: car.vehicle.name,
        plate: car.vehicle.registrationNumber,
        photo: car.vehicle.photo ?? car.vehicle.photos?.[0],
        state: stateWordFor(picture, car, now),
        protection: !worst
          ? 'Nothing declared yet'
          : worst.health === 'healthy'
            ? 'Fully protected'
            : `${PROTECTION_TITLE[worst.kind]}, ${termWords(worst.term, now).toLowerCase()}`,
        relationship: sinceWords(car),
        href: hrefForDestination({ to: 'vehicle', vehicleId: car.vehicle.id }),
      };
    }),
    beginHref: hrefForDestination({ to: 'studio' }),

    /* The same cars in the shape the form writes back. Projected here rather
       than derived in the screen: a renderer that reshaped domain objects
       would be doing the projection's job (ARCHITECTURE §1). */
    editable: ordered.map(car => ({
      id: car.vehicle.id,
      name: car.vehicle.name,
      registrationNumber: car.vehicle.registrationNumber,
    })),
  };
}

/* ── VEHICLE ─────────────────────────────────────────────────────────────── */

/**
 * §11.4's regions are authored per photograph — only whoever looked at the
 * image knows where its wheels are. Nothing records them yet, so a real
 * photograph carries none and the car cannot be asked about itself. The screen
 * is whole without the interaction (§18.1) and this is the one place that has
 * to change when the studio starts marking them.
 */
function regionsFor(_vehicle: Vehicle): readonly { id: RegionId; x: number; y: number }[] {
  return [];
}

export function toVehiclePhotograph(car: CarPicture): PhotographSource {
  const url = car.vehicle.photo ?? car.vehicle.photos?.[0];
  return {
    url,
    aspect: 1,
    description: url ? `${car.vehicle.name}, photographed at AutoModz` : undefined,
    regions: regionsFor(car.vehicle),
  };
}

/** Which part of the car a protection guards. Only physical ones guard a part. */
const REGION_OF: Partial<Record<ProtectionKind, RegionId>> = {
  ppf: 'paint', ceramic: 'paint', glass: 'glass', interior: 'interior',
};

export function toVehicle(car: CarPicture, picture: CustomerPicture, now = new Date()): VehicleModel {
  const catalogue = picture.catalogue;
  const protections = protectionsOf(car, catalogue, now);

  const byRegion: VehicleProtection[] = [];
  for (const p of protections) {
    const region = REGION_OF[p.kind];
    if (!region || byRegion.some(x => x.region === region)) continue;
    byRegion.push({
      region,
      label: PROTECTION_TITLE[p.kind],
      term: termWords(p.term, now),
      documentHref: p.document ? p.document.url : undefined,
    });
  }

  return {
    name: car.vehicle.name,
    plate: car.vehicle.registrationNumber,
    state: stateWordFor(picture, car, now),
    since: sinceWords(car, 'With AutoModz since').replace(/^with/, 'With'),
    /* Carries the car. Without it, following History from the second car in a
       garage showed the FIRST car's life. */
    historyHref: hrefForDestination({ to: 'history.car', vehicleId: car.vehicle.id }),
    protections: byRegion,

    /* THE CAR'S MEDIA, month by month — `os/moment`, connected. The old
       Garage carried this for the selected car; the car has its own room now,
       so it lives here. The engine derives the frames from the jobs; nothing
       is re-derived. */
    media: groupByMonth(sortMoments(projectMoments({
      vehicleId: car.vehicle.id,
      jobs: car.jobs,
      visitByJob: new Map(
        car.jobs.filter(j => j.bookingId).map(j => [j.id, j.bookingId as string]),
      ),
    }))).map(g => ({
      month: g.label,
      frames: g.moments.flatMap(m =>
        m.media.map((f, i) => ({
          id: `${m.id}-${i}`,
          url: f.url,
          caption: m.caption,
          visitHref: m.visitId
            ? hrefForDestination({ to: 'visit', visitId: m.visitId })
            : undefined,
        })),
      ),
    })).filter(g => g.frames.length > 0),

    /* Correcting the car is the Garage's form, addressed. */
    editHref: hrefForDestination({ to: 'garage.edit', vehicleId: car.vehicle.id }),
    /* §18.4's invitation. Was `'/studio'`, which has no declare flow. */
    declareHref: waLink(
      `Hello AutoModz — I would like to add what protects my ${car.vehicle.name}.`,
    ),
  };
}

/* ── HISTORY ─────────────────────────────────────────────────────────────── */

/**
 * A car's history. §16 — sealed visits only, and the papers they handed over.
 * The catalogue argument is gone: nothing here may consult it (see `visitsOf`).
 */
export function toHistory(car: CarPicture, invoices: Invoice[] = []): HistoryModel {
  const visits = visitsOf(car);
  return { vehicle: car.vehicle.name, visits: visits.map(v => toVisit(v, car, invoices)) };
}

export function toVisit(
  visit: Visit,
  car: CarPicture,
  invoices: Invoice[] = [],
): HistoryVisit {
  /* THE PAPERS THIS VISIT HANDED OVER. Matched on the visit's own ids, never
     on date or amount — those can coincide. `documents` was hardcoded `[]`, so
     no chapter has ever shown its invoice. */
  const invoice = invoices.find(i =>
    (visit.bookingId && i.bookingId === visit.bookingId)
    || (visit.jobId && i.jobId === visit.jobId));
  const frames = framesOfVisit(visit, car);
  const [cover, ...rest] = frames;

  return {
    id: visit.id,
    when: longDate(isoOf(visit.createdAt)),
    title: visitTitle(visit),
    line: visitLine(visit),
    photo: cover ? { url: cover.url, description: `${car.vehicle.name}, finished at AutoModz` } : undefined,
    did: visit.stages.map(s => s.note).filter(Boolean).join(' ')
      || visit.services.map(s => s.name).join(', '),
    photos: rest.map(f => ({
      url: f.url,
      description: `${car.vehicle.name} at AutoModz`,
      caption: f.caption,
    })),
    /* §16.2 — what it promised, as captured at seal. Never recomputed. */
    promised: visit.termsCaptured.map(t => ({
      label: PROTECTION_TITLE[t.kind],
      term: termWords(t.term).toLowerCase(),
    })),
    /* §16 — the amount as SEALED, not as the price list reads today. */
    settled: visit.amounts.total > 0
      ? `₹${visit.amounts.total.toLocaleString('en-IN')}`
      : undefined,
    /* SHARE. The chapter's public address is the invoice's share token, and
       `/api/invoice/[id]?view=chapter` already strips amounts, the phone and
       every internal reference before anything leaves the server. */
    shareHref: invoice
      ? hrefForDestination({ to: 'chapter', invoiceId: invoice.id, token: invoice.publicToken })
      : undefined,
    documents: invoice
      ? [{
          /* Its own share token, so the paper opens for whoever holds the
             link — the same token the studio sends. */
          label: invoice.paymentStatus === 'paid'
            ? `Receipt · ${invoice.invoiceNumber}`
            : `Invoice · ${invoice.invoiceNumber}`,
          href: hrefForDestination({
            to: 'invoice', invoiceId: invoice.id, token: invoice.publicToken,
          }),
        }]
      : [],
  };
}

/* ── STUDIO ──────────────────────────────────────────────────────────────── */

/**
 * THE LIVE VISIT. Null unless the car is actually here — a countdown to a
 * moment that has passed is worse than none. Every value is `os/stay`'s.
 */
export function toLiveVisit(
  picture: CustomerPicture,
  car: CarPicture,
  bookingId: string,
  now = new Date(),
): LiveVisitModel | null {
  const protections = protectionsOf(car, picture.catalogue, now);
  const read = readOwnership(picture, car, protections, now);
  if (!read.live || read.live.id !== bookingId || !read.stay) return null;

  const stay = read.stay;
  const job = car.jobs.find(j => j.bookingId === bookingId);
  const frames = (job?.photos ?? []).map((p, i) => ({
    id: `${bookingId}-${i}`,
    url: p.url,
    caption: SHOT_CAPTION[p.kind as 'before' | 'during' | 'after'],
  }));

  return {
    id: bookingId,
    vehicleName: car.vehicle.name,
    word: ACT_TITLE[stay.act],
    line: stay.narration,
    timing: stay.timing ?? undefined,
    service: read.live.serviceName,
    acts: stay.acts.map(a => ({
      label: a.title,
      done: a.state === 'done',
      current: a.state === 'current',
    })),
    frames,
    hero: stay.latestPhoto ?? car.vehicle.photo,
    backHref: hrefForDestination({ to: 'vehicle', vehicleId: car.vehicle.id }),
  };
}

export function toStudio(picture: CustomerPicture): StudioModel {
  const here = picture.cars.find(c => {
    const b = liveBooking(c);
    return b && visitPhase(b.status) === 'live';
  });

  return {
    place: 'Maninagar · Ahmedabad',
    /* §4.5 — the absence of news is good news and should look like it. */
    presence: here ? 'Your car is here' : 'Your car is with you',
    visitHref: here ? hrefForDestination({ to: 'vehicle' }) : undefined,
    voice:
      'Every car is inspected in daylight before anything is put on it. '
      + 'Paint is corrected by hand, panel by panel, and nothing is coated until '
      + 'the surface underneath is right. If a car is not ready, it stays.',
    does: 'Paint correction and ceramic coating. Paint protection film. Glass and '
      + 'wheel sealing. Interior deep cleaning and leather care. Wash and '
      + 'maintenance for cars already protected here.',
    credentials: [],
    hours: `Open ${COMPANY.hours.open} to ${COMPANY.hours.close}, every day.`,
    address: COMPANY.address,
    directionsHref: COMPANY.mapsUrl,
    /* §6.3's primary action opens the booking flow in place. It used to be an
       outbound WhatsApp link, because there was no in-app booking surface —
       the most important control in the product handed the customer to another
       application. There is one now. */
    /* MADE PLAIN AT THE BOUNDARY. `StudioScreen` is a client component, and
       these three are the only things in any projection handed to a renderer
       as whole Firestore documents — the booking flow wants the Service
       objects themselves. Those documents carry `Timestamp` CLASS instances
       (`Service.createdAt`, `Vehicle.createdAt`, `Subscription.createdAt` and
       friends), and React refuses to serialise a class instance across the
       server/client boundary. The room threw for every signed-in customer.

       Converted HERE rather than in `loadCustomerPicture`: `customerPicture`,
       `ownership` and this file all sort on `createdAt?.toMillis?.()`, which
       with optional chaining would quietly return 0 for a converted value and
       break every ordering in the product without raising anything. */
    booking: {
      services: plainValue(picture.catalogue) as Service[],
      vehicles: plainValue(picture.cars.map(c => c.vehicle)) as Vehicle[],
      membership: (plainValue(picture.subscription ?? null) ?? null) as Subscription | null,
    },

    /* EVERY VISIT THE CUSTOMER MAY STILL CHANGE. `changeable` mirrors
       firestore.rules — pending or confirmed only — so the sheet never offers
       an act the server will refuse. The rule is enforced there, not here. */
    manageable: picture.cars.flatMap(car =>
      car.bookings
        .filter(b => ['pending', 'confirmed'].includes(b.status))
        .map(b => ({
          id: b.id,
          service: b.serviceName,
          vehicleName: car.vehicle.name,
          scheduledDate: b.scheduledDate,
          scheduledTime: b.scheduledTime,
          durationMinutes: b.serviceDurationMinutes ?? 60,
          changeable: true,
        })),
    ),
  };
}

/* ── YOU ─────────────────────────────────────────────────────────────────── */

const CARS_IN_WORDS = ['No cars', 'One car', 'Two cars', 'Three cars', 'Four cars', 'Five cars'];

export function toYou(picture: CustomerPicture, now = new Date()): YouModel {
  const { user, subscription, cars } = picture;
  const n = cars.length;
  const count = CARS_IN_WORDS[n] ?? `${n} cars`;

  return {
    name: user.name || 'You',
    reachedAt: [user.email, user.phone].filter(Boolean).join(' · '),
    garage: {
      line: `${count} live${n === 1 ? 's' : ''} here.`,
      action: { label: 'Your garage', href: hrefForDestination({ to: 'garage' }) },
    },
    membership: subscription ? {
      lines: membershipLines(subscription, now),
      action: { label: 'What it includes', href: hrefForDestination({ to: 'membership' }) },
    } : undefined,
    /* THE SURFACES NOW EXIST, so the controls return. Each opened `/you` —
       the address it was already on — and was omitted rather than left inert.
       The three sheet-backed ones are addressed (`?panel=`), so each is
       linkable and closed by the back button. */
    details: {
      line: 'Your name and how we reach you.',
      action: { label: 'Your details',
        href: hrefForDestination({ to: 'profile.panel', panel: 'profile' }) },
    },
    notifications: {
      line: 'What we tell you, and where.',
      action: { label: 'Notifications',
        href: hrefForDestination({ to: 'profile.panel', panel: 'notifications' }) },
    },
    ownership: {
      line: 'Bring someone with you.',
      action: { label: 'Invite a friend',
        href: hrefForDestination({ to: 'profile.panel', panel: 'referral' }) },
    },
    privacy: {
      line: 'What we hold, and why.',
      action: { label: 'Privacy', href: hrefForDestination({ to: 'privacy' }) },
    },
    terms: {
      line: 'How we work.',
      action: { label: 'Terms', href: hrefForDestination({ to: 'terms' }) },
    },
    deletion: {
      line: 'Leaving for good?',
      action: { label: 'Delete your account',
        href: hrefForDestination({ to: 'profile.panel', panel: 'delete' }) },
    },
    support: {
      line: 'Something not right?',
      /* Was `COMPANY.mapsUrl` — "Talk to us" opened Google Maps. The studio's
         actual channel is WhatsApp. */
      action: { label: 'Talk to us', href: waLink('Hello AutoModz —') },
    },
  };
}

/**
 * §15.3's first three facts. THE FOURTH — "what it has been worth" — is not
 * here, and its absence is deliberate: it must be the honest cumulative saving
 * from settled visits, and nothing records that yet. A plausible number would
 * be the one figure §15.3 says decides renewal, invented.
 */
function membershipLines(sub: Subscription, now: Date): string[] {
  const remaining = washesLeftOf(sub);
  const term: Term = { kind: 'dated', expiresOn: sub.endDate, grace: true };
  const health = healthOf(term, now);
  return [
    `${sub.plan} member.`,
    `${remaining === 0 ? 'No washes' : remaining === 1 ? 'One wash' : `${remaining} washes`} left this cycle.`,
    health === 'lapsed'
      ? `Lapsed ${longDate(sub.endDate)}.`
      : `Renews ${longDate(sub.endDate)}.`,
  ];
}

/* ── MEMBERSHIP ──────────────────────────────────────────────────────────── */

export function toMembership(picture: CustomerPicture, now = new Date()): MembershipModel {
  /* THE ENGINE DECIDES. `os/club` already owns the state, the cycle's
     arithmetic and the one true sentence under the card. This used to recompute
     `remaining` and the health locally — a second implementation of the same
     membership maths, which is exactly what §22.2 forbids. */
  const club = clubOf(picture, now);
  const sub = picture.subscription;

  const history = picture.subscriptions.map(s => ({
    id: s.id,
    plan: `${s.plan} member`,
    period: `${longDate(s.startDate)} — ${longDate(s.endDate)}`,
    status: s.status,
  }));

  if (club.state === 'none' || !sub) {
    return { held: false, history };
  }

  const term: Term = { kind: 'dated', expiresOn: sub.endDate, grace: true };
  const health = healthOf(term, now);
  const plan = MEMBERSHIP_PLANS.find(p => p.id === sub.plan);
  const days = cycleDaysLeft(club, now);

  return {
    held: true,
    tier: `${club.plan} member`,
    /* §15.3 #2 — the engine's own count, not a second subtraction. */
    remaining: club.washesLeft === 0
      ? 'No washes left this cycle'
      : `${club.washesLeft} of ${club.washesTotal} washes left this cycle`,
    share: club.washesTotal > 0 ? club.washesLeft / club.washesTotal : undefined,
    term: health === 'lapsed'
      ? `Lapsed ${longDate(sub.endDate)}`
      : `Renews ${longDate(sub.endDate)}`,
    /* §14.4 — a countdown only when the number is small enough to act on. */
    countdown: days !== null && days >= 0 && days <= 30
      ? `${days} day${days === 1 ? '' : 's'} left in this cycle`
      : undefined,
    awaitingPayment: club.awaitingPayment,
    tone: TONE[health],
    benefits: plan?.perks,
    /* The benefit is used, not admired — a wash that is already paid for is
       booked like any other, with the category chosen. Only when there is one
       left and the membership is actually in force. */
    bookWashHref: club.state === 'active' && club.washesLeft > 0
      ? hrefForDestination({ to: 'studio.category', category: 'Washing' })
      : undefined,
    subscriptionId: sub.id,
    currentPlan: sub.plan,
    history,
  };
}

