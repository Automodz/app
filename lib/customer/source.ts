'use client';
/**
 * THE CUSTOMER'S PICTURE - one read, one place.
 *
 * Every customer room needs an overlapping slice of the same things: the
 * person, their cars, what protects each car, what has happened to each car,
 * and the membership. Seven routes each fetching their own slice would be seven
 * chances to disagree about one car (§22.2, §22.5 - truth is not recomputed).
 *
 * This fetches. It derives nothing - `project.ts` does that, from what is here.
 *
 * ── WHY BOOKINGS AND JOBS ARE STILL READ ─────────────────────────────────
 * `visits` is the anchor, but nothing writes to it yet: `writeDerivedVisit`
 * has no caller outside its own service. Reading only `visits` would show every
 * existing customer an empty History. So both are loaded and `project.ts`
 * prefers stored visits, falling back to the Booking+Job pair through the
 * service's own `visitFromPair` - the documented migration read path, using the
 * same projection the migration will persist.
 */
import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { getVehicles, getJobsForVehicle, getBookingsForVehicle } from '@/lib/services/vehicles';
import { getProtections } from '@/lib/services/protections';
import { getVisitsForVehicle } from '@/lib/services/visits';
import { getUserSubscription } from '@/lib/services/subscriptions';
import { getServices } from '@/lib/services/services';
import { getUserNotifications } from '@/lib/services/notifications';
import { getDeclarations } from '@/lib/services/declarations';
import type {
  Approval, Booking, Declaration, Invoice, Job, Notification, Protection, SavedAddress,
  Service, Subscription, User, Vehicle, Visit,
} from '@/lib/types';

/** Everything known about one car. */
export interface CarPicture {
  vehicle: Vehicle;
  protections: Protection[];
  /**
   * THE PAPERS THE OWNER HAS SENT - and what the studio made of each.
   *
   * Read beside the protections rather than derived from them, because a
   * declaration that is still waiting, or one the studio refused, produces no
   * protection at all and yet is the whole of what the car has to say about
   * its certificate. Without this the ledger could only ever show the two
   * states a Protection has (in date, out of date) and the customer who sent
   * something last night would be told "not added" (§19.1).
   */
  declarations: Declaration[];
  /** newest first. Empty until the visit migration runs. */
  visits: Visit[];
  /** newest first. The fallback History and Protection are projected from. */
  bookings: Booking[];
  jobs: Job[];
}

export interface CustomerPicture {
  user: User;
  cars: CarPicture[];
  subscription: Subscription | null;
  /** Every subscription this owner has held, newest first. The record. */
  subscriptions: Subscription[];
  /** This owner's invoices - the papers a chapter hands over. */
  invoices: Invoice[];
  /**
   * WHAT THE STUDIO HAS SENT THEM.
   *
   * NOT so a list can be drawn - §17.1 forbids one, and the enforcement test
   * still stands. Read so that an UNREAD record can be resolved to the surface
   * that owns the fact it is about (§17.3) and surfaced there as state. Forty-
   * two of these had been written and nothing in the customer application read
   * one, so a car that was ready to collect said so only in a push the customer
   * may never have seen.
   */
  notifications: Notification[];
  /** Consulted only to capture terms that were never recorded. */
  catalogue: Service[];
  /**
   * WHERE THE STUDIO MAY COLLECT FROM - design screens 08 and 19.
   *
   * Part of the one read rather than fetched by the two surfaces that need it,
   * so the booking sheet's chips and the settings list can never disagree
   * about which address is the default.
   */
  addresses: SavedAddress[];
  /**
   * MID-VISIT REQUESTS WAITING ON THIS CUSTOMER - design screen 12.
   *
   * Read with the picture so a car on a bay can WEAR the question rather than
   * relying on a push having been seen. A notification the customer missed is
   * a car held for a day on a question nobody asked out loud.
   */
  approvals: Approval[];
}

export type CustomerState =
  /** §19.1 - loading is a state, not an absence. */
  | { status: 'loading' }
  | { status: 'anonymous' }
  /** §20.2 - always recoverable. */
  | { status: 'failed'; retry: () => void }
  | { status: 'ready'; picture: CustomerPicture };

/**
 * The whole read, as a function. Separated from the hook so the orchestration
 * can be tested without a renderer - the hook does React, this does data.
 */
export async function loadPicture(user: User): Promise<CustomerPicture> {
  const [vehicles, subscription, catalogue, notifications] = await Promise.all([
    getVehicles(user.uid),
    getUserSubscription(user.uid),
    getServices(),
    /* The existing reader, reused. Rules already scope it to its owner. */
    getUserNotifications(user.uid),
  ]);

  /* A customer has a handful of cars, so this is a handful of parallel queries
     rather than an N+1 walk over a collection. */
  const cars = await Promise.all(vehicles.map(async (vehicle): Promise<CarPicture> => {
    const [protections, declarations, visits, bookings, jobs] = await Promise.all([
      getProtections(vehicle.id),
      getDeclarations(vehicle.id),
      getVisitsForVehicle(vehicle.id),
      /* §P1.6 - the ID, never the plate. See lib/server/customerPicture.ts. */
      getBookingsForVehicle(vehicle.id, user.uid),
      getJobsForVehicle(vehicle.id, user.uid),
    ]);
    return { vehicle, protections, declarations, visits, bookings, jobs };
  }));

  return {
    user, cars, subscription,
    subscriptions: subscription ? [subscription] : [],
    invoices: [], notifications, catalogue,
    /* The client twin is the legacy read path - every customer room renders on
       the server now (`lib/server/customerPicture.ts`), and only `Room.tsx`
       still calls this. Addresses are deliberately not fetched here rather
       than half-fetched: a surface that needs them is a server-rendered one. */
    addresses: [],
    approvals: [],
  };
}

export function useCustomerPicture(): CustomerState {
  const user = useAppStore(s => s.user);
  const authLoading = useAppStore(s => s.authLoading);
  const [state, setState] = useState<CustomerState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (authLoading) { setState({ status: 'loading' }); return; }
    if (!user) { setState({ status: 'anonymous' }); return; }

    let live = true;
    setState({ status: 'loading' });

    (async () => {
      try {
        const picture = await loadPicture(user);
        if (!live) return;
        setState({ status: 'ready', picture });
      } catch (err) {
        if (!live) return;
        /* §20.3 - "distinguish ours from theirs." A swallowed read error is one
           nobody can diagnose; the customer still sees the recoverable state,
           but the cause reaches the console in development. */
        if (process.env.NODE_ENV !== 'production') {
          console.error('[customer] could not load the picture', err);
        }
        setState({ status: 'failed', retry: () => setAttempt(n => n + 1) });
      }
    })();

    return () => { live = false; };
  }, [user, authLoading, attempt]);

  return state;
}
