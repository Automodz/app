/**
 * THE BRIDGE — the server's picture, adapted to the engines that already exist.
 *
 * Source: docs/HOME-STATE-MAP.md
 * Reference: reference/customer-old/app/app/page.tsx:167-200
 *
 * WHAT THIS FILE IS NOT: it is not a state machine. `lib/os/ownership.ts` is the
 * state machine, `lib/os/club.ts` is the membership lifecycle and
 * `lib/os/proposal.ts` is the recommendation engine. All three were written,
 * tested, and then disconnected when the customer UI was replaced — their unit
 * tests still pass with zero callers in the shipping app. Nothing here
 * re-derives what any of them decide.
 *
 * All this does is shape `CustomerPicture` into the inputs they ask for. Every
 * judgement — precedence, thresholds, wording — stays in the engine that owns
 * it. The derivations below are ported line-for-line from the old Home so the
 * engines receive exactly the inputs they were tested against.
 */
import type { Booking, Subscription } from '@/lib/types';
import { PROTECTION_TITLE } from '@/lib/types';
import type { CarPicture, CustomerPicture } from './source';
import { ownershipState, type Ownership, type OwnershipState } from '@/lib/os/ownership';
import type { LiveProtection } from '@/lib/os/protection';
import { clubModel, type ClubModel } from '@/lib/os/club';
import { proposalFor, type Proposal } from '@/lib/os/proposal';
import { nextActionFor, type NextAction } from '@/lib/os/action';
import { deriveStay, type StayModel } from '@/lib/os/stay';
import { truthOf, type ProtectionFact } from '@/lib/os/truth';
import { conciergeLog, type LogEntry } from '@/lib/os/log';
import { visitPhase } from '@/lib/os/visit';

/**
 * A refusal or a no-show stops speaking after a fortnight. Ported verbatim —
 * without it, a visit the studio could not take three months ago is still the
 * headline on the car today.
 */
export const DECLINE_WINDOW_MS = 14 * 86_400_000;

const millisOf = (t: unknown): number =>
  (t as { toMillis?: () => number })?.toMillis?.() ?? 0;

/** Newest scheduled first. */
const newestFirst = (a: Booking, b: Booking) =>
  String(b.scheduledDate ?? '').localeCompare(String(a.scheduledDate ?? ''));

/**
 * THE NEXT VISIT — one definition, for every surface that names one.
 *
 * There used to be two. This file's `agreedOf` took the SOONEST open booking
 * and fed the Home hero, the ownership state machine and the timeline;
 * `project.ts` kept a private `liveBooking` that took the FIRST match in a list
 * ordered by `createdAt`, and fed Home's NEXT VISIT block, the Vehicle room and
 * the Studio. On a car holding two open bookings the two disagreed, and Home
 * said "Teflon Coating, 24 July" in its largest type directly above a section
 * headed NEXT VISIT that said "Kovalent Prolong, 28 July". Both sentences were
 * true about different bookings. Neither was the answer to the question.
 *
 * AND NEITHER LOOKED AT THE DATE. A request the studio never actioned stayed
 * the car's next visit for ever: three of them were still being offered with a
 * "Move it" control eleven days after the day they named.
 *
 * A visit is upcoming while the DAY it is booked for has not ended — not the
 * hour. A customer whose 09:00 wash is still on the forecourt at 09:05 has not
 * stopped having a visit today, and retiring it mid-morning would be the
 * product being pedantic at their expense.
 */

/**
 * Today, as the studio's booking records spell a day. Compared as a string
 * against `scheduledDate`, which is the same shape and the same comparison
 * `os/club` already uses to decide a membership has lapsed — §22.2, one
 * implementation of one idea. (It reads UTC, as every other date comparison in
 * the product does; a booking therefore turns over at 05:30 local rather than
 * at midnight. Correcting that is a change to the whole date layer, not to this
 * function, and inventing a second convention here would be worse than the
 * five hours.)
 */
