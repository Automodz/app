/**
 * THE TIMELINE — an OS object.
 *
 * Source: docs/AUTOMODZ-OS-ARCHITECTURE.md §2, §3
 *
 * It lived in `lib/customer/` first, projected inside Home's model. That was
 * wrong: a record of ownership is not a feature of one screen. It is one of the
 * seven objects, emitted from the same sources as the rest, and consumed by
 * Home, Vehicle, History and Notifications without any of them owning it.
 *
 * This replaces "Journey", and the rename is not cosmetic. A journey is a
 * chronological log of things that happened; a timeline is the ownership
 * position of a car laid out in time, and it therefore runs FORWARD as well as
 * back. A visit booked for next Tuesday and a warranty that lapses in March are
 * both timeline events, and both sort above today.
 *
 * It is a projection of the same seven objects every other surface projects —
 * Car, Protection, Visit, Membership — so it is reusable on Home, on the
 * Vehicle, and on History without any of them owning it.
 *
 * WHAT IT DOES NOT DO: it derives no lifecycle of its own. Health comes from
 * `os/term`, visit phase from `os/visit`, membership state from `os/club`.
 * This file only decides what is worth a line and how it is worded.
 */
import type { Booking } from '@/lib/types';
import { PROTECTION_TITLE } from '@/lib/types';
import type { LiveProtection } from './protection';
import type { ClubModel } from './club';
import type { CarPicture } from '@/lib/customer/source';
import { visitPhase } from './visit';
import { completedOf, nextVisitOf, declinedOf } from '@/lib/customer/ownership';

export type TimelineKind =
  | 'acquired'
  | 'visit_booked'
  | 'visit_completed'
  | 'visit_declined'
  | 'protection_started'
  | 'protection_expiring'
  | 'protection_lapsed'
  | 'membership_started'
  | 'membership_renewed'
  | 'membership_lapsed';

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  /** When it happened, or when it will. Drives sort and the "ahead" split. */
  at: Date;
  /** The customer's words. Never a status code. */
  title: string;
  /** One quiet sentence, when there is one worth saying. */
  line?: string;
  /**
   * WHAT the event is about, never WHERE it lives. An engine that knew
   * `/history/…` could not be reused by the operations application, where the
   * same visit lives somewhere else (ARCHITECTURE §4). The projection resolves
   * this into an address.
   */
  ref?: { object: 'visit' | 'membership'; id?: string };
  /** True when `at` is in the future — the timeline runs forward too. */
  ahead: boolean;
}

const dateOf = (iso?: string): Date | null => {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const millisOf = (t: unknown): number =>
  (t as { toMillis?: () => number })?.toMillis?.() ?? 0;

/** The day a dated term ends, or null for the shapes that never end. */
const endOf = (p: LiveProtection): Date | null =>
  p.term.kind === 'dated' ? dateOf(p.term.expiresOn) : null;

function visitEvent(b: Booking, kind: TimelineKind, title: string, line?: string): TimelineEvent | null {
  const at = dateOf(b.scheduledDate);
  if (!at) return null;
  return {
    id: `${kind}_${b.id}`,
    kind, at, title, line,
    ref: { object: 'visit', id: b.id },
    ahead: at.getTime() > Date.now(),
  };
}

export interface TimelineInput {
  car: CarPicture;
  protections: LiveProtection[];
  club: ClubModel;
  now?: Date;
}

/**
 * Every event worth a line, newest first, with future events above the present.
 *
 * Sorting is a single descending pass on time: because a booked visit is dated
 * ahead of now, it lands at the top naturally. No separate "upcoming" list is
 * needed, and there is therefore no way for the two to disagree.
 */
export function projectTimeline({ car, protections, club, now = new Date() }: TimelineInput): TimelineEvent[] {
  const out: TimelineEvent[] = [];

  /* ── the car itself ── */
  const acquired = millisOf(car.vehicle.createdAt);
  if (acquired) {
    out.push({
      id: `acquired_${car.vehicle.id}`,
      kind: 'acquired',
      at: new Date(acquired),
      title: 'Added to the garage',
      ahead: false,
    });
  }

  /* ── visits ── */
  for (const b of completedOf(car)) {
    const e = visitEvent(b, 'visit_completed', `${b.serviceName} completed`);
    if (e) out.push(e);
  }

  const booked = nextVisitOf(car, now);
  if (booked) {
    const confirmed = visitPhase(booked.status) === 'agreed';
    const e = visitEvent(
      booked,
      'visit_booked',
      confirmed ? 'Visit booked' : 'Visit requested',
      booked.scheduledTime ? `${booked.serviceName}, ${booked.scheduledTime}` : booked.serviceName,
    );
    if (e) out.push(e);
  }

  const refused = declinedOf(car, now.getTime());
  if (refused) {
    const e = visitEvent(
      refused,
      'visit_declined',
      refused.noShow ? 'Slot missed' : 'Visit not taken',
      refused.rejectionReason ?? undefined,
    );
    if (e) out.push(e);
  }

  /* ── protections: when each began, and when it ends ── */
  for (const p of protections) {
    const word = PROTECTION_TITLE[p.kind];
    const began = dateOf(p.since);
    if (began) {
      out.push({
        id: `protection_started_${p.id}`,
        kind: 'protection_started',
        at: began,
        title: `${word} applied`,
        line: p.provider,
        ref: p.visitId ? { object: 'visit', id: p.visitId } : undefined,
        ahead: false,
      });
    }

    const ends = endOf(p);
    if (!ends) continue;
    const lapsed = p.health === 'lapsed';
    out.push({
      id: `protection_${lapsed ? 'lapsed' : 'expiring'}_${p.id}`,
      kind: lapsed ? 'protection_lapsed' : 'protection_expiring',
      at: ends,
      title: lapsed ? `${word} lapsed` : `${word} expires`,
      ahead: ends.getTime() > now.getTime(),
    });
  }

  /* ── membership: the relationship, not the car ── */
  const since = dateOf(club.since ?? undefined);
  if (since) {
    out.push({
      id: 'membership_started',
      kind: 'membership_started',
      at: since,
      title: 'Membership started',
      line: club.plan ?? undefined,
      ref: { object: 'membership' },
      ahead: false,
    });
  }

  const renews = dateOf(club.renewsOn ?? undefined);
  if (renews) {
    const gone = club.state === 'lapsed';
    out.push({
      id: `membership_${gone ? 'lapsed' : 'renewed'}`,
      kind: gone ? 'membership_lapsed' : 'membership_renewed',
      at: renews,
      title: gone ? 'Membership lapsed' : 'Membership renews',
      line: club.context ?? undefined,
      ref: { object: 'membership' },
      ahead: renews.getTime() > now.getTime(),
    });
  }

  return out.sort((a, b) => b.at.getTime() - a.at.getTime());
}
