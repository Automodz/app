/**
 * THE OWNERSHIP STATE ENGINE.
 *
 * The customer product is not a set of pages - it is one surface that
 * reorganises itself around where the owner actually stands right now. This is
 * the single place that decides which state that is, and what therefore
 * deserves the top of the screen.
 *
 * It derives nothing new: every input already comes from the visit, protection,
 * proposal, club and term engines. It only ranks them. One state wins; the
 * module order follows from it, so no two customers are shown the same Home.
 */
import type { Booking } from '@/lib/types';
import type { Protection } from '@/lib/cx/protection';
import type { ClubModel } from './club';
import { careAct, visitPhase } from './visit';
import { daysLeft } from './term';

/** A car untouched for this long is dormant - the studio should say something. */
export const DORMANT_DAYS = 90;

export type OwnershipState =
  | 'new'                  // no car in the garage yet
  | 'ready'                // the car is finished and waiting to be collected
  | 'in_studio'            // the car is with us right now
  | 'declined'             // a request the studio could not take, or a no-show
  | 'booked'               // a visit is agreed or requested
  | 'membership_attention' // the Club has lapsed or is in grace
  | 'warranty_expiring'    // a protection layer is waning or expiring
  | 'dormant'              // nothing for 90+ days
  | 'unvisited'            // a car, but no story yet
  | 'protected'            // steady, and something shields it
  | 'settled';             // steady, nothing shields it

/** The modules Home can show. Order is decided per state, never hard-coded. */
export type ModuleKey =
  | 'status'      // what is happening to the car
  | 'protection'  // what shields it
  | 'documents'   // its papers
  | 'activity'    // its ownership timeline
  | 'ownership'   // the Club
  | 'studio';     // where it is cared for

export interface Ownership {
  state: OwnershipState;
  /** modules top-to-bottom, most relevant to this state first */
  order: ModuleKey[];
}

const ALL: ModuleKey[] = ['status', 'protection', 'documents', 'activity', 'ownership', 'studio'];

/** Lead with these; everything else keeps its natural order behind them. */
const LEAD: Record<OwnershipState, ModuleKey[]> = {
  // the car is finished: collection, then the work that was just done
  ready:                ['status', 'activity', 'studio'],
  // the car is with us: what is happening, then where it is
  in_studio:            ['status', 'activity', 'studio'],
  // a refused request: the way forward, then where to reach us
  declined:             ['status', 'studio'],
  // a visit is coming: the visit, then how to get there
  booked:               ['status', 'studio'],
  // the relationship needs attention before anything else
  membership_attention: ['ownership', 'status'],
  // the shield is running out - it outranks routine status
  warranty_expiring:    ['protection', 'status'],
  // nothing for months: the invitation leads, the history reminds
  dormant:              ['status', 'activity'],
  // a car with no story: trust first, then the invitation to start one
  new:                  ['status', 'studio'],
  unvisited:            ['status', 'studio', 'protection'],
  // steady states
  protected:            ['status', 'protection', 'activity'],
  settled:              ['status', 'activity', 'protection'],
};

function orderFor(state: OwnershipState): ModuleKey[] {
  const lead = LEAD[state];
  return [...lead, ...ALL.filter(m => !lead.includes(m))];
}

export interface OwnershipInput {
  /** cars in the garage */
  vehicleCount: number;
  /** the visit in flight, if any */
  live: Booking | null;
  /** the next agreed/requested visit, if any */
  agreed: Booking | null;
  /** a visit the studio refused, or a no-show, still worth answering */
  declined: Booking | null;
  /** completed visits, newest first */
  completed: Booking[];
  protections: Protection[];
  club: ClubModel;
  now?: Date;
}

/**
 * One state wins. The order below IS the product's opinion about what matters:
 * a car in our hands outranks a booking, which outranks a lapsed membership,
 * which outranks an expiring warranty, which outranks silence.
 */
export function ownershipState(input: OwnershipInput): Ownership {
  const { vehicleCount, live, agreed, declined, completed, protections, club, now = new Date() } = input;

  const state: OwnershipState = (() => {
    if (vehicleCount === 0) return 'new';

    if (live) return careAct(live.status) === 'ready' ? 'ready' : 'in_studio';
    if (declined) return 'declined';
    if (agreed && ['proposed', 'agreed'].includes(visitPhase(agreed.status))) return 'booked';

    if (club.state === 'grace' || club.state === 'lapsed') return 'membership_attention';

    if (protections.some(p => p.active && (p.term === 'waning' || p.term === 'expiring'))) {
      return 'warranty_expiring';
    }

    if (completed.length === 0) return 'unvisited';

    const since = -daysLeft(completed[0].scheduledDate, now); // days since that visit
    if (since >= DORMANT_DAYS) return 'dormant';

    return protections.some(p => p.active) ? 'protected' : 'settled';
  })();

  return { state, order: orderFor(state) };
}
