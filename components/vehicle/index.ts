/**
 * THE VEHICLE RENDERER BOUNDARY · §11.3
 *
 * Deliberately NOT in `components/system`. That layer is domain-free - "no
 * component may know about cars, memberships, bookings or AutoModz" - and a
 * region called "the wheels" is exactly that knowledge. It is equally not in
 * `components/screens`, because it is not a screen: it is the seam a screen is
 * written against, and the point of §11.3 is that the seam outlives whatever
 * is on either side of it.
 */
export type {
  RegionId, RenderedRegion, RenderingProps, VehicleRendering,
} from './renderer';
export { REGION_NAME, inReadingOrder } from './renderer';

export { photograph } from './photograph';
export type { PhotographSource } from './photograph';
