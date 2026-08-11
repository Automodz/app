/**
 * INTENT → ADDRESS.
 *
 * Source: docs/AUTOMODZ-OS-ARCHITECTURE.md §4, §5
 *
 * The engines say what should happen (`lib/os/action.ts`). This is the only
 * place that knows where. It lives in `navigation/` because that is where the
 * route table lives — putting it anywhere else would mean two files knowing the
 * product's addresses, and the second one always drifts.
 *
 * A renderer never calls this. The projection does, so a screen receives a
 * label and an href and has no destination logic of its own (§1).
 */
import type { NextAction, ActionIntent } from '@/lib/os/action';
import {
  STUDIO, GARAGE, MEMBERSHIP, HOME, HISTORY, PROFILE, VEHICLE, CARS, SELL, WELCOME,
  BOOKING,
} from './routes';

/** Where a visit is watched or read. */
const visit = (id?: string) => (id ? `/history/${id}` : '/history');

/**
 * A booking's own two screens — the confirmation and the place it is changed.
 *
 * `manage_visit` used to resolve to `${STUDIO}?manage=${id}`, a sheet over the
 * Studio. One address per screen, so a notification, a share and the back
 * button all behave.
 */
const booking = (id: string) => `${BOOKING}/${encodeURIComponent(id)}`;
const bookingManage = (id: string) => `${booking(id)}/manage`;
/** The calendar file for a booking. A FILE, not a room. */
const bookingCalendar = (id: string) => `/api/booking/${encodeURIComponent(id)}/calendar`;

/**
 * The marketplace, with a search already applied.
 *
 * §6.4 — every filtered view is a real address, so a shortlist can be sent to
 * whoever is actually paying for the car. Empty filters are omitted rather
 * than written as blanks, so the plain list has one canonical URL.
 */
const cars = (f: { query?: string; fuel?: string; upto?: number }) => {
  const p = new URLSearchParams();
  if (f.query) p.set('q', f.query);
  if (f.fuel && f.fuel !== 'all') p.set('fuel', f.fuel);
  if (f.upto) p.set('upto', String(f.upto));
  const qs = p.toString();
  return qs ? `${CARS}?${qs}` : CARS;
};

/**
 * A paper that opens for whoever holds the link.
 *
 * The share token travels in the address because these two are the only
 * customer surfaces reachable without a session — the same token the studio
 * sends. Without one the address still resolves, and the route refuses it.
 */
const shared = (base: string, id: string, token?: string) =>
  token ? `${base}/${id}?t=${encodeURIComponent(token)}` : `${base}/${id}`;

/**
 * The first arrival, at one of its steps.
 *
 * `?step=` is what makes the flow deep-linkable and the back button work — the
 * step used to be component state, so Back left the welcome entirely and a
 * reload started it over. `?welcome=1` travels with it so a forced arrival
 * stays forced as the customer moves through it.
 */
const welcome = (step?: string, forced?: boolean) => {
  const p = new URLSearchParams();
  if (forced) p.set('welcome', '1');
  if (step && step !== 'hello') p.set('step', step);
  const qs = p.toString();
  return qs ? `${WELCOME}?${qs}` : WELCOME;
};

/** The studio, optionally with the service already chosen. */
const studio = (category?: string) =>
  category ? `${STUDIO}?cat=${encodeURIComponent(category)}` : STUDIO;

/**
 * Every intent, resolved. Exhaustive by construction: `ActionIntent` is a union
 * and this record must cover it, so adding an intent without an address is a
 * compile error rather than a dead button (§10.5 — nothing is inert).
 */
const RESOLVERS: Record<ActionIntent, (a: NextAction) => string> = {
  add_car:             () => `${GARAGE}?add=1`,
  arrange_visit:       () => studio(),
  arrange_again:       () => studio(),
  manage_visit:        a => (a.params?.visitId ? bookingManage(a.params.visitId) : STUDIO),
  follow_visit:        a => visit(a.params?.visitId),
  see_visit:           a => visit(a.params?.visitId),
  renew_protection:    a => studio(a.params?.category),
  /* The intent travels in the address, so Home's "Renew the Club" opens the
     renewal rather than dropping the customer on the room to find it. */
  renew_membership:    () => `${MEMBERSHIP}?club=renew`,
  rejoin_membership:   () => `${MEMBERSHIP}?club=join`,
};

/** The address for an action. */
export const hrefFor = (action: NextAction): string => RESOLVERS[action.intent](action);

/**
 * Where a timeline event's object lives. The engine says WHAT the event is
 * about; this is the only place that knows where that is.
 */
export const hrefForRef = (ref?: { object: 'visit' | 'membership'; id?: string }): string | undefined => {
  if (!ref) return undefined;
  return ref.object === 'membership' ? MEMBERSHIP : visit(ref.id);
};

/**
 * EVERY PLACE THE PALETTE CAN SEND SOMEONE.
 *
 * ARCHITECTURE §1 — a renderer builds no addresses, and neither does a
 * projection. The Desk's items were assembled in `toHome` with their hrefs
 * typed out inline (`'/vehicle'`, `'/studio'`, `'/history'`), which is a second
 * copy of the route table living in a projection. Change a route and the
 * palette silently keeps sending people to the old one.
 *
 * A destination names WHAT it wants to reach. Only this file knows where that
 * is — the same rule `NextAction` already follows.
 */
