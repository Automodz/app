/**
 * FIRST ARRIVAL - the engine.
 *
 * Source: docs/AUTOMODZ-OS-ARCHITECTURE.md §1 - engines decide, and this one is
 * pure: no React, no routes, no Firestore, no `localStorage`.
 *
 * WHAT THIS REPLACED. The flag was `localStorage['automodz-welcomed']`, written
 * and read on the device. Three things followed from that and all three were
 * wrong: the same customer signing in on a second device was welcomed again;
 * clearing browser data re-triggered it forever; and the studio had no way to
 * reset it for someone who asked. The flag now lives on the user document and
 * this file only decides what to do with it.
 *
 * IT IS NOT ONBOARDING. There is no tutorial, no progress dots, no
 * skip-forever. It is one arrival: who we are, what the three rooms hold, that
 * the record is kept, whether to be told things, and whether there is a car
 * yet. Every step after the first may be passed over.
 */

/** The steps, in order. The order IS the flow - there is no branching state. */
export const STEPS = ['hello', 'rooms', 'record', 'notifications', 'car'] as const;
export type WelcomeStep = (typeof STEPS)[number];

/** Whatever the URL said, resolved to a step that exists. */
export const stepFrom = (raw: string | null | undefined): WelcomeStep =>
  (STEPS as readonly string[]).includes(raw ?? '') ? (raw as WelcomeStep) : 'hello';

export const stepIndex = (step: WelcomeStep): number => STEPS.indexOf(step);

/** The step after this one, or null when this is the last. */
export const nextStep = (step: WelcomeStep): WelcomeStep | null =>
  STEPS[stepIndex(step) + 1] ?? null;

export interface FirstRunFacts {
  /** Set once the customer has finished. Absent means they have not. */
  welcomedAt?: unknown;
  /** A garage with a car in it is proof of a previous arrival on its own. */
  vehicleCount: number;
  /** `?welcome=1` - the reset path, for the studio and for development. */
  forced?: boolean;
}

/**
 * Should this customer be welcomed?
 *
 * `forced` wins over everything, because that is what makes a reset a reset.
 * Otherwise a recorded arrival settles it, and failing that a car in the garage
 * does - someone with a car has plainly been here before, whatever the flag
 * says, and walking them through an arrival would be the product forgetting
 * them.
 */
export const shouldWelcome = (f: FirstRunFacts): boolean => {
  if (f.forced) return true;
  if (f.welcomedAt) return false;
  return f.vehicleCount === 0;
};

/**
 * May the welcome interrupt at this address?
 *
 * Only from Home. Interrupting someone reading their own history to walk them
 * through an arrival is the application talking over the customer.
 */
export const welcomeInterrupts = (pathname: string): boolean => pathname === '/';
