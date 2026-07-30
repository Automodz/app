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
import type { Booking, Protection, ProtectionKind, Service, Subscription, Vehicle, Visit } from '@/lib/types';
import { PROTECTION_TITLE } from '@/lib/types';
import { COMPANY, waLink } from '@/lib/company';
import { healthOf, termDaysLeft, type Health, type Term } from '@/lib/os/term';
import { liveProtection, projectProtections, sortByUrgency } from '@/lib/os/protection';
import { visitPhase, careAct, ACT_TITLE, ACT_LINE, PHASE_TITLE, PHASE_LINE } from '@/lib/os/visit';
import type { CarPicture, CustomerPicture } from './source';

import type { HomeModel, HomeProtection } from '@/components/screens/HomeScreen';
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

function protectionsOf(car: CarPicture, catalogue: Service[], now = new Date()) {
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
export function visitsOf(car: CarPicture, _catalogue: Service[]): Visit[] {
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

  const state = stateOf(car);
  const live = liveBooking(car);
  const protections = protectionsOf(car, picture.catalogue, now);
  const visits = visitsOf(car, picture.catalogue);
  const latest = visits[0];
  const latestFrames = latest ? framesOfVisit(latest, car) : [];

  return {
    vehicle: {
      name: car.vehicle.name,
      plate: car.vehicle.registrationNumber,
      photo: car.vehicle.photo ?? car.vehicle.photos?.[0],
    },
    state: {
      word: state.word,
      line: state.line,
      action: live && visitPhase(live.status) === 'live'
        ? { label: 'Follow it live', href: `/vehicle?car=${car.vehicle.id}` }
        : undefined,
    },
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
    latest: latest ? {
      title: visitTitle(latest),
      when: longDate(isoOf(latest.createdAt)),
      note: visitLine(latest),
      photo: latestFrames[0]?.url,
      href: `/history/${latest.id}`,
    } : undefined,
  };
}

/**
 * §15.2 — the membership, in the shape every other protection takes. Its term
 * is dated with grace, which is the shape `Term` already gives a membership.
 */
function membershipAsProtection(sub: Subscription | null, now: Date): HomeProtection[] {
  if (!sub || sub.status === 'cancelled') return [];
  const term: Term = { kind: 'dated', expiresOn: sub.endDate, grace: true };
  const left = Math.max(0, sub.washesTotal - sub.washesUsed);
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
        state: stateOf(car).word,
        protection: !worst
          ? 'Nothing declared yet'
          : worst.health === 'healthy'
            ? 'Fully protected'
            : `${PROTECTION_TITLE[worst.kind]}, ${termWords(worst.term, now).toLowerCase()}`,
        relationship: sinceWords(car),
        href: `/vehicle?car=${car.vehicle.id}`,
      };
    }),
    beginHref: '/studio',
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

export function toVehicle(car: CarPicture, catalogue: Service[], now = new Date()): VehicleModel {
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
    state: stateOf(car).word,
    since: sinceWords(car, 'With AutoModz since').replace(/^with/, 'With'),
    /* Carries the car. Without it, following History from the second car in a
       garage showed the FIRST car's life. */
    historyHref: `/history?car=${car.vehicle.id}`,
    protections: byRegion,
    /* §18.4's invitation. Was `'/studio'`, which has no declare flow. */
    declareHref: waLink(
      `Hello AutoModz — I would like to add what protects my ${car.vehicle.name}.`,
    ),
  };
}

/* ── HISTORY ─────────────────────────────────────────────────────────────── */

export function toHistory(car: CarPicture, catalogue: Service[]): HistoryModel {
  const visits = visitsOf(car, catalogue);
  return { vehicle: car.vehicle.name, visits: visits.map(v => toVisit(v, car)) };
}

export function toVisit(visit: Visit, car: CarPicture): HistoryVisit {
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
    settled: visit.amounts.total > 0
      ? `₹${visit.amounts.total.toLocaleString('en-IN')}`
      : undefined,
    documents: [],
  };
}

/* ── STUDIO ──────────────────────────────────────────────────────────────── */

export function toStudio(picture: CustomerPicture): StudioModel {
  const here = picture.cars.find(c => {
    const b = liveBooking(c);
    return b && visitPhase(b.status) === 'live';
  });

  return {
    place: 'Maninagar · Ahmedabad',
    /* §4.5 — the absence of news is good news and should look like it. */
    presence: here ? 'Your car is here' : 'Your car is with you',
    visitHref: here ? '/vehicle' : undefined,
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
    /* §6.3's primary action. Was `'/studio'` — the address it is already on, so
       the single most important control in the product did nothing. There is no
       in-app booking surface, so it opens the channel the studio actually takes
       bookings on rather than pretending to have one. */
    arrangeHref: waLink('Hello AutoModz — I would like to arrange a visit.'),
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
      action: { label: 'Your garage', href: '/garage' },
    },
    membership: subscription ? {
      lines: membershipLines(subscription, now),
      action: { label: 'What it includes', href: '/membership' },
    } : undefined,
    /* §10.5 — notifications, ownership and privacy are OMITTED, not pointed at
       `/you`. Each had no surface to open, so each was a control that navigated
       to the address it was already on. They return the day those surfaces
       exist; until then the room is honest. */
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
  const remaining = Math.max(0, sub.washesTotal - sub.washesUsed);
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
  const sub = picture.subscription;
  if (!sub) {
    return {
      held: false,
      joinHref: waLink('Hello AutoModz — I would like to know about the club.'),
    };
  }

  const term: Term = { kind: 'dated', expiresOn: sub.endDate, grace: true };
  const remaining = Math.max(0, sub.washesTotal - sub.washesUsed);
  const health = healthOf(term, now);

  return {
    held: true,
    tier: `${sub.plan} member`,
    /* §15.3 #2 and #3, in the engine's own words. */
    remaining: remaining === 0
      ? 'No washes left this cycle'
      : `${remaining} of ${sub.washesTotal} washes left this cycle`,
    term: health === 'lapsed'
      ? `Lapsed ${longDate(sub.endDate)}`
      : `Renews ${longDate(sub.endDate)}`,
    tone: TONE[health],
    /* §15.6 — leaving must be reachable. Was `'/you'`, which cancelled nothing.
       Rules DO allow an owner to set `status: 'cancelled'`, so an in-app cancel
       is buildable; it needs a confirmation surface, which is a feature. Until
       then this reaches the one channel that can actually end a membership. */
    leaveHref: waLink('Hello AutoModz — I would like to leave the club.'),
  };
}