const todayISO = (now: Date) => now.toISOString().slice(0, 10);

/** Open — requested or confirmed — and still ahead of us. */
export const isUpcoming = (b: Booking, now: Date): boolean =>
  ['proposed', 'agreed'].includes(visitPhase(b.status))
  && String(b.scheduledDate ?? '') >= todayISO(now);

/**
 * Soonest first, and DETERMINISTIC. Two visits on the same day are separated by
 * the hour, and two at the same hour by id, so which one a room calls "next"
 * can never depend on the order Firestore happened to return the documents in.
 */
export const soonestFirst = (a: Booking, b: Booking) =>
  String(a.scheduledDate ?? '').localeCompare(String(b.scheduledDate ?? ''))
  || String(a.scheduledTime ?? '').localeCompare(String(b.scheduledTime ?? ''))
  || String(a.id ?? '').localeCompare(String(b.id ?? ''));

/** Every visit still ahead of this car, soonest first. */
export function upcomingOf(car: CarPicture, now = new Date()): Booking[] {
  return visitsOfCar(car).filter(b => isUpcoming(b, now)).sort(soonestFirst);
}

/**
 * The visits that count as this car's story: everything but the cancelled.
 * A cancellation is not a visit that happened, so it is excluded here — and
 * read separately by `declinedOf`, which is the only thing that cares.
 */
export function visitsOfCar(car: CarPicture): Booking[] {
  return car.bookings.filter(b => b.status !== 'cancelled').sort(newestFirst);
}

/** Visits that finished. `archived` is the phase word for a completed booking. */
export function completedOf(car: CarPicture): Booking[] {
  return visitsOfCar(car).filter(b => visitPhase(b.status) === 'archived');
}

/** The visit in flight, if any. */
export function liveOf(car: CarPicture): Booking | null {
  return visitsOfCar(car).find(b => visitPhase(b.status) === 'live') ?? null;
}

/**
 * THE next visit, or none at all. The single answer every room gives.
 *
 * Named for what it IS rather than for a booking status: `agreedOf` invited the
 * reading "the confirmed one", and it returned requested visits too.
 */
export function nextVisitOf(car: CarPicture, now = new Date()): Booking | null {
  return upcomingOf(car, now)[0] ?? null;
}

/**
 * The declined fork: a request the studio could not take, or a missed slot.
 *
 * Three rules, all ported: it is drawn from the CANCELLED bookings (which
 * `visitsOfCar` deliberately excludes), it retires after `DECLINE_WINDOW_MS`,
 * and it only speaks when nothing is in flight for the car.
 */
export function declinedOf(car: CarPicture, now = Date.now()): Booking | null {
  if (liveOf(car) || nextVisitOf(car, new Date(now))) return null;
  return car.bookings
    .filter(b => b.status === 'cancelled' && (b.rejectionReason != null || b.noShow === true))
    .filter(b => now - (millisOf(b.cancelledAt) || millisOf(b.updatedAt)) <= DECLINE_WINDOW_MS)
    .sort((a, b) => millisOf(b.cancelledAt) - millisOf(a.cancelledAt))[0] ?? null;
}

/**
 * The membership lifecycle. Its `completed` is every finished visit the OWNER
 * has, across all their cars — the Club belongs to the person, not the car.
 */
export function clubOf(picture: CustomerPicture, now = new Date()): ClubModel {
  return clubModel({
    membership: (picture.subscription ?? null) as Subscription | null,
    completed: picture.cars.flatMap(completedOf),
    now,
  });
}

