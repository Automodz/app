/**
 * THE CUSTOMER'S PICTURE - the SHAPE, and nothing that fetches it.
 *
 * Every customer room needs an overlapping slice of the same things: the
 * person, their cars, what protects each car, what has happened to each car,
 * and the membership. One shape, so seven routes cannot disagree about one car
 * (§22.2, §22.5 - truth is not recomputed).
 *
 * ── WHY THIS IS A FILE OF ITS OWN ────────────────────────────────────────
 * These interfaces lived in `lib/customer/source.ts`, beside the CLIENT read
 * that produced them - a `'use client'` module importing eight Firebase
 * service modules. Every projection and every screen imports the shape, and a
 * type import is erased, so nothing was actually shipping the SDK; but the two
 * were one edit apart from each other, and the whole point of moving the rooms
 * onto the server was that the customer bundle carries no Firestore client at
 * all (`lib/server/customerPicture`).
 *
 * The client read is gone - its last caller was the client `Room`, which
 * `ServerRoom` replaced - so what is left is the shape, and it belongs
 * somewhere that cannot import a fetcher by accident. This file imports the
 * domain types and nothing else, and it never will.
 */
import type {
  Approval, Booking, Declaration, Invoice, Job, Notification, Protection,
  SavedAddress, Service, Subscription, User, Vehicle, Visit,
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

/* `CustomerState` STOOD HERE - loading / anonymous / failed / ready. Those are
   the four answers a CLIENT fetch gives, and there is no client fetch: a room
   renders on the server, so the request either has the picture or it does not
   and `ServerRoom` says which (§19.1's best version is a room that was never
   absent). It went with the read it described. */
