'use client';
/**
 * THE CUSTOMER'S PICTURE — one read, one place.
 *
 * Every customer room needs an overlapping slice of the same things: the
 * person, their cars, what protects each car, what has happened to each car,
 * and the membership. Seven routes each fetching their own slice would be seven
 * chances to disagree about one car (§22.2, §22.5 — truth is not recomputed).
 *
 * This fetches. It derives nothing — `project.ts` does that, from what is here.
 *
 * ── WHY BOOKINGS AND JOBS ARE STILL READ ─────────────────────────────────
 * `visits` is the anchor, but nothing writes to it yet: `writeDerivedVisit`
 * has no caller outside its own service. Reading only `visits` would show every
 * existing customer an empty History. So both are loaded and `project.ts`
 * prefers stored visits, falling back to the Booking+Job pair through the
 * service's own `visitFromPair` — the documented migration read path, using the
 * same projection the migration will persist.
 */
import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { getVehicles, getJobsForVehicle, getBookingsForVehicle } from '@/lib/services/vehicles';
import { getProtections } from '@/lib/services/protections';
import { getVisitsForVehicle } from '@/lib/services/visits';
import { getUserSubscription } from '@/lib/services/subscriptions';
import { getServices } from '@/lib/services/services';
import type {
  Booking, Job, Protection, Service, Subscription, User, Vehicle, Visit,
} from '@/lib/types';

/** Everything known about one car. */
export interface CarPicture {
  vehicle: Vehicle;
  protections: Protection[];
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
  /** Consulted only to capture terms that were never recorded. */
  catalogue: Service[];
}

export type CustomerState =
  /** §19.1 — loading is a state, not an absence. */
  | { status: 'loading' }
  | { status: 'anonymous' }
  /** §20.2 — always recoverable. */
  | { status: 'failed'; retry: () => void }
  | { status: 'ready'; picture: CustomerPicture };

/**
 * The whole read, as a function. Separated from the hook so the orchestration
 * can be tested without a renderer — the hook does React, this does data.
 */
export async function loadPicture(user: User): Promise<CustomerPicture> {
  const [vehicles, subscription, catalogue] = await Promise.all([
    getVehicles(user.uid),
    getUserSubscription(user.uid),
    getServices(),
  ]);

  /* A customer has a handful of cars, so this is a handful of parallel queries
     rather than an N+1 walk over a collection. */
  const cars = await Promise.all(vehicles.map(async (vehicle): Promise<CarPicture> => {
    const [protections, visits, bookings, jobs] = await Promise.all([
      getProtections(vehicle.id),
      getVisitsForVehicle(vehicle.id),
      getBookingsForVehicle(vehicle.registrationNumber, user.uid),
      getJobsForVehicle(vehicle.registrationNumber, user.uid),
    ]);
    return { vehicle, protections, visits, bookings, jobs };
  }));

  return { user, cars, subscription, catalogue };
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
        /* §20.3 — "distinguish ours from theirs." A swallowed read error is one
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