export type Destination =
  | { to: 'home' }
  | { to: 'garage' }
  | { to: 'garage.add' }
  | { to: 'history' }
  | { to: 'studio' }
  | { to: 'studio.category'; category: string }
  | { to: 'membership' }
  | { to: 'membership.join' }
  | { to: 'profile' }
  | { to: 'profile.panel'; panel: 'profile' | 'notifications' | 'referral' | 'delete' }
  | { to: 'vehicle'; vehicleId?: string }
  | { to: 'visit'; visitId: string }
  | { to: 'booking'; bookingId: string }
  | { to: 'booking.manage'; bookingId: string }
  | { to: 'booking.calendar'; bookingId: string }
  | { to: 'privacy' }
  | { to: 'terms' }
  | { to: 'cars' }
  | { to: 'cars.filtered'; query?: string; fuel?: string; upto?: number }
  | { to: 'car'; listingId: string }
  | { to: 'sell' }
  | { to: 'history.car'; vehicleId: string }
  | { to: 'garage.edit'; vehicleId: string }
  /**
   * `fromVisitId` — the visit that sent them, when one did.
   *
   * The paper is a SHARED address: opened from a message it has no history
   * behind it, so `history.back()` is not a way out. Told which visit sent
   * them, the page can offer the record itself. Built here because addresses
   * are built here and nowhere else — a projection that assembled this query
   * string would be a second route table (`__tests__/integration/product`).
   */
  | { to: 'invoice'; invoiceId: string; token?: string; fromVisitId?: string }
  | { to: 'chapter'; invoiceId: string; token?: string }
  | { to: 'welcome'; forced?: boolean }
  | { to: 'welcome.step'; step: string; forced?: boolean };

export const hrefForDestination = (d: Destination): string => {
  switch (d.to) {
    case 'home':             return HOME;
    case 'garage':           return GARAGE;
    case 'garage.add':       return `${GARAGE}?add=1`;
    case 'history':          return HISTORY;
    case 'studio':           return STUDIO;
    case 'studio.category':  return studio(d.category);
    case 'membership':       return MEMBERSHIP;
    case 'membership.join':  return `${MEMBERSHIP}?club=join`;
    case 'profile':          return PROFILE;
    case 'profile.panel':    return `${PROFILE}?panel=${d.panel}`;
    case 'vehicle':          return d.vehicleId ? `${VEHICLE}?car=${d.vehicleId}` : VEHICLE;
    case 'visit':            return visit(d.visitId);
    case 'booking':          return booking(d.bookingId);
    case 'booking.manage':   return bookingManage(d.bookingId);
    case 'booking.calendar': return bookingCalendar(d.bookingId);
    case 'privacy':          return '/privacy';
    case 'terms':            return '/terms';
    case 'cars':             return CARS;
    case 'cars.filtered':    return cars(d);
    case 'car':              return `${CARS}/${d.listingId}`;
    case 'sell':             return SELL;
    case 'history.car':      return `${HISTORY}?car=${d.vehicleId}`;
    case 'garage.edit':      return `${GARAGE}?edit=${d.vehicleId}`;
    case 'invoice':          return d.fromVisitId
      ? `${shared('/invoice', d.invoiceId, d.token)}${d.token ? '&' : '?'}from=${encodeURIComponent(visit(d.fromVisitId))}`
      : shared('/invoice', d.invoiceId, d.token);
    case 'chapter':          return shared('/chapter', d.invoiceId, d.token);
    case 'welcome':          return welcome(undefined, d.forced);
    case 'welcome.step':     return welcome(d.step, d.forced);
  }
};

/**
 * WHERE A NOTIFICATION LANDS.
 *
 * §17.3 — "A notification is a doorway. It opens the exact surface it is about
 * — never the home screen, never a generic list."
 *
 * Every customer notification in the product pointed at `/app`, the old
 * customer root, which has not existed since the rooms moved to `/`. A booking
 * confirmation, a car ready to collect and a missed appointment all opened a
 * 404. This is the one place that answer is written, so the push payload, the
 * stored notification and the service worker cannot disagree about it.
 */
export const eventHref = (
  event: string,
  source: { kind: string; id: string },
): string => {
  /* A booking's own screen while it is still a booking; the visit's while the
     car is here or after it has been sealed. The distinction is the event, not
     the collection the id came from — `vehicle_ready` names a booking id and
     yet belongs on the visit, because that is the surface that owns the fact
     (§17.3). */
  switch (event) {
    case 'booking_confirmed':
    case 'booking_rescheduled':
    case 'booking_cancelled':
    case 'booking_expired':
      return booking(source.id);
    case 'approval_requested':
    case 'approval_approved':
    case 'approval_declined':
      return source.kind === 'approval' ? `/approval/${encodeURIComponent(source.id)}` : visit(source.id);
    case 'vehicle_ready':
    case 'payment_required':
    case 'payment_settled':
    case 'visit_completed':
      return visit(source.id);
    default:
      return source.kind === 'booking' ? booking(source.id) : visit(source.id);
  }
};

export const notificationHref = (n: {
  type?: string;
  bookingId?: string;
}): string => {
  /* A notification about a visit opens THAT visit. `/history/[id]` renders the
     live surface while the car is here and the sealed record afterwards, so one
     address is correct at every stage of the visit's life. */
  if (n.bookingId) return visit(n.bookingId);
  if (n.type === 'membership') return MEMBERSHIP;
  /* A reminder or an offer is about the car's standing, and Home is the car. */
  return HOME;
};

/** What a renderer receives: a label and somewhere real to go. */
export interface ResolvedAction {
  label: string;
  href: string;
  intent: ActionIntent;
}

export const resolveAction = (action: NextAction): ResolvedAction => ({
  label: action.label,
  href: hrefFor(action),
  intent: action.intent,
});