export interface OwnershipRead {
  /** Straight from the engine: the state and the module order it implies. */
  ownership: Ownership;
  state: OwnershipState;
  club: ClubModel;
  /** A recommendation, or null. Already suppressed per the rules below. */
  proposal: Proposal | null;
  live: Booking | null;
  /** THE next visit — `nextVisitOf`, never anything a room worked out itself. */
  agreed: Booking | null;
  declined: Booking | null;
  completed: Booking[];
  protections: LiveProtection[];
  /** The one next thing to do, as an INTENT. Resolved to an address by
   *  `navigation/resolve.ts` — never here (ARCHITECTURE §4). */
  nextAction: NextAction;
  /**
   * The live visit, act by act, with an honest line about time. Null unless a
   * visit is actually in flight. `os/stay` has been written and tested since
   * the rebuild with no caller — this is that caller.
   */
  stay: StayModel | null;
  /**
   * The single sentence that is true about this car right now. `os/truth` is
   * the engine that decides it, and it has had no caller since the rebuild.
   */
  truth: string;
  /**
   * The studio's record of what has happened, in order. The old Desk carried
   * this; `os/log` has had no caller since the rebuild.
   */
  log: LogEntry[];
}


/**
 * `protections` is passed IN rather than derived here. `lib/customer/project`
 * already owns that derivation (stored protections through `liveProtection`,
 * with a fallback to `projectProtections` for cars whose promises predate the
 * seal). Deriving it a second time here would be a second implementation, and
 * importing project.ts would make the two files circular.
 */
export function readOwnership(
  picture: CustomerPicture,
  car: CarPicture,
  protections: LiveProtection[],
  now = new Date(),
): OwnershipRead {
  const live = liveOf(car);
  const agreed = nextVisitOf(car, now);
  const declined = declinedOf(car, now.getTime());
  const completed = completedOf(car);
  const club = clubOf(picture, now);

  const ownership = ownershipState({
    vehicleCount: picture.cars.length,
    live, agreed, declined, completed, protections, club, now,
  });

  /* One open proposal per vehicle, suppressed while a visit is already in
     flight — a car that is booked in does not need to be told to book in. */
  const proposal = (live || agreed)
    ? null
    : proposalFor({
        vehicleId: car.vehicle.id,
        protections,
        lastCaredOn: completed[0]?.scheduledDate,
        now,
      });

  /* The stay is only meaningful while the car is here. Asking for one on a
     finished visit would produce a countdown to a moment that has passed. */
  const job = live ? car.jobs.find(j => j.bookingId === live.id) ?? null : null;
  const stay = live ? deriveStay(live, job, now) : null;

  const visits = visitsOfCar(car);
  const jobByBooking = new Map(
    car.jobs.filter(j => j.bookingId).map(j => [j.bookingId as string, j]),
  );

  /* The one true sentence, and the record behind it. Both engines take the
     protections as FACTS — a label and a date — rather than the stored shape,
     so neither has to know how a term is modelled. */
  const facts: ProtectionFact[] = protections
    .filter(p => p.term.kind === 'dated')
    .map(p => ({
      label: PROTECTION_TITLE[p.kind],
      expiresOn: (p.term as { expiresOn: string }).expiresOn,
    }));

  const truth = truthOf({
    visits,
    protections: facts,
    lastCaredOn: completed[0]?.scheduledDate,
    now,
  });

  const log = conciergeLog({
    visits,
    jobByBooking,
    membership: (picture.subscription ?? null) as Subscription | null,
    protections,
    vehicleName: car.vehicle.name,
    now,
  });

  const nextAction = nextActionFor({
    state: ownership.state,
    club,
    proposal,
    liveVisitId: live?.id,
    agreedVisitId: agreed?.id,
    proposalApplies: proposalApplies(ownership.state),
  });

  return {
    ownership, state: ownership.state, club, proposal,
    live, agreed, declined, completed, protections, nextAction, stay, truth, log,
  };
}

/**
 * docs/HOME-STATE-MAP.md — the proposal is a LAYER over the steady states, not
 * a state of its own. A car cannot be both in the studio and overdue for a
 * wash; live facts outrank recommendations.
 */
export const PROPOSAL_APPLIES: readonly OwnershipState[] =
  ['protected', 'settled', 'dormant'];

export const proposalApplies = (state: OwnershipState): boolean =>
  PROPOSAL_APPLIES.includes(state);
