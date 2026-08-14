/**
 * THE FIRST ARRIVAL, SHAPED FOR THE SCREEN.
 *
 * Source: docs/AUTOMODZ-OS-ARCHITECTURE.md §1 - the projection owns the
 * wording, the engine owns the decisions, and the renderer draws what it is
 * handed.
 *
 * Every address here comes from `navigation/resolve`. The step addresses are
 * built by the resolver too (`?step=`), which is what makes the flow
 * deep-linkable and the back button work: each step is a real history entry,
 * not a value in component state.
 */
import type { CustomerPicture } from './source';
import { STEPS, stepIndex, nextStep, type WelcomeStep } from '@/lib/os/welcome';
import { hrefForDestination } from '@/navigation/resolve';
import { COMPANY } from '@/lib/company';

/** One of the three rooms, as the arrival explains it. */
export interface WelcomeRoom {
  name: string;
  line: string;
  href: string;
}

export interface WelcomePanel {
  step: WelcomeStep;
  title: string;
  line?: string;
  /** The rooms, on the one step that names them. */
  rooms?: WelcomeRoom[];
  /** What the forward control says. */
  forward: string;
  /** What passing over this step says, or absent when it cannot be passed. */
  pass?: string;
  /** Where forward goes, when it is a step rather than an act. */
  forwardHref?: string;
  passHref?: string;
}

export interface WelcomeModel {
  /** Who is arriving. Empty when the profile has no name yet. */
  greeting: string;
  panel: WelcomePanel;
  /** Which of how many - for the accessible name, never as progress dots. */
  position: { index: number; total: number };
  /** Where the arrival ends. */
  homeHref: string;
  /** Where "yes, I have a car" goes. */
  addCarHref: string;
  /** True when this customer already has a car - the last step changes. */
  hasCar: boolean;
}

const stepHref = (step: WelcomeStep, forced: boolean) =>
  hrefForDestination({ to: 'welcome.step', step, forced });

/**
 * THE THREE ROOMS, said once.
 *
 * The product's own names for them, with what each actually holds - the point
 * of this step is that a customer who has just arrived can tell where a thing
 * will be before they go looking for it.
 */
const roomsOf = (): WelcomeRoom[] => [
  {
    name: 'My Car',
    line: 'The car itself - its photographs, its papers, what protects it.',
    href: hrefForDestination({ to: 'garage' }),
  },
  {
    name: 'My Studio',
    line: 'Where visits are arranged, and where you follow one while it happens.',
    href: hrefForDestination({ to: 'studio' }),
  },
  {
    name: 'My Ownership',
    line: 'Everything that has been done, kept in order, for as long as you own it.',
    href: hrefForDestination({ to: 'history' }),
  },
];

const PANELS: Record<WelcomeStep, (ctx: { name: string; hasCar: boolean }) => Omit<WelcomePanel, 'step' | 'forwardHref' | 'passHref'>> = {
  hello: () => ({
    title: `Welcome to ${COMPANY.name}.`,
    line: 'This is where your car lives - its care, its protection, its story. '
      + 'It takes a minute to show you round.',
    forward: 'Show me',
  }),

  rooms: () => ({
    title: 'Three places, and that is all.',
    line: 'Nothing here is buried. Everything you need is one of these.',
    rooms: roomsOf(),
    forward: 'Go on',
    pass: 'Skip',
  }),

  record: () => ({
    title: 'We keep the record.',
    line: 'Every visit, every warranty, every photograph - written down as it '
      + 'happens and kept for as long as you own the car. You never have to '
      + 'remember what was done or when. It is already here.',
    forward: 'Good',
    pass: 'Skip',
  }),

  notifications: () => ({
    title: 'Shall we tell you things?',
    line: 'When your car is ready, when a warranty is running out, when a visit '
      + 'is confirmed. Nothing else, and you can change your mind any time in You.',
    forward: 'Yes, tell me',
    pass: 'Not now',
  }),

  car: ({ hasCar }) => (hasCar
    ? {
      title: 'Your car is already here.',
      line: 'Everything else follows from it.',
      forward: 'Take me in',
    }
    : {
      title: 'Do you have a car already?',
      line: 'Add it and everything else follows - its protection, its visits, '
        + 'its record. If not, that is fine; you can add one whenever you like.',
      forward: 'Yes, add it',
      pass: 'Not yet',
    }),
};

export function toWelcome(
  picture: CustomerPicture, step: WelcomeStep, forced = false,
): WelcomeModel {
  const hasCar = picture.cars.length > 0;
  const name = picture.user.name?.trim().split(' ')[0] ?? '';
  const body = PANELS[step]({ name, hasCar });
  const after = nextStep(step);

  return {
    greeting: name,
    panel: {
      ...body,
      step,
      /* The forward control is a LINK to the next step wherever there is one,
         so it lands in history and Back returns. Only the last step is an act
         rather than an address. */
      forwardHref: after ? stepHref(after, forced) : undefined,
      passHref: body.pass && after ? stepHref(after, forced) : undefined,
    },
    position: { index: stepIndex(step) + 1, total: STEPS.length },
    homeHref: hrefForDestination({ to: 'home' }),
    addCarHref: hrefForDestination({ to: 'garage.add' }),
    hasCar,
  };
}
