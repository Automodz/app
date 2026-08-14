/**
 * NAVIGATION
 *
 * Source of truth: docs/AUTOMODZ-OS.md §6
 *
 * The application's wayfinding: where you are, how you move, and when the
 * navigation gets out of the way. It knows the seven rooms and nothing else -
 * no vehicles, no visits, no memberships, no data of any kind.
 *
 * HOW THE SEVEN ROOMS ARE SUPPORTED WITH FOUR SLOTS
 *
 *   Now · Garage · History · You        four slots        §6.2
 *   Arrange a visit → Studio            primary action    §6.3
 *   Vehicle                             reached from the Garage   §12.2
 *   Membership                          reached from protection   §15.2
 *
 * Every route still maps to exactly one navigation element through
 * `activates`, so §6.2's promise - "always shows where the customer is" -
 * holds in all seven rooms, including the two without a slot.
 *
 * WHAT THIS DOES NOT DO
 * It does not redirect on launch. §6.6 says a cold launch returns the customer
 * to the room they were last in; the provider REMEMBERS that room and offers
 * it, but acting on it belongs to whoever owns the shell. There is no layout
 * here to make that decision in.
 */

export { CustomerChrome } from './CustomerChrome';
export { NavigationProvider, useNavigation, useTakeover } from './NavigationProvider';
export { BottomNavigation } from './BottomNavigation';
export { StudioMark } from './StudioMark';
export type { StudioMarkProps } from './StudioMark';

export {
  rooms, slots, primaryAction,
  roomFor, chromeFor, activeSlotFor,
  HOME, GARAGE, VEHICLE, HISTORY, STUDIO, MEMBERSHIP, PROFILE,
} from './routes';
export type { Room, Concept, Chrome } from './routes';
export { PaletteProvider, PaletteFeed, useOpenPalette } from './Palette';
