/**
 * FIRESTORE → THE SCREENS.
 *
 * Pure functions. Every customer room's model is built here, from one
 * `CustomerPicture`, so no screen ever touches a Firestore document and no two
 * rooms can compute a different answer for the same car (§22.5).
 *
 * Everything derived - health, term wording, the visit's act, the protection
 * fallback - comes from the existing engines in `lib/os`. Nothing is
 * re-implemented here; this file only chooses words and shapes.
 */
import type { Approval, Booking, Estimate, Invoice, PaymentStatus, Notification, Protection, ProtectionKind, Service, Subscription, Vehicle, Visit } from '@/lib/types';
import { PROTECTION_TITLE, MEMBERSHIP_PLANS } from '@/lib/types';
import { COMPANY, waLink } from '@/lib/company';
import { healthOf, termDaysLeft, type Health, type Term } from '@/lib/os/term';
import {
  liveProtection, projectProtections, sortByUrgency, oneProtectionPerKind, measurementOf,
} from '@/lib/os/protection';
import {
  readPuc, mayDeclare, PUC, PUC_TONE, PUC_STATUS_WORD, type PucState,
} from '@/lib/os/puc';
import {
  visitPhase, careAct, ACT_TITLE, ACT_LINE, PHASE_TITLE, PHASE_LINE, visitDateOf,
} from '@/lib/os/visit';
import type { CarPicture, CustomerPicture } from './source';
import { readOwnership, clubOf, proposalApplies, liveOf, nextVisitOf, upcomingOf, soonestFirst, isUpcoming } from './ownership';
import { DOT } from '@/design';
import { cycleDaysLeft, type ClubModel } from '@/lib/os/club';
import { MEMBERSHIP_WORD } from '@/lib/os/membership';
import {
  changeWindowOf, bookingTransition, scheduledEpochMs, approvalHasExpired,
  CHANGE_WINDOW_HOURS, STUDIO_UTC_OFFSET_MIN,
} from '@/lib/os/lifecycle';
import { spanDays, DAY_OPEN_MIN, WORK_DAY_MIN } from '@/lib/availability';
import { scopesOf, addOnsOf } from '@/lib/os/scope';
import { shortAddress, fullAddress } from '@/lib/os/address';
import { maskVpa } from '@/lib/os/upi';
import { hasPublicHistoryConsent } from '@/lib/os/consent';
import { PICKUP_LEG_FEE } from '@/lib/services/pricing';
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
import type { PucModel, PucCertificate } from '@/components/screens/PucScreen';
import type { PhotographSource } from '@/components/vehicle';
import type { RegionId } from '@/components/vehicle';
import type { HistoryModel, HistoryVisit } from '@/components/screens/HistoryScreen';
import type { StudioModel } from '@/components/screens/StudioScreen';
import type { BookedModel, BookedRow } from '@/components/screens/BookedScreen';
import type { ManageBookingModel } from '@/components/studio/ManageBooking';
import type { ScopeQuoteModel } from '@/components/studio/ScopeAndQuote';
import type { ApprovalModel } from '@/components/studio/ApprovalScreen';
import type { SettleModel, SettleLine } from '@/components/studio/SettleScreen';
import { PAYMENT_WORD, PAYMENT_LINE, settlementOf } from '@/lib/os/settlement';
import type { CarriedEstimate } from '@/components/studio/BookingFlow';
import type { YouModel } from '@/components/screens/YouScreen';
import type { MembershipModel } from '@/components/screens/MembershipScreen';

/* ── shared vocabulary ───────────────────────────────────────────────────── */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "12 July 2026". §16.4-adjacent: a date a customer would say out loud. */
export function longDate(iso: string | null | undefined): string {
  /* SIXTEEN CALLERS, AND ANY ONE OF THEM CAN BE HANDED NOTHING. A membership
     benefit with no date threw here and took the whole Club room to the error
     boundary - the guard two lines below was already thinking about a
     malformed date and never about an absent one. §19.1: an absence is a
     state. Empty, so `x ? longDate(x) : ''` at a call site still reads the
     same and nothing prints a stray fragment. */
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "March 2029" - §14.4, beyond a season the date alone speaks. */
function monthYear(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return y && m ? `${MONTHS[m - 1]} ${y}` : iso;
}

const millis = (t?: { toMillis?: () => number }) => t?.toMillis?.() ?? 0;
/** §9.2's four states, from the engine's four healths. */
const TONE: Record<Health, HomeProtection['tone']> = {
  healthy: 'assent', attention: 'caution', urgent: 'urgent', lapsed: 'lapsed',
};

/**
 * WHERE A VISIT THAT HAS NOT STARTED IS REACHED.
 *
 * Not `/history/{id}`. Home's NEXT VISIT block pointed there, and a booking has
 * no record until it is sealed - so tapping the visit you have booked told a
 * customer with four cars in their garage "Your car's place is ready. Add your
 * car."
 *
 * It then pointed at `/studio?manage=<id>`, a sheet over the Studio, which was
 * the only surface a pending visit had. A booking has its OWN two screens now
 * (design 09 and 10), so this is the confirmation - what the studio holds -
 * and the manage screen is one tap further in, exactly as the design draws it.
 */
const manageHref = (bookingId: string) =>
  hrefForDestination({ to: 'booking', bookingId });

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
  /* §14.4 - "a countdown is honest only when the number is small enough to act
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
 * `protectionsOf` and `stateOf` are each called several times per render - Home
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
 * if they do not. Never merged - `projectProtections` documents why.
 */
function computeProtections(car: CarPicture, catalogue: Service[], now = new Date()) {
  if (car.protections.length > 0) {
    /* §14.2 - a car has ONE answer per kind. Enforced in the engine rather than
       by an id convention any writer can route around; production carries two
       glass protections for one car because a seed chose its own id. */
    return sortByUrgency(
      oneProtectionPerKind(car.protections).map(p => liveProtection(p, now)),
    );
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

/* `liveBooking` STOOD HERE - the second implementation of "the next visit",
   and the one that disagreed with the first. It read `car.bookings` in
   `createdAt` order and returned the newest open booking rather than the
   soonest, and it never looked at whether the day had already passed. Both
   answers now come from `lib/customer/ownership`: `liveOf` for the visit
   actually in flight, `nextVisitOf` for the one still ahead. Two questions,
   two functions, one answer each. */

/** What is happening to the car, in the present tense (§5.3 #2). Memoised. */
/**
 * THE ONE STATE WORD, for every surface that shows one.
 *
 * Home reads the full ownership engine (11 states, docs/HOME-STATE-MAP.md).
 * Garage and Vehicle show only the word - but it must be the SAME word, or the
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

export function stateOf(car: CarPicture, now = new Date()): { word: string; line?: string } {
  const hit = stateCache.get(car);
  if (hit) return hit;
  const out = computeState(car, now);
  stateCache.set(car, out);
  return out;
}

function computeState(car: CarPicture, now: Date): { word: string; line?: string } {
  /* The visit in flight outranks the one that is coming - a car being worked on
     is not "booked in". Both from the canonical readers. */
  const b = liveOf(car) ?? nextVisitOf(car, now);
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
 * §16.1 - "every COMPLETED visit". Sealed only, and STORED only.
 *
 * There used to be a fallback here that projected a visit from its Booking+Job
 * pair whenever `visits` was empty, because nothing wrote visits. It is gone:
 * `lib/server/sealVisit.ts` now writes one on completion and the backfill seals
 * every historical job. The fallback had to go for a reason beyond tidiness -
 * §22.5, truth is not recomputed. A projected visit read its warranty from the
 * live catalogue, so editing a price list rewrote what a past customer had been
 * promised. A sealed visit cannot be rewritten by anything.
 *
 * DEPLOY ORDER MATTERS: run `POST /api/visit/backfill` before or immediately
 * after shipping this. Until it has run, a car whose jobs predate the seal shows
 * no history - correctly, since nothing has been sealed for it yet, but visibly.
 */
/**
 * A car's HISTORY - sealed visits only.
 *
 * §16 - history never recalculates. A sealed visit carries its own services,
 * its own amounts and its own captured terms, so nothing here consults the
 * catalogue, the price list or the current warranties. It took a `catalogue`
 * argument that was never read (`_catalogue`), threaded through four call
 * sites; a parameter that exists but does nothing is an invitation to start
 * using it, which is exactly how a past visit starts changing.
 */
export function visitsOf(car: CarPicture): Visit[] {
  return car.visits.filter(v => v.status === 'sealed');
}

/* ── what a visit cost ───────────────────────────────────────────────────── */

/**
 * WHAT A VISIT COST - one figure, from one source, chosen once.
 *
 * Two numbers exist for the same visit and they are not the same kind of fact.
 * `visit.amounts.total` is what the visit was SEALED at, from the services it
 * carried. The invoice is what the studio actually billed, line by line, and
 * it is the document the customer holds. They can differ: the studio can raise
 * paper for a subset of the work, apply something at the counter, or correct a
 * figure after the visit was sealed.
 *
 * THE ALBUM AND THE RECORD DISAGREED IN PRODUCTION. `toHistory` summed the
 * sealed amounts and printed "₹2,12,640 settled in all"; opening the one visit
 * with an invoice showed ₹1,250, because `VisitScreen` prefers the receipt.
 * The album's total was ₹11,990 higher than the sum of everything the customer
 * could actually open, and nothing in the product could see the gap.
 *
 * The invoice wins where one exists - it is the money that changed hands and
 * the only figure with a document behind it. The sealed amount is the fallback,
 * which is most visits: the studio raises paper for a minority of them.
 *
 * AND EACH INVOICE IS CLAIMED BY AT MOST ONE VISIT. Matching is by the visit's
 * own ids, never by date or amount, and an invoice already taken by an earlier
 * visit cannot be counted again by a later one - otherwise two visits sharing a
 * booking would add the same money to the album twice.
 */
export interface VisitMoney {
  /** In rupees. Zero when neither source has a figure. */
  total: number;
  source: 'invoice' | 'sealed';
  invoice?: Invoice;
}

export function moneyOfVisits(
  visits: Visit[], invoices: Invoice[],
): Map<string, VisitMoney> {
  const claimed = new Set<string>();
  const out = new Map<string, VisitMoney>();

  for (const v of visits) {
    /* `!!v.bookingId` matters: three of the demo customer's four sealed visits
       carry an empty string, and an empty string must not match an invoice
       that simply has no booking. */
    const invoice = invoices.find(i =>
      !claimed.has(i.id)
      && ((!!v.bookingId && i.bookingId === v.bookingId)
        || (!!v.jobId && i.jobId === v.jobId)));

    if (invoice) {
      claimed.add(invoice.id);
      out.set(v.id, { total: invoice.total ?? 0, source: 'invoice', invoice });
    } else {
      out.set(v.id, { total: v.amounts?.total ?? 0, source: 'sealed' });
    }
  }
  return out;
}

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/**
 * THE PHOTOGRAPHS A JOB RECORDED, WITH THE KIND IT RECORDED THEM AS.
 *
 * `framesOfVisit` prefers stage media, and stage media carries `kind: 'photo'`
 * - the moment it was taken is not on it. The before/during/after distinction
 * exists ONLY on the job, and was therefore discarded for every visit whose
 * stages carried any media at all. That is why no visit could show a
 * comparison: not missing data, shadowed data.
 *
 * Read separately here, so the sequence keeps stage media as its source and
 * the comparison gets the kinds. Neither reaches into the other.
 */
function shotsOfVisit(visit: Visit, car: CarPicture) {
  const job = car.jobs.find(j => j.bookingId === visit.bookingId || j.id === visit.jobId);
  const photos = job?.photos ?? [];
  const of = (kind: string) => photos.filter(p => p.kind === kind).map(p => p.url);
  return { before: of('before'), during: of('during'), after: of('after') };
}

/** The photographs a visit produced, in the order they were taken. */
function framesOfVisit(visit: Visit, car: CarPicture) {
  /* `stages` and `stage.media` are REQUIRED by the type and not by Firestore.
     A sealed visit is an immutable historical record, so a document written
     before either field existed is still exactly as it was - and reading one
     unguarded threw, which took down the whole History room rather than
     costing that visit its photographs. §19.1: an absence is a state, never a
     crash. Nothing here invents a photograph; it just survives not finding
     one. */
  const fromStages = (visit.stages ?? []).flatMap(s =>
    (s.media ?? [])
      .filter(m => m.kind === 'photo')
      .map(m => ({ url: m.url, caption: undefined as string | undefined })));
  if (fromStages.length > 0) return fromStages;

  const job = car.jobs.find(j => j.bookingId === visit.bookingId || j.id === visit.jobId);
  return (job?.photos ?? []).map(p => ({
    url: p.url,
    caption: p.kind === 'before' ? 'Before' : p.kind === 'after' ? 'After' : 'During',
  }));
}

/** One sentence about the visit, in the studio's own words where it left any. */
function visitLine(visit: Visit): string {
  const note = (visit.stages ?? []).map(s => s.note).filter(Boolean).pop();
  if (note) return note;
  const names = (visit.services ?? []).map(s => s.name);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}.` : `${names[0] ?? 'A visit'}.`;
}

function visitTitle(visit: Visit): string {
  const names = (visit.services ?? []).map(s => s.name);
  return names[0] ?? 'A visit';
}

/* ── HOME ────────────────────────────────────────────────────────────────── */

export function toHome(
  picture: CustomerPicture,
  now = new Date(),
  /** The car the customer chose, when they chose one (`?car=`). */
  selectedId?: string,
  /**
   * THE STUDIO'S SOONEST OPENING - design 03 and 05.
   *
   * Passed in rather than computed: it depends on every other customer's
   * bookings, and a projection may not read a database (ARCHITECTURE §1). The
   * page loads it from the same occupancy the Booking Service accepts against,
   * so a day named here cannot be a day the writer then refuses. Absent when
   * the studio cannot be reached - an invented opening is a customer told to
   * come on a day the bays are full.
   */
  opening?: { date: string; time: string } | null,
): HomeModel | null {
  /* THE CAR THE CUSTOMER IS LOOKING AT. `leadCar` decides for them on first
     arrival - the one that needs attention - and the garage rail lets them
     say otherwise. An unknown id falls back rather than showing nothing. */
  const car = (selectedId && picture.cars.find(c => c.vehicle.id === selectedId))
    ?? leadCar(picture);
  if (!car) return null;

  const protections = protectionsOf(car, picture.catalogue, now);
  const read = readOwnership(picture, car, protections, now);
  const visits = visitsOf(car);

  /**
   * ONE IMPORTANT FACT, ONE DOMINANT PRESENTATION.
   *
   * `homeStateCopy` builds the hero out of the proposal itself in exactly two
   * situations: the `warranty_expiring` state, and the steady states where
   * `proposalApplies`. In both, `state.line` IS `proposal.headline` and
   * `state.note` IS `proposal.reason` - so the hero is already saying what
   * needs attention and why, in the largest type on the screen, above a
   * primary action the same proposal resolved.
   *
   * Before this, `truth` and a separate WORTH CONSIDERING section said it
   * again: the i20's ceramic appeared three times in three wordings on one
   * screen. The hero wins, because it is the dominant presentation and it
   * carries the act.
   *
   * Derived from the ownership STATE, not by comparing sentences: two engines
   * phrasing the same fact differently must never be detected by string
   * equality, or the day one of them is reworded the duplication comes back
   * silently.
   */
  const heroOwnsTheProposal = !!read.proposal
    && (read.state === 'warranty_expiring' || proposalApplies(read.state));

  /**
   * THE SAME IDEA, FOR THE VISIT THAT IS COMING.
   *
   * `homeStateCopy` builds the hero out of `read.agreed` in exactly one state -
   * `booked` - where the Display reads "Requested" or "Booked in" and the line
   * under it is already "Regular Wash, 27 July 2026 at 09:00." A NEXT VISIT
   * section repeating that sentence is the screen saying one fact twice, which
   * is the habit `heroOwnsTheProposal` exists to prevent.
   *
   * Derived from the ownership STATE, not by comparing the two sentences: the
   * day either is reworded, string equality would silently stop matching and
   * the duplication would come back unnoticed.
   *
   * It stays when the hero is about something else - a car in the studio that
   * ALSO has a visit booked for next week is two facts, and the second one is
   * not on the screen anywhere else.
   */
  const heroOwnsTheVisit = read.state === 'booked' && !!read.agreed;

  const latest = visits[0];
  const latestFrames = latest ? framesOfVisit(latest, car) : [];

  return {
    vehicle: {
      name: car.vehicle.name,
      plate: car.vehicle.registrationNumber,
      photo: car.vehicle.photo ?? car.vehicle.photos?.[0],
    },
    /* THE STATE, FROM THE ENGINE - not from a hand-rolled condition here.
       `lib/os/ownership` resolves 11 states in a documented precedence; this
       used to be five branches over booking status alone, which meant a lapsed
       membership, a refused visit, a dormant car and an expiring warranty were
       all literally unsayable. See docs/HOME-STATE-MAP.md. */
    state: homeStateCopy(read, car.vehicle.name),



    studio: {
      name: COMPANY.name,
      address: COMPANY.address,
      directions: COMPANY.mapsUrl,
      call: telLink(),
      message: waLink(`Hi ${COMPANY.name}! A question about my ${car.vehicle.name}.`),
    },

    /* ── ONE COMPOSITION ──────────────────────────────────────────────
       Home answers four questions and nothing else: what is happening,
       is the car all right, what can I do now, what is coming. */

    /* THE ENGINE'S OUTPUT, KEPT - see the note on HomeModel. */
    protections: [
      ...protections.map(p => ({
        id: p.id,
        label: PROTECTION_TITLE[p.kind],
        term: termWords(p.term, now),
        remaining: remainingOf(p, now),
        measurement: measurementOf(p),
        tone: TONE[p.health],
      })),
      ...membershipAsProtection(picture.subscription, read.club, now),
    ],
    nextAction: resolveAction(read.nextAction),
    liveActivity: latest ? {
      title: visitTitle(latest),
      when: longDate(visitDateOf(latest)),
      note: visitLine(latest),
      photo: latestFrames[0]?.url,
      href: hrefForDestination({ to: 'visit', visitId: latest.id }),
    } : undefined,
    timeline: projectTimeline({ car, protections, club: read.club, now })
      .map<HomeTimelineEvent>(e => ({
        id: e.id,
        title: e.title,
        line: e.line,
        when: longDate(e.at.toISOString().slice(0, 10)),
        href: hrefForRef(e.ref),
        ahead: e.ahead,
      })),



    protection: protections.length > 0 ? (() => {
      const worst = protections[0];
      const holding = protections.every(p => p.health === 'healthy');
      return {
        headline: holding ? 'Protected' : PROTECTION_TITLE[worst.kind],
        layers: protections.map(p => PROTECTION_TITLE[p.kind]),
        /* §14.4 - a date when it is far off, a countdown only when the number
           is small enough to act on. "Everything's holding" is the honest
           thing to say when nothing needs doing, and saying it in days would
           invent an urgency that is not there. */
        said: holding
          ? 'Everything’s holding'
          : termWords(worst.term, now),
        tone: TONE[worst.health],
        items: protections.map(p => ({
          id: p.id,
          label: PROTECTION_TITLE[p.kind],
          term: termWords(p.term, now),
          tone: TONE[p.health],
        })),
      };
    })() : undefined,

    /* THE ONE SENTENCE, VERBATIM FROM `os/truth`.
       Suppressed in the two cases where the engine's answer is one Home has
       already given in larger type - a car in the studio, or one booked in -
       and in the quiet fallbacks, which are the engine saying it has nothing
       to add. Everything else is what the customer opened the app to learn.

       AND SUPPRESSED WHEN THE HERO IS ALREADY PRESENTING THE PROPOSAL. See
       `heroOwnsTheProposal` - a car whose ceramic is on its edge had the same
       fact stated three times on one screen, in three wordings. */
    truth: (read.live || read.agreed) ? undefined
      : heroOwnsTheProposal ? undefined
      : /^All quiet/.test(read.truth) ? undefined
      : read.truth,

    /* HOME BECOMES THE VISIT while the car is here: the stage it is at, the
       studio's own words about it, and the photographs as they are taken. */
    live: read.stay && read.live ? {
      acts: read.stay.acts.map(a => ({
        label: a.title,
        done: a.state === 'done',
        current: a.state === 'current',
      })),
      timing: read.stay.timing ?? undefined,
      frames: (car.jobs.find(j => j.bookingId === read.live!.id)?.photos ?? [])
        .map((p, i) => ({
          id: `${read.live!.id}-${i}`,
          url: p.url,
          caption: SHOT_CAPTION[p.kind as 'before' | 'during' | 'after'],
        })),
      href: hrefForDestination({ to: 'visit', visitId: read.live.id }),
    } : undefined,

    /* THE PROPOSAL ENGINE'S OWN REASONING, when the hero is NOT already
       presenting it. `readOwnership` suppresses the proposal entirely while a
       visit is booked or in flight; this is the second half of the same idea -
       a proposal the hero has already spoken does not get a second section of
       its own. Nothing here decides anything; it is carried. */
    /* THE SOONEST THE STUDIO CAN TAKE IT - design 03 and 05, and only while
       nothing is booked and nothing is in flight. A customer whose visit is on
       Thursday does not need to be told the studio is free on Thursday, and a
       customer whose car is on a bay needs the bay, not a calendar. */
    nextOpening: opening && !read.live && !read.agreed
      ? {
          line: `Next opening · ${shortDay(opening.date)}${
            spokenHour(opening.time) ? `, ${spokenHour(opening.time)}` : ''}`,
          href: hrefForDestination({ to: 'studio' }),
        }
      : undefined,

    suggestion: read.proposal && !heroOwnsTheProposal ? {
      headline: read.proposal.headline,
      reason: read.proposal.reason,
      href: `${hrefForDestination({ to: 'studio' })}?arrange=1&cat=${encodeURIComponent(read.proposal.serviceCategory)}`,
    } : undefined,

    /* THE VISIT THAT IS COMING - `read.agreed`, which IS `nextVisitOf`, the
       same booking the hero and the Vehicle room and the Studio all name. Not
       one in progress: that is the state at the top of the screen. And not one
       whose day has passed, which is what made three lapsed requests read as
       this week's plans. §18.1 - nothing ahead, nothing drawn. */
    next: (() => {
      const b = read.agreed;
      if (!b || heroOwnsTheVisit) return undefined;
      return {
        service: b.serviceName,
        when: `${longDate(b.scheduledDate)}${b.scheduledTime ? ` · ${b.scheduledTime}` : ''}`,
        vehicleName: car.vehicle.name,
        href: manageHref(b.id),
      };
    })(),

    /* ITS LIFE - one photograph and one fact, not a log. The album is where
       a life is read; this is what makes a customer want to open it. */
    life: visits.length > 0 ? {
      photo: latestFrames[0]?.url ?? framesOfVisit(visits[0], car)[0]?.url,
      count: `${visits.length} ${visits.length === 1 ? 'visit' : 'visits'} ${sinceWords(car, 'since')}`,
      href: hrefForDestination({ to: 'history.car', vehicleId: car.vehicle.id }),
    } : undefined,

    /* THE CONCIERGE LOG, ON ITS OWN CONDITION.
       It was nested inside `life`, which requires a SEALED VISIT - so a car
       with a membership confirmed and a coating applied but no completed
       visit computed its entries and could never show them. Two of the demo
       customer's four cars were in exactly that position. The two facts are
       unrelated: a life is a record of visits, a log is what the studio has
       already told you, and either can exist without the other.

       Three on Home - enough to give the record meaning, short of becoming
       the timeline the album already is. The palette takes twelve of the same
       list; neither re-derives anything. */
    record: read.log.slice(0, 3).map(e => ({
      id: e.id,
      line: e.line,
      when: longDate(e.at.toISOString().slice(0, 10)),
    })),

    /* THE CLUB, FROM THE CLUB ENGINE. This read `status === 'active'` off the
       document, which is not the same question: a subscription can carry that
       status and have run past its end date, and Home would go on offering
       "10 washes remaining this cycle" on a cycle that had ended. `os/club`
       resolves the five states - none, pending, active, grace, lapsed - and it
       is the only thing entitled to. Home still shows the club only where it
       showed it before, so the composition is unchanged. */
    membership: read.club.state === 'active'
      ? {
          plan: read.club.plan ?? '',
          said: `${read.club.washesLeft} washes remaining this cycle`,
          href: hrefForDestination({ to: 'membership' }),
        }
      : undefined,

    /* THE CARS ARE THE NAVIGATION. Each carries its own state - the same word
       its own room would use - and tapping one makes Home that car's home. */
    garage: picture.cars.length > 1
      ? {
          cars: picture.cars.map(c => ({
            id: c.vehicle.id,
            name: c.vehicle.name,
            state: stateWordFor(picture, c, now),
            photo: c.vehicle.photo ?? c.vehicle.photos?.[0],
            href: `${hrefForDestination({ to: 'home' })}?car=${c.vehicle.id}`,
            current: c.vehicle.id === car.vehicle.id,
          })),
        }
      : undefined,

    /* Filled by the page - a projection reads nothing (ARCHITECTURE §1). */
    forSale: [],
    marketHref: hrefForDestination({ to: 'cars' }),
  };
}



/**
 * §15.2 - the membership, in the shape every other protection takes. Its term
 * is dated with grace, which is the shape `Term` already gives a membership.
 */
/**
 * WHETHER there is a membership at all is the club engine's answer, not a
 * status check here. This asked `status !== 'cancelled'`, which is a different
 * question and let an expired membership through as a live protection. The id
 * is still the document's, because a `ClubModel` is a state and not a record.
 */
function membershipAsProtection(
  sub: Subscription | null, club: ClubModel, now: Date,
): HomeProtection[] {
  if (!sub || club.state === 'none' || !club.renewsOn) return [];
  const term: Term = { kind: 'dated', expiresOn: club.renewsOn, grace: true };
  const left = club.washesLeft;
  return [{
    id: `membership_${sub.id}`,
    label: PROTECTION_TITLE.membership,
    /* What remains is washes, not days - §14.3's balance shape in words. */
    term: left === 0 ? termWords(term, now) : `${left} washes left`,
    remaining: club.washesTotal > 0 ? left / club.washesTotal : 0,
    tone: TONE[healthOf(term, now)],
  }];
}

/**
 * §12.3 forbids a primary car, so this is not one. It is the car the STUDIO has
 * touched most recently - the first position in the strip, which any car can
 * occupy and none holds.
 */
export function leadCar(picture: CustomerPicture): CarPicture | undefined {
  return [...picture.cars].sort((a, b) => attention(b) - attention(a))[0];
}

const attention = (car: CarPicture): number => {
  if (liveOf(car)) return Number.MAX_SAFE_INTEGER;
  return Math.max(millis(car.vehicle.createdAt), ...car.bookings.map(b => millis(b.createdAt)), 0);
};

/* ── THE RECORD'S CONTEXT ────────────────────────────────────────────────── */

/**
 * WHICH CAR THE RECORD IS ABOUT — asked once, by every address that shows one.
 *
 * `/history`, `/history?car=<id>` and `/history/<visitId>` each resolved this
 * for themselves, and the three answers did not agree. The album fell back to
 * `leadCar` whenever the query was absent, so a customer who had opened the
 * BMW's record and then followed a link without the car saw the Kia's visits
 * under the same heading — silently, with nothing on screen to say the subject
 * had changed. And a visit page never learned which car it belonged to at all,
 * so it had no context to hand back to the control that leaves it.
 *
 * OWNERSHIP IS BY `vehicleId`, ALWAYS. A registration number is a label a
 * customer can retype and two people can share; it has never been ownership
 * evidence in this product and is not one here.
 */
export type HistoryContext =
  /** One sealed visit, and the car it belongs to. */
  | { kind: 'visit'; car: CarPicture; visit: Visit }
  /** The car is on the bay right now — a different surface entirely (§13.2). */
  | { kind: 'live'; car: CarPicture; bookingId: string }
  /** Arranged but not yet arrived; the id in the address is a booking's. */
  | { kind: 'booked'; car: CarPicture; bookingId: string }
  /** The album for one car. */
  | { kind: 'album'; car: CarPicture }
  /**
   * MORE THAN ONE CAR AND NOTHING SAYING WHICH.
   *
   * `leadCar` is a real product default and stays the answer for a customer
   * with one car. With several, guessing is how the wrong car's history gets
   * shown under the right car's name, so the room asks instead.
   */
  | { kind: 'choose'; cars: readonly CarPicture[] }
  /** No car at all. */
  | { kind: 'none' };

/**
 * Resolve the record's subject from the address and the picture.
 *
 * `visitId` is the path segment when there is one; `car` is `?car=`. Both are
 * untrusted input and neither is used as anything but a lookup key.
 */
export function historyContextOf(
  picture: CustomerPicture,
  route: { visitId?: string; car?: string } = {},
  now = new Date(),
): HistoryContext {
  const byId = (id?: string) =>
    (id ? picture.cars.find(c => c.vehicle.id === id) : undefined);

  /* A VISIT ID NAMES ITS OWN CAR. Searched across the customer's cars only —
     the picture IS the ownership boundary, so a visit that is not in it is not
     theirs and simply is not found. */
  if (route.visitId) {
    for (const car of picture.cars) {
      if (toLiveVisit(picture, car, route.visitId, now)) {
        return { kind: 'live', car, bookingId: route.visitId };
      }
    }
    for (const car of picture.cars) {
      const visit = visitsOf(car).find(v => v.id === route.visitId);
      if (visit) return { kind: 'visit', car, visit };
    }
    /* Every notification written before events existed addresses a BOOKING id
       here. The booking's car is the context. */
    const found = findBooking(picture, route.visitId);
    if (found) return { kind: 'booked', car: found.car, bookingId: route.visitId };
  }

  const named = byId(route.car);
  if (named) return { kind: 'album', car: named };

  if (picture.cars.length === 0) return { kind: 'none' };
  if (picture.cars.length === 1) return { kind: 'album', car: picture.cars[0] };

  /* An unknown or absent `?car=` with several cars: ask, never guess. */
  return { kind: 'choose', cars: picture.cars };
}

/**
 * The car a context is about, when it is about one. The address that a Back
 * control should carry is built from this and nothing else.
 */
export const carOfContext = (ctx: HistoryContext): CarPicture | undefined =>
  ('car' in ctx ? ctx.car : undefined);

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
        /* §17.1 - the car is the inbox, so the collection carries the mark and
           the car's own room carries the doorway. Nothing here is a message. */
        news: !!noticeOf(picture, car, now),
        href: hrefForDestination({ to: 'vehicle', vehicleId: car.vehicle.id }),
      };
    }),
    /* OPENS THE SHEET. Pointing at `/studio` alone landed the customer in the
       room and left them to find the control - the same half-step the Vehicle
       room's "change or cancel" made. An invitation should complete the act it
       names. */
    beginHref: `${hrefForDestination({ to: 'studio' })}?arrange=1`,
    addHref: hrefForDestination({ to: 'garage.add' }),

    /* The same cars in the shape the form writes back. Projected here rather
       than derived in the screen: a renderer that reshaped domain objects
       would be doing the projection's job (ARCHITECTURE §1). */
    editable: ordered.map(car => ({
      id: car.vehicle.id,
      name: car.vehicle.name,
      registrationNumber: car.vehicle.registrationNumber,
      odometer: car.vehicle.odometer,
      year: car.vehicle.year,
    })),

    /**
     * THE RECORD, UNDER THE COLLECTION - design screen 1h.
     *
     * Every sealed visit across every car, newest first, as one list. The
     * album at `/history` is per car and stays that way; this is the studio's
     * relationship with the customer rather than with one vehicle, which is
     * why the car's name is part of each line.
     *
     * Money comes from `moneyOfVisits` - the SAME reader the album totals
     * with - so a figure here can never disagree with the figure on the visit
     * it links to. That disagreement is a bug this codebase has already had
     * once (see the note on `moneyOfVisits`) and it is not being reopened for
     * a summary list.
     *
     * Six, because the design shows four and a scroll of thirty visits under
     * a collection is the album with the photographs taken out.
     */
    record: ordered
      .flatMap(car => {
        const visits = visitsOf(car);
        const money = moneyOfVisits(visits, picture.invoices);
        return visits.map(v => ({
          id: v.id,
          at: visitDateOf(v),
          title: visitTitle(v),
          when: longDate(visitDateOf(v)),
          vehicle: car.vehicle.name,
          settled: (money.get(v.id)?.total ?? 0) > 0
            ? rupees(money.get(v.id)!.total)
            : undefined,
          href: hrefForDestination({ to: 'visit', visitId: v.id }),
        }));
      })
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 6)
      .map(({ at: _at, ...row }) => row),

    /* The full album, for the car the collection leads with. */
    historyHref: ordered[0]
      ? hrefForDestination({ to: 'history.car', vehicleId: ordered[0].vehicle.id })
      : hrefForDestination({ to: 'history' }),
  };
}

/* ── NEWS ────────────────────────────────────────────────────────────────── */

/**
 * AN UNREAD NOTIFICATION, RESOLVED TO THE SURFACE THAT OWNS IT.
 *
 * §17.1 - "A list of notifications is the same mistake as a list of documents.
 * State changes surface as state. The car is the inbox." So there is no inbox
 * and this builds none: it returns AT MOST ONE unread record per car, as a mark
 * on the car it belongs to, and the mark is a doorway to the object rather than
 * a message to be processed.
 *
 * §17.3 - "A notification is a doorway. It opens the exact surface it is about
 * - never the home screen, never a generic list." Which surface that is depends
 * on the state of the object NOW, not on the state it was in when the push went
 * out. `navigation/resolve.notificationHref` is the WRITE-time resolver and it
 * is right at the moment it runs; by the time the customer taps, the visit it
 * addressed may have been sealed under a different id, or never sealed at all.
 * Resolved against the picture here for that reason, using the same readers
 * every other room uses - `liveOf`, the sealed visit, `isUpcoming`.
 *
 * WHERE THERE IS NO OWNING SURFACE, THERE IS NO SIGNAL. Ten of the nineteen
 * customer notifications in production are about a booking that was completed
 * or cancelled and never sealed into a visit; those have no surface to open and
 * no destination is invented for them. That gap is reported, not papered over.
 */
export interface Notice {
  /** The record, so consuming the doorway can mark exactly it read. */
  id: string;
  /** The studio's own subject line. Never the body, and never a list of them. */
  title: string;
  /** The surface that owns the fact. Always real, or there is no notice. */
  href: string;
}

/** Where this notification's object lives now, or null if nowhere. */
function surfaceOf(
  n: Notification, picture: CustomerPicture, car: CarPicture, now: Date,
): string | null {
  if (n.type === 'membership') return hrefForDestination({ to: 'membership' });
  if (!n.bookingId) return null;

  const live = liveOf(car);
  if (live && live.id === n.bookingId) {
    return hrefForDestination({ to: 'visit', visitId: live.id });
  }
  /* The sealed record carries its own id, which is NOT the booking's - a
     notification written during the visit addresses the booking. */
  const sealed = visitsOf(car).find(v => v.bookingId === n.bookingId);
  if (sealed) return hrefForDestination({ to: 'visit', visitId: sealed.id });

  const booking = car.bookings.find(b => b.id === n.bookingId);
  if (booking && isUpcoming(booking, now)) return manageHref(booking.id);

  return null;
}

/** The newest unread thing about this car that has somewhere to go. */
export function noticeOf(
  picture: CustomerPicture, car: CarPicture, now = new Date(),
): Notice | undefined {
  const mine = new Set([
    ...car.bookings.map(b => b.id),
  ]);
  for (const n of picture.notifications) {
    if (n.read === true) continue;
    /* A membership notice belongs to the club, not to any one car, and is not
       carried here - the Membership room is its own surface. */
    if (!n.bookingId || !mine.has(n.bookingId)) continue;
    const href = surfaceOf(n, picture, car, now);
    if (href) return { id: n.id, title: n.title, href };
  }
  return undefined;
}

/** Every unread notification about this car that has nowhere to go. */
export function unmappableOf(picture: CustomerPicture, car: CarPicture, now = new Date()): number {
  const mine = new Set(car.bookings.map(b => b.id));
  return picture.notifications.filter(n =>
    n.read !== true && !!n.bookingId && mine.has(n.bookingId)
    && !surfaceOf(n, picture, car, now)).length;
}

/* ── VEHICLE ─────────────────────────────────────────────────────────────── */

/**
 * §11.4's regions are authored per photograph - only whoever looked at the
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

/* ── THE POLLUTION CERTIFICATE, IN WORDS ─────────────────────────────────
   One vocabulary for the ledger row, the room's headline and its action, so
   the car and the certificate's own screen can never say different things
   about the same state (§22.2). */

/** What the ledger row's value says. `termWords` wherever a term is running. */
function pucLedgerWords(puc: ReturnType<typeof readPuc>, now: Date): string {
  if (puc.protection && puc.state !== 'declared') return termWords(puc.protection.term, now);
  if (puc.state === 'declared') return 'Verification in progress';
  if (puc.state === 'rejected') return 'Not accepted';
  return 'Not added';
}

/**
 * The one way in, worded for the state it is in.
 *
 * Every state has one - including the two where there is nothing to do but
 * wait, because "see what you sent" is still an act and a row with no way into
 * it is a fact the customer cannot check (§10.5).
 */
function pucActionWords(puc: ReturnType<typeof readPuc>): string {
  switch (puc.state) {
    case 'missing':  return 'Declare certificate';
    case 'declared': return 'See what you sent';
    case 'renewing': return 'See the renewal';
    case 'expired':  return 'Renew certificate';
    case 'rejected': return 'Declare again';
    case 'active':
      return puc.protection?.health === 'healthy' ? 'See the certificate' : 'Renew certificate';
  }
}

/** The headline on the certificate's own screen. The date, said in full. */
function pucHeadline(puc: ReturnType<typeof readPuc>): string {
  const term = puc.protection?.term;
  const until = term?.kind === 'dated' ? longDate(term.expiresOn) : '';
  switch (puc.state) {
    case 'missing':  return 'Not added';
    case 'declared': return 'Verification in progress';
    case 'rejected': return 'Not accepted';
    case 'expired':  return until ? `Expired ${until}` : 'Expired';
    case 'active':
    case 'renewing': return until ? `Valid until ${until}` : 'On record';
  }
}

/** The sentence under it. Never a restatement of the headline. */
const PUC_LINE: Record<PucState, string> = {
  missing:
    'Nothing on record for this car. Send us the certificate and it will sit '
    + 'beside everything else that protects it.',
  declared:
    'It is with the studio. Once we have seen the certificate itself, it will '
    + 'stand on your car.',
  renewing:
    'The certificate we hold still stands. The one you have just sent is with '
    + 'the studio.',
  active:
    'On record and in date. We will say so here as the day approaches, so it '
    + 'is never a surprise.',
  expired:
    'The certificate we hold has run out. Have the car tested, then send us '
    + 'the new one.',
  rejected:
    'The studio could not accept the last certificate you sent. Send it again '
    + 'once it is sorted, and we will look straight away.',
};

export function toVehicle(car: CarPicture, picture: CustomerPicture, now = new Date()): VehicleModel {
  const catalogue = picture.catalogue;
  const protections = protectionsOf(car, catalogue, now);

  /**
   * EVERY LAYER, NOT THE FOUR THAT SIT SOMEWHERE ON THE PAINT.
   *
   * This built a list keyed by region and dropped anything without one, which
   * threw away insurance, the pollution certificate, the registration and the
   * FASTag - six of the ten kinds. The survivors were then drawn only as marks
   * on the photograph, positioned by `regionsFor()`, which returns nothing
   * because no photograph has ever had its regions authored. Between the two,
   * a car with seven live protections showed none of them in its own room.
   *
   * The region is carried where there is one, so the marks work unchanged the
   * day the studio starts locating them; `sortByUrgency` has already put the
   * one that needs attention first.
   */
  const layers: VehicleProtection[] = protections
    /* THE CLUB IS NOT A LAYER ON THE CAR. §15.2 places a membership among the
       protections, and Home does exactly that - but it belongs to the person
       and to `os/club`, and listing it in the car's own room would be the same
       fact in a second place under a different owner. */
    .filter(p => p.kind !== 'membership')
    /* THE CERTIFICATE IS DRAWN BELOW, WHOLE. It is the one protection with a
       state a Term cannot express - sent, refused, waiting - and it is the one
       the customer can act on, so it carries its own row and its own act.
       Mapping it here as well would put one fact in two places. */
    .filter(p => p.kind !== PUC)
    .map(p => ({
    id: p.id,
    region: REGION_OF[p.kind],
    label: PROTECTION_TITLE[p.kind],
    term: termWords(p.term, now),
    /* §14.2 - the design draws each layer as a proportion of its own term,
       which is a number this projection was already computing for Home and
       throwing away here. Undefined for a term that does not deplete, and the
       room draws no bar rather than a full one. */
    remaining: remainingOf(p, now),
    /* One definition, from the engine - never re-derived per screen. */
    measurement: measurementOf(p),
    tone: TONE[p.health],
    /* §14.6 - the file where one exists. Nothing writes `document` yet, so
       this is undefined throughout; the room draws no control for it. */
    documentHref: p.document ? p.document.url : undefined,
  }));

  /**
   * THE POLLUTION CERTIFICATE, AS A TRUTHFUL ROW.
   *
   * Always drawn, whatever the car has - because "not added" is an answer and
   * an absent row is not (§19.1). A Protection alone could only ever say two
   * things about it, in date or out of it; a car whose owner sent a
   * certificate last night was told "not added" and had no way to know it had
   * arrived. The state comes from the engine, which reads the declarations
   * beside the protections and never treats a submission as a promise.
   */
  const puc = readPuc({ protections, declarations: car.declarations ?? [] });
  const pucHref = hrefForDestination({ to: 'vehicle.puc', vehicleId: car.vehicle.id });
  const pucRow: VehicleProtection = {
    id: puc.protection?.id ?? `${car.vehicle.id}_puc`,
    label: PROTECTION_TITLE[PUC],
    term: pucLedgerWords(puc, now),
    /* A bar only where a real term is running. A submission has no proportion
       to draw and drawing one would be the wait wearing a measurement. */
    remaining: puc.protection && (puc.state === 'active' || puc.state === 'renewing')
      ? remainingOf(puc.protection, now)
      : undefined,
    measurement: puc.protection ? measurementOf(puc.protection) : undefined,
    tone: puc.protection && (puc.state === 'active' || puc.state === 'renewing')
      ? TONE[puc.protection.health]
      : TONE[PUC_TONE[puc.state]],
    /* §10.5 - nothing is inert, and every state has exactly one way in. The
       word changes with the state; the destination never does. */
    action: { label: pucActionWords(puc), href: pucHref },
  };

  /**
   * THE CAR'S NEXT VISIT.
   *
   * The room named the car's STATE - "Booked in" - and then said nothing about
   * when, what for, or how to change it. A customer looking at their own car
   * had to go to the Studio, find the visit among every other car's, and work
   * out which one was this one's. The booking already belongs to this car;
   * this is the room that should say so.
   *
   * `nextVisitOf` is the same reader Home, the Studio and the ownership engine
   * use, so the car cannot disagree with itself - or with Home - about which
   * visit is the one in hand. It was `liveBooking`, which answered a different
   * question and sometimes named a different booking.
   */
  const live = liveOf(car);
  const next = nextVisitOf(car, now);

  /**
   * THE CAR IN ONE LINE - "Phantom Black · matte wrap · 2023" (design 1d).
   *
   * Assembled from what the owner has actually told us and nothing else. Each
   * part is optional, so this is a line of one, two or three facts, or absent.
   * `category` and `color` are the legacy descriptors: they were written by
   * pickers the photograph replaced, and this is the first surface to read
   * them since - a fact already stored is not a fact worth asking for twice.
   */
  const descriptor = [
    car.vehicle.color,
    car.vehicle.category,
    car.vehicle.year ? String(car.vehicle.year) : undefined,
  ].filter(Boolean).join(DOT) || undefined;

  /**
   * WHAT THE STUDIO STANDS BEHIND, AND UNTIL WHEN.
   *
   * The furthest-out dated term among the car's protections. §14.6 - a
   * warranty is a promise with an end, so the room says the end rather than
   * the word "covered". A car whose protections are all perpetual or all
   * balances has no date to give, and the tile is simply not drawn.
   */
  /* AND IT MUST STILL HOLD. This read every dated term including LAPSED ones,
     so a Land Rover whose only protection was a pollution certificate that ran
     out on 30 July was given a tile reading "Active to July 2026" — under a
     ledger row saying "Lapsed 30 July 2026", on the same screen. Found by
     looking at the rendered room, not by any assertion that existed. The word
     on the tile is "Active to"; a promise that has ended is not one, and a car
     with nothing live draws no tile rather than a false one (§18.1). */
  const furthest = protections
    .filter(p => p.kind !== 'membership' && p.term.kind === 'dated' && p.health !== 'lapsed')
    .map(p => (p.term as Extract<Term, { kind: 'dated' }>).expiresOn)
    .sort()
    .pop();

  return {
    name: car.vehicle.name,
    plate: car.vehicle.registrationNumber,
    descriptor,
    warranty: furthest ? `Active to ${monthYear(furthest)}` : undefined,
    /* Grouped in the Indian convention, because that is how the number is
       read aloud here - 41,208 and not 41208. */
    odometer: typeof car.vehicle.odometer === 'number'
      ? `${car.vehicle.odometer.toLocaleString('en-IN')} km`
      : undefined,
    state: stateWordFor(picture, car, now),
    next: next
      ? {
          service: next.serviceName,
          /* The day in the customer's terms, and the hour as booked. */
          when: `${longDate(next.scheduledDate)}${next.scheduledTime ? ` at ${next.scheduledTime}` : ''}`,
          /* §16 - pending is not the same promise as confirmed, and a customer
             who is waiting on the studio should be told they are. */
          settled: next.status === 'confirmed',
          /* Straight at THIS visit's sheet - the same address Home's NEXT
             VISIT now uses, so one booking has one destination. Every upcoming
             visit is by definition pending or confirmed, which is exactly the
             set `firestore.rules` lets the customer change, so the room can
             never offer an act the server will refuse. */
          manageHref: manageHref(next.id),
        }
      : undefined,
    /* WHILE THE CAR IS ACTUALLY HERE, there is nothing to arrange and nothing
       to change - there is work to watch. Inviting a booking under the word
       "In care" is the room contradicting itself in the space of one screen.
       §5.4 - the live account is a takeover reached from the car, so this is
       the car pointing at it. */
    followHref: live
      ? hrefForDestination({ to: 'visit', visitId: live.id })
      : undefined,
    /* Arranging for THIS car, from this car - the Studio's sheet opens with
       the category unset but the room already knows whose visit it is. */
    arrangeHref: `${hrefForDestination({ to: 'studio' })}?arrange=1`,
    since: sinceWords(car, 'With AutoModz since').replace(/^with/, 'With'),
    /* §17.1 - the car IS the inbox. One unread thing about this car, as a
       doorway to the object it is about. Never a feed, never a body. */
    notice: noticeOf(picture, car, now),
    /* Carries the car. Without it, following History from the second car in a
       garage showed the FIRST car's life. */
    historyHref: hrefForDestination({ to: 'history.car', vehicleId: car.vehicle.id }),
    /* The certificate last, because it is the one row that is always there
       whatever the car has, and `sortByUrgency` has already ordered the
       promises that actually depend on a term. */
    protections: [...layers, pucRow],

    /* THE CAR'S MEDIA, month by month - `os/moment`, connected. The old
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
    /* `declareHref` STOOD HERE — a `wa.me` link with a sentence typed into it,
       and the only way the product ever offered to declare anything. It drew an
       empty-ledger pane saying "tell us what protects it", which opened
       WhatsApp and ended there: nothing on the other side wrote a Protection,
       and `declareProtection()` had no caller at all. A control that opens a
       messaging application is not a flow.
       The certificate now has a real one, and the ledger always carries its
       row — so there is no empty ledger left for an invitation to fill. The
       way to reach a person survives on the certificate's own screen, where it
       is secondary to the form rather than instead of it (§18.4). */
  };
}

/* ── THE POLLUTION CERTIFICATE ───────────────────────────────────────────── */

/**
 * The certificate's own room — what stands, what is waiting, what was refused,
 * and every certificate this car has ever had.
 *
 * ── NOTHING HERE IS DERIVED TWICE ────────────────────────────────────────
 * The state, whether a certificate may be sent and the words for each are the
 * SAME functions the car's ledger row uses, so the row and the room cannot
 * disagree about the car in front of them. This only chooses shapes.
 *
 * ── AND NOTHING HERE IS INVENTED ─────────────────────────────────────────
 * A protection with no `since` — every pollution certificate in production is
 * one, because they were seeded rather than declared — prints no issue date
 * rather than a guessed one, and a protection with no declaration behind it
 * prints no certificate number. The row simply is not drawn (§18.1).
 */
export function toPuc(car: CarPicture, picture: CustomerPicture, now = new Date()): PucModel {
  const protections = protectionsOf(car, picture.catalogue, now);
  const declarations = car.declarations ?? [];
  const puc = readPuc({ protections, declarations });

  const held = puc.protection;
  const term = held?.term;

  /* The declaration the standing protection was created from, when there is
     one. It is the only place a certificate NUMBER lives — a Protection has
     no field for one and inventing one would be a fact nobody gave us. */
  const behind = held?.declarationId
    ? declarations.find(d => d.id === held.declarationId)
    : undefined;

  const standing: PucCertificate | undefined = held
    ? {
        reference: behind?.reference,
        /* Bare. The row's label is the word for it — a value that repeats its
           own label reads as a stammer. */
        issued: held.since ? longDate(held.since) : undefined,
        /* And the word for the end of the term follows the state, so a lapsed
           certificate is never filed under "Valid". */
        untilLabel: held.health === 'lapsed' ? 'Ran out' : 'Valid until',
        until: term?.kind === 'dated' ? longDate(term.expiresOn) : termWords(held.term, now),
        evidenceUrl: held.document?.url,
      }
    : undefined;

  return {
    car: car.vehicle.name,
    plate: car.vehicle.registrationNumber,
    state: pucHeadline(puc),
    line: PUC_LINE[puc.state],
    tone: puc.protection && (puc.state === 'active' || puc.state === 'renewing')
      ? TONE[puc.protection.health]
      : TONE[PUC_TONE[puc.state]],

    standing,

    pending: puc.pending
      ? {
          reference: puc.pending.reference,
          until: longDate(puc.pending.expiresOn),
          sent: longDate(isoDayOf(puc.pending.submittedAt)),
        }
      : undefined,

    refused: puc.refused
      ? {
          reference: puc.refused.reference,
          on: longDate(isoDayOf(puc.refused.decidedAt ?? puc.refused.submittedAt)),
          because: puc.refused.decisionReason,
        }
      : undefined,

    /* THE WHOLE RECORD, UNEDITED. This is what "a renewal does not rewrite the
       last one" looks like from the customer's side: every certificate they
       have ever sent, with the dates it was sent with and what became of it. */
    record: puc.record.map(d => ({
      id: d.id,
      reference: d.reference,
      validity: `Until ${longDate(d.expiresOn)}`,
      state: PUC_STATUS_WORD[d.status],
      tone: d.status === 'verified' ? TONE.healthy
        : d.status === 'rejected' ? TONE.urgent
          : d.status === 'submitted' ? TONE.attention
            : TONE.lapsed,
    })),

    /* §10.5 — offered only where the server would accept it. `mayDeclare` is
       the engine's answer and the same one the service enforces, so the form
       is never drawn for an act that would be refused. */
    declare: mayDeclare(puc)
      ? {
          vehicleId: car.vehicle.id,
          title: puc.state === 'missing' || puc.state === 'rejected'
            ? 'Declare the certificate'
            : 'Renew it',
          note: 'We check what you send against the certificate itself before '
            + 'it stands on your car. Nothing changes here until we have.',
          submit: 'Send it to the studio',
        }
      : undefined,

    /* §18.4 — a way to reach a person, kept as the alternative it is. */
    askHref: waLink(
      `Hello AutoModz — this is about the pollution certificate for my ${car.vehicle.name}.`,
    ),
  };
}

/** A stored moment as an ISO day, for the one date formatter. */
const isoDayOf = (t?: { toMillis?: () => number }): string =>
  (millis(t) ? new Date(millis(t)).toISOString().slice(0, 10) : '');

/* ── HISTORY ─────────────────────────────────────────────────────────────── */

/**
 * A car's history. §16 - sealed visits only, and the papers they handed over.
 * The catalogue argument is gone: nothing here may consult it (see `visitsOf`).
 */
export function toHistory(car: CarPicture, invoices: Invoice[] = []): HistoryModel {
  const visits = visitsOf(car);

  /* THE STANDING. §16.1 calls History "a series of transformations" - but a
     series has a shape, and the room showed none of it: a customer scrolled
     photographs with no idea how many visits there had been, how long the car
     had been cared for here, or what the record added up to. The facts were
     all already in hand and none of them were said.

     Summed from the SEALED amounts (§16.2 - never recomputed from today's
     price list), so this total is the sum of what was actually settled. */
  const oldest = visits[visits.length - 1];
  /* THE SUM OF WHAT EACH VISIT ACTUALLY SAYS. It summed the sealed amounts
     while every visit that had an invoice showed the invoice, so this line and
     the visits underneath it were adding up different money. One reader now,
     for the total and for each record. */
  const money = moneyOfVisits(visits, invoices);
  const settledTotal = visits.reduce((n, v) => n + (money.get(v.id)?.total ?? 0), 0);

  return {
    vehicle: car.vehicle.name,
    count: visits.length,
    since: oldest ? longDate(visitDateOf(oldest)) : undefined,
    settledTotal: settledTotal > 0 ? rupees(settledTotal) : undefined,
    visits: visits.map(v => toVisit(v, car, invoices)),
  };
}

export function toVisit(
  visit: Visit,
  car: CarPicture,
  invoices: Invoice[] = [],
): HistoryVisit {
  /* WHAT IT COST, AND THE PAPER BEHIND IT - `moneyOfVisits`, the same reader
     the album totals with, run over the same list in the same order so a visit
     opened on its own cannot be paired with a different invoice than the one
     the album counted for it. This used to match the invoice here, privately,
     and the album never learned the answer. */
  const money = moneyOfVisits(visitsOf(car), invoices).get(visit.id)
    ?? { total: visit.amounts?.total ?? 0, source: 'sealed' as const };
  const invoice = money.invoice;
  const frames = framesOfVisit(visit, car);
  const [cover, ...rest] = frames;

  return {
    id: visit.id,
    when: longDate(visitDateOf(visit)),
    /* The year alone, so the album can put a divider between one year and the
       next without re-parsing a formatted date on the client. */
    year: visitDateOf(visit).slice(0, 4),
    title: visitTitle(visit),
    line: visitLine(visit),
    photo: cover ? { url: cover.url, description: `${car.vehicle.name}, finished at AutoModz` } : undefined,
    /* GUARDED, LIKE `framesOfVisit` ABOVE, AND FOR THE SAME REASON. A sealed
       visit is immutable, so a record written before one of these fields
       existed still has no value for it - and an unguarded read here does not
       lose one visit's detail, it throws inside a `.map` over EVERY visit and
       takes the whole History room down to the error boundary. Found by
       rendering a record with a stage from an older schema. */
    did: (visit.stages ?? []).map(s => s.note).filter(Boolean).join(' ')
      || (visit.services ?? []).map(s => s.name).join(', '),
    photos: rest.map(f => ({
      url: f.url,
      description: `${car.vehicle.name} at AutoModz`,
      caption: f.caption,
    })),
    /* §16.2 - what it promised, as captured at seal. Never recomputed. */
    promised: (visit.termsCaptured ?? []).map(t => ({
      label: PROTECTION_TITLE[t.kind],
      term: termWords(t.term).toLowerCase(),
    })),
    /* §16 - the amount as SEALED, not as the price list reads today, and ONLY
       where the sealed amount is the answer. Where an invoice exists the
       receipt owns the money; carrying both invited the screen to add them up
       or to show whichever it reached first. One figure, one source. */
    settled: money.source === 'sealed' && money.total > 0
      ? rupees(money.total)
      : undefined,

    /* BEFORE AND AFTER, from the kinds the job recorded. Only when BOTH
       exist: a comparison with one side missing is not a comparison, and
       inventing the other half from an unrelated frame would be a lie about
       the customer's own car. */
    comparison: (() => {
      const shots = shotsOfVisit(visit, car);
      return shots.before[0] && shots.after[0]
        ? { before: shots.before[0], after: shots.after[0] }
        : undefined;
    })(),

    /* THE RECEIPT, INLINE. The figures already existed and lived one tap away
       at `/invoice/[id]`, so the customer had to leave the record of the work
       to learn what the work cost. Carried verbatim from the invoice - nothing
       here recomputes a total, and the paper remains reachable for whoever
       wants the document itself. */
    receipt: invoice ? {
      number: invoice.invoiceNumber,
      lineItems: (invoice.lineItems ?? []).map(li => ({
        name: li.name,
        qty: li.qty,
        unitPrice: `₹${(li.unitPrice ?? 0).toLocaleString('en-IN')}`,
        amount: `₹${(li.amount ?? 0).toLocaleString('en-IN')}`,
      })),
      subtotal: `₹${(invoice.subtotal ?? 0).toLocaleString('en-IN')}`,
      discount: invoice.discount
        ? { label: invoice.discount.label, amount: `₹${invoice.discount.amount.toLocaleString('en-IN')}` }
        : undefined,
      gst: invoice.gst
        ? { rate: `${invoice.gst.rate}%`, amount: `₹${invoice.gst.amount.toLocaleString('en-IN')}` }
        : undefined,
      total: `₹${(invoice.total ?? 0).toLocaleString('en-IN')}`,
      paid: invoice.paymentStatus === 'paid',
      method: invoice.paymentMethod,
    } : undefined,
    /* SHARE. The chapter's public address is the invoice's share token, and
       `/api/invoice/[id]?view=chapter` already strips amounts, the phone and
       every internal reference before anything leaves the server. */
    shareHref: invoice
      ? hrefForDestination({ to: 'chapter', invoiceId: invoice.id, token: invoice.publicToken })
      : undefined,
    documents: invoice
      ? [{
          /* Its own share token, so the paper opens for whoever holds the
             link - the same token the studio sends. */
          label: invoice.paymentStatus === 'paid'
            ? `Receipt · ${invoice.invoiceNumber}`
            : `Invoice · ${invoice.invoiceNumber}`,
          /* CARRIES WHERE IT CAME FROM, resolved by the one resolver. The
             paper is a shared address with no history behind it when opened
             from a message; told which visit sent them, it offers the record
             rather than a dead end. */
          href: hrefForDestination({
            to: 'invoice', invoiceId: invoice.id, token: invoice.publicToken,
            fromVisitId: visit.id,
          }),
        }]
      : [],
  };
}

/* ── STUDIO ──────────────────────────────────────────────────────────────── */

/**
 * THE LIVE VISIT. Null unless the car is actually here - a countdown to a
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
    /* §20.1 - a way to reach a human, on the screen a customer is most likely
       to want one. The message names the car, so the studio does not have to
       ask which one it is about. */
    messageHref: waLink(
      `Hello AutoModz — about my ${car.vehicle.name} (${car.vehicle.registrationNumber}) in the studio today.`,
    ),
    /* SETTLING, once the car is actually ready. Offered only then and only
       when something is outstanding: a "Pay" control on a car that is still
       being worked on asks for money against work that is not finished, and
       one on a settled visit is a control that can only refuse itself. */
    settleHref: (() => {
      if (stay.act !== 'ready') return undefined;
      const job = car.jobs.find(j => j.bookingId === bookingId);
      const owed = settlementOf({
        jobTotal: job?.totalAmount,
        bookingTotal: read.live.totalAmount,
        received: job?.amountPaid ?? 0,
      });
      return owed.settled
        ? undefined
        : hrefForDestination({ to: 'settle', bookingId });
    })(),
    /* THE QUESTION THE STUDIO IS WAITING ON, on the surface that owns it.
       Matched by VEHICLE rather than by job, because an approval belongs to
       the car on the bay and the customer is standing in that car's visit. */
    approval: (() => {
      const waiting = pendingApprovals(picture.approvals, now)
        .find(a => a.vehicleId === car.vehicle.id);
      return waiting
        ? {
            line: waiting.reason,
            href: hrefForDestination({ to: 'approval', approvalId: waiting.id }),
          }
        : undefined;
    })(),
  };
}

/**
 * The estimate, worded for the sheet that spends it.
 *
 * Every value is read from the STORED estimate. Nothing is recomputed: the
 * figure the customer saw on screen 07 is the figure they see on 08, and it is
 * the figure the booking is made at, because all three are this one record.
 */
export function toCarriedEstimate(e: Estimate): CarriedEstimate {
  const extras = e.scope.addOns.map(a => a.label);
  const panels = e.scope.panels?.map(p => p.label) ?? [];
  return {
    id: e.id,
    serviceId: e.serviceId,
    vehicleId: e.vehicleId,
    serviceName: e.serviceName,
    scopeLine: [e.scope.label, ...panels, ...extras].filter(Boolean).join(DOT),
    total: e.breakdown.washCovered ? 'Covered' : rupees(e.breakdown.total),
    bay: e.scope.bayDays === 1 ? '1 day in the bay' : `${e.scope.bayDays} days in the bay`,
    durationMinutes: e.scope.durationMinutes,
  };
}

export function toStudio(
  picture: CustomerPicture,
  now = new Date(),
  estimate: Estimate | null = null,
): StudioModel {
  const here = picture.cars.find(c => liveOf(c));

  return {
    place: 'Maninagar · Ahmedabad',
    /* §4.5 - the absence of news is good news and should look like it. */
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
       outbound WhatsApp link, because there was no in-app booking surface -
       the most important control in the product handed the customer to another
       application. There is one now. */
    /* MADE PLAIN AT THE BOUNDARY. `StudioScreen` is a client component, and
       these three are the only things in any projection handed to a renderer
       as whole Firestore documents - the booking flow wants the Service
       objects themselves. Those documents carry `Timestamp` CLASS instances
       (`Service.createdAt`, `Vehicle.createdAt`, `Subscription.createdAt` and
       friends), and React refuses to serialise a class instance across the
       server/client boundary. The room threw for every signed-in customer.

       Converted HERE rather than in `loadCustomerPicture`: `customerPicture`,
       `ownership` and this file all sort on `createdAt?.toMillis?.()`, which
       with optional chaining would quietly return 0 for a converted value and
       break every ordering in the product without raising anything. */
    /* Design 06 → 07 - one address per service, resolved here because a
       renderer builds none (ARCHITECTURE §1). The car is the lead one, so a
       customer with a single car never has to answer "which car" twice. */
    estimate: estimate ? toCarriedEstimate(estimate) : null,

    serviceHref: Object.fromEntries(
      picture.catalogue
        .filter(s => s.active !== false)
        .map(s => [s.id, hrefForDestination({
          to: 'studio.scope', serviceId: s.id, vehicleId: leadCar(picture)?.vehicle.id,
        })]),
    ),

    booking: {
      services: plainValue(picture.catalogue) as Service[],
      vehicles: plainValue(picture.cars.map(c => c.vehicle)) as Vehicle[],
      membership: (plainValue(picture.subscription ?? null) ?? null) as Subscription | null,
      /* WHERE THE STUDIO MAY COLLECT FROM - the same list the settings room
         shows, from the same read, so the two cannot disagree about which
         address is the default and therefore which chip is pre-selected. */
      addresses: picture.addresses.map(a => ({
        id: a.id,
        chip: shortAddress(a),
        line: fullAddress(a),
        isDefault: a.isDefault === true,
      })),
      /* THE FEE IS THE ENGINE'S. A figure typed into a screen is a figure that
         drifts from what the server charges the first time either changes. */
      legFee: rupees(PICKUP_LEG_FEE),
      addAddressHref: hrefForDestination({ to: 'profile.panel', panel: 'addresses' }),
    },

    /* EVERY VISIT THE CUSTOMER MAY STILL CHANGE - `upcomingOf`, the same
       reader every other room uses, so "Your visits" cannot list a visit the
       car's own room has stopped believing in.

       TWO THINGS CHANGED HERE. It filtered on status alone, so a request the
       studio never actioned sat in this list for ever under a heading that
       says these are your visits, offering "Move it" and "Cancel the visit"
       for a day that had already gone. And the list came out in GARAGE order -
       27 July, then 28 July, then 24 July - because it walked the cars and
       concatenated. Sorted across every car now, soonest first, by the one
       comparator; the answer to "when is my next visit" is the top row.

       Every upcoming visit is pending or confirmed by construction, which is
       the same set `firestore.rules` allows the customer to change, so the
       sheet still cannot offer an act the server will refuse. */
    manageable: picture.cars
      .flatMap(car => upcomingOf(car, now).map(b => ({ b, car })))
      .sort((x, y) => soonestFirst(x.b, y.b))
      .map(({ b, car }) => ({
        id: b.id,
        service: b.serviceName,
        vehicleName: car.vehicle.name,
        when: whenWords(b),
        standing: standingWord(b),
        href: hrefForDestination({ to: 'booking', bookingId: b.id }),
      })),
  };
}

/* ── SCOPE & QUOTE ───────────────────────────────────────────────────────── */

/**
 * SCREEN 07 - how much of the car, and what that costs.
 *
 * NO PRICE IS COMPUTED HERE. The coverages and extras are WORDED from the
 * catalogue - a label, a detail line and the figure the catalogue carries -
 * and the estimate itself comes from the server, which runs `priceVisit`. A
 * projection that added up a scope and an add-on would be a second pricing
 * path with no test between it and the customer's money.
 */
export function toScopeQuote(
  picture: CustomerPicture,
  serviceId: string,
  vehicleId?: string,
): ScopeQuoteModel | null {
  const service = picture.catalogue.find(s => s.id === serviceId && s.active !== false);
  if (!service) return null;

  /* The car named in the address, or the one the customer is most likely to
     mean. A quote is FOR a car - the studio prices a bonnet, not an abstraction
     - so with no car at all there is nothing to quote and the room says so. */
  const car = (vehicleId ? picture.cars.find(c => c.vehicle.id === vehicleId) : undefined)
    ?? leadCar(picture);
  if (!car) return null;

  return {
    serviceId: service.id,
    serviceName: service.name,
    forCar: `For the ${car.vehicle.name}`,
    vehicleId: car.vehicle.id,
    brandLine: [service.brand, service.warranty].filter(Boolean).join(DOT) || undefined,
    scopes: scopesOf(service).map(s => ({
      id: s.id,
      kind: s.kind,
      label: s.label,
      detail: s.detail,
      /* "On quote" IS THE PRICE of a custom coverage, and it is the design's
         own word. A zero would claim the studio does it for nothing. */
      price: typeof s.price === 'number' && s.price > 0 ? rupees(s.price) : 'On quote',
      panels: s.panels?.map(p => ({ id: p.id, label: p.label, price: rupees(p.price) })),
    })),
    addOns: addOnsOf(service).map(a => ({
      id: a.id,
      label: a.label,
      detail: a.detail,
      price: rupees(a.price),
      recommendedWith: a.recommendedWith ?? [],
    })),
    /* The date screen, which the estimate id is appended to. Built by the
       resolver - a screen that assembled this would be a second route table. */
    nextHrefBase: hrefForDestination({ to: 'studio.arrange' }),
    backHref: hrefForDestination({ to: 'studio' }),
  };
}

/* ── READY · PAY · RATE ──────────────────────────────────────────────────── */

/**
 * SCREEN 13 - what the visit came to, and how to settle it.
 *
 * NOTHING IS ADDED UP HERE. The lines come from the booking's stored
 * breakdown, which `priceVisit` produced and a mid-visit approval updated; the
 * payable figure comes from `settlementOf`, which states its order of
 * authority once rather than letting each surface pick a document. A
 * projection that summed line items would be a fifth opinion about one visit's
 * money, and the audit found four already disagreeing.
 */
export function toSettle(args: {
  picture: CustomerPicture;
  bookingId: string;
  /** The sealed record, when the visit has produced one. */
  visit?: Visit | null;
  /** What the studio has received, and against which record. */
  money: { total: number; received: number; payable: number };
  /** The live payment, if one has been started. */
  payment?: { status: PaymentStatus } | null;
  rated?: boolean;
  /** False when the studio has no collecting address configured. */
  upiAvailable: boolean;
}): SettleModel | null {
  const found = findBooking(args.picture, args.bookingId);
  if (!found) return null;
  const { booking: b, car } = found;

  const status: PaymentStatus = args.money.payable === 0
    ? 'paid'
    : args.payment?.status ?? 'unpaid';

  /* THE LINES ARE THE STORED WORKING. A booking made before breakdowns existed
     falls back to the one thing it does carry - the service and its total -
     rather than inventing a decomposition of a figure nobody itemised. */
  const bd = b.breakdown;
  const lines: SettleLine[] = bd
    ? [
        { label: b.serviceName, value: rupees(bd.subtotal), detail: b.scope?.label },
        ...(bd.discount
          ? [{ label: bd.discount.label, value: `−${rupees(bd.discountAmount)}` }] : []),
        ...bd.fees.map(f => ({ label: f.label, value: rupees(f.amount) })),
        ...(bd.tax
          ? [{ label: `GST ${bd.tax.rate}%`, value: rupees(bd.tax.amount) }] : []),
      ]
    : [{ label: b.serviceName, value: rupees(args.money.total), detail: b.scope?.label }];

  const collected = b.dropRequired
    ? 'We are bringing it back to you.'
    : 'Ready to collect from the studio — Maninagar, Ahmedabad.';

  return {
    bookingId: b.id,
    eyebrow: [car.vehicle.name, 'closed'].filter(Boolean).join(DOT),
    headline: args.money.payable === 0 ? 'All settled.' : 'Back with you.',
    handover: collected,
    lines,
    total: rupees(args.money.total),
    payable: args.money.payable > 0 ? rupees(args.money.payable) : undefined,
    paymentWord: PAYMENT_WORD[status],
    paymentLine: PAYMENT_LINE[status],
    /* Offered only when there is something to pay AND nothing already with the
       studio to confirm - a second link against a credit they are checking is
       how one visit ends up with two payments to reconcile. */
    payable_now: args.money.payable > 0 && status !== 'submitted',
    awaitingConfirmation: status === 'submitted',
    method: args.picture.user.upiVpa
      ? `UPI · ${maskVpa(args.picture.user.upiVpa)}`
      : 'No payment address saved',
    methodHref: hrefForDestination({ to: 'profile.panel', panel: 'payment' }),
    visitId: args.visit?.id,
    rated: args.rated ? 'Thank you — the studio has read it.' : undefined,
    recordHref: args.visit
      ? hrefForDestination({ to: 'visit', visitId: args.visit.id })
      : hrefForDestination({ to: 'booking', bookingId: b.id }),
    upiUnavailable: args.upiAvailable
      ? undefined
      : 'The studio is not taking UPI in the app just now — settle at the counter and we will mark it.',
  };
}

/* ── MID-VISIT APPROVAL ──────────────────────────────────────────────────── */

/**
 * SCREEN 12 - what the studio found, and what it changes.
 *
 * Every figure is read from the STORED approval, which the server froze when
 * it asked. Nothing is recomputed: the customer taps a total, and the total
 * they tapped is the total that is applied.
 *
 * `requestedByEmployeeId` is on the record and is deliberately absent from
 * this model. §2.2 - no individual is ever named on a customer surface, and
 * the design's own "requester identity" line is answered by the studio, not by
 * a person.
 */
export function toApproval(
  approval: Approval,
  now = new Date(),
): ApprovalModel {
  const expired = approvalHasExpired(
    { status: approval.status, requestedAtMs: approval.requestedAt?.toMillis?.() ?? 0 },
    now,
  );

  /* "Same day" is a claim about the studio's evening, and it is only true when
     the extra time still fits inside one. Above that it says so. */
  const hours = Math.round(approval.timeDeltaMinutes / 60);
  const timeDelta = approval.timeDeltaMinutes <= 0
    ? 'No extra time'
    : approval.timeDeltaMinutes < WORK_DAY_MIN
      ? `+${hours === 0 ? `${approval.timeDeltaMinutes} min` : `${hours} hour${hours === 1 ? '' : 's'}`} · same day`
      : `+${bayWords(approval.timeDeltaMinutes)} in the bay`;

  const settled =
    approval.status === 'approved'
      ? 'You approved this. The studio is going ahead.'
      : approval.status === 'declined'
        ? 'You skipped this. The visit carries on as booked.'
        : approval.status === 'cancelled'
          ? 'The studio withdrew this — it turned out not to be needed.'
          : approval.status === 'expired' || expired
            ? 'This request has run out. Call the studio and we will pick it up.'
            : undefined;

  const until = approval.expiresAt?.toDate?.();

  return {
    id: approval.id,
    eyebrow: ['In the studio', approval.vehicleName].filter(Boolean).join(DOT),
    headline: approval.reason,
    detail: approval.detail,
    photos: approval.photos ?? [],
    proposedLabel: approval.proposed.label,
    priceDelta: `+${rupees(approval.priceDelta)}`,
    timeDelta,
    newTotal: rupees(approval.after.total),
    currentTotal: rupees(approval.before.total),
    settled,
    standsUntil: !settled && until
      ? `Stands until ${spokenHour(hourInStudio(until)) ?? 'the end of the day'}`
      : undefined,
    /* The visit it belongs to. A booking id is what the customer's own history
       is addressed by while the car is here. */
    visitHref: approval.bookingId
      ? hrefForDestination({ to: 'visit', visitId: approval.bookingId })
      : hrefForDestination({ to: 'home' }),
  };
}

/** Approvals still waiting on this customer, newest first. */
export function pendingApprovals(approvals: Approval[], now = new Date()): Approval[] {
  return approvals
    .filter(a => a.status === 'requested' && !approvalHasExpired(
      { status: a.status, requestedAtMs: a.requestedAt?.toMillis?.() ?? 0 }, now,
    ))
    .sort((a, b) => (b.requestedAt?.toMillis?.() ?? 0) - (a.requestedAt?.toMillis?.() ?? 0));
}

/* ── THE BOOKING ─────────────────────────────────────────────────────────── */

/** "9:00 am". The hour as a person says it, never "09:00" on a confirmation. */
export function spokenHour(time?: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time ?? '');
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const suffix = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return min === 0 ? `${h12} ${suffix}` : `${h12}:${m[2]} ${suffix}`;
}

/** "Wednesday 12 February" - the day named, because a confirmation is read once. */
function fullDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const weekday = new Date(Date.UTC(y, m - 1, d))
    .toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'UTC' });
  return `${weekday} ${d} ${MONTHS[m - 1]}`;
}

/** "Thu 12 Feb" - the compact form, for a chip. */
export function shortDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const weekday = new Date(Date.UTC(y, m - 1, d))
    .toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' });
  return `${weekday} ${d} ${MONTHS[m - 1].slice(0, 3)}`;
}

/**
 * WHEN, ACROSS HOWEVER MANY DAYS IT TAKES.
 *
 * A two-day job said as one day is the single most consequential thing this
 * product could get wrong on a confirmation: the customer plans a morning
 * without a car and loses two.
 */
function whenWords(b: Booking): string {
  const start = fullDay(b.scheduledDate);
  const hour = spokenHour(b.scheduledTime);
  const end = b.endDate && b.endDate !== b.scheduledDate ? b.endDate : null;
  if (end) return `${shortDay(b.scheduledDate)} – ${shortDay(end)}`;
  return hour ? `${start} at ${hour}` : start;
}

/** "2 days in the bay" / "4 hours in the studio" - the same wording as screen 07. */
export function bayWords(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'To be confirmed';
  if (minutes < WORK_DAY_MIN) {
    const h = Math.max(1, Math.round(minutes / 60));
    return `${h} hour${h === 1 ? '' : 's'}`;
  }
  const d = spanDays(DAY_OPEN_MIN, minutes);
  return `${d} day${d === 1 ? '' : 's'}`;
}

export interface FoundBooking {
  booking: Booking;
  car: CarPicture;
}

/**
 * ONE BOOKING, FOUND BY ID ACROSS EVERY CAR THE CUSTOMER OWNS.
 *
 * Ownership is structural: `CustomerPicture` was built by querying `bookings`
 * where `userId == <the verified session's uid>`, so a booking that is not
 * this customer's is not in here to be found. There is no id check to forget.
 */
export function findBooking(picture: CustomerPicture, id: string): FoundBooking | null {
  for (const car of picture.cars) {
    const booking = car.bookings.find(b => b.id === id);
    if (booking) return { booking, car };
  }
  return null;
}

/** The studio's word for a booking's standing, on its own two screens. */
function standingWord(b: Booking): string {
  switch (visitPhase(b.status)) {
    case 'proposed':  return 'Awaiting the studio';
    case 'agreed':    return 'Confirmed';
    case 'live':      return 'In the studio';
    case 'archived':  return 'Finished';
    case 'expired':   return 'Not taken up';
    case 'cancelled': return 'Cancelled';
  }
}

/**
 * SCREEN 09 - BOOKED.
 *
 * Every figure comes from the stored booking, which the Booking Service wrote
 * from its own arithmetic. Nothing is recomputed here, so this screen cannot
 * quote a total the studio does not hold.
 */
export function toBooked(
  picture: CustomerPicture, id: string, now = new Date(),
): BookedModel | null {
  const found = findBooking(picture, id);
  if (!found) return null;
  const { booking: b, car } = found;

  const phase = visitPhase(b.status);
  const awaiting = phase === 'proposed';
  const settled = phase === 'archived' || phase === 'cancelled' || phase === 'expired';
  const duration = b.serviceDurationMinutes ?? 60;

  const back = b.endDate && b.endDate !== b.scheduledDate
    ? `${longDate(b.endDate)}, end of day`
    : [spokenHour(endOfSlot(b.scheduledTime, duration)) ?? null, 'the same day']
        .filter(Boolean).join(DOT);

  /* HOW THE CAR GETS THERE. The legs are what the customer actually chose, and
     the address is the SNAPSHOT stored on the booking - never the saved
     address as it stands today, which they may have edited since. */
  const collection = b.pickupRequired && b.dropRequired
    ? `We collect it and bring it back${b.pickupAddress ? ` - ${b.pickupAddress}` : ''}.`
    : b.pickupRequired
      ? `We collect it${b.pickupAddress ? ` from ${b.pickupAddress}` : ''}. You collect it from the studio.`
      : b.dropRequired
        ? `Bring it to the studio; we bring it back${b.pickupAddress ? ` to ${b.pickupAddress}` : ''}.`
        : 'Bring it to the studio — Maninagar, Ahmedabad.';

  const rows: BookedRow[] = [
    {
      label: 'Work',
      value: b.serviceName,
      detail: [car.vehicle.name, b.scope?.label].filter(Boolean).join(DOT) || undefined,
    },
    { label: 'In the bay', value: bayWords(duration) },
    { label: 'Back to you', value: back },
    {
      label: 'Estimate',
      value: rupees(b.totalAmount ?? 0),
      detail: b.usedMembershipWash
        ? 'Covered by your membership'
        : b.discount?.label ?? 'Final on inspection',
    },
  ];

  const window = changeWindowOf(b, now);

  return {
    headline: awaiting ? 'We have your request.'
      : phase === 'agreed' ? 'The bay is yours.'
      : phase === 'live' ? 'Your car is with us.'
      : phase === 'archived' ? 'Back with you.'
      : phase === 'expired' ? 'That day passed.'
      : 'This visit was cancelled.',
    standing: standingWord(b),
    awaiting,
    /* A bay is only HELD while the booking is still standing. A cancelled or
       expired visit that breathes amber contradicts its own headline. */
    holds: !settled,
    when: whenWords(b),
    collection,
    rows,
    /* NO CALENDAR ENTRY FOR A BAY NOBODY HAS PROMISED. A request the studio
       has not accepted is not an appointment, and putting one in an owner's
       calendar would be the product asserting something the studio has not. */
    calendarHref: awaiting || settled
      ? undefined
      : hrefForDestination({ to: 'booking.calendar', bookingId: b.id }),
    manageHref: hrefForDestination({ to: 'booking.manage', bookingId: b.id }),
    lockedBecause: window.allowed || phase === 'proposed'
      ? undefined
      : lockedWords(window.reason),
    visitHref: phase === 'live'
      ? hrefForDestination({ to: 'visit', visitId: b.id }) : undefined,
    homeHref: hrefForDestination({ to: 'home' }),
  };
}

/** When the slot ends, from the start and the work's own duration. */
function endOfSlot(time: string | undefined, durationMinutes: number): string | undefined {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time ?? '');
  if (!m) return undefined;
  const total = Number(m[1]) * 60 + Number(m[2]) + durationMinutes;
  if (total >= 24 * 60) return undefined;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Why it can no longer be changed, in the studio's words. */
function lockedWords(reason: string): string {
  switch (reason) {
    case 'inside-window':
      return 'Your slot is less than a day away, so the studio is already '
        + 'preparing for it. Call us and we will sort it.';
    case 'work-started':
      return 'The studio has started on this one, so it can no longer be '
        + 'changed here. Call us and we will sort it.';
    case 'already-completed':
      return 'This visit is finished. Its record is in your car’s history.';
    case 'already-cancelled':
      return 'This visit was cancelled.';
    case 'already-expired':
      return 'That day passed without us confirming it. Arrange another and we will.';
    default:
      return 'This visit can no longer be changed here. Call us and we will sort it.';
  }
}

/**
 * SCREEN 10 - MANAGE BOOKING.
 *
 * `openings` is passed in rather than computed, because it depends on every
 * other customer's bookings and this file may not read a database (§1). The
 * page loads them through `lib/server/openings.ts`, from the same occupancy
 * the Booking Service accepts against.
 */
export function toManageBooking(
  picture: CustomerPicture,
  id: string,
  openings: { date: string; time: string }[] = [],
  now = new Date(),
): ManageBookingModel | null {
  const found = findBooking(picture, id);
  if (!found) return null;
  const { booking: b, car } = found;

  const window = changeWindowOf(b, now);
  const canCancel = bookingTransition(b.status, 'cancelled', 'customer').ok;

  /* WHEN THE FREE CHANGE RUNS OUT, stated before it does rather than after.
     The design's promise is "free until 24 hours before", and a promise with
     no stated deadline is one the customer discovers by being refused. */
  const at = scheduledEpochMs(b.scheduledDate, b.scheduledTime);
  const deadline = at === null ? null : new Date(at - CHANGE_WINDOW_HOURS * 3600_000);
  const freeUntil = window.allowed && deadline
    ? `Free to change until ${longDate(isoInStudio(deadline))}, `
      + `${spokenHour(hourInStudio(deadline)) ?? ''}.`
    : undefined;

  return {
    id: b.id,
    standing: standingWord(b),
    headline: b.serviceName,
    vehicleName: car.vehicle.name,
    when: whenWords(b),
    freeUntil,
    moveable: window.allowed,
    moveBlockedBecause: window.allowed ? undefined : lockedWords(window.reason),
    cancellable: canCancel,
    /* A booking may be cancellable while it may no longer be MOVED - inside
       the last day the studio has prepared for a slot, but the customer may
       still withdraw. Two rules, two answers, never one control for both. */
    cancelBlockedBecause: canCancel ? undefined : lockedWords(
      b.status === 'cancelled' ? 'already-cancelled'
        : b.status === 'expired' ? 'already-expired'
        : b.status === 'completed' ? 'already-completed'
        : 'work-started',
    ),
    openings: openings.map(o => ({ ...o, label: shortDay(o.date) })),
    backHref: hrefForDestination({ to: 'booking', bookingId: b.id }),
    homeHref: hrefForDestination({ to: 'home' }),
  };
}

/** A studio-local date from an instant. The studio keeps studio time (§lifecycle). */
function isoInStudio(d: Date): string {
  return new Date(d.getTime() + STUDIO_UTC_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}
function hourInStudio(d: Date): string {
  return new Date(d.getTime() + STUDIO_UTC_OFFSET_MIN * 60_000).toISOString().slice(11, 16);
}

/* ── YOU ─────────────────────────────────────────────────────────────────── */

const CARS_IN_WORDS = ['No cars', 'One car', 'Two cars', 'Three cars', 'Four cars', 'Five cars'];

export function toYou(picture: CustomerPicture, now = new Date()): YouModel {
  const { user, cars } = picture;
  const n = cars.length;
  const count = CARS_IN_WORDS[n] ?? `${n} cars`;

  /**
   * THE SAME ENGINE THE MEMBERSHIP ROOM READS.
   *
   * This asked `subscription ? …` - any subscription, whatever had become of
   * it - and then derived the wording from the raw document. A customer whose
   * Silver membership had been CANCELLED was told, on this screen,
   *
   *     Silver member.
   *     4 washes left this cycle.
   *     Renews 15 August 2026.
   *
   * while `/membership`, one tap away, said "You are not a member." Both
   * sentences were about the same document; only one of them asked `os/club`.
   */
  const club = clubOf(picture, now);

  /**
   * THE ONE QUIET LINE - design screen 1l, "You - and the one quiet line".
   *
   * The person's room says one thing about their car and only while something
   * is actually happening to it. §5.2 bars the car's DETAILS from this room,
   * not the fact that the studio currently has it: a customer who opens their
   * own room while their car is on a bay and is told nothing has to go and
   * look. It is a doorway (§17.3), never a status board - one sentence, and
   * absent the moment the work ends.
   */
  const lead = leadCar(picture);
  const live = lead ? liveOf(lead) : undefined;
  const quiet = live && lead
    ? {
        line: stateOf(lead, now).line ?? stateOf(lead, now).word,
        href: hrefForDestination({ to: 'visit', visitId: live.id }),
      }
    : undefined;

  return {
    name: user.name || 'You',
    reachedAt: [user.email, user.phone].filter(Boolean).join(DOT),
    /* "Gold · since 2023" - and just "Gold" when no membership carries a
       start date, rather than the dangling "Gold · since" a template with an
       empty tail produces. */
    standing: club.state !== 'none'
      ? [
          club.plan,
          picture.subscriptions
            .map(s => s.startDate)
            .filter((d): d is string => typeof d === 'string' && d.length >= 4)
            .sort()[0]
            ?.slice(0, 4),
        ].filter(Boolean).join(' · since ')
      : undefined,
    state: quiet,
    garage: {
      line: `${count} live${n === 1 ? 's' : ''} here.`,
      action: { label: 'Your garage', href: hrefForDestination({ to: 'garage' }) },
    },
    membership: club.state !== 'none' ? {
      lines: membershipLines(club),
      action: { label: 'What it includes', href: hrefForDestination({ to: 'membership' }) },
    } : undefined,
    /* THE SURFACES NOW EXIST, so the controls return. Each opened `/you` -
       the address it was already on - and was omitted rather than left inert.
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
    privacy: cars.length > 0 ? {
      /* Design 17's consent, decided here rather than buried in a policy. The
         published policy is still one tap further on, inside the panel. */
      line: cars.some(c => hasPublicHistoryConsent(c.vehicle))
        ? 'A car’s record may be shown if you sell it.'
        : 'Your cars’ records stay private.',
      action: { label: 'Your car’s record',
        href: hrefForDestination({ to: 'profile.panel', panel: 'privacy' }) },
    } : {
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
    /* ── DESIGN SCREEN 19'S OWN ROWS ─────────────────────────────────
       Each one opens a surface that exists. §10.5 - if there is no
       destination there is no control, which is why each is conditional on
       the thing behind it rather than always drawn and sometimes inert. */
    papers: picture.invoices.length > 0 ? {
      line: picture.invoices.length === 1
        ? 'One invoice, and your warranties.'
        : `${picture.invoices.length} invoices, and your warranties.`,
      action: { label: 'Invoices and papers', href: hrefForDestination({ to: 'history' }) },
    } : undefined,
    payment: {
      /* MASKED. A payment address on a screen is a payment address in a
         photograph of that screen. Enough to recognise, not enough to reuse. */
      line: user.upiVpa ? `UPI · ${maskVpa(user.upiVpa)}` : 'Not saved yet.',
      action: { label: 'Payment method',
        href: hrefForDestination({ to: 'profile.panel', panel: 'payment' }) },
    },
    addresses: {
      line: picture.addresses.length === 0 ? 'None saved yet.'
        : picture.addresses.length === 1 ? 'One saved.'
        : `${picture.addresses.length} saved.`,
      action: { label: 'Pickup addresses',
        href: hrefForDestination({ to: 'profile.panel', panel: 'addresses' }) },
    },
    /* CONSENT IS PER CAR, so the row exists only when there is a car to
       decide about - an empty garage has no record to publish. */
    ...(cars.length > 0 ? {
      consentCars: cars.map(c => ({
        id: c.vehicle.id,
        name: c.vehicle.name,
        registration: c.vehicle.registrationNumber,
        granted: hasPublicHistoryConsent(c.vehicle),
      })),
    } : {}),
    quiet: {
      line: 'Only approvals and handover reach you.',
      on: user.quietMode === true,
    },
    support: {
      line: 'Something not right?',
      /* Was `COMPANY.mapsUrl` - "Talk to us" opened Google Maps. The studio's
         actual channel is WhatsApp. */
      action: { label: 'Talk to us', href: waLink('Hello AutoModz -') },
    },
  };
}

/**
 * §15.3's first three facts. THE FOURTH - "what it has been worth" - is not
 * here, and its absence is deliberate: it must be the honest cumulative saving
 * from settled visits, and nothing records that yet. A plausible number would
 * be the one figure §15.3 says decides renewal, invented.
 */
function membershipLines(club: ClubModel): string[] {
  const remaining = club.washesLeft;
  /* The state is the engine's, so the third line cannot claim a renewal the
     Membership room has already said will not happen. `healthOf` was being
     asked here as a second opinion on a lifecycle `clubModel` had already
     resolved - and it answered "healthy" for a cancelled plan, because a
     cancellation is not a date. */
  /* NO DATE MEANS NO DATE, NOT AN EMPTY SPACE WHERE ONE WOULD BE.
     Every branch interpolated `when` unguarded, so a membership with no known
     renewal - a lapsed one, most often - was shown the sentence

         Lapsed .

     with a stranded space before the stop. `Renews .` and `The cycle ended .`
     were the same defect waiting on the same absent field. §18.1: nothing is
     drawn for nothing, so the date leaves the sentence rather than leaving a
     hole in it, and a renewal nobody can name is not announced at all. */
  const when = club.renewsOn ? longDate(club.renewsOn) : '';
  const standing =
    club.state === 'lapsed' ? (when ? `Lapsed ${when}.` : 'Lapsed.')
      : club.state === 'grace' ? (when ? `The cycle ended ${when}.` : 'The cycle has ended.')
      : club.state === 'pending' ? 'Waiting on the studio to confirm it.'
      : when ? `Renews ${when}.` : '';

  return [
    `${club.plan} member.`,
    `${remaining === 0 ? 'No washes' : remaining === 1 ? 'One wash' : `${remaining} washes`} left this cycle.`,
    standing,
  ].filter(Boolean);
}

/* ── MEMBERSHIP ──────────────────────────────────────────────────────────── */

export function toMembership(picture: CustomerPicture, now = new Date()): MembershipModel {
  /* THE ENGINE DECIDES. `os/club` already owns the state, the cycle's
     arithmetic and the one true sentence under the card. This used to recompute
     `remaining` and the health locally - a second implementation of the same
     membership maths, which is exactly what §22.2 forbids. */
  const club = clubOf(picture, now);
  const sub = picture.subscription;

  /* §21.8 — the CUSTOMER's word, never the internal one. This printed the raw
     enum, so a membership the studio had not yet taken payment for appeared in
     the record as the lowercase word "pending" beside four sentences of the
     product's own English. `MEMBERSHIP_WORD` is the one vocabulary, shared
     with the studio's own screen.

     The dash is an em dash, as it is everywhere else in the product. */
  const history = picture.subscriptions.map(s => ({
    id: s.id,
    plan: `${s.plan} member`,
    period: `${longDate(s.startDate)} — ${longDate(s.endDate)}`,
    status: MEMBERSHIP_WORD[s.status] ?? s.status,
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
    /**
     * WHOSE CARD IT IS - design screen 1i.
     *
     * A membership card with no name on it is a receipt. The holder's name and
     * the year they joined are what make it theirs, and both were already in
     * the picture and never asked for. The number is the subscription's own id,
     * shortened and cased - not a new identifier minted for a screen, which
     * would be a second identity for one membership.
     */
    holder: picture.user.name || undefined,
    memberNo: sub.id.slice(-4).toUpperCase(),
    /* The year the relationship started, from the EARLIEST membership held -
       a customer on their third year should not read "since 2026" because the
       current subscription began in January. Every date here is optional in
       practice (a membership created by the studio at the counter may carry
       none), so the whole line is dropped rather than guessed. */
    memberSince: [...picture.subscriptions, sub]
      .map(s => s.startDate)
      .filter((d): d is string => typeof d === 'string' && d.length >= 4)
      .sort()[0]
      ?.slice(0, 4),
    /* §15.3 #2 - the engine's own count, not a second subtraction. */
    remaining: club.washesLeft === 0
      ? 'No washes left this cycle'
      : `${club.washesLeft} of ${club.washesTotal} washes left this cycle`,
    share: club.washesTotal > 0 ? club.washesLeft / club.washesTotal : undefined,
    term: health === 'lapsed'
      ? `Lapsed ${longDate(sub.endDate)}`
      : `Renews ${longDate(sub.endDate)}`,
    /* §14.4 - a countdown only when the number is small enough to act on. */
    countdown: days !== null && days >= 0 && days <= 30
      ? `${days} day${days === 1 ? '' : 's'} left in this cycle`
      : undefined,
    awaitingPayment: club.awaitingPayment,
    /* What they have already told the studio, so the room does not ask twice
       for something it was given last night (§19.1). */
    paymentClaimed: sub?.transactionId,
    tone: TONE[health],
    benefits: plan?.perks,
    /* The benefit is used, not admired - a wash that is already paid for is
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

